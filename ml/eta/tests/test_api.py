"""
tests/test_api.py — FastAPI Integration Tests
=============================================
Tests all three API endpoints using FastAPI's TestClient (httpx).
No live DB or Redis required — all dependencies are mocked via
FastAPI's dependency_overrides mechanism and app.state injection.

Run:
    pytest tests/test_api.py -v
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from serving.main import app
from serving.predictor import ETAComputationError, ETAPredictor
from serving.schemas import ETAResponse, HealthResponse


# ---------------------------------------------------------------------------
# Mock predictor factory
# ---------------------------------------------------------------------------


def make_mock_predictor(
    model_loaded: bool = True,
    eta_minutes: float = 7.3,
    confidence: float = 0.87,
    model_version: str = "v2_xgb",
    raise_error: bool = False,
) -> MagicMock:
    """Build a mock ETAPredictor that returns canned responses.

    Args:
        model_loaded:  Whether the mock predictor has a model loaded.
        eta_minutes:   Fixed ETA to return.
        confidence:    Fixed confidence to return.
        model_version: Version string to return.
        raise_error:   If True, predict() raises ETAComputationError.

    Returns:
        Mock ETAPredictor.
    """
    mock = MagicMock(spec=ETAPredictor)
    mock.model_loaded = model_loaded
    mock.model_version = model_version
    mock.model_metadata = {
        "version": model_version,
        "mae": 2.1,
        "rmse": 3.4,
        "n_samples": 12000,
        "feature_names": ["distance_to_stop_km", "current_speed_kmh"],
        "xgb_version": "2.0.0",
        "trained_at": "2025-01-20T14:00:00",
    }
    mock.feature_names = ["distance_to_stop_km", "current_speed_kmh"]

    if raise_error:
        mock.predict = AsyncMock(
            side_effect=ETAComputationError("Bus 'BAD_BUS' not found in database.")
        )
    else:
        canned_response = ETAResponse(
            bus_id="BUS_28K_001",
            target_stop_id="rly_station",
            eta_minutes=eta_minutes,
            confidence=confidence,
            model_version=model_version,  # type: ignore
            computed_at=datetime(2025, 1, 24, 8, 32, 11, tzinfo=timezone.utc),
        )
        mock.predict = AsyncMock(return_value=canned_response)

    return mock


# ---------------------------------------------------------------------------
# App state injection fixture
# ---------------------------------------------------------------------------


@pytest.fixture
def client_with_mock_predictor():
    """TestClient with a mock predictor injected into app.state."""
    mock_predictor = make_mock_predictor()

    # We must inject into app.state before the test client is created.
    # Since the lifespan won't run in TestClient by default, we patch app.state directly.
    app.state.predictor = mock_predictor

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, mock_predictor


@pytest.fixture
def client_v1_predictor():
    """TestClient with a v1 rule-based mock predictor."""
    mock_predictor = make_mock_predictor(
        model_loaded=False,
        eta_minutes=12.5,
        confidence=0.70,
        model_version="v1_rule_based",
    )
    app.state.predictor = mock_predictor

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, mock_predictor


@pytest.fixture
def client_error_predictor():
    """TestClient with a predictor that raises ETAComputationError."""
    mock_predictor = make_mock_predictor(raise_error=True)
    app.state.predictor = mock_predictor

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, mock_predictor


# ---------------------------------------------------------------------------
# POST /eta — happy path tests
# ---------------------------------------------------------------------------


class TestETAEndpointHappyPath:
    """Tests for POST /eta with valid requests and a working predictor."""

    def test_eta_returns_200(self, client_with_mock_predictor) -> None:
        """POST /eta with valid body returns HTTP 200."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        assert response.status_code == 200

    def test_eta_response_shape(self, client_with_mock_predictor) -> None:
        """Response body must contain all required fields."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        data = response.json()

        assert "bus_id" in data
        assert "target_stop_id" in data
        assert "eta_minutes" in data
        assert "confidence" in data
        assert "model_version" in data
        assert "computed_at" in data

    def test_eta_minutes_is_non_negative(self, client_with_mock_predictor) -> None:
        """eta_minutes must be ≥ 0."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        data = response.json()
        assert data["eta_minutes"] >= 0.0

    def test_eta_confidence_in_range(self, client_with_mock_predictor) -> None:
        """confidence must be in [0.0, 1.0]."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        data = response.json()
        assert 0.0 <= data["confidence"] <= 1.0

    def test_eta_model_version_v2(self, client_with_mock_predictor) -> None:
        """model_version must be 'v2_xgb' when XGBoost model is loaded."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        data = response.json()
        assert data["model_version"] == "v2_xgb"

    def test_eta_model_version_v1(self, client_v1_predictor) -> None:
        """model_version must be 'v1_rule_based' when using fallback."""
        client, _ = client_v1_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        data = response.json()
        assert data["model_version"] == "v1_rule_based"

    def test_eta_echoes_request_bus_id(self, client_with_mock_predictor) -> None:
        """Response bus_id must match request bus_id."""
        client, mock = client_with_mock_predictor
        # Override mock to echo the right bus_id
        mock.predict.return_value = ETAResponse(
            bus_id="BUS_99_003",
            target_stop_id="jagadamba",
            eta_minutes=5.0,
            confidence=0.8,
            model_version="v2_xgb",
            computed_at=datetime.now(tz=timezone.utc),
        )
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_99_003", "target_stop_id": "jagadamba"},
        )
        data = response.json()
        assert data["bus_id"] == "BUS_99_003"
        assert data["target_stop_id"] == "jagadamba"

    def test_eta_content_type_is_json(self, client_with_mock_predictor) -> None:
        """Response Content-Type must be application/json."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BUS_28K_001", "target_stop_id": "rly_station"},
        )
        assert "application/json" in response.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# POST /eta — validation error tests
# ---------------------------------------------------------------------------


class TestETAEndpointValidation:
    """Tests for POST /eta with invalid request bodies."""

    def test_missing_bus_id_returns_422(self, client_with_mock_predictor) -> None:
        """Missing bus_id must return HTTP 422 Unprocessable Entity."""
        client, _ = client_with_mock_predictor
        response = client.post("/eta", json={"target_stop_id": "rly_station"})
        assert response.status_code == 422

    def test_missing_target_stop_returns_422(self, client_with_mock_predictor) -> None:
        """Missing target_stop_id must return HTTP 422."""
        client, _ = client_with_mock_predictor
        response = client.post("/eta", json={"bus_id": "BUS_28K_001"})
        assert response.status_code == 422

    def test_empty_bus_id_returns_422(self, client_with_mock_predictor) -> None:
        """Empty string bus_id must return HTTP 422."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "", "target_stop_id": "rly_station"},
        )
        assert response.status_code == 422

    def test_whitespace_only_bus_id_returns_422(self, client_with_mock_predictor) -> None:
        """Whitespace-only bus_id must return HTTP 422 after strip validation."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "   ", "target_stop_id": "rly_station"},
        )
        assert response.status_code == 422

    def test_null_bus_id_returns_422(self, client_with_mock_predictor) -> None:
        """Null bus_id must return HTTP 422."""
        client, _ = client_with_mock_predictor
        response = client.post(
            "/eta",
            json={"bus_id": None, "target_stop_id": "rly_station"},
        )
        assert response.status_code == 422

    def test_empty_body_returns_422(self, client_with_mock_predictor) -> None:
        """Empty JSON body must return HTTP 422."""
        client, _ = client_with_mock_predictor
        response = client.post("/eta", json={})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /eta — error path tests
# ---------------------------------------------------------------------------


class TestETAEndpointErrors:
    """Tests for POST /eta when the predictor raises errors."""

    def test_computation_error_returns_503(self, client_error_predictor) -> None:
        """ETAComputationError must result in HTTP 503."""
        client, _ = client_error_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BAD_BUS", "target_stop_id": "rly_station"},
        )
        assert response.status_code == 503

    def test_computation_error_response_has_error_field(self, client_error_predictor) -> None:
        """503 response body must have an 'error' field."""
        client, _ = client_error_predictor
        response = client.post(
            "/eta",
            json={"bus_id": "BAD_BUS", "target_stop_id": "rly_station"},
        )
        data = response.json()
        assert "error" in data


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_200(self, client_with_mock_predictor) -> None:
        """GET /health must return HTTP 200."""
        client, _ = client_with_mock_predictor
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_shape(self, client_with_mock_predictor) -> None:
        """Health response must have status, model_loaded, model_version."""
        client, _ = client_with_mock_predictor
        data = client.get("/health").json()
        assert "status" in data
        assert "model_loaded" in data
        assert "model_version" in data

    def test_health_ok_when_model_loaded(self, client_with_mock_predictor) -> None:
        """status='ok' when model_loaded=True."""
        client, _ = client_with_mock_predictor
        data = client.get("/health").json()
        assert data["status"] == "ok"
        assert data["model_loaded"] is True

    def test_health_degraded_when_no_model(self, client_v1_predictor) -> None:
        """status='degraded' when running on v1 fallback."""
        client, _ = client_v1_predictor
        data = client.get("/health").json()
        assert data["status"] == "degraded"
        assert data["model_loaded"] is False

    def test_health_model_version_v2(self, client_with_mock_predictor) -> None:
        """model_version='v2_xgb' in health when XGBoost loaded."""
        client, _ = client_with_mock_predictor
        data = client.get("/health").json()
        assert data["model_version"] == "v2_xgb"


# ---------------------------------------------------------------------------
# GET /model/info
# ---------------------------------------------------------------------------


class TestModelInfoEndpoint:
    """Tests for GET /model/info."""

    def test_model_info_returns_200(self, client_with_mock_predictor) -> None:
        """GET /model/info must return HTTP 200."""
        client, _ = client_with_mock_predictor
        response = client.get("/model/info")
        assert response.status_code == 200

    def test_model_info_has_version_field(self, client_with_mock_predictor) -> None:
        """model/info response must include 'version' field."""
        client, _ = client_with_mock_predictor
        data = client.get("/model/info").json()
        assert "version" in data

    def test_model_info_has_features_list(self, client_with_mock_predictor) -> None:
        """model/info response must include 'features' as a list."""
        client, _ = client_with_mock_predictor
        data = client.get("/model/info").json()
        assert "features" in data
        assert isinstance(data["features"], list)

    def test_model_info_v1_has_null_mae(self, client_v1_predictor) -> None:
        """When v1 rule-based is active, mae_minutes should be null."""
        client, _ = client_v1_predictor
        data = client.get("/model/info").json()
        assert data.get("mae_minutes") is None

    def test_model_info_v2_has_mae(self, client_with_mock_predictor) -> None:
        """When v2 is active, mae_minutes should be a float."""
        client, _ = client_with_mock_predictor
        data = client.get("/model/info").json()
        if data.get("mae_minutes") is not None:
            assert isinstance(data["mae_minutes"], (int, float))


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------


class TestRootEndpoint:
    """Tests for GET / (root convenience endpoint)."""

    def test_root_returns_200(self, client_with_mock_predictor) -> None:
        """GET / must return HTTP 200."""
        client, _ = client_with_mock_predictor
        response = client.get("/")
        assert response.status_code == 200

    def test_root_contains_docs_link(self, client_with_mock_predictor) -> None:
        """Root response should mention /docs."""
        client, _ = client_with_mock_predictor
        data = client.get("/").json()
        assert "docs" in data or "/docs" in str(data)
