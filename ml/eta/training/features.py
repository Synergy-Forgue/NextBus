"""
training/features.py — Feature Engineering for NXTBus ETA Prediction
======================================================================
All feature engineering lives here.  This module contains only pure
functions with no side effects: given inputs, return outputs, no I/O.

The FEATURE_NAMES list defines the authoritative feature order.  Both
training (train.py) and serving (predictor.py) must use this exact order.
Any drift between training-time and inference-time order produces silently
wrong predictions.

Every public function has a Google-style docstring explaining:
  - What the feature measures.
  - Why it matters for ETA prediction.
  - Fallback behaviour when data is missing.

All distances are in kilometres.
All speeds are in km/h.
All times are in minutes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import numpy as np
import pandas as pd
from geopy.distance import geodesic
from sklearn.preprocessing import LabelEncoder

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature name registry — SINGLE SOURCE OF TRUTH
# ---------------------------------------------------------------------------

FEATURE_NAMES: list[str] = [
    "distance_to_stop_km",       # 0
    "stops_remaining",            # 1
    "current_speed_kmh",          # 2
    "rolling_avg_speed_5",        # 3
    "rolling_avg_speed_10",       # 4
    "speed_variance",             # 5
    "hour_of_day",                # 6
    "minute_of_hour",             # 7
    "day_of_week",                # 8
    "is_weekday",                 # 9
    "is_peak_hour",               # 10
    "route_id_encoded",           # 11
    "direction",                  # 12
    "occupancy_ratio",            # 13
    "congestion_index",           # 14
    "segment_hist_speed",         # 15
    "hist_avg_dwell_at_next",     # 16
]

assert len(FEATURE_NAMES) == 17, "FEATURE_NAMES must have exactly 17 entries"


# ---------------------------------------------------------------------------
# Stop arrival radius constant
# ---------------------------------------------------------------------------

ARRIVAL_RADIUS_METERS: float = 60.0  # A bus is "at" a stop within 60 metres


# ---------------------------------------------------------------------------
# 1. distance_to_stop_km
# ---------------------------------------------------------------------------


def compute_distance_to_stop_km(
    bus_lat: float,
    bus_lng: float,
    stop_lat: float,
    stop_lng: float,
) -> float:
    """Compute geodesic (great-circle) distance from bus to target stop.

    **What it measures**: Straight-line distance in kilometres from the bus's
    current GPS position to the target stop's GPS coordinates.

    **Why it matters for ETA**: The most fundamental predictor of arrival time.
    Longer distance → higher ETA, all else being equal. Used in both the v1
    formula (directly) and as the strongest feature in v2 XGBoost.

    Uses geopy.distance.geodesic (WGS-84 ellipsoid) for accuracy. Do NOT
    use haversine directly — geodesic is more accurate over Visakhapatnam's
    scale and is already a project dependency.

    Args:
        bus_lat:  Current bus latitude (decimal degrees, WGS-84).
        bus_lng:  Current bus longitude (decimal degrees, WGS-84).
        stop_lat: Target stop latitude.
        stop_lng: Target stop longitude.

    Returns:
        Distance in kilometres (float, always ≥ 0).
    """
    return float(
        geodesic((bus_lat, bus_lng), (stop_lat, stop_lng)).km
    )


# ---------------------------------------------------------------------------
# 2. stops_remaining
# ---------------------------------------------------------------------------


def compute_stops_remaining(
    current_lat: float,
    current_lng: float,
    target_stop_id: str,
    route_stops: list[dict],
) -> int:
    """Count intermediate stops between the bus's current position and target.

    **What it measures**: The number of stops the bus must service (board/alight
    passengers) before reaching the target stop, excluding the bus's current
    nearest stop and the target itself.

    **Why it matters for ETA**: Each intermediate stop adds dwell time (~0.75 min).
    A bus 3 stops away but 2 km closer than another might still arrive later
    due to cumulative dwell time. This feature captures that.

    Algorithm:
        1. Find the route stop closest to the current GPS position (nearest stop).
        2. Find the stop_order of the target stop.
        3. Return the count of stops with stop_order strictly between
           nearest_order and target_order.

    Args:
        current_lat:    Current bus latitude.
        current_lng:    Current bus longitude.
        target_stop_id: Unique ID of the destination stop.
        route_stops:    List of dicts with keys: stop_id, stop_order, lat, lng.
                        Must be the stops for the bus's current route.

    Returns:
        Number of intermediate stops (int, ≥ 0). Returns 0 if route_stops
        is empty or target_stop_id is not in the route.
    """
    if not route_stops:
        return 0

    # Find the target stop's order
    target_order: Optional[int] = None
    for rs in route_stops:
        if rs["stop_id"] == target_stop_id:
            target_order = rs["stop_order"]
            break

    if target_order is None:
        return 0

    # Find the nearest stop's order
    min_dist = float("inf")
    nearest_order = 0
    for rs in route_stops:
        dist = geodesic(
            (current_lat, current_lng),
            (rs["lat"], rs["lng"]),
        ).km
        if dist < min_dist:
            min_dist = dist
            nearest_order = rs["stop_order"]

    if target_order <= nearest_order:
        return 0

    return sum(
        1 for rs in route_stops
        if nearest_order < rs["stop_order"] < target_order
    )


# ---------------------------------------------------------------------------
# 3. rolling_avg_speed (window=5 and window=10)
# ---------------------------------------------------------------------------


def compute_rolling_avg_speed(
    gps_df: pd.DataFrame,
    bus_id: str,
    window: int = 10,
    fallback_kmh: float = 25.0,
) -> float:
    """Compute rolling average speed over the last N GPS records for a bus.

    **What it measures**: The mean speed of the bus over its most recent N
    GPS records. More stable than instantaneous speed and less noisy than
    a long historical average.

    **Why it matters for ETA**: Recent average speed is the best proxy for
    how fast the bus is currently moving through traffic. It smooths out
    brief stops at traffic lights while reflecting current congestion. Used
    in two variants: window=5 (very recent) and window=10 (slightly broader).

    **Fallback**: Returns `fallback_kmh` if fewer than `window` records exist
    for this bus. This occurs for new buses or buses that recently came online.

    Args:
        gps_df:       DataFrame with columns: bus_id, speed_kmh, recorded_at.
        bus_id:       Filter to this bus only.
        window:       Number of most-recent records to average.
        fallback_kmh: Speed to return when insufficient records exist.

    Returns:
        Average speed in km/h (float).
    """
    bus_records = gps_df[gps_df["bus_id"] == bus_id].copy()
    bus_records = bus_records.dropna(subset=["speed_kmh"])

    if len(bus_records) < window:
        _log.debug(
            "Rolling avg speed: bus=%s has only %d records (need %d), using fallback %.1f",
            bus_id, len(bus_records), window, fallback_kmh,
        )
        return fallback_kmh

    # Sort ascending by time, take last N records
    bus_records = bus_records.sort_values("recorded_at", ascending=True)
    recent = bus_records.tail(window)
    return float(recent["speed_kmh"].mean())


# ---------------------------------------------------------------------------
# 4. speed_variance
# ---------------------------------------------------------------------------


def compute_speed_variance(
    gps_df: pd.DataFrame,
    bus_id: str,
    window: int = 10,
    fallback: float = 0.0,
) -> float:
    """Compute variance of speed over the last N GPS records for a bus.

    **What it measures**: The variability of the bus's speed over recent records.
    High variance = bus is frequently stopping and starting (traffic jam, many
    stops). Low variance = bus is moving at a steady pace.

    **Why it matters for ETA**: Speed variance is a proxy for traffic congestion
    and stop density. A bus with high speed variance will have higher, less
    predictable ETAs. XGBoost can use this to adjust predictions upward when
    the bus is in stop-start traffic.

    Args:
        gps_df:  DataFrame with columns: bus_id, speed_kmh, recorded_at.
        bus_id:  Filter to this bus only.
        window:  Number of most-recent records to use.
        fallback: Value to return when insufficient data (default 0.0 = smooth).

    Returns:
        Population variance of speeds (float, ≥ 0).
    """
    bus_records = gps_df[gps_df["bus_id"] == bus_id].copy()
    bus_records = bus_records.dropna(subset=["speed_kmh"])

    if len(bus_records) < 2:
        return fallback

    bus_records = bus_records.sort_values("recorded_at", ascending=True)
    recent = bus_records.tail(window)
    return float(np.var(recent["speed_kmh"].values))


# ---------------------------------------------------------------------------
# 5. temporal features
# ---------------------------------------------------------------------------


def compute_temporal_features(timestamp: datetime) -> dict[str, int]:
    """Extract temporal features from a UTC datetime.

    **What they measure**: The time-of-day and day-of-week context of the
    prediction. Bus travel times are heavily influenced by time:
      - Morning peak (8–10am): heavy congestion, buses are slower.
      - Evening peak (5–7pm): heaviest congestion in Visakhapatnam.
      - Midnight: roads are clear, buses move faster.
      - Weekdays vs weekends: weekdays have heavier commuter traffic.

    **Why they matter for ETA**: XGBoost can learn time-dependent patterns
    that the v1 rule-based formula ignores entirely. For example: the 8am
    trip from Gajuwaka to RLY Station is consistently 20% slower than the
    same trip at 11am.

    Args:
        timestamp: A timezone-aware datetime (UTC preferred).

    Returns:
        Dict with keys:
          hour_of_day    (int 0–23)
          minute_of_hour (int 0–59)
          day_of_week    (int 0=Mon, 6=Sun)
          is_weekday     (int 0 or 1)
    """
    # Ensure we work in UTC
    if timestamp.tzinfo is not None:
        ts_utc = timestamp.astimezone(timezone.utc)
    else:
        ts_utc = timestamp

    is_weekday = 1 if ts_utc.weekday() < 5 else 0

    return {
        "hour_of_day": ts_utc.hour,
        "minute_of_hour": ts_utc.minute,
        "day_of_week": ts_utc.weekday(),
        "is_weekday": is_weekday,
    }


# ---------------------------------------------------------------------------
# 6. is_peak_hour
# ---------------------------------------------------------------------------


def compute_is_peak_hour(hour_of_day: int) -> int:
    """Determine if the given hour falls within a Visakhapatnam peak period.

    **What it measures**: A binary flag indicating whether the prediction is
    being made during a high-traffic period. Peak hours in Visakhapatnam:
      - Morning peak: 8:00–9:59am (office commute start)
      - Evening peak: 5:00–6:59pm (office commute return)

    **Why it matters for ETA**: Peak hour is the single most important
    categorical factor for ETA. Bus travel times in Visakhapatnam during
    peak hours can be 30–50% longer than off-peak. XGBoost will learn this
    interaction automatically when this feature is included.

    Args:
        hour_of_day: Integer hour in [0, 23] (UTC).

    Returns:
        1 if peak hour, 0 otherwise (int, never bool).
    """
    is_morning_peak = 8 <= hour_of_day < 10
    is_evening_peak = 17 <= hour_of_day < 19
    return int(is_morning_peak or is_evening_peak)


# ---------------------------------------------------------------------------
# 7. occupancy_ratio
# ---------------------------------------------------------------------------


def compute_occupancy_ratio(occupancy_count: int, capacity: int) -> float:
    """Compute the bus load factor as a ratio in [0.0, 1.0].

    **What it measures**: What fraction of the bus's passenger capacity is
    currently occupied. 0.0 = empty bus, 1.0 = full bus.

    **Why it matters for ETA**: A heavily loaded bus spends more time at each
    stop (more passengers boarding/alighting). High occupancy_ratio correlates
    with longer dwell times and therefore higher ETAs. This feature helps
    XGBoost adjust predictions for crowded services.

    Args:
        occupancy_count: Current number of passengers on the bus.
        capacity:        Maximum passenger capacity of the bus.

    Returns:
        Float in [0.0, 1.0]. Returns 0.5 if capacity == 0 (missing data).
        Capped at 1.0 if occupancy exceeds capacity (overcrowding).
    """
    if capacity <= 0:
        _log.debug("compute_occupancy_ratio: capacity=0, using fallback 0.5")
        return 0.5
    ratio = occupancy_count / capacity
    return float(min(1.0, max(0.0, ratio)))


# ---------------------------------------------------------------------------
# 8. congestion_index
# ---------------------------------------------------------------------------


def compute_congestion_index(
    current_speed_kmh: float,
    segment_hist_speed_kmh: float,
    max_index: float = 3.0,
) -> float:
    """Compute a congestion index as current speed / historical average speed.

    **What it measures**: How the bus's current speed compares to the historical
    average speed for this road segment at this time of day.

      congestion_index < 1.0 → bus is slower than historical (congestion)
      congestion_index = 1.0 → bus is at historical average (normal)
      congestion_index > 1.0 → bus is faster than historical (clear road)

    **Why it matters for ETA**: This is the most direct measure of current
    congestion. A bus crawling at 10 km/h on a segment that historically runs
    at 40 km/h is in severe traffic, and the model should predict a higher ETA.
    Using the ratio (not raw speed) makes this feature route-independent.

    Args:
        current_speed_kmh:      Bus's current speed in km/h.
        segment_hist_speed_kmh: Historical average speed for this segment in km/h.
        max_index:              Upper cap on the index (prevents outliers from
                                extreme speeds). Default 3.0.

    Returns:
        Float congestion index. 1.0 if segment_hist_speed_kmh == 0 (no history).
    """
    if segment_hist_speed_kmh <= 0.0:
        return 1.0
    raw_index = current_speed_kmh / segment_hist_speed_kmh
    return float(min(max_index, max(0.0, raw_index)))


# ---------------------------------------------------------------------------
# 9. route_id_encoded
# ---------------------------------------------------------------------------


def fit_route_encoder(route_ids: list[str]) -> LabelEncoder:
    """Fit a LabelEncoder on all known route IDs.

    **What it does**: Converts string route IDs ('28K', '99', '14C', etc.)
    into integer labels that XGBoost can use as a feature.

    **Why LabelEncoder**: Route ID is a nominal categorical variable. We use
    LabelEncoder (not one-hot) because XGBoost handles ordinal/integer
    categoricals well with tree splits, and one-hot encoding for a small
    number of routes would produce sparse, redundant features.

    The encoder is fitted at training time and saved in models/metadata.json
    as a route_encoding dict so it can be reconstructed at inference time
    without loading the sklearn object.

    Args:
        route_ids: List of all known route ID strings.

    Returns:
        Fitted LabelEncoder.
    """
    encoder = LabelEncoder()
    encoder.fit(route_ids)
    return encoder


def encode_route_id(route_id: str, encoder: LabelEncoder) -> int:
    """Encode a single route_id string to an integer.

    Returns 0 for unseen route IDs (graceful handling of new routes).

    Args:
        route_id: Route identifier string (e.g. '28K').
        encoder:  Fitted LabelEncoder from fit_route_encoder().

    Returns:
        Integer label (int).
    """
    try:
        return int(encoder.transform([route_id])[0])
    except ValueError:
        _log.warning("Unknown route_id '%s', encoding as 0.", route_id)
        return 0


# ---------------------------------------------------------------------------
# 10. segment_hist_speed
# ---------------------------------------------------------------------------


def compute_segment_hist_speed(
    lat: float,
    lng: float,
    hour: int,
    segment_speed_df: pd.DataFrame,
    fallback_kmh: float = 25.0,
) -> float:
    """Look up the historical average speed for the GPS grid cell at this hour.

    **What it measures**: The average speed buses have travelled through the
    0.01° × 0.01° grid cell containing (lat, lng) at the same hour ±1 over
    the last 7 days.

    **Why it matters for ETA**: segment_hist_speed captures road-level
    speed patterns. A grid cell near a major intersection may have a
    historical average of 12 km/h at 9am and 45 km/h at 11pm. This feature
    lets the model reason about road-specific congestion patterns rather than
    just the bus's current speed (which is noisy).

    The 0.01° grid is precomputed by extract.py and passed in as a DataFrame
    to keep this function pure (no DB access).

    Args:
        lat:               Current latitude.
        lng:               Current longitude.
        hour:              Current hour of day (UTC).
        segment_speed_df:  DataFrame with columns: grid_lat, grid_lng, hour,
                           avg_speed_kmh. Precomputed from gps_history.
        fallback_kmh:      Speed to return when no history exists for this cell.

    Returns:
        Historical average speed in km/h (float).
    """
    grid_lat = round(lat, 2)
    grid_lng = round(lng, 2)
    hour_low = max(0, hour - 1)
    hour_high = min(23, hour + 1)

    if segment_speed_df.empty:
        return fallback_kmh

    mask = (
        (segment_speed_df["grid_lat"] == grid_lat)
        & (segment_speed_df["grid_lng"] == grid_lng)
        & (segment_speed_df["hour"] >= hour_low)
        & (segment_speed_df["hour"] <= hour_high)
    )
    matched = segment_speed_df[mask]

    if matched.empty:
        return fallback_kmh

    return float(matched["avg_speed_kmh"].mean())


# ---------------------------------------------------------------------------
# 11. extract_stop_arrivals
# ---------------------------------------------------------------------------


def extract_stop_arrivals(
    gps_df: pd.DataFrame,
    stops_df: pd.DataFrame,
    arrival_radius_meters: float = ARRIVAL_RADIUS_METERS,
) -> pd.DataFrame:
    """Derive stop arrival events from raw GPS history.

    **What it does**: Scans every GPS record and determines whether the bus
    was within `arrival_radius_meters` of a known stop. An 'arrival' event
    is created when a GPS record is within the radius AND the immediately
    preceding record was outside the radius (bus just entered the stop zone).

    This logic produces the training labels: for each past moment when we
    could have made a prediction, we know when the bus actually arrived.

    **Why this derivation**: We don't have explicit stop-arrival signals from
    Track B. Instead, we infer arrivals from GPS proximity. The 60m radius
    is chosen to account for GPS accuracy (±15m phone GPS) plus stop-to-road
    offset (stop sign may be 20m from the road GPS trace).

    Args:
        gps_df:                DataFrame from gps_history with columns:
                               bus_id, lat, lng, speed_kmh, recorded_at, occupancy.
        stops_df:              DataFrame of stops with columns: stop_id, lat, lng.
        arrival_radius_meters: Radius within which GPS is considered "at stop".

    Returns:
        DataFrame with columns: bus_id, stop_id, arrival_time, lat, lng.
        Each row is one arrival event.

    Notes:
        - Empty DataFrame is returned if gps_df or stops_df are empty.
        - Only the FIRST record within the radius is counted per approach
          (subsequent records inside the zone are not double-counted).
    """
    if gps_df.empty or stops_df.empty:
        return pd.DataFrame(columns=["bus_id", "stop_id", "arrival_time", "lat", "lng"])

    arrivals: list[dict] = []

    # Sort by bus and time for correct sequential processing
    gps_sorted = gps_df.sort_values(["bus_id", "recorded_at"]).reset_index(drop=True)

    for stop_row in stops_df.itertuples(index=False):
        stop_id = stop_row.stop_id
        stop_lat = float(stop_row.lat)
        stop_lng = float(stop_row.lng)

        # Compute distance of every GPS record to this stop (in metres)
        distances_m = gps_sorted.apply(
            lambda row: geodesic(
                (float(row["lat"]), float(row["lng"])),
                (stop_lat, stop_lng),
            ).meters,
            axis=1,
        )

        within_radius = distances_m <= arrival_radius_meters

        # Process per bus: find transition from outside → inside radius
        for bus_id in gps_sorted["bus_id"].unique():
            bus_mask = gps_sorted["bus_id"] == bus_id
            bus_within = within_radius[bus_mask]
            bus_records = gps_sorted[bus_mask]

            # Find transitions: previous record outside, current record inside
            prev_within = bus_within.shift(1, fill_value=False)
            arrivals_mask = within_radius[bus_mask] & ~prev_within

            for idx in bus_records[arrivals_mask.values].itertuples():
                arrivals.append(
                    {
                        "bus_id": bus_id,
                        "stop_id": stop_id,
                        "arrival_time": idx.recorded_at,
                        "lat": idx.lat,
                        "lng": idx.lng,
                    }
                )

    if not arrivals:
        return pd.DataFrame(columns=["bus_id", "stop_id", "arrival_time", "lat", "lng"])

    return pd.DataFrame(arrivals).sort_values("arrival_time").reset_index(drop=True)


# ---------------------------------------------------------------------------
# 12. build_feature_matrix
# ---------------------------------------------------------------------------


def build_feature_matrix(
    gps_df: pd.DataFrame,
    stops_df: pd.DataFrame,
    route_stops_df: pd.DataFrame,
    target_stop_id: str,
    segment_speed_df: pd.DataFrame,
    route_encoder: Optional[LabelEncoder] = None,
    fallback_speed_kmh: float = 25.0,
    fallback_dwell_minutes: float = 0.75,
) -> pd.DataFrame:
    """Build the full feature matrix from raw DataFrames.

    This is the main entry point for feature engineering during training.
    It takes all raw data sources and produces a DataFrame where each row
    is a GPS record with all 17 features computed.

    The output DataFrame will have all FEATURE_NAMES as columns, plus
    any extra columns present in gps_df (e.g., recorded_at, bus_id).

    **Training pipeline usage**:
        df = build_feature_matrix(gps_df, stops_df, route_stops_df, ...)
        X = df[FEATURE_NAMES].values
        y = df["actual_eta_minutes"].values

    Args:
        gps_df:             Raw GPS history DataFrame. Must have columns:
                            bus_id, lat, lng, speed_kmh, recorded_at, occupancy.
                            Optional: route_id, capacity, heading.
        stops_df:           Stops DataFrame with columns: stop_id, lat, lng.
        route_stops_df:     Route-stop mapping with: route_id, stop_id,
                            stop_order, lat, lng.
        target_stop_id:     The stop we're computing ETA toward.
        segment_speed_df:   Precomputed segment speed lookup with:
                            grid_lat, grid_lng, hour, avg_speed_kmh.
        route_encoder:      Fitted LabelEncoder for route_id strings.
                            If None, uses hash-based encoding.
        fallback_speed_kmh: Speed fallback when insufficient history.
        fallback_dwell_minutes: Dwell time fallback.

    Returns:
        DataFrame with FEATURE_NAMES columns (and original gps_df columns).
    """
    if gps_df.empty:
        return pd.DataFrame(columns=FEATURE_NAMES)

    df = gps_df.copy()

    # --- Resolve target stop coordinates ---
    target_stop = stops_df[stops_df["stop_id"] == target_stop_id]
    if target_stop.empty:
        _log.warning("Target stop '%s' not found in stops_df.", target_stop_id)
        target_lat, target_lng = float(df["lat"].mean()), float(df["lng"].mean())
    else:
        target_lat = float(target_stop.iloc[0]["lat"])
        target_lng = float(target_stop.iloc[0]["lng"])

    # --- Build route_stops lookup ---
    route_stops_lookup: dict[str, list[dict]] = {}
    for row in route_stops_df.itertuples(index=False):
        rid = str(row.route_id)
        if rid not in route_stops_lookup:
            route_stops_lookup[rid] = []
        route_stops_lookup[rid].append(
            {
                "stop_id": str(row.stop_id),
                "stop_order": int(row.stop_order),
                "lat": float(row.lat),
                "lng": float(row.lng),
            }
        )

    # --- 0. distance_to_stop_km ---
    df["distance_to_stop_km"] = df.apply(
        lambda r: compute_distance_to_stop_km(
            float(r["lat"]), float(r["lng"]), target_lat, target_lng
        ),
        axis=1,
    )

    # --- 1. stops_remaining ---
    def _stops_remaining(row: pd.Series) -> int:
        route_id = str(row.get("route_id", ""))
        rs = route_stops_lookup.get(route_id, [])
        return compute_stops_remaining(
            float(row["lat"]), float(row["lng"]), target_stop_id, rs
        )

    df["stops_remaining"] = df.apply(_stops_remaining, axis=1)

    # --- 2. current_speed_kmh ---
    df["current_speed_kmh"] = df["speed_kmh"].fillna(fallback_speed_kmh)

    # --- 3-4. rolling_avg_speed_5 and rolling_avg_speed_10 ---
    # For training, compute per-bus rolling windows on the sorted DataFrame
    df = df.sort_values(["bus_id", "recorded_at"]).reset_index(drop=True)
    df["rolling_avg_speed_5"] = (
        df.groupby("bus_id")["speed_kmh"]
        .transform(lambda s: s.rolling(5, min_periods=1).mean())
        .fillna(fallback_speed_kmh)
    )
    df["rolling_avg_speed_10"] = (
        df.groupby("bus_id")["speed_kmh"]
        .transform(lambda s: s.rolling(10, min_periods=1).mean())
        .fillna(fallback_speed_kmh)
    )

    # --- 5. speed_variance ---
    df["speed_variance"] = (
        df.groupby("bus_id")["speed_kmh"]
        .transform(lambda s: s.rolling(10, min_periods=2).var())
        .fillna(0.0)
    )

    # --- 6-10. Temporal features ---
    if "recorded_at" in df.columns:
        ts_col = pd.to_datetime(df["recorded_at"], utc=True)
        df["hour_of_day"] = ts_col.dt.hour
        df["minute_of_hour"] = ts_col.dt.minute
        df["day_of_week"] = ts_col.dt.dayofweek
        df["is_weekday"] = (ts_col.dt.dayofweek < 5).astype(int)
        df["is_peak_hour"] = df["hour_of_day"].apply(compute_is_peak_hour)
    else:
        now = datetime.now(tz=timezone.utc)
        df["hour_of_day"] = now.hour
        df["minute_of_hour"] = now.minute
        df["day_of_week"] = now.weekday()
        df["is_weekday"] = int(now.weekday() < 5)
        df["is_peak_hour"] = compute_is_peak_hour(now.hour)

    # --- 11. route_id_encoded ---
    if "route_id" in df.columns:
        if route_encoder is not None:
            df["route_id_encoded"] = df["route_id"].apply(
                lambda r: encode_route_id(str(r), route_encoder)
            )
        else:
            # Hash-based fallback (stable, deterministic)
            df["route_id_encoded"] = df["route_id"].apply(
                lambda r: hash(str(r)) % 100
            )
    else:
        df["route_id_encoded"] = 0

    # --- 12. direction ---
    def _direction(row: pd.Series) -> float:
        route_id = str(row.get("route_id", ""))
        rs = route_stops_lookup.get(route_id, [])
        if not rs:
            return 0.0
        target_order = next(
            (r["stop_order"] for r in rs if r["stop_id"] == target_stop_id), None
        )
        if target_order is None:
            return 0.0
        min_dist = float("inf")
        nearest_order = 0
        for r in rs:
            d = geodesic((float(row["lat"]), float(row["lng"])), (r["lat"], r["lng"])).km
            if d < min_dist:
                min_dist = d
                nearest_order = r["stop_order"]
        return 0.0 if target_order >= nearest_order else 1.0

    df["direction"] = df.apply(_direction, axis=1)

    # --- 13. occupancy_ratio ---
    if "occupancy" in df.columns and "capacity" in df.columns:
        df["occupancy_ratio"] = df.apply(
            lambda r: compute_occupancy_ratio(
                int(r.get("occupancy", 0)), int(r.get("capacity", 50))
            ),
            axis=1,
        )
    elif "occupancy" in df.columns:
        df["occupancy_ratio"] = df["occupancy"].apply(
            lambda x: compute_occupancy_ratio(int(x), 50)
        )
    else:
        df["occupancy_ratio"] = 0.5

    # --- 14-15. congestion_index and segment_hist_speed ---
    def _seg_speed(row: pd.Series) -> float:
        hour = int(row.get("hour_of_day", 12))
        return compute_segment_hist_speed(
            float(row["lat"]), float(row["lng"]), hour,
            segment_speed_df, fallback_kmh=fallback_speed_kmh
        )

    df["segment_hist_speed"] = df.apply(_seg_speed, axis=1)
    df["congestion_index"] = df.apply(
        lambda r: compute_congestion_index(
            float(r["current_speed_kmh"]), float(r["segment_hist_speed"])
        ),
        axis=1,
    )

    # --- 16. hist_avg_dwell_at_next ---
    # Simplified: use fallback during training (full computation requires DB join)
    # In training, this feature will be 0.75 unless a dwell_lookup is provided.
    df["hist_avg_dwell_at_next"] = fallback_dwell_minutes

    # Final type normalisation
    for col in FEATURE_NAMES:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    _log.info(
        "build_feature_matrix: %d rows, %d feature columns",
        len(df), len([c for c in FEATURE_NAMES if c in df.columns]),
    )
    return df
