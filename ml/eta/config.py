"""
config.py — NXTBus ML/ETA Service Configuration
================================================
Central settings module for the entire ml/eta package.

All values are read from environment variables (or a .env file).
Import `settings` from this module everywhere configuration is needed.
No credentials or URLs are ever hardcoded.

Usage:
    from config import settings
    print(settings.database_url)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# Path constants — relative to this file's directory
# ---------------------------------------------------------------------------

# Root of nxtbus/ml/eta/
ETA_ROOT: Path = Path(__file__).parent.resolve()

# Default model artefact directory (gitignored)
DEFAULT_MODEL_DIR: Path = ETA_ROOT / "models"
DEFAULT_MODEL_PATH: Path = DEFAULT_MODEL_DIR / "eta_v2_xgb.pkl"
DEFAULT_METADATA_PATH: Path = DEFAULT_MODEL_DIR / "metadata.json"


# ---------------------------------------------------------------------------
# Settings model
# ---------------------------------------------------------------------------


class Settings(BaseSettings):
    """Runtime configuration for the NXTBus ETA service.

    All fields are populated from environment variables or a `.env` file
    located in the project root.  Pydantic-settings handles type coercion,
    validation, and documentation automatically.

    Environment variable names are the uppercased field names.
    Example: ``database_url`` → ``DATABASE_URL``.
    """

    model_config = SettingsConfigDict(
        env_file=str(ETA_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Don't raise on extra vars that aren't defined here
        extra="ignore",
    )

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/nxtbus",
        description=(
            "Async PostgreSQL DSN used by SQLAlchemy 2.x + asyncpg. "
            "Must start with 'postgresql+asyncpg://'. "
            "Example: postgresql+asyncpg://user:pass@host:5432/nxtbus"
        ),
    )

    # ------------------------------------------------------------------
    # Redis
    # ------------------------------------------------------------------

    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description=(
            "Redis connection URL for async redis-py client. "
            "Example: redis://localhost:6379/0 or "
            "redis://:password@host:6379/0"
        ),
    )

    # ------------------------------------------------------------------
    # Model artefacts
    # ------------------------------------------------------------------

    model_path: Path = Field(
        default=DEFAULT_MODEL_PATH,
        description=(
            "Absolute or relative path to the serialised XGBoost model file "
            "(eta_v2_xgb.pkl). If this file does not exist, the service "
            "automatically falls back to the v1 rule-based predictor."
        ),
    )

    metadata_path: Path = Field(
        default=DEFAULT_METADATA_PATH,
        description=(
            "Path to metadata.json produced by training/train.py. "
            "Exposed via the GET /model/info endpoint."
        ),
    )

    # ------------------------------------------------------------------
    # Location provider selection
    # ------------------------------------------------------------------

    location_provider: Literal["phone_gps", "hardware_gps", "simulated"] = Field(
        default="phone_gps",
        description=(
            "Selects which LocationProvider implementation to inject. "
            "  phone_gps   — reads driver's mobile phone GPS from Redis (MVP default). "
            "  hardware_gps — reads Teltonika FMB920 hardware GPS from Redis. "
            "  simulated   — deterministic fake positions for unit tests."
        ),
    )

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Python logging level for all loggers in this service.",
    )

    # ------------------------------------------------------------------
    # Serving
    # ------------------------------------------------------------------

    host: str = Field(
        default="0.0.0.0",
        description="Host interface for the Uvicorn server.",
    )

    port: int = Field(
        default=8001,
        description="TCP port the FastAPI ETA service listens on.",
    )

    workers: int = Field(
        default=2,
        description="Number of Uvicorn worker processes.",
        ge=1,
        le=16,
    )

    # ------------------------------------------------------------------
    # Phase-2 activation threshold
    # ------------------------------------------------------------------

    v2_activation_threshold: int = Field(
        default=5_000,
        description=(
            "Minimum number of GPS history rows recorded in the last 14 days "
            "required before the system considers switching from v1 (rule-based) "
            "to v2 (XGBoost). Used during predictor startup."
        ),
        ge=100,
    )

    v2_activation_window_days: int = Field(
        default=14,
        description="Look-back window in days used for the v2 activation row count.",
        ge=1,
        le=90,
    )

    # ------------------------------------------------------------------
    # v1 Rule-based constants
    # ------------------------------------------------------------------

    dwell_time_per_stop_minutes: float = Field(
        default=0.75,
        description=(
            "Assumed dwell time (minutes) per intermediate stop in the "
            "v1 rule-based ETA formula. Configurable without redeployment."
        ),
        gt=0.0,
        le=5.0,
    )

    speed_floor_kmh: float = Field(
        default=15.0,
        description=(
            "Minimum speed (km/h) assumed for ETA calculation. "
            "Prevents division-by-zero and unrealistically high ETAs "
            "when a bus is temporarily stationary."
        ),
        gt=0.0,
        le=60.0,
    )

    rolling_speed_window: int = Field(
        default=10,
        description=(
            "Number of recent GPS records used to compute rolling average speed "
            "for the v1 predictor and the rolling_avg_speed_10 feature."
        ),
        ge=3,
        le=50,
    )

    speed_fallback_kmh: float = Field(
        default=25.0,
        description=(
            "Default speed (km/h) used when fewer than `rolling_speed_window` "
            "GPS records exist for a given bus_id."
        ),
        gt=0.0,
        le=120.0,
    )

    # ------------------------------------------------------------------
    # Feature engineering
    # ------------------------------------------------------------------

    visakhapatnam_bbox: dict[str, float] = Field(
        default={
            "lat_min": 17.50,
            "lat_max": 17.90,
            "lng_min": 83.10,
            "lng_max": 83.50,
        },
        description=(
            "Bounding box for Visakhapatnam city used in data validation. "
            "GPS readings outside this box are flagged as invalid."
        ),
    )

    stop_arrival_radius_meters: float = Field(
        default=60.0,
        description=(
            "Radius (metres) within which a GPS fix is considered an 'arrival' "
            "at a stop. Used in extract_stop_arrivals() to derive training labels."
        ),
        gt=10.0,
        le=200.0,
    )

    segment_hist_speed_window_days: int = Field(
        default=7,
        description=(
            "Look-back window (days) for computing segment_hist_speed feature: "
            "average speed in a GPS grid cell at the same hour ±1."
        ),
        ge=1,
        le=30,
    )

    # ------------------------------------------------------------------
    # MLflow
    # ------------------------------------------------------------------

    mlflow_tracking_uri: str = Field(
        default="./mlruns",
        description=(
            "MLflow tracking server URI. Use a local path for development, "
            "a remote URI (e.g. http://mlflow-server:5000) for production."
        ),
    )

    mlflow_experiment_name: str = Field(
        default="nxtbus_eta_prediction",
        description="Name of the MLflow experiment all training runs are logged to.",
    )

    # ------------------------------------------------------------------
    # Validators
    # ------------------------------------------------------------------

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure the database URL uses the async asyncpg driver.

        SQLAlchemy 2.x requires 'postgresql+asyncpg://' for async operation.
        A plain 'postgresql://' URL would silently fall back to synchronous
        psycopg2 and block the event loop.

        Args:
            v: The raw DATABASE_URL string.

        Returns:
            The validated URL string.

        Raises:
            ValueError: If the URL does not start with 'postgresql+asyncpg://'.
        """
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError(
                f"DATABASE_URL must start with 'postgresql+asyncpg://', got: {v!r}. "
                "Using a synchronous driver would block the async event loop."
            )
        return v

    @field_validator("model_path", "metadata_path", mode="before")
    @classmethod
    def resolve_path(cls, v: object) -> Path:
        """Coerce string paths to Path objects and resolve relative paths.

        Args:
            v: A string or Path value from the environment.

        Returns:
            An absolute Path.
        """
        return Path(str(v)).resolve()


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

settings = Settings()

# ---------------------------------------------------------------------------
# Configure root logger immediately when this module is first imported.
# Every other module in this package does `logging.getLogger(__name__)` and
# inherits the level set here.
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

_log = logging.getLogger(__name__)
_log.debug("Settings loaded: provider=%s log_level=%s", settings.location_provider, settings.log_level)
