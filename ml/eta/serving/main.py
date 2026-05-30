"""
serving/main.py — NXTBus ETA FastAPI Application
=================================================
Entrypoint for the ETA microservice.  Exposes three endpoints:

  POST /eta          → ETAResponse   (called by Track B NestJS backend)
  GET  /health       → HealthResponse
  GET  /model/info   → ModelInfoResponse

Lifecycle:
  - On startup:  creates DB engine, Redis client, initialises predictor.
  - On shutdown: closes all connections gracefully.

The service is fully async end-to-end (asyncpg + redis-py asyncio mode).
p95 latency target: < 50ms per /eta request.

Run locally:
    uvicorn serving.main:app --host 0.0.0.0 --port 8001 --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis, ConnectionPool
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

from config import settings
from serving.schemas import ETARequest, ETAResponse, HealthResponse, ModelInfoResponse
from serving.predictor import ETAPredictor, ETAComputationError
from serving.providers import get_provider

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifespan — startup and shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """FastAPI lifespan context manager.

    Initialises all shared resources before the server starts accepting
    requests, and tears them down gracefully when the server stops.

    Resources created here:
      - SQLAlchemy async engine (connection pool to PostgreSQL).
      - Redis async client (connection pool to Redis).
      - LocationProvider (depends on LOCATION_PROVIDER env var).
      - ETAPredictor (loads model + warms route cache).

    These are stored on ``app.state`` and accessed by route handlers
    through FastAPI dependency injection.
    """
    _log.info("NXTBus ETA service starting up...")

    # --- PostgreSQL async engine ---
    engine: AsyncEngine = create_async_engine(
        str(settings.database_url),
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,    # verify connections before use
        pool_recycle=3600,     # recycle connections every hour
        echo=settings.log_level == "DEBUG",
    )
    _log.info("PostgreSQL engine created (pool_size=5, max_overflow=10).")

    # --- Redis async client ---
    redis_pool = ConnectionPool.from_url(
        str(settings.redis_url),
        max_connections=20,
        decode_responses=False,  # we decode manually in providers.py
    )
    redis_client: Redis = Redis(connection_pool=redis_pool)
    _log.info("Redis client created (max_connections=20).")

    # --- Location provider ---
    provider = get_provider(redis_client=redis_client)

    # --- Predictor ---
    predictor = ETAPredictor(
        engine=engine,
        redis=redis_client,
        provider=provider,
    )
    await predictor.startup()

    # Store on app.state for route handler access
    app.state.engine = engine
    app.state.redis = redis_client
    app.state.predictor = predictor

    _log.info(
        "NXTBus ETA service ready. model_version=%s model_loaded=%s",
        predictor.model_version,
        predictor.model_loaded,
    )

    yield  # --- application is live and serving requests ---

    # --- Shutdown ---
    _log.info("NXTBus ETA service shutting down...")
    predictor.shutdown()
    await redis_client.aclose()
    await engine.dispose()
    _log.info("All connections closed. Goodbye.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------


app = FastAPI(
    title="NXTBus ETA Prediction Service",
    description=(
        "ML-powered bus arrival time prediction for Visakhapatnam, India. "
        "Provides real-time ETA estimates using GPS tracking data. "
        "Operates in two modes: v1 rule-based (Day 1) and v2 XGBoost (after 14 days of data)."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# --- CORS — only internal Track B backend should call this service ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Restrict to backend's origin in production
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(ETAComputationError)
async def eta_computation_error_handler(
    request: Request, exc: ETAComputationError
) -> JSONResponse:
    """Handle ETAComputationError with a structured 503 response.

    Returns a JSON error body so Track B gets a parseable error, not HTML.
    """
    _log.error("ETAComputationError on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": "eta_computation_failed",
            "detail": str(exc),
            "path": str(request.url.path),
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catch-all handler to prevent leaking stack traces to the caller."""
    _log.exception("Unhandled exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "detail": "An unexpected error occurred. Check service logs.",
            "path": str(request.url.path),
        },
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post(
    "/eta",
    response_model=ETAResponse,
    summary="Predict bus ETA to a target stop",
    response_description="Predicted arrival time in minutes with confidence score",
    tags=["Prediction"],
    status_code=status.HTTP_200_OK,
)
async def predict_eta(request: ETARequest, http_request: Request) -> ETAResponse:
    """Compute and return the ETA for a bus arriving at a specific stop.

    Called by the Track B NestJS backend whenever a commuter requests
    arrival time information in the Track C mobile app.

    The response shape is guaranteed regardless of whether the v1 rule-based
    or v2 XGBoost model is active.  Track B should never branch on
    ``model_version`` in the response.

    **Latency target**: p95 < 50ms.  This endpoint performs:
    - One async Redis GET (~1ms)
    - One async PostgreSQL query for rolling speed (~5ms)
    - XGBoost inference if v2 active (~2ms)

    Args:
        request:      Validated ETARequest with bus_id and target_stop_id.
        http_request: FastAPI Request for accessing app.state.

    Returns:
        ETAResponse with eta_minutes, confidence, model_version, computed_at.

    Raises:
        HTTPException(503): If ETA cannot be computed (re-raised from ETAComputationError handler).
        HTTPException(422): If request body fails Pydantic validation.
    """
    predictor: ETAPredictor = http_request.app.state.predictor
    result = await predictor.predict(request)
    return result


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    tags=["Operations"],
    status_code=status.HTTP_200_OK,
)
async def health_check(request: Request) -> HealthResponse:
    """Return the health status of the ETA service.

    Used by:
      - Docker health checks (``HEALTHCHECK`` instruction in Dockerfile).
      - Load balancers to decide whether to route traffic.
      - Track B backend to detect service degradation.

    A ``status='degraded'`` response means the service is running but
    using the v1 rule-based fallback (XGBoost model not loaded).
    This is expected on Day 1 before training data exists.

    Returns:
        HealthResponse with status, model_loaded, model_version.
    """
    predictor: ETAPredictor = request.app.state.predictor
    model_loaded = predictor.model_loaded
    model_version = predictor.model_version

    return HealthResponse(
        status="ok" if model_loaded else "degraded",
        model_loaded=model_loaded,
        model_version=model_version,  # type: ignore[arg-type]
    )


