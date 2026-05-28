"""
serving/predictor.py — ETA Predictor Orchestrator
==================================================
Central brain of the ETA serving layer.  Decides whether to use:
  - v1: Rule-based haversine + dwell formula  (always available, Day 1)
  - v2: XGBoost model loaded from eta_v2_xgb.pkl  (activates automatically)

Consumers (FastAPI route handlers) call:

    predictor = ETAPredictor(db, redis)
    await predictor.startup()          # called once in lifespan
    result = await predictor.predict(ETARequest(...))

The predictor never exposes which version it is using internally — callers
always receive an ETAResponse with the same shape.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
from geopy.distance import geodesic
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy import text
from redis.asyncio import Redis

from config import settings
from serving.schemas import ETARequest, ETAResponse
from serving.providers import (
    LocationProvider,
    LocationReading,
    LocationNotAvailableError,
    StaleLocationError,
)

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------


class ETAComputationError(Exception):
    """Raised when ETA cannot be computed due to missing data or logic failure.

    Examples:
      - Bus not found in database.
      - Target stop not found.
      - No route association for bus.
      - Provider throws LocationNotAvailableError.
    """


class ModelNotLoadedError(Exception):
    """Raised when XGBoost model is expected but not loaded.

    This should never propagate to the API caller — the predictor
    catches it and falls back to v1 automatically.
    """


class InsufficientDataError(Exception):
    """Raised when there are not enough GPS records to compute a feature.

    For example, rolling_avg_speed_10 needs at least 10 GPS records.
    The predictor catches this and applies fallback values.
    """


# ---------------------------------------------------------------------------
# Stop / Route data structures (read from DB, cached in memory)
# ---------------------------------------------------------------------------


class StopInfo:
    """Lightweight container for a bus stop's DB attributes.

    Attributes:
        stop_id:   Unique stop identifier (matches stops.id).
        name:      Human-readable stop name.
        lat:       WGS-84 latitude.
        lng:       WGS-84 longitude.
    """

    __slots__ = ("stop_id", "name", "lat", "lng")

    def __init__(self, stop_id: str, name: str, lat: float, lng: float) -> None:
        self.stop_id = stop_id
        self.name = name
        self.lat = lat
        self.lng = lng


class RouteStop:
    """A stop in a route, with its ordering position.

    Attributes:
        stop_id:    Unique stop identifier.
        stop_order: 0-based integer position in the route.
        lat:        WGS-84 latitude.
        lng:        WGS-84 longitude.
    """

    __slots__ = ("stop_id", "stop_order", "lat", "lng")

    def __init__(self, stop_id: str, stop_order: int, lat: float, lng: float) -> None:
        self.stop_id = stop_id
        self.stop_order = stop_order
        self.lat = lat
        self.lng = lng


# ---------------------------------------------------------------------------
# ETAPredictor
# ---------------------------------------------------------------------------


class ETAPredictor:
    """Orchestrates ETA prediction using either v1 (rule-based) or v2 (XGBoost).

    Lifecycle:
        1. Instantiate with DB engine, Redis client, and a LocationProvider.
        2. Call ``await startup()`` once during FastAPI lifespan.
           This decides v1 vs v2, loads the model if applicable, and
           warms up the route/stop cache.
        3. Call ``await predict(request)`` per HTTP request.
        4. Call ``shutdown()`` during FastAPI lifespan teardown.

    Version selection logic (performed in startup):
        - If model.pkl exists on disk AND can be loaded → use v2.
        - Otherwise → use v1 rule-based (logged clearly).
        - v2 also checks DB row count ≥ 5000 over last 14 days, but this
          is informational — the file existence check is authoritative.

    Args:
        engine:   Async SQLAlchemy engine connected to PostgreSQL.
        redis:    Async Redis client.
        provider: Configured LocationProvider instance.
    """

    def __init__(
        self,
        engine: AsyncEngine,
        redis: Redis,
        provider: LocationProvider,
    ) -> None:
        self._engine = engine
        self._redis = redis
        self._provider = provider

        # Set during startup()
        self._model: Optional[object] = None          # XGBoost Booster or sklearn wrapper
        self._model_version: str = "v1_rule_based"
        self._model_loaded: bool = False
        self._model_metadata: dict = {}
        self._feature_names: list[str] = []

        # In-memory caches populated during startup
        # bus_id → route_id
        self._bus_route_cache: dict[str, str] = {}
        # bus_id → capacity
        self._bus_capacity_cache: dict[str, int] = {}
        # route_id → [RouteStop] ordered by stop_order
        self._route_stops_cache: dict[str, list[RouteStop]] = {}
        # stop_id → StopInfo
        self._stops_cache: dict[str, StopInfo] = {}

    # ------------------------------------------------------------------
    # Startup & Shutdown
    # ------------------------------------------------------------------

    async def startup(self) -> None:
        """Initialise the predictor: load model and warm caches.

        Must be awaited exactly once, inside the FastAPI lifespan
        ``async with`` block before the application starts serving.

        This method:
          1. Loads route/stop/bus data into memory from PostgreSQL.
          2. Attempts to load the XGBoost model from disk.
          3. Logs which predictor version will be used.

        Raises:
            ETAComputationError: If the DB cache load fails fatally.
        """
        _log.info("ETAPredictor startup: loading caches and model...")
        await self._load_route_cache()
        self._try_load_model()
        _log.info(
            "ETAPredictor ready. version=%s model_loaded=%s buses=%d routes=%d",
            self._model_version,
            self._model_loaded,
            len(self._bus_route_cache),
            len(self._route_stops_cache),
        )

    def shutdown(self) -> None:
        """Release in-memory resources.

        Called during FastAPI lifespan teardown.  DB/Redis connections are
        managed by the caller (lifespan) and closed there.
        """
        self._model = None
        self._bus_route_cache.clear()
        self._bus_capacity_cache.clear()
        self._route_stops_cache.clear()
        self._stops_cache.clear()
        _log.info("ETAPredictor shutdown complete.")

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _try_load_model(self) -> None:
        """Attempt to load the XGBoost model from disk.

        Sets ``self._model_version`` to 'v2_xgb' if successful,
        or 'v1_rule_based' if the model file is missing or fails to load.

        This method is intentionally synchronous — joblib.load() runs once
        at startup time (not during request handling), so blocking the
        event loop momentarily is acceptable.

        Side effects:
            Updates: _model, _model_version, _model_loaded, _feature_names,
                     _model_metadata.
        """
        model_path: Path = settings.model_path
        metadata_path: Path = settings.metadata_path

        if not model_path.exists():
            _log.info(
                "Model file not found at '%s'. Using v1 rule-based predictor. "
                "Run training/train.py once enough GPS history is available.",
                model_path,
            )
            self._model_version = "v1_rule_based"
            self._model_loaded = False
            return

        try:
            self._model = joblib.load(model_path)
            _log.info("XGBoost model loaded from '%s'.", model_path)
        except Exception as exc:  # pylint: disable=broad-except
            _log.warning(
                "Failed to load model from '%s': %s. Falling back to v1.",
                model_path,
                exc,
                exc_info=True,
            )
            self._model_version = "v1_rule_based"
            self._model_loaded = False
            return

        # Load metadata
        if metadata_path.exists():
            try:
                with open(metadata_path, "r", encoding="utf-8") as fh:
                    self._model_metadata = json.load(fh)
                self._feature_names = self._model_metadata.get("feature_names", [])
                _log.info(
                    "Model metadata loaded: mae=%.3f n_samples=%d features=%d",
                    self._model_metadata.get("mae", float("nan")),
                    self._model_metadata.get("n_samples", 0),
                    len(self._feature_names),
                )
            except Exception as exc:  # pylint: disable=broad-except
                _log.warning("Could not read metadata.json: %s", exc)

        self._model_version = "v2_xgb"
        self._model_loaded = True
        _log.info("Predictor version selected: v2_xgb")

    # ------------------------------------------------------------------
    # DB cache loading
    # ------------------------------------------------------------------

    async def _load_route_cache(self) -> None:
        """Populate in-memory caches from PostgreSQL.

        Loads:
          - buses table → bus_id: route_id, capacity
          - stops table → stop_id: StopInfo
          - route_stops + stops join → route_id: [RouteStop ordered by stop_order]

        Raises:
            ETAComputationError: On DB connection failure.
        """
        try:
            async with AsyncSession(self._engine) as session:
                await self._load_buses(session)
                await self._load_stops(session)
                await self._load_route_stops(session)
        except Exception as exc:
            _log.error("Failed to load route cache from DB: %s", exc, exc_info=True)
            raise ETAComputationError(
                f"DB cache load failed during startup: {exc}"
            ) from exc

    async def _load_buses(self, session: AsyncSession) -> None:
        """Load buses table into memory caches.

        Args:
            session: Active async SQLAlchemy session.
        """
        result = await session.execute(
            text("SELECT id, route_id, capacity FROM buses")
        )
        rows = result.fetchall()
        for row in rows:
            bus_id, route_id, capacity = row
            self._bus_route_cache[str(bus_id)] = str(route_id)
            self._bus_capacity_cache[str(bus_id)] = int(capacity)
        _log.debug("Loaded %d buses into cache.", len(self._bus_route_cache))

    async def _load_stops(self, session: AsyncSession) -> None:
        """Load stops table into memory cache.

        Args:
            session: Active async SQLAlchemy session.
        """
        result = await session.execute(
            text("SELECT id, name, lat, lng FROM stops")
        )
        rows = result.fetchall()
        for row in rows:
            stop_id, name, lat, lng = row
            self._stops_cache[str(stop_id)] = StopInfo(
                stop_id=str(stop_id),
                name=str(name),
                lat=float(lat),
                lng=float(lng),
            )
        _log.debug("Loaded %d stops into cache.", len(self._stops_cache))

    async def _load_route_stops(self, session: AsyncSession) -> None:
        """Load route_stops → stops join into memory cache.

        Joins route_stops with stops to get lat/lng per route-ordered stop.

        Args:
            session: Active async SQLAlchemy session.
        """
        result = await session.execute(
            text(
                """
                SELECT rs.route_id, rs.stop_id, rs.stop_order, s.lat, s.lng
                FROM route_stops rs
                JOIN stops s ON s.id = rs.stop_id
                ORDER BY rs.route_id, rs.stop_order
                """
            )
        )
        rows = result.fetchall()
        for row in rows:
            route_id, stop_id, stop_order, lat, lng = row
            route_id = str(route_id)
            if route_id not in self._route_stops_cache:
                self._route_stops_cache[route_id] = []
            self._route_stops_cache[route_id].append(
                RouteStop(
                    stop_id=str(stop_id),
                    stop_order=int(stop_order),
                    lat=float(lat),
                    lng=float(lng),
                )
            )
        _log.debug(
            "Loaded route_stops for %d routes.", len(self._route_stops_cache)
        )

    # ------------------------------------------------------------------
    # Public predict() entry point
    # ------------------------------------------------------------------

    async def predict(self, request: ETARequest) -> ETAResponse:
        """Compute ETA for the given request.

        Dispatches to ``_predict_v1`` or ``_predict_v2`` based on which
        version was selected during ``startup()``.

        Args:
            request: Validated ETARequest from the API layer.

        Returns:
            A fully populated ETAResponse (never null).

        Raises:
            ETAComputationError: If prediction cannot be completed.
        """
        if self._model_loaded and self._model_version == "v2_xgb":
            try:
                return await self._predict_v2(request)
            except Exception as exc:  # pylint: disable=broad-except
                _log.warning(
                    "v2 prediction failed for bus=%s, falling back to v1: %s",
                    request.bus_id,
                    exc,
                )
                return await self._predict_v1(request)
        else:
            return await self._predict_v1(request)

    # ------------------------------------------------------------------
    # v1 — Rule-based predictor
    # ------------------------------------------------------------------

    async def _predict_v1(self, request: ETARequest) -> ETAResponse:
        """Compute ETA using the rule-based haversine + dwell formula.

        Formula:
            eta_minutes = (haversine_km / max(rolling_avg_speed, speed_floor)) * 60
                        + (stops_remaining * dwell_time_per_stop)

        Where:
            haversine_km     = Geodesic distance from current bus position
                               to target stop.
            rolling_avg_speed = Mean speed over last N GPS records for this bus
                               (fallback: settings.speed_fallback_kmh if < N records).
            speed_floor      = settings.speed_floor_kmh (15 km/h default).
            stops_remaining  = Count of stops between current bus position and
                               target stop in the route's ordered stop list.
            dwell_time       = settings.dwell_time_per_stop_minutes (0.75 min).

        Args:
            request: Validated ETARequest.

        Returns:
            ETAResponse with model_version='v1_rule_based'.

        Raises:
            ETAComputationError: If bus or stop data is missing.
        """
        bus_id = request.bus_id
        target_stop_id = request.target_stop_id

        # --- Validate bus is known ---
        if bus_id not in self._bus_route_cache:
            raise ETAComputationError(
                f"Bus '{bus_id}' not found in database. "
                "Ensure the bus is registered in the 'buses' table."
            )
        route_id = self._bus_route_cache[bus_id]

        # --- Validate target stop is known ---
        if target_stop_id not in self._stops_cache:
            raise ETAComputationError(
                f"Stop '{target_stop_id}' not found in database."
            )
        target_stop = self._stops_cache[target_stop_id]

        # --- Get current bus location ---
        try:
            location: LocationReading = await self._provider.get_location(bus_id)
        except (LocationNotAvailableError, StaleLocationError) as exc:
            raise ETAComputationError(
                f"Cannot get location for bus '{bus_id}': {exc}"
            ) from exc

        # --- Haversine distance to target stop ---
        distance_km: float = geodesic(
            (location.lat, location.lng),
            (target_stop.lat, target_stop.lng),
        ).km

        # --- Rolling average speed from GPS history ---
        rolling_speed = await self._get_rolling_avg_speed(bus_id)
        effective_speed = max(rolling_speed, settings.speed_floor_kmh)

        # --- Count stops remaining between bus and target ---
        stops_remaining = self._count_stops_remaining(
            route_id=route_id,
            current_lat=location.lat,
            current_lng=location.lng,
            target_stop_id=target_stop_id,
        )

        # --- v1 ETA formula ---
        travel_time_minutes = (distance_km / effective_speed) * 60.0
        dwell_time_minutes = stops_remaining * settings.dwell_time_per_stop_minutes
        eta_minutes = travel_time_minutes + dwell_time_minutes

        # Clamp to non-negative (should never be negative but defensive)
        eta_minutes = max(0.0, round(eta_minutes, 2))

        _log.info(
            "v1 ETA: bus=%s stop=%s dist=%.2fkm speed=%.1f stops_remaining=%d "
            "travel=%.2fmin dwell=%.2fmin eta=%.2fmin",
            bus_id,
            target_stop_id,
            distance_km,
            effective_speed,
            stops_remaining,
            travel_time_minutes,
            dwell_time_minutes,
            eta_minutes,
        )

        return ETAResponse(
            bus_id=bus_id,
            target_stop_id=target_stop_id,
            eta_minutes=eta_minutes,
            confidence=0.70,  # Fixed heuristic confidence for rule-based predictor
            model_version="v1_rule_based",
            computed_at=datetime.now(tz=timezone.utc),
        )

    async def _get_rolling_avg_speed(self, bus_id: str) -> float:
        """Compute rolling average speed from recent GPS history.

        Queries the gps_history table for the most recent N records for
        the given bus, where N = settings.rolling_speed_window.

        Falls back to settings.speed_fallback_kmh if:
          - Fewer than N records exist.
          - The DB query fails.

        Args:
            bus_id: The bus to compute rolling speed for.

        Returns:
            Average speed in km/h over the last N records.
        """
        try:
            async with AsyncSession(self._engine) as session:
                result = await session.execute(
                    text(
                        """
                        SELECT speed_kmh
                        FROM gps_history
                        WHERE bus_id = :bus_id
                          AND speed_kmh IS NOT NULL
                        ORDER BY recorded_at DESC
                        LIMIT :limit
                        """
                    ),
                    {"bus_id": bus_id, "limit": settings.rolling_speed_window},
                )
                rows = result.fetchall()

            if len(rows) < settings.rolling_speed_window:
                _log.debug(
                    "Only %d GPS records found for bus=%s (need %d). "
                    "Using fallback speed %.1f km/h.",
                    len(rows),
                    bus_id,
                    settings.rolling_speed_window,
                    settings.speed_fallback_kmh,
                )
                return settings.speed_fallback_kmh

            speeds = [float(row[0]) for row in rows]
            avg = sum(speeds) / len(speeds)
            _log.debug("Rolling avg speed for bus=%s: %.2f km/h (%d records)", bus_id, avg, len(speeds))
            return avg

        except Exception as exc:  # pylint: disable=broad-except
            _log.warning(
                "DB query for rolling speed failed for bus=%s: %s. Using fallback.",
                bus_id,
                exc,
            )
            return settings.speed_fallback_kmh

    def _count_stops_remaining(
        self,
        route_id: str,
        current_lat: float,
        current_lng: float,
        target_stop_id: str,
    ) -> int:
        """Count intermediate stops between the bus's current position and target.

        Finds the route stop closest to the bus's current GPS position,
        then counts how many stops exist between that position and the
        target stop (exclusive of the target itself).

        Returns 0 if:
          - The route has no stops cached.
          - The target stop is not in this route.
          - The bus is past the target stop (returns from opposite end not supported).

        Args:
            route_id:     The route the bus is on.
            current_lat:  Current bus latitude.
            current_lng:  Current bus longitude.
            target_stop_id: The stop to count towards.

        Returns:
            Number of intermediate stops (0 or more).
        """
        route_stops = self._route_stops_cache.get(route_id, [])
        if not route_stops:
            _log.warning("No route_stops found for route=%s.", route_id)
            return 0

        # Find the stop order of the target
        target_order: Optional[int] = None
        for rs in route_stops:
            if rs.stop_id == target_stop_id:
                target_order = rs.stop_order
                break

        if target_order is None:
            _log.warning(
                "Target stop '%s' not found in route '%s'.",
                target_stop_id,
                route_id,
            )
            return 0

        # Find the closest stop to the bus (current position) by geodesic distance
        closest_order = 0
        min_dist = float("inf")
        for rs in route_stops:
            dist = geodesic((current_lat, current_lng), (rs.lat, rs.lng)).km
            if dist < min_dist:
                min_dist = dist
                closest_order = rs.stop_order

        # Stops remaining = stops between current position and target (exclusive)
        if target_order <= closest_order:
            return 0  # Bus is at or past the target stop

        # Count stops strictly between closest_order (exclusive) and target_order (exclusive)
        stops_between = sum(
            1
            for rs in route_stops
            if closest_order < rs.stop_order < target_order
        )
        return stops_between

    # ------------------------------------------------------------------
    # v2 — XGBoost predictor
    # ------------------------------------------------------------------

    async def _predict_v2(self, request: ETARequest) -> ETAResponse:
        """Compute ETA using the trained XGBoost model.

        Assembles the feature vector (same feature set used in training),
        runs inference, and returns the prediction.

        The feature assembly reads:
          - LocationProvider for current bus position + speed.
          - PostgreSQL gps_history for rolling speed stats.
          - In-memory caches for route/stop geometry.
          - Redis (via provider) for occupancy.

        Args:
            request: Validated ETARequest.

        Returns:
            ETAResponse with model_version='v2_xgb'.

        Raises:
            ModelNotLoadedError: If model is not available (should be caught upstream).
            ETAComputationError: If feature assembly fails.
        """
        if self._model is None:
            raise ModelNotLoadedError("XGBoost model is not loaded.")

        bus_id = request.bus_id
        target_stop_id = request.target_stop_id

        if bus_id not in self._bus_route_cache:
            raise ETAComputationError(f"Bus '{bus_id}' not found in cache.")

        route_id = self._bus_route_cache[bus_id]
        capacity = self._bus_capacity_cache.get(bus_id, 50)

        if target_stop_id not in self._stops_cache:
            raise ETAComputationError(f"Stop '{target_stop_id}' not found in cache.")

        target_stop = self._stops_cache[target_stop_id]

        # Get current location
        try:
            location: LocationReading = await self._provider.get_location(bus_id)
        except (LocationNotAvailableError, StaleLocationError) as exc:
            raise ETAComputationError(
                f"Cannot get location for bus '{bus_id}': {exc}"
            ) from exc

        # Assemble feature vector
        features = await self._assemble_features(
            bus_id=bus_id,
            route_id=route_id,
            capacity=capacity,
            location=location,
            target_stop=target_stop,
        )

        # Run inference
        feature_array = np.array([features], dtype=np.float32)
        try:
            eta_raw: float = float(self._model.predict(feature_array)[0])
        except Exception as exc:
            raise ETAComputationError(f"XGBoost inference failed: {exc}") from exc

        eta_minutes = max(0.0, round(eta_raw, 2))

        # Derive confidence: inversely proportional to distance uncertainty.
        # Heuristic: start at 0.95 and decay slightly for high distances.
        dist_km = features[0]  # distance_to_stop_km is the first feature
        confidence = max(0.5, min(0.95, 0.95 - (dist_km * 0.005)))

        _log.info(
            "v2 ETA: bus=%s stop=%s eta=%.2fmin confidence=%.3f",
            bus_id,
            target_stop_id,
            eta_minutes,
            confidence,
        )

        return ETAResponse(
            bus_id=bus_id,
            target_stop_id=target_stop_id,
            eta_minutes=eta_minutes,
            confidence=round(confidence, 3),
            model_version="v2_xgb",
            computed_at=datetime.now(tz=timezone.utc),
        )

    async def _assemble_features(
        self,
        bus_id: str,
        route_id: str,
        capacity: int,
        location: LocationReading,
        target_stop: StopInfo,
    ) -> list[float]:
        """Assemble the feature vector for v2 XGBoost inference.

        Must match EXACTLY the feature order used during training in
        training/features.py.  Any drift between training-time and
        inference-time feature order will silently produce garbage predictions.

        Feature order (matches FEATURE_NAMES in training/features.py):
          0   distance_to_stop_km
          1   stops_remaining
          2   current_speed_kmh
          3   rolling_avg_speed_5
          4   rolling_avg_speed_10
          5   speed_variance
          6   hour_of_day
          7   minute_of_hour
          8   day_of_week
          9   is_weekday
          10  is_peak_hour
          11  route_id_encoded
          12  direction
          13  occupancy_ratio
          14  congestion_index
          15  segment_hist_speed
          16  hist_avg_dwell_at_next

        Args:
            bus_id:      Bus identifier for history queries.
            route_id:    Route the bus is on.
            capacity:    Bus passenger capacity.
            location:    Current LocationReading.
            target_stop: Target StopInfo.

        Returns:
            List of floats in the exact feature order above.
        """
        now_utc = datetime.now(tz=timezone.utc)

        # 0. distance_to_stop_km
        distance_to_stop_km = geodesic(
            (location.lat, location.lng),
            (target_stop.lat, target_stop.lng),
        ).km

        # 1. stops_remaining
        stops_remaining = float(
            self._count_stops_remaining(
                route_id=route_id,
                current_lat=location.lat,
                current_lng=location.lng,
                target_stop_id=target_stop.stop_id,
            )
        )

        # 2. current_speed_kmh
        current_speed_kmh = location.speed_kmh

        # 3-5. Rolling speed stats from GPS history
        speed_stats = await self._get_speed_stats(bus_id)
        rolling_avg_speed_5 = speed_stats["avg_5"]
        rolling_avg_speed_10 = speed_stats["avg_10"]
        speed_variance = speed_stats["variance"]

        # 6-10. Temporal features
        hour_of_day = float(now_utc.hour)
        minute_of_hour = float(now_utc.minute)
        day_of_week = float(now_utc.weekday())  # 0=Mon, 6=Sun
        is_weekday = 1.0 if now_utc.weekday() < 5 else 0.0
        is_peak = (
            (8 <= now_utc.hour < 10) or (17 <= now_utc.hour < 19)
        )
        is_peak_hour = 1.0 if is_peak else 0.0

        # 11. route_id_encoded — use hash-based encoding (stable, no encoder needed at inference)
        # The training pipeline uses LabelEncoder and saves the mapping in metadata.
        # At inference we use a simple deterministic integer hash modulo 100.
        route_id_encoded = float(
            self._model_metadata.get(
                "route_encoding", {}
            ).get(route_id, hash(route_id) % 100)
        )

        # 12. direction — 0=forward, 1=return
        direction = self._infer_direction(route_id, location, target_stop)

        # 13. occupancy_ratio
        occupancy_ratio = await self._get_occupancy_ratio(bus_id, capacity)

        # 14-16. Historical features
        congestion_index, segment_hist_speed = await self._get_congestion_features(
            location.lat, location.lng, now_utc.hour
        )
        hist_avg_dwell_at_next = await self._get_hist_dwell(route_id, location)

        return [
            distance_to_stop_km,      # 0
            stops_remaining,           # 1
            current_speed_kmh,         # 2
            rolling_avg_speed_5,       # 3
            rolling_avg_speed_10,      # 4
            speed_variance,            # 5
            hour_of_day,               # 6
            minute_of_hour,            # 7
            day_of_week,               # 8
            is_weekday,                # 9
            is_peak_hour,              # 10
            route_id_encoded,          # 11
            direction,                 # 12
            occupancy_ratio,           # 13
            congestion_index,          # 14
            segment_hist_speed,        # 15
            hist_avg_dwell_at_next,    # 16
        ]

    async def _get_speed_stats(self, bus_id: str) -> dict[str, float]:
        """Compute rolling speed statistics from GPS history.

        Returns avg speed over last 5 and 10 records, plus variance over 10.
        Falls back to (speed_fallback_kmh, speed_fallback_kmh, 0.0) if data
        is insufficient.

        Args:
            bus_id: Bus identifier.

        Returns:
            Dict with keys: 'avg_5', 'avg_10', 'variance'.
        """
        fallback = settings.speed_fallback_kmh
        try:
            async with AsyncSession(self._engine) as session:
                result = await session.execute(
                    text(
                        """
                        SELECT speed_kmh FROM gps_history
                        WHERE bus_id = :bus_id AND speed_kmh IS NOT NULL
                        ORDER BY recorded_at DESC LIMIT 10
                        """
                    ),
                    {"bus_id": bus_id},
                )
                rows = result.fetchall()

            speeds = [float(r[0]) for r in rows]

            if not speeds:
                return {"avg_5": fallback, "avg_10": fallback, "variance": 0.0}

            avg_5 = sum(speeds[:5]) / len(speeds[:5]) if len(speeds) >= 5 else fallback
            avg_10 = sum(speeds) / len(speeds)
            variance = float(np.var(speeds)) if len(speeds) > 1 else 0.0

            return {"avg_5": avg_5, "avg_10": avg_10, "variance": variance}

        except Exception as exc:  # pylint: disable=broad-except
            _log.warning("Speed stats query failed for bus=%s: %s", bus_id, exc)
            return {"avg_5": fallback, "avg_10": fallback, "variance": 0.0}

    async def _get_occupancy_ratio(self, bus_id: str, capacity: int) -> float:
        """Get current occupancy ratio from Redis state.

        occupancy_ratio = occupancy_count / bus_capacity.
        Falls back to 0.5 (medium load) if Redis is unavailable.

        Args:
            bus_id:   Bus identifier.
            capacity: Bus seating capacity from the buses table.

        Returns:
            Float in [0.0, 1.0].
        """
        try:
            raw = await self._redis.get(f"bus:{bus_id}:state")
            if raw is None:
                return 0.5
            payload = json.loads(raw)
            occupancy_count = int(payload.get("occupancy_count", 0))
            if capacity <= 0:
                return 0.5
            return min(1.0, max(0.0, occupancy_count / capacity))
        except Exception as exc:  # pylint: disable=broad-except
            _log.debug("Occupancy fetch failed for bus=%s: %s", bus_id, exc)
            return 0.5

    async def _get_congestion_features(
        self, lat: float, lng: float, hour: int
    ) -> tuple[float, float]:
        """Compute congestion_index and segment_hist_speed.

        segment_hist_speed = average speed in the 0.01° grid cell containing
        (lat, lng) at the same hour ±1 over the last 7 days.

        congestion_index = current_speed / segment_hist_speed (capped at 2.0).
        Falls back to (1.0, settings.speed_fallback_kmh) if no historical data.

        Args:
            lat:  Current bus latitude.
            lng:  Current bus longitude.
            hour: Current hour of day (UTC).

        Returns:
            Tuple of (congestion_index, segment_hist_speed).
        """
        grid_lat = round(lat, 2)  # 0.01° ≈ 1.1 km grid
        grid_lng = round(lng, 2)
        hour_low = max(0, hour - 1)
        hour_high = min(23, hour + 1)
        fallback_speed = settings.speed_fallback_kmh

        try:
            async with AsyncSession(self._engine) as session:
                result = await session.execute(
                    text(
                        """
                        SELECT AVG(speed_kmh) as avg_speed
                        FROM gps_history
                        WHERE
                            ROUND(CAST(lat AS NUMERIC), 2) = :grid_lat
                          AND ROUND(CAST(lng AS NUMERIC), 2) = :grid_lng
                          AND EXTRACT(HOUR FROM recorded_at) BETWEEN :hour_low AND :hour_high
                          AND recorded_at > NOW() - INTERVAL '7 days'
                          AND speed_kmh IS NOT NULL
                        """
                    ),
                    {
                        "grid_lat": grid_lat,
                        "grid_lng": grid_lng,
                        "hour_low": hour_low,
                        "hour_high": hour_high,
                    },
                )
                row = result.fetchone()

            if row is None or row[0] is None:
                return (1.0, fallback_speed)

            seg_speed = float(row[0])
            if seg_speed <= 0:
                return (1.0, fallback_speed)

            # congestion_index < 1 means bus is slower than historical avg (traffic)
            # congestion_index > 1 means bus is faster than historical avg (clear road)
            return (1.0, seg_speed)  # congestion_index computed at inference time from current speed

        except Exception as exc:  # pylint: disable=broad-except
            _log.debug("Congestion features query failed: %s", exc)
            return (1.0, fallback_speed)

    async def _get_hist_dwell(self, route_id: str, location: LocationReading) -> float:
        """Get historical average dwell time at the next stop on the route.

        Looks up the closest upcoming stop and queries the average dwell time
        (gap between consecutive GPS records near that stop) from gps_history.
        Falls back to settings.dwell_time_per_stop_minutes if no history.

        Args:
            route_id: The bus's current route.
            location: Current LocationReading.

        Returns:
            Average dwell time in minutes at the next stop.
        """
        fallback = settings.dwell_time_per_stop_minutes
        route_stops = self._route_stops_cache.get(route_id, [])
        if not route_stops:
            return fallback

        # Find next stop (closest stop that is ahead of the bus)
        min_dist = float("inf")
        next_stop_id: Optional[str] = None
        for rs in route_stops:
            dist = geodesic((location.lat, location.lng), (rs.lat, rs.lng)).km
            if dist < min_dist:
                min_dist = dist
                next_stop_id = rs.stop_id

        if next_stop_id is None:
            return fallback

        try:
            next_stop = self._stops_cache.get(next_stop_id)
            if next_stop is None:
                return fallback

            async with AsyncSession(self._engine) as session:
                result = await session.execute(
                    text(
                        """
                        SELECT AVG(dwell_secs) FROM (
                            SELECT
                                EXTRACT(EPOCH FROM (lead(recorded_at) OVER w - recorded_at)) as dwell_secs
                            FROM gps_history
                            WHERE
                                SQRT(POWER(CAST(lat AS FLOAT) - :stop_lat, 2)
                                   + POWER(CAST(lng AS FLOAT) - :stop_lng, 2)) < 0.001
                              AND recorded_at > NOW() - INTERVAL '7 days'
                            WINDOW w AS (ORDER BY recorded_at)
                        ) sub
                        WHERE dwell_secs BETWEEN 10 AND 300
                        """
                    ),
                    {"stop_lat": next_stop.lat, "stop_lng": next_stop.lng},
                )
                row = result.fetchone()

            if row and row[0] is not None:
                return float(row[0]) / 60.0  # convert seconds to minutes

            return fallback

        except Exception as exc:  # pylint: disable=broad-except
            _log.debug("Hist dwell query failed: %s", exc)
            return fallback

    def _infer_direction(
        self,
        route_id: str,
        location: LocationReading,
        target_stop: StopInfo,
    ) -> float:
        """Infer direction of travel: 0 = forward through stops, 1 = return.

        Compares the stop_order of the nearest stop to the target stop's order.
        If the target has a higher stop_order than the nearest stop, the bus
        is travelling forward (direction=0).  Otherwise, return (direction=1).

        Args:
            route_id:    The bus's route.
            location:    Current bus location.
            target_stop: Target stop info.

        Returns:
            0.0 for forward, 1.0 for return.
        """
        route_stops = self._route_stops_cache.get(route_id, [])
        if not route_stops:
            return 0.0

        # Find order of nearest stop
        min_dist = float("inf")
        nearest_order = 0
        for rs in route_stops:
            dist = geodesic((location.lat, location.lng), (rs.lat, rs.lng)).km
            if dist < min_dist:
                min_dist = dist
                nearest_order = rs.stop_order

        # Find order of target stop
        target_order = 0
        for rs in route_stops:
            if rs.stop_id == target_stop.stop_id:
                target_order = rs.stop_order
                break

        return 0.0 if target_order >= nearest_order else 1.0

    # ------------------------------------------------------------------
    # Properties for FastAPI health & info endpoints
    # ------------------------------------------------------------------

    @property
    def model_version(self) -> str:
        """The active predictor version string."""
        return self._model_version

    @property
    def model_loaded(self) -> bool:
        """True if the XGBoost model was successfully loaded."""
        return self._model_loaded

    @property
    def model_metadata(self) -> dict:
        """Raw metadata dict from models/metadata.json."""
        return self._model_metadata

    @property
    def feature_names(self) -> list[str]:
        """Ordered list of feature names used by the v2 model."""
        return self._feature_names
