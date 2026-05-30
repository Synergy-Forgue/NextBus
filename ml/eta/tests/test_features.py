"""
tests/test_features.py — Unit Tests for Feature Engineering Functions
======================================================================
Tests every public function in training/features.py.

Follows TDD: these tests define the expected behaviour BEFORE features.py
is implemented.  Each test documents what the function must do.

Design principles:
  - No database or Redis required (uses hardcoded DataFrames).
  - No network calls.
  - Deterministic — same input always produces same output.
  - Each test has a single, clear assertion.

Run with:
    pytest tests/test_features.py -v

All coordinates are real Visakhapatnam locations so haversine calculations
produce geographically plausible results.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import pytest

# We import from training.features — these will exist after features.py is written
from training.features import (
    compute_distance_to_stop_km,
    compute_stops_remaining,
    compute_rolling_avg_speed,
    compute_speed_variance,
    compute_temporal_features,
    compute_is_peak_hour,
    compute_occupancy_ratio,
    compute_congestion_index,
    extract_stop_arrivals,
    build_feature_matrix,
    FEATURE_NAMES,
)


# ---------------------------------------------------------------------------
# Test fixtures — reference stop coordinates
# ---------------------------------------------------------------------------

# Real Visakhapatnam bus stops
RLY_STATION = {"lat": 17.7068, "lng": 83.2040}
RTC_COMPLEX  = {"lat": 17.7192, "lng": 83.3170}
JAGADAMBA    = {"lat": 17.7211, "lng": 83.3089}
GAJUWAKA     = {"lat": 17.6804, "lng": 83.2036}


def make_gps_df(
    speeds: list[float],
    lats: Optional[list[float]] = None,
    lngs: Optional[list[float]] = None,
    bus_id: str = "BUS_28K_001",
    start_time: Optional[datetime] = None,
) -> pd.DataFrame:
    """Helper: build a minimal gps_history DataFrame for testing.

    Args:
        speeds:     List of speed_kmh values (most recent first).
        lats:       Optional lat values (defaults to JAGADAMBA lat).
        lngs:       Optional lng values (defaults to JAGADAMBA lng).
        bus_id:     Bus identifier.
        start_time: Start timestamp (defaults to 2025-01-24 08:00 UTC).

    Returns:
        DataFrame with columns: bus_id, lat, lng, speed_kmh, recorded_at.
    """
    n = len(speeds)
    if start_time is None:
        start_time = datetime(2025, 1, 24, 8, 0, 0, tzinfo=timezone.utc)

    timestamps = [start_time + timedelta(seconds=i * 30) for i in range(n)]

    return pd.DataFrame(
        {
            "bus_id": [bus_id] * n,
            "lat": lats if lats else [JAGADAMBA["lat"]] * n,
            "lng": lngs if lngs else [JAGADAMBA["lng"]] * n,
            "speed_kmh": speeds,
            "recorded_at": timestamps,
            "occupancy": [20] * n,
        }
    )


# ---------------------------------------------------------------------------
# 1. compute_distance_to_stop_km
# ---------------------------------------------------------------------------


class TestComputeDistanceToStopKm:
    """Tests for the haversine distance feature."""

    def test_same_point_is_zero(self) -> None:
        """Distance from a point to itself must be exactly 0."""
        dist = compute_distance_to_stop_km(
            bus_lat=JAGADAMBA["lat"],
            bus_lng=JAGADAMBA["lng"],
            stop_lat=JAGADAMBA["lat"],
            stop_lng=JAGADAMBA["lng"],
        )
        assert dist == pytest.approx(0.0, abs=1e-6)

    def test_jagadamba_to_rly_station_is_plausible(self) -> None:
        """Jagadamba to Railway Station is approximately 10–12 km by road.
        Straight-line haversine should be ~8–11 km."""
        dist = compute_distance_to_stop_km(
            bus_lat=JAGADAMBA["lat"],
            bus_lng=JAGADAMBA["lng"],
            stop_lat=RLY_STATION["lat"],
            stop_lng=RLY_STATION["lng"],
        )
        assert 8.0 < dist < 12.0, f"Expected ~8-12 km, got {dist:.3f} km"

    def test_gajuwaka_to_rtc_complex(self) -> None:
        """Gajuwaka to RTC Complex should be approximately 12–18 km straight line."""
        dist = compute_distance_to_stop_km(
            bus_lat=GAJUWAKA["lat"],
            bus_lng=GAJUWAKA["lng"],
            stop_lat=RTC_COMPLEX["lat"],
            stop_lng=RTC_COMPLEX["lng"],
        )
        assert 12.0 < dist < 20.0, f"Expected ~12-20 km, got {dist:.3f} km"

    def test_distance_is_symmetric(self) -> None:
        """Haversine(A, B) must equal Haversine(B, A)."""
        d_ab = compute_distance_to_stop_km(
            JAGADAMBA["lat"], JAGADAMBA["lng"],
            RLY_STATION["lat"], RLY_STATION["lng"],
        )
        d_ba = compute_distance_to_stop_km(
            RLY_STATION["lat"], RLY_STATION["lng"],
            JAGADAMBA["lat"], JAGADAMBA["lng"],
        )
        assert d_ab == pytest.approx(d_ba, abs=1e-6)

    def test_return_type_is_float(self) -> None:
        """Return value must be a Python float (not numpy float)."""
        dist = compute_distance_to_stop_km(
            JAGADAMBA["lat"], JAGADAMBA["lng"],
            RLY_STATION["lat"], RLY_STATION["lng"],
        )
        assert isinstance(dist, float)

    def test_distance_is_non_negative(self) -> None:
        """Distance is always non-negative."""
        dist = compute_distance_to_stop_km(
            17.70, 83.20, 17.71, 83.21
        )
        assert dist >= 0.0


# ---------------------------------------------------------------------------
# 2. compute_stops_remaining
# ---------------------------------------------------------------------------


class TestComputeStopsRemaining:
    """Tests for the stops_remaining feature."""

    def _make_route_stops(self) -> list[dict]:
        """Create a simple 5-stop route through Visakhapatnam."""
        return [
            {"stop_id": "gajuwaka",    "stop_order": 0, "lat": GAJUWAKA["lat"],    "lng": GAJUWAKA["lng"]},
            {"stop_id": "rly_station", "stop_order": 1, "lat": RLY_STATION["lat"], "lng": RLY_STATION["lng"]},
            {"stop_id": "jagadamba",   "stop_order": 2, "lat": JAGADAMBA["lat"],   "lng": JAGADAMBA["lng"]},
            {"stop_id": "rtc_complex", "stop_order": 3, "lat": RTC_COMPLEX["lat"], "lng": RTC_COMPLEX["lng"]},
            {"stop_id": "terminus",    "stop_order": 4, "lat": 17.7300,             "lng": 83.3300},
        ]

    def test_bus_at_first_stop_to_last_has_three_intermediate(self) -> None:
        """Bus at gajuwaka heading to terminus has 3 intermediate stops."""
        route_stops = self._make_route_stops()
        count = compute_stops_remaining(
            current_lat=GAJUWAKA["lat"],
            current_lng=GAJUWAKA["lng"],
            target_stop_id="terminus",
            route_stops=route_stops,
        )
        # stops between gajuwaka(0) and terminus(4): rly_station(1), jagadamba(2), rtc_complex(3)
        assert count == 3

    def test_bus_next_to_target_has_zero_intermediate(self) -> None:
        """Bus at jagadamba heading to rtc_complex has 0 intermediate stops."""
        route_stops = self._make_route_stops()
        count = compute_stops_remaining(
            current_lat=JAGADAMBA["lat"],
            current_lng=JAGADAMBA["lng"],
            target_stop_id="rtc_complex",
            route_stops=route_stops,
        )
        # jagadamba(2) → rtc_complex(3): no intermediate stops
        assert count == 0

    def test_empty_route_stops_returns_zero(self) -> None:
        """If route has no stops, return 0 (no crash)."""
        count = compute_stops_remaining(
            current_lat=JAGADAMBA["lat"],
            current_lng=JAGADAMBA["lng"],
            target_stop_id="rtc_complex",
            route_stops=[],
        )
        assert count == 0

    def test_target_not_in_route_returns_zero(self) -> None:
        """If target stop is not in the route, return 0 gracefully."""
        route_stops = self._make_route_stops()
        count = compute_stops_remaining(
            current_lat=JAGADAMBA["lat"],
            current_lng=JAGADAMBA["lng"],
            target_stop_id="nonexistent_stop",
            route_stops=route_stops,
        )
        assert count == 0

    def test_returns_integer(self) -> None:
        """stops_remaining must be a non-negative integer."""
        route_stops = self._make_route_stops()
        count = compute_stops_remaining(
            current_lat=JAGADAMBA["lat"],
            current_lng=JAGADAMBA["lng"],
            target_stop_id="terminus",
            route_stops=route_stops,
        )
        assert isinstance(count, int)
        assert count >= 0


# ---------------------------------------------------------------------------
# 3. compute_rolling_avg_speed
# ---------------------------------------------------------------------------


class TestComputeRollingAvgSpeed:
    """Tests for rolling_avg_speed_5 and rolling_avg_speed_10 features."""

    def test_avg_speed_5_with_sufficient_data(self) -> None:
        """Average of first 5 speeds (most recent) when ≥ 5 records exist."""
        speeds = [30.0, 28.0, 32.0, 25.0, 20.0, 35.0, 40.0]
        df = make_gps_df(speeds)
        # Most recent 5 speeds (end of DataFrame after ascending sort)
        avg5 = compute_rolling_avg_speed(df, bus_id="BUS_28K_001", window=5)
        # Last 5 in time: speeds[-5:] = [20.0, 35.0, 40.0, ... ] depends on order
        # We test that it's a reasonable float
        assert isinstance(avg5, float)
        assert 0.0 < avg5 <= 120.0

    def test_avg_speed_10_with_insufficient_data_uses_fallback(self) -> None:
        """Falls back to fallback_kmh when fewer than 10 records exist."""
        speeds = [30.0, 28.0, 32.0]
        df = make_gps_df(speeds)
        avg10 = compute_rolling_avg_speed(
            df, bus_id="BUS_28K_001", window=10, fallback_kmh=25.0
        )
        assert avg10 == pytest.approx(25.0)

    def test_avg_speed_empty_df_uses_fallback(self) -> None:
        """Empty DataFrame triggers fallback."""
        df = pd.DataFrame(columns=["bus_id", "speed_kmh", "recorded_at"])
        avg = compute_rolling_avg_speed(df, bus_id="BUS_28K_001", window=5, fallback_kmh=25.0)
        assert avg == pytest.approx(25.0)

    def test_avg_speed_uniform_speeds(self) -> None:
        """If all speeds are equal, average equals that speed."""
        speeds = [40.0] * 10
        df = make_gps_df(speeds)
        avg = compute_rolling_avg_speed(df, bus_id="BUS_28K_001", window=10)
        assert avg == pytest.approx(40.0)

    def test_avg_speed_only_filters_correct_bus(self) -> None:
        """Rolling average should only use records for the specified bus_id."""
        # Mix two buses
        df1 = make_gps_df([60.0] * 10, bus_id="BUS_28K_001")
        df2 = make_gps_df([20.0] * 10, bus_id="BUS_99_003")
        combined = pd.concat([df1, df2], ignore_index=True)

        avg_28k = compute_rolling_avg_speed(combined, bus_id="BUS_28K_001", window=10)
        avg_99 = compute_rolling_avg_speed(combined, bus_id="BUS_99_003", window=10)

        assert avg_28k == pytest.approx(60.0)
        assert avg_99 == pytest.approx(20.0)


# ---------------------------------------------------------------------------
# 4. compute_speed_variance
# ---------------------------------------------------------------------------


class TestComputeSpeedVariance:
    """Tests for the speed_variance feature."""

    def test_zero_variance_for_constant_speed(self) -> None:
        """All identical speeds should produce variance = 0."""
        speeds = [30.0] * 10
        df = make_gps_df(speeds)
        var = compute_speed_variance(df, bus_id="BUS_28K_001", window=10)
        assert var == pytest.approx(0.0, abs=1e-6)

    def test_high_variance_for_variable_speeds(self) -> None:
        """Wide range of speeds should produce non-zero variance."""
        speeds = [5.0, 50.0, 5.0, 50.0, 5.0, 50.0, 5.0, 50.0, 5.0, 50.0]
        df = make_gps_df(speeds)
        var = compute_speed_variance(df, bus_id="BUS_28K_001", window=10)
        assert var > 100.0  # variance of [5,50,5,...] is ~500

    def test_single_record_variance_is_zero(self) -> None:
        """Variance of a single value is 0."""
        df = make_gps_df([30.0])
        var = compute_speed_variance(df, bus_id="BUS_28K_001", window=10, fallback=0.0)
        assert var == pytest.approx(0.0, abs=1e-6)

    def test_variance_is_non_negative(self) -> None:
        """Variance is always ≥ 0."""
        speeds = [10.0, 20.0, 15.0, 25.0, 30.0]
        df = make_gps_df(speeds)
        var = compute_speed_variance(df, bus_id="BUS_28K_001", window=5)
        assert var >= 0.0


# ---------------------------------------------------------------------------
# 5. compute_temporal_features
# ---------------------------------------------------------------------------


class TestComputeTemporalFeatures:
    """Tests for temporal feature extraction from a timestamp."""

    def test_hour_of_day_extracted_correctly(self) -> None:
        """Hour of day must match the UTC hour of the timestamp."""
        ts = datetime(2025, 1, 24, 14, 30, 0, tzinfo=timezone.utc)
        features = compute_temporal_features(ts)
        assert features["hour_of_day"] == 14

    def test_minute_of_hour_extracted_correctly(self) -> None:
        """Minute must match the minute component of the timestamp."""
        ts = datetime(2025, 1, 24, 14, 47, 0, tzinfo=timezone.utc)
        features = compute_temporal_features(ts)
        assert features["minute_of_hour"] == 47

    def test_monday_is_day_zero(self) -> None:
        """Monday should be day_of_week=0 (Python weekday convention)."""
        # 2025-01-20 is a Monday
        ts = datetime(2025, 1, 20, 8, 0, 0, tzinfo=timezone.utc)
        features = compute_temporal_features(ts)
        assert features["day_of_week"] == 0

    def test_sunday_is_day_six(self) -> None:
        """Sunday should be day_of_week=6."""
        # 2025-01-26 is a Sunday
        ts = datetime(2025, 1, 26, 10, 0, 0, tzinfo=timezone.utc)
        features = compute_temporal_features(ts)
        assert features["day_of_week"] == 6

    def test_weekday_flag_true_on_tuesday(self) -> None:
        """is_weekday should be 1 for Tuesday."""
        ts = datetime(2025, 1, 21, 9, 0, 0, tzinfo=timezone.utc)  # Tuesday
        features = compute_temporal_features(ts)
        assert features["is_weekday"] == 1

    def test_weekday_flag_false_on_saturday(self) -> None:
        """is_weekday should be 0 for Saturday."""
        ts = datetime(2025, 1, 25, 9, 0, 0, tzinfo=timezone.utc)  # Saturday
        features = compute_temporal_features(ts)
        assert features["is_weekday"] == 0


# ---------------------------------------------------------------------------
# 6. compute_is_peak_hour
# ---------------------------------------------------------------------------


class TestComputeIsPeakHour:
    """Tests for the is_peak_hour binary feature."""

    @pytest.mark.parametrize("hour", [8, 9])
    def test_morning_peak_is_one(self, hour: int) -> None:
        """Hours 8 and 9 are peak hours (8–10am window)."""
        assert compute_is_peak_hour(hour) == 1

    @pytest.mark.parametrize("hour", [17, 18])
    def test_evening_peak_is_one(self, hour: int) -> None:
        """Hours 17 and 18 are peak hours (5–7pm window)."""
        assert compute_is_peak_hour(hour) == 1

    @pytest.mark.parametrize("hour", [10, 11, 16, 7])
    def test_off_peak_is_zero(self, hour: int) -> None:
        """Hours outside 8-10am and 5-7pm are not peak hours."""
        assert compute_is_peak_hour(hour) == 0

    def test_midnight_is_not_peak(self) -> None:
        """Hour 0 (midnight) is not a peak hour."""
        assert compute_is_peak_hour(0) == 0

    def test_return_type_is_int(self) -> None:
        """Return value must be int (0 or 1), not bool."""
        result = compute_is_peak_hour(9)
        assert isinstance(result, int)
        assert result in (0, 1)


# ---------------------------------------------------------------------------
# 7. compute_occupancy_ratio
# ---------------------------------------------------------------------------


class TestComputeOccupancyRatio:
    """Tests for the occupancy_ratio feature."""

    def test_full_bus_returns_one(self) -> None:
        """Bus with occupancy = capacity should return 1.0."""
        ratio = compute_occupancy_ratio(occupancy_count=50, capacity=50)
        assert ratio == pytest.approx(1.0)

    def test_empty_bus_returns_zero(self) -> None:
        """Bus with occupancy = 0 should return 0.0."""
        ratio = compute_occupancy_ratio(occupancy_count=0, capacity=50)
        assert ratio == pytest.approx(0.0)

    def test_half_full_bus(self) -> None:
        """Bus with occupancy = capacity/2 should return 0.5."""
        ratio = compute_occupancy_ratio(occupancy_count=25, capacity=50)
        assert ratio == pytest.approx(0.5)

    def test_overcrowded_bus_capped_at_one(self) -> None:
        """Occupancy exceeding capacity is capped at 1.0 (no ratio > 1)."""
        ratio = compute_occupancy_ratio(occupancy_count=60, capacity=50)
        assert ratio == pytest.approx(1.0)

    def test_zero_capacity_returns_fallback(self) -> None:
        """Zero capacity (data error) should return 0.5 (medium load fallback)."""
        ratio = compute_occupancy_ratio(occupancy_count=10, capacity=0)
        assert ratio == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# 8. compute_congestion_index
# ---------------------------------------------------------------------------


class TestComputeCongestionIndex:
    """Tests for the congestion_index feature."""

    def test_normal_conditions_returns_one(self) -> None:
        """When current speed equals historical, congestion index is 1.0."""
        idx = compute_congestion_index(current_speed_kmh=30.0, segment_hist_speed_kmh=30.0)
        assert idx == pytest.approx(1.0)

    def test_slow_bus_less_than_one(self) -> None:
        """Bus slower than historical average: congestion_index < 1."""
        idx = compute_congestion_index(current_speed_kmh=15.0, segment_hist_speed_kmh=30.0)
        assert idx == pytest.approx(0.5)

    def test_fast_bus_greater_than_one(self) -> None:
        """Bus faster than historical average: congestion_index > 1."""
        idx = compute_congestion_index(current_speed_kmh=40.0, segment_hist_speed_kmh=20.0)
        assert idx == pytest.approx(2.0)

    def test_zero_hist_speed_returns_one_fallback(self) -> None:
        """Zero historical speed (no data): fall back to 1.0 (neutral)."""
        idx = compute_congestion_index(current_speed_kmh=30.0, segment_hist_speed_kmh=0.0)
        assert idx == pytest.approx(1.0)

    def test_congestion_index_capped_at_max(self) -> None:
        """Congestion index should be capped at a maximum (e.g. 3.0)."""
        idx = compute_congestion_index(current_speed_kmh=300.0, segment_hist_speed_kmh=10.0)
        assert idx <= 3.0


# ---------------------------------------------------------------------------
# 9. extract_stop_arrivals
# ---------------------------------------------------------------------------


class TestExtractStopArrivals:
    """Tests for the extract_stop_arrivals label derivation function.

    extract_stop_arrivals(df, stops) → pd.DataFrame
    where each row represents: at time T, bus was X metres from stop S,
    and arrived at stop S at time T+delta.

    The function derives training labels (actual_eta_minutes) from raw
    GPS history by detecting when a bus crosses within 60m of a stop.
    """

    def _make_stops_df(self) -> pd.DataFrame:
        """Create a minimal stops DataFrame for testing."""
        return pd.DataFrame(
            {
                "stop_id": ["jagadamba", "rtc_complex"],
                "lat": [JAGADAMBA["lat"], RTC_COMPLEX["lat"]],
                "lng": [JAGADAMBA["lng"], RTC_COMPLEX["lng"]],
            }
        )

    def test_arrival_detected_when_within_radius(self) -> None:
        """A GPS record within 60m of a stop should be marked as arrival."""
        # Bus starts far away (at gajuwaka), then moves very close to jagadamba
        base_time = datetime(2025, 1, 24, 8, 0, 0, tzinfo=timezone.utc)
        gps_df = pd.DataFrame(
            {
                "bus_id": ["BUS_28K_001", "BUS_28K_001"],
                "lat": [GAJUWAKA["lat"], JAGADAMBA["lat"] + 0.0001],  # ~11m away
                "lng": [GAJUWAKA["lng"], JAGADAMBA["lng"] + 0.0001],
                "speed_kmh": [30.0, 5.0],
                "recorded_at": [base_time, base_time + timedelta(minutes=15)],
                "occupancy": [20, 22],
            }
        )
        stops_df = self._make_stops_df()
        arrivals = extract_stop_arrivals(gps_df, stops_df)

        # Should have at least one arrival at jagadamba
        assert len(arrivals) >= 1
        if len(arrivals) > 0:
            arrival_stops = arrivals["stop_id"].tolist()
            assert "jagadamba" in arrival_stops

    def test_no_arrival_when_always_far_away(self) -> None:
        """If bus never comes within 60m of any stop, no arrivals are detected."""
        base_time = datetime(2025, 1, 24, 8, 0, 0, tzinfo=timezone.utc)
        # Positions far from all known stops (in the sea, but using valid bbox coords)
        gps_df = pd.DataFrame(
            {
                "bus_id": ["BUS_28K_001", "BUS_28K_001"],
                "lat": [17.60, 17.61],
                "lng": [83.15, 83.16],
                "speed_kmh": [30.0, 30.0],
                "recorded_at": [base_time, base_time + timedelta(minutes=5)],
                "occupancy": [20, 20],
            }
        )
        stops_df = self._make_stops_df()
        arrivals = extract_stop_arrivals(gps_df, stops_df)
        assert len(arrivals) == 0

    def test_output_has_required_columns(self) -> None:
        """Output DataFrame must have stop_id, bus_id, arrival_time columns."""
        base_time = datetime(2025, 1, 24, 8, 0, 0, tzinfo=timezone.utc)
        gps_df = pd.DataFrame(
            {
                "bus_id": ["BUS_28K_001", "BUS_28K_001"],
                "lat": [GAJUWAKA["lat"], JAGADAMBA["lat"]],
                "lng": [GAJUWAKA["lng"], JAGADAMBA["lng"]],
                "speed_kmh": [30.0, 5.0],
                "recorded_at": [base_time, base_time + timedelta(minutes=15)],
                "occupancy": [20, 22],
            }
        )
        stops_df = self._make_stops_df()
        arrivals = extract_stop_arrivals(gps_df, stops_df)

        required_cols = {"bus_id", "stop_id", "arrival_time"}
        assert required_cols.issubset(set(arrivals.columns)), (
            f"Missing columns: {required_cols - set(arrivals.columns)}"
        )

    def test_empty_gps_df_returns_empty(self) -> None:
        """Empty GPS history produces empty arrivals DataFrame."""
        gps_df = pd.DataFrame(
            columns=["bus_id", "lat", "lng", "speed_kmh", "recorded_at", "occupancy"]
        )
        stops_df = self._make_stops_df()
        arrivals = extract_stop_arrivals(gps_df, stops_df)
        assert len(arrivals) == 0


# ---------------------------------------------------------------------------
# 10. build_feature_matrix
# ---------------------------------------------------------------------------


class TestBuildFeatureMatrix:
    """Tests for the full feature matrix construction function."""

    def test_feature_names_constant_matches_expected_count(self) -> None:
        """FEATURE_NAMES must contain exactly 17 features (as documented)."""
        assert len(FEATURE_NAMES) == 17

    def test_feature_names_all_strings(self) -> None:
        """All feature names must be non-empty strings."""
        for name in FEATURE_NAMES:
            assert isinstance(name, str)
            assert len(name) > 0

    def test_required_feature_names_present(self) -> None:
        """Key feature names must be present in FEATURE_NAMES."""
        required = {
            "distance_to_stop_km",
            "stops_remaining",
            "current_speed_kmh",
            "rolling_avg_speed_5",
            "rolling_avg_speed_10",
            "speed_variance",
            "hour_of_day",
            "is_peak_hour",
            "occupancy_ratio",
            "congestion_index",
        }
        assert required.issubset(set(FEATURE_NAMES)), (
            f"Missing: {required - set(FEATURE_NAMES)}"
        )

    def test_build_feature_matrix_output_shape(self) -> None:
        """build_feature_matrix returns a DataFrame with len(FEATURE_NAMES) columns."""
        # Build a minimal labelled DataFrame as would come from extract.py + arrivals
        base_time = datetime(2025, 1, 24, 8, 0, 0, tzinfo=timezone.utc)
        n_records = 20
        gps_df = make_gps_df(
            speeds=[30.0] * n_records,
            start_time=base_time,
        )
        # Add extra columns expected by build_feature_matrix
        gps_df["heading"] = 90.0
        gps_df["route_id"] = "28K"
        gps_df["capacity"] = 50

        stops_df = pd.DataFrame(
            {
                "stop_id": ["jagadamba"],
                "lat": [JAGADAMBA["lat"]],
                "lng": [JAGADAMBA["lng"]],
            }
        )

        route_stops_df = pd.DataFrame(
            {
                "route_id": ["28K"],
                "stop_id": ["jagadamba"],
                "stop_order": [0],
                "lat": [JAGADAMBA["lat"]],
                "lng": [JAGADAMBA["lng"]],
            }
        )

        segment_speed_df = pd.DataFrame(
            columns=["grid_lat", "grid_lng", "hour", "avg_speed_kmh"]
        )

        feature_df = build_feature_matrix(
            gps_df=gps_df,
            stops_df=stops_df,
            route_stops_df=route_stops_df,
            target_stop_id="jagadamba",
            segment_speed_df=segment_speed_df,
        )

        assert set(FEATURE_NAMES).issubset(set(feature_df.columns)), (
            f"Missing columns: {set(FEATURE_NAMES) - set(feature_df.columns)}"
        )

    def test_build_feature_matrix_no_nan_in_required_cols(self) -> None:
        """Feature matrix must not have NaN in any FEATURE_NAMES column."""
        base_time = datetime(2025, 1, 24, 8, 0, 0, tzinfo=timezone.utc)
        n_records = 15
        gps_df = make_gps_df(speeds=[25.0] * n_records, start_time=base_time)
        gps_df["heading"] = 90.0
        gps_df["route_id"] = "28K"
        gps_df["capacity"] = 50

        stops_df = pd.DataFrame(
            {
                "stop_id": ["jagadamba"],
                "lat": [JAGADAMBA["lat"]],
                "lng": [JAGADAMBA["lng"]],
            }
        )

        route_stops_df = pd.DataFrame(
            {
                "route_id": ["28K"],
                "stop_id": ["jagadamba"],
                "stop_order": [0],
                "lat": [JAGADAMBA["lat"]],
                "lng": [JAGADAMBA["lng"]],
            }
        )

        segment_speed_df = pd.DataFrame(
            columns=["grid_lat", "grid_lng", "hour", "avg_speed_kmh"]
        )

        feature_df = build_feature_matrix(
            gps_df=gps_df,
            stops_df=stops_df,
            route_stops_df=route_stops_df,
            target_stop_id="jagadamba",
            segment_speed_df=segment_speed_df,
        )

        for col in FEATURE_NAMES:
            if col in feature_df.columns:
                nan_count = feature_df[col].isna().sum()
                assert nan_count == 0, f"Column '{col}' has {nan_count} NaN values"
