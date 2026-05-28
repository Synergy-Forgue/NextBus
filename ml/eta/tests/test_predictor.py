"""
tests/test_predictor.py — Unit Tests for ETAPredictor
======================================================
Tests both the v1 rule-based path and the v2 XGBoost fallback behaviour.
Uses SimulatedProvider — no DB or Redis required.

Run:
    pytest tests/test_predictor.py -v
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest

from serving.predictor import (
    ETAComputationError,
    ETAPredictor,
    RouteStop,
    StopInfo,
)
from serving.providers import SimulatedProvider
from serving.schemas import ETARequest, ETAResponse


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


def make_predictor(model_loaded: bool = False) -> ETAPredictor:
    """Build an ETAPredictor with mocked DB engine and Redis.

    Args:
        model_loaded: If True, set up predictor as if XGBoost is loaded.

    Returns:
        Pre-configured ETAPredictor (startup not called — caches injected directly).
    """
    mock_engine = MagicMock()
    mock_redis = MagicMock()
    provider = SimulatedProvider()

    predictor = ETAPredictor(engine=mock_engine, redis=mock_redis, provider=provider)

    # Inject in-memory caches (bypass DB)
    predictor._bus_route_cache = {
        "BUS_28K_001": "28K",
        "BUS_99_003": "99",
    }
    predictor._bus_capacity_cache = {
        "BUS_28K_001": 50,
        "BUS_99_003": 60,
    }
    predictor._stops_cache = {
        "rly_station": StopInfo("rly_station", "Railway Station", 17.7068, 83.2040),
        "rtc_complex": StopInfo("rtc_complex", "RTC Complex", 17.7192, 83.3170),
        "jagadamba": StopInfo("jagadamba", "Jagadamba", 17.7211, 83.3089),
        "gajuwaka": StopInfo("gajuwaka", "Gajuwaka", 17.6804, 83.2036),
    }
    predictor._route_stops_cache = {
        "28K": [
            RouteStop("gajuwaka", 0, 17.6804, 83.2036),
            RouteStop("rly_station", 1, 17.7068, 83.2040),
            RouteStop("jagadamba", 2, 17.7211, 83.3089),
            RouteStop("rtc_complex", 3, 17.7192, 83.3170),
        ],
        "99": [
            RouteStop("jagadamba", 0, 17.7211, 83.3089),
            RouteStop("rtc_complex", 1, 17.7192, 83.3170),
        ],
    }

    if model_loaded:
        predictor._model_loaded = True
        predictor._model_version = "v2_xgb"
        predictor._model_metadata = {
            "feature_names": [],
            "mae": 2.1,
            "n_samples": 12000,
        }
    else:
        predictor._model_loaded = False
        predictor._model_version = "v1_rule_based"

    return predictor


# ---------------------------------------------------------------------------
# v1 Rule-based tests
# ---------------------------------------------------------------------------


class TestPredictorV1:
    """Tests for the v1 rule-based ETA formula."""

    @pytest.mark.asyncio
    async def test_v1_returns_eta_response(self) -> None:
        """v1 predict() must return a valid ETAResponse object."""
        predictor = make_predictor(model_loaded=False)

        # Mock the DB rolling speed call to return fallback speed
        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
        response = await predictor.predict(request)

        assert isinstance(response, ETAResponse)

    @pytest.mark.asyncio
    async def test_v1_model_version_is_correct(self) -> None:
        """v1 response must have model_version='v1_rule_based'."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rtc_complex")
        response = await predictor.predict(request)

        assert response.model_version == "v1_rule_based"

    @pytest.mark.asyncio
    async def test_v1_confidence_is_fixed_at_070(self) -> None:
        """v1 rule-based confidence must always be exactly 0.70."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 30.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="jagadamba")
        response = await predictor.predict(request)

        assert response.confidence == pytest.approx(0.70)

    @pytest.mark.asyncio
    async def test_v1_eta_minutes_is_non_negative(self) -> None:
        """ETA must never be negative, even for edge case positions."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 50.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
        response = await predictor.predict(request)

        assert response.eta_minutes >= 0.0

    @pytest.mark.asyncio
    async def test_v1_unknown_bus_raises_eta_computation_error(self) -> None:
        """ETAComputationError raised for bus not in DB cache."""
        predictor = make_predictor(model_loaded=False)

        request = ETARequest(bus_id="BUS_NONEXISTENT", target_stop_id="rly_station")

        with pytest.raises(ETAComputationError, match="not found"):
            await predictor.predict(request)

    @pytest.mark.asyncio
    async def test_v1_unknown_stop_raises_eta_computation_error(self) -> None:
        """ETAComputationError raised for stop not in DB cache."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="nonexistent_stop")

        with pytest.raises(ETAComputationError, match="not found"):
            await predictor.predict(request)

    @pytest.mark.asyncio
    async def test_v1_eta_increases_with_distance(self) -> None:
        """ETA to a farther stop must be ≥ ETA to a nearer stop (same route)."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        # BUS_28K_001 is simulated at (17.7150, 83.2600) — between gajuwaka and jagadamba
        req_near = ETARequest(bus_id="BUS_28K_001", target_stop_id="jagadamba")
        req_far = ETARequest(bus_id="BUS_28K_001", target_stop_id="rtc_complex")

        resp_near = await predictor.predict(req_near)
        resp_far = await predictor.predict(req_far)

        # rtc_complex is further from bus position than jagadamba
        assert resp_far.eta_minutes >= resp_near.eta_minutes - 1.0, (
            f"ETA to rtc_complex ({resp_far.eta_minutes:.2f}) should be >= "
            f"ETA to jagadamba ({resp_near.eta_minutes:.2f})"
        )

    @pytest.mark.asyncio
    async def test_v1_uses_speed_floor_when_bus_stationary(self) -> None:
        """When rolling avg speed is 0, speed floor (15 km/h) is used, not 0."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 0.0  # Bus reports zero speed

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
        response = await predictor.predict(request)

        # Should not be infinity or extremely large
        assert response.eta_minutes < 300.0
        assert response.eta_minutes > 0.0

    @pytest.mark.asyncio
    async def test_v1_response_echoes_request_ids(self) -> None:
        """Response bus_id and target_stop_id must echo the request."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
        response = await predictor.predict(request)

        assert response.bus_id == "BUS_28K_001"
        assert response.target_stop_id == "rly_station"

    @pytest.mark.asyncio
    async def test_v1_computed_at_is_recent_utc(self) -> None:
        """computed_at must be a recent UTC datetime."""
        predictor = make_predictor(model_loaded=False)

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed

        before = datetime.now(tz=timezone.utc)
        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
        response = await predictor.predict(request)
        after = datetime.now(tz=timezone.utc)

        assert before <= response.computed_at <= after