@app.get(
    "/model/info",
    response_model=ModelInfoResponse,
    summary="Model metadata and accuracy metrics",
    tags=["Operations"],
    status_code=status.HTTP_200_OK,
)
async def model_info(request: Request) -> ModelInfoResponse:
    """Return metadata about the currently active prediction model.

    For v2 XGBoost, returns accuracy metrics (MAE, RMSE) and training
    metadata from ``models/metadata.json``.

    For v1 rule-based, returns minimal info with null accuracy fields.

    Returns:
        ModelInfoResponse with version, mae_minutes, trained_at, features.
    """
    predictor: ETAPredictor = request.app.state.predictor
    meta = predictor.model_metadata

    if not predictor.model_loaded:
        # v1 rule-based — no training metadata
        return ModelInfoResponse(
            version="v1_rule_based",
            mae_minutes=None,
            rmse_minutes=None,
            trained_at=None,
            n_samples=None,
            features=[],
            xgb_version=None,
        )

    # v2 XGBoost — parse metadata.json
    trained_at_raw = meta.get("trained_at")
    trained_at: datetime | None = None
    if trained_at_raw:
        try:
            trained_at = datetime.fromisoformat(trained_at_raw)
            if trained_at.tzinfo is None:
                trained_at = trained_at.replace(tzinfo=timezone.utc)
        except ValueError:
            _log.warning("Could not parse trained_at=%r from metadata.", trained_at_raw)

    return ModelInfoResponse(
        version=meta.get("version", "v2_xgb"),
        mae_minutes=meta.get("mae"),
        rmse_minutes=meta.get("rmse"),
        trained_at=trained_at,
        n_samples=meta.get("n_samples"),
        features=meta.get("feature_names", predictor.feature_names),
        xgb_version=meta.get("xgb_version"),
    )


# ---------------------------------------------------------------------------
# Root redirect for convenience
# ---------------------------------------------------------------------------


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    """Root endpoint — redirect hint to /docs."""
    return JSONResponse(
        content={
            "service": "NXTBus ETA Prediction Service",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/health",
        }
    )
