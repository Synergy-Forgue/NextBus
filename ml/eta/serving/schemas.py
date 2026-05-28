"""
serving/schemas.py — Pydantic API Contracts for the NXTBus ETA Service
=======================================================================
Defines all request and response models used by the FastAPI endpoints.

This file is the single source of truth for the JSON contract between
Track D (ML) and Track B (NestJS backend). If the shape changes here,
the backend must be updated accordingly — and vice versa.

All models use strict types and field-level documentation so that the
auto-generated OpenAPI schema (/docs) is self-describing for Track B
engineers.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------


class ETARequest(BaseModel):
    """Payload sent by Track B (NestJS) to POST /eta.

    Track B calls this endpoint every time a commuter requests the ETA
    for a specific bus arriving at a specific stop.  The ML service uses
    the bus_id to fetch live state from Redis and the target_stop_id to
    look up stop coordinates and remaining stops from PostgreSQL.

    Example:
        {
            "bus_id": "BUS_28K_001",
            "target_stop_id": "rly_station"
        }
    """

    bus_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description=(
            "Unique identifier of the bus. Must match the bus.id column "
            "in PostgreSQL and the Redis key prefix 'bus:{bus_id}:state'. "
            "Example: 'BUS_28K_001'"
        ),
        examples=["BUS_28K_001", "BUS_99_003"],
    )

    target_stop_id: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description=(
            "Unique identifier of the destination stop. Must match stops.id "
            "in PostgreSQL. "
            "Example: 'rly_station'"
        ),
        examples=["rly_station", "rtc_complex", "jagadamba", "gajuwaka"],
    )

    @field_validator("bus_id", "target_stop_id")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        """Strip leading/trailing whitespace from string IDs.

        Protects against accidental whitespace in JSON payloads sent by
        the NestJS client, which would cause Redis/DB lookup misses.

        Args:
            v: The raw string field value.

        Returns:
            The stripped string.

        Raises:
            ValueError: If the stripped value is empty.
        """
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field must not be blank or whitespace-only.")
        return stripped


# ---------------------------------------------------------------------------
# Response Models
# ---------------------------------------------------------------------------


class ETAResponse(BaseModel):
    """Response returned by POST /eta.

    This shape is guaranteed regardless of which predictor version is
    active (v1 rule-based or v2 XGBoost).  Track B and Track C must never
    branch on model_version — it is informational only.

    The confidence field conveys how much to trust the estimate:
      - v1 rule-based: always returns 0.70 (heuristic, no data-driven CI)
      - v2 XGBoost: derived from the model's internal estimate

    Example:
        {
            "bus_id": "BUS_28K_001",
            "target_stop_id": "rly_station",
            "eta_minutes": 7.3,
            "confidence": 0.87,
            "model_version": "v2_xgb",
            "computed_at": "2025-01-24T08:32:11Z"
        }
    """

    bus_id: str = Field(
        ...,
        description="Echo of the bus_id from the request.",
    )

    target_stop_id: str = Field(
        ...,
        description="Echo of the target_stop_id from the request.",
    )

    eta_minutes: float = Field(
        ...,
        ge=0.0,
        le=300.0,
        description=(
            "Predicted time in minutes until the bus arrives at target_stop_id. "
            "Always non-negative. Capped at 300 minutes (5 hours) for sanity. "
            "Track C displays this value directly to commuters."
        ),
        examples=[7.3, 12.5, 2.0],
    )

    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description=(
            "Confidence score in [0.0, 1.0] for this ETA prediction. "
            "v1 rule-based always returns 0.70. "
            "v2 XGBoost returns a data-driven score. "
            "Track C may use this to show a confidence indicator to commuters."
        ),
        examples=[0.87, 0.70, 0.55],
    )

    model_version: Literal["v1_rule_based", "v2_xgb"] = Field(
        ...,
        description=(
            "Identifier of the predictor that produced this response. "
            "  'v1_rule_based' — haversine + dwell formula, no ML model. "
            "  'v2_xgb'        — XGBoost model loaded from eta_v2_xgb.pkl. "
            "Informational only — Track B must not branch on this value."
        ),
    )

    computed_at: datetime = Field(
        ...,
        description=(
            "UTC timestamp at which this ETA was computed. "
            "Serialised as ISO 8601 with timezone suffix (Z). "
            "Track B may use this to detect stale responses."
        ),
        examples=["2025-01-24T08:32:11Z"],
    )

    model_config = {
        "json_encoders": {
            datetime: lambda dt: dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    }


# ---------------------------------------------------------------------------
# Health & Info Responses
# ---------------------------------------------------------------------------


class HealthResponse(BaseModel):
    """Response returned by GET /health.

    Used by Docker health checks, load balancers, and the Track B backend
    to verify the ETA service is alive and has a model loaded.

    Example:
        { "status": "ok", "model_loaded": true, "model_version": "v2_xgb" }
    """

    status: Literal["ok", "degraded", "error"] = Field(
        ...,
        description=(
            "Overall health status. "
            "  'ok'       — service is healthy and model is loaded. "
            "  'degraded' — service is running but using v1 fallback (no model). "
            "  'error'    — service cannot compute ETAs."
        ),
    )

    model_loaded: bool = Field(
        ...,
        description=(
            "True if the XGBoost model (v2) was successfully loaded from disk. "
            "False means the service is running in v1 rule-based fallback mode."
        ),
    )

    model_version: Literal["v1_rule_based", "v2_xgb"] = Field(
        ...,
        description="Version of the active predictor.",
    )

    @model_validator(mode="after")
    def check_status_consistency(self) -> "HealthResponse":
        """Ensure status reflects the model_loaded state.

        If a model is loaded, status must be 'ok'.
        If no model is loaded (v1 fallback), status must be 'degraded'.
        'error' is reserved for cases where ETA computation itself fails.

        Returns:
            The validated model instance.

        Raises:
            ValueError: If status and model_loaded are contradictory.
        """
        if self.model_loaded and self.status != "ok":
            raise ValueError(
                "status must be 'ok' when model_loaded is True, "
                f"got status={self.status!r}"
            )
        if not self.model_loaded and self.status == "ok":
            raise ValueError(
                "status must be 'degraded' (not 'ok') when model_loaded is False."
            )
        return self


class ModelInfoResponse(BaseModel):
    """Response returned by GET /model/info.

    Exposes metadata written by training/train.py into models/metadata.json.
    Track B engineering and ops teams use this to verify which model version
    is running in production and its measured accuracy.

    Example:
        {
            "version": "v2_xgb",
            "mae_minutes": 2.1,
            "rmse_minutes": 3.4,
            "trained_at": "2025-01-20T14:00:00Z",
            "n_samples": 12000,
            "features": ["distance_to_stop_km", "current_speed_kmh", ...]
        }
    """

    version: str = Field(
        ...,
        description="Model version string, e.g. 'v2_xgb' or 'v1_rule_based'.",
    )

    mae_minutes: float | None = Field(
        default=None,
        ge=0.0,
        description=(
            "Mean Absolute Error on the held-out test set, in minutes. "
            "None for v1 rule-based (no training data used). "
            "Target: < 2.5 minutes."
        ),
    )

    rmse_minutes: float | None = Field(
        default=None,
        ge=0.0,
        description=(
            "Root Mean Squared Error on the held-out test set, in minutes. "
            "None for v1 rule-based."
        ),
    )

    trained_at: datetime | None = Field(
        default=None,
        description=(
            "UTC timestamp when this model was trained. "
            "None for v1 rule-based."
        ),
    )

    n_samples: int | None = Field(
        default=None,
        ge=0,
        description=(
            "Total number of labelled training samples used. "
            "None for v1 rule-based."
        ),
    )

    features: list[str] = Field(
        default_factory=list,
        description=(
            "Ordered list of feature names used by the model. "
            "Empty list for v1 rule-based. "
            "Order matches the column order expected by the XGBoost model."
        ),
    )

    xgb_version: str | None = Field(
        default=None,
        description=(
            "XGBoost library version string used during training. "
            "Useful for reproducibility audits. "
            "None for v1 rule-based."
        ),
    )

    model_config = {
        "json_encoders": {
            datetime: lambda dt: dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    }