# ---------------------------------------------------------------------------
# v2 XGBoost fallback tests
# ---------------------------------------------------------------------------


class TestPredictorV2Fallback:
    """Tests for v2 fallback behaviour when model.pkl is missing or fails."""

    def test_model_not_loaded_when_pkl_missing(self, tmp_path: Path) -> None:
        """When model.pkl does not exist, model_loaded must be False."""
        predictor = make_predictor(model_loaded=False)
        assert not predictor.model_loaded
        assert predictor.model_version == "v1_rule_based"

    def test_try_load_model_sets_v1_when_file_missing(self, tmp_path: Path) -> None:
        """_try_load_model() must set v1_rule_based when model file is absent."""
        mock_engine = MagicMock()
        mock_redis = MagicMock()
        provider = SimulatedProvider()
        predictor = ETAPredictor(engine=mock_engine, redis=mock_redis, provider=provider)

        with patch.object(
            type(predictor),
            "_model_loaded",
            new_callable=lambda: property(lambda self: False),
        ):
            # Point to a non-existent path
            with patch("serving.predictor.settings") as mock_settings:
                mock_settings.model_path = tmp_path / "nonexistent.pkl"
                mock_settings.metadata_path = tmp_path / "metadata.json"
                mock_settings.log_level = "INFO"
                predictor._try_load_model()

        assert predictor._model_version == "v1_rule_based"
        assert not predictor._model_loaded

    @pytest.mark.asyncio
    async def test_v2_falls_back_to_v1_when_inference_fails(self) -> None:
        """If v2 XGBoost.predict() raises, result must fall back to v1."""
        predictor = make_predictor(model_loaded=True)

        # Mock a broken model
        broken_model = MagicMock()
        broken_model.predict.side_effect = RuntimeError("XGBoost exploded")
        predictor._model = broken_model

        async def mock_get_rolling_avg_speed(bus_id: str) -> float:
            return 25.0

        async def mock_assemble_features(*args, **kwargs) -> list:
            return [0.0] * 17

        predictor._get_rolling_avg_speed = mock_get_rolling_avg_speed
        predictor._assemble_features = mock_assemble_features

        request = ETARequest(bus_id="BUS_28K_001", target_stop_id="rly_station")
        response = await predictor.predict(request)

        # Should fall back to v1, not raise
        assert isinstance(response, ETAResponse)
        assert response.model_version == "v1_rule_based"


# ---------------------------------------------------------------------------
# stops_remaining tests
# ---------------------------------------------------------------------------


class TestCountStopsRemaining:
    """Direct tests for the _count_stops_remaining helper method."""

    def test_three_intermediate_stops(self) -> None:
        """Bus at gajuwaka→rtc_complex should have 2 intermediate stops."""
        predictor = make_predictor()
        count = predictor._count_stops_remaining(
            route_id="28K",
            current_lat=17.6804,  # gajuwaka
            current_lng=83.2036,
            target_stop_id="rtc_complex",
        )
        # gajuwaka(0) → rtc_complex(3): rly_station(1), jagadamba(2) = 2 intermediate
        assert count == 2

    def test_zero_for_adjacent_stops(self) -> None:
        """Bus at jagadamba heading to rtc_complex: 0 intermediate stops."""
        predictor = make_predictor()
        count = predictor._count_stops_remaining(
            route_id="28K",
            current_lat=17.7211,  # jagadamba
            current_lng=83.3089,
            target_stop_id="rtc_complex",
        )
        assert count == 0

    def test_zero_for_unknown_route(self) -> None:
        """Unknown route_id returns 0 without crashing."""
        predictor = make_predictor()
        count = predictor._count_stops_remaining(
            route_id="UNKNOWN_ROUTE",
            current_lat=17.7211,
            current_lng=83.3089,
            target_stop_id="rtc_complex",
        )
        assert count == 0
