"""
serving/providers.py — LocationProvider Abstraction
====================================================
Defines the LocationProvider ABC and all three concrete implementations.

The rest of the ML pipeline (predictor, feature engineering, tests) calls
``provider.get_location(bus_id)`` and never knows or cares which physical
source the location came from.

Swap between implementations by setting the environment variable:
    LOCATION_PROVIDER=phone_gps      # MVP default — driver's phone via Redis
    LOCATION_PROVIDER=hardware_gps   # Teltonika FMB920 via MQTT → Redis
    LOCATION_PROVIDER=simulated      # Deterministic fakes for unit tests

To get the configured provider instance for the running environment:
    from serving.providers import get_provider
    provider = get_provider()          # reads LOCATION_PROVIDER from settings
    reading = await provider.get_location("BUS_28K_001")

Design notes:
    - All I/O methods are async to avoid blocking the event loop.
    - Redis connections are passed in (dependency injection) so callers
      control the connection lifecycle (created in FastAPI lifespan).
    - SimulatedProvider requires no external connections — safe for tests.
    - Adding a fourth provider (e.g. GTFS-RT feed) requires only a new
      subclass and a single entry in get_provider() — nothing else changes.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional

from redis.asyncio import Redis

from config import settings

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LocationReading — the data contract between providers and the predictor
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LocationReading:
    """A single GPS location snapshot for a bus.

    This is the sole output type of every LocationProvider implementation.
    Consumers must not access Redis or GPS hardware directly — they always
    receive a LocationReading through the provider abstraction.

    Attributes:
        bus_id:          The bus this reading belongs to.
        lat:             WGS-84 latitude in decimal degrees.
        lng:             WGS-84 longitude in decimal degrees.
        speed_kmh:       Instantaneous speed in km/h at the time of recording.
        heading:         Compass bearing in degrees [0, 360). 0 = North.
        source:          Which physical source produced this reading.
                         'phone_gps'   — driver's mobile phone (MVP).
                         'hardware_gps'— Teltonika FMB920 unit (production).
                         'simulated'   — synthetic value for unit tests.
        timestamp:       UTC datetime when the fix was captured.
        accuracy_meters: 1-sigma horizontal accuracy reported by the GPS
                         receiver. None if the source doesn't report it
                         (e.g. hardware GPS MQTT payload omits this field).
    """

    bus_id: str
    lat: float
    lng: float
    speed_kmh: float
    heading: float
    source: Literal["phone_gps", "hardware_gps", "simulated"]
    timestamp: datetime
    accuracy_meters: Optional[float] = field(default=None)

    def __post_init__(self) -> None:
        """Validate field ranges after construction.

        Raises:
            ValueError: If any field is out of the expected physical range.
        """
        bbox = settings.visakhapatnam_bbox
        if not (bbox["lat_min"] <= self.lat <= bbox["lat_max"]):
            raise ValueError(
                f"lat {self.lat} is outside Visakhapatnam bounding box "
                f"[{bbox['lat_min']}, {bbox['lat_max']}]"
            )
        if not (bbox["lng_min"] <= self.lng <= bbox["lng_max"]):
            raise ValueError(
                f"lng {self.lng} is outside Visakhapatnam bounding box "
                f"[{bbox['lng_min']}, {bbox['lng_max']}]"
            )
        if not (0.0 <= self.speed_kmh <= 120.0):
            raise ValueError(
                f"speed_kmh {self.speed_kmh} must be in [0.0, 120.0]"
            )
        if not (0.0 <= self.heading < 360.0):
            raise ValueError(
                f"heading {self.heading} must be in [0.0, 360.0)"
            )
        if self.accuracy_meters is not None and self.accuracy_meters < 0:
            raise ValueError(
                f"accuracy_meters {self.accuracy_meters} must be non-negative"
            )


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class LocationNotAvailableError(Exception):
    """Raised when a location reading cannot be retrieved for a bus.

    Possible causes:
      - Redis key 'bus:{bus_id}:state' has expired (TTL 30 s).
      - The bus has not reported a GPS fix recently.
      - Redis connection failure.

    Callers should catch this and decide whether to raise ETAComputationError
    or fall back gracefully.
    """


class StaleLocationError(LocationNotAvailableError):
    """Raised when a location reading exists but is too old to be trusted.

    The Redis key may still exist within its 30-second TTL, but the
    'updated_at' timestamp inside the JSON payload indicates the bus has
    not sent a new fix for longer than STALE_THRESHOLD_SECONDS.

    Attributes:
        age_seconds: How many seconds old the most recent fix is.
    """

    def __init__(self, bus_id: str, age_seconds: float) -> None:
        self.bus_id = bus_id
        self.age_seconds = age_seconds
        super().__init__(
            f"Location for bus {bus_id!r} is stale ({age_seconds:.1f}s old). "
            "The bus may have lost GPS signal or stopped reporting."
        )


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maximum age (seconds) before a cached location is considered stale.
# The Track B Redis key has TTL=30s, but we apply a slightly tighter check
# because the payload contains 'updated_at' which may lag behind the key TTL.
STALE_THRESHOLD_SECONDS: float = 45.0


# ---------------------------------------------------------------------------
# Abstract Base Class
# ---------------------------------------------------------------------------


class LocationProvider(ABC):
    """Abstract base class for all GPS location source implementations.

    All concrete providers must implement ``get_location``.  The method is
    async because real providers read from Redis (I/O bound).

    Dependency injection pattern:
        The provider is created once during FastAPI lifespan startup and
        stored in ``app.state.provider``.  The /eta route receives it via
        a FastAPI dependency function.

    Example usage:
        provider = PhoneGPSProvider(redis_client=redis)
        reading = await provider.get_location("BUS_28K_001")
        print(reading.lat, reading.lng, reading.speed_kmh)
    """

    @abstractmethod
    async def get_location(self, bus_id: str) -> LocationReading:
        """Fetch the most recent GPS location for a given bus.

        Args:
            bus_id: The unique bus identifier (e.g. 'BUS_28K_001').
                    Must match the key used in Redis: 'bus:{bus_id}:state'.

        Returns:
            A LocationReading with current position, speed, and heading.

        Raises:
            LocationNotAvailableError: If no location can be retrieved.
            StaleLocationError:        If the most recent fix is too old.
        """


# ---------------------------------------------------------------------------
# Concrete Implementation 1 — PhoneGPSProvider (MVP, active)
# ---------------------------------------------------------------------------


class PhoneGPSProvider(LocationProvider):
    """Reads GPS data broadcast by the driver's mobile phone app.

    This is the ACTIVE provider for the NXTBus MVP.  The Track C driver
    app sends phone GPS coordinates to the Track B backend, which writes
    them to Redis under the key ``bus:{bus_id}:state`` with a 30-second TTL.

    Data source:   Redis key ``bus:{bus_id}:state``
    Source tag:    ``"phone_gps"``
    Active when:   ``LOCATION_PROVIDER=phone_gps`` (default)

    Phone GPS characteristics:
      - Accuracy: ~5–15 m in open areas, up to 50 m in urban canyons.
      - Latency:  ~1–3 s end-to-end (phone → app → backend → Redis).
      - Availability: Only when driver app is running and has signal.

    Redis payload format (set by Track B NestJS backend):
        {
            "lat": 17.7211,
            "lng": 83.3089,
            "speed_kmh": 28.4,
            "heading": 182,
            "occupancy_count": 34,
            "occupancy_level": "medium",
            "is_panic": false,
            "updated_at": 1706123456789   // epoch milliseconds
        }

    Args:
        redis_client: An async redis-py client (``redis.asyncio.Redis``).
                      Created during FastAPI lifespan and shared across
                      requests for connection pooling.
    """

    def __init__(self, redis_client: Redis) -> None:
        self._redis = redis_client
        _log.info("PhoneGPSProvider initialised (source=phone_gps).")

    async def get_location(self, bus_id: str) -> LocationReading:
        """Fetch phone GPS location from Redis for the given bus.

        Args:
            bus_id: Unique bus identifier.

        Returns:
            A LocationReading with source='phone_gps'.

        Raises:
            LocationNotAvailableError: If the Redis key is missing or empty.
            StaleLocationError:        If updated_at is older than 45 seconds.
            ValueError:                If the Redis payload is malformed JSON
                                       or missing required fields.
        """
        redis_key = f"bus:{bus_id}:state"
        raw: Optional[bytes] = await self._redis.get(redis_key)

        if raw is None:
            raise LocationNotAvailableError(
                f"Redis key '{redis_key}' not found. "
                "The bus may not be active or the driver app is not running."
            )

        try:
            payload: dict = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Malformed JSON in Redis key '{redis_key}': {exc}"
            ) from exc

        # --- Validate required fields are present ---
        required_fields = {"lat", "lng", "speed_kmh", "heading", "updated_at"}
        missing = required_fields - payload.keys()
        if missing:
            raise ValueError(
                f"Redis key '{redis_key}' is missing required fields: {missing}. "
                f"Payload keys present: {set(payload.keys())}"
            )

        # --- Staleness check ---
        # updated_at is epoch milliseconds from Track B's JavaScript Date.now()
        updated_at_ms: int = int(payload["updated_at"])
        updated_at_utc = datetime.fromtimestamp(updated_at_ms / 1000.0, tz=timezone.utc)
        now_utc = datetime.now(tz=timezone.utc)
        age_seconds = (now_utc - updated_at_utc).total_seconds()

        if age_seconds > STALE_THRESHOLD_SECONDS:
            raise StaleLocationError(bus_id=bus_id, age_seconds=age_seconds)

        _log.debug(
            "PhoneGPSProvider: bus=%s lat=%.5f lng=%.5f speed=%.1f age=%.1fs",
            bus_id,
            payload["lat"],
            payload["lng"],
            payload["speed_kmh"],
            age_seconds,
        )

        return LocationReading(
            bus_id=bus_id,
            lat=float(payload["lat"]),
            lng=float(payload["lng"]),
            speed_kmh=float(payload["speed_kmh"]),
            heading=float(payload["heading"]),
            source="phone_gps",
            timestamp=updated_at_utc,
            accuracy_meters=None,  # phone GPS accuracy not reported by Track B
        )


# ---------------------------------------------------------------------------
# Concrete Implementation 2 — HardwareGPSProvider (future production)
# ---------------------------------------------------------------------------


class HardwareGPSProvider(LocationProvider):
    """Reads GPS data from Teltonika FMB920 hardware units.

    This provider is NOT active for the MVP — it is provided so that the
    production switch from phone GPS to hardware GPS requires ZERO code
    changes outside of setting ``LOCATION_PROVIDER=hardware_gps``.

    Data source:   Redis key ``bus:{bus_id}:state``
    Source tag:    ``"hardware_gps"``
    Active when:   ``LOCATION_PROVIDER=hardware_gps``

    Hardware GPS characteristics vs phone GPS:
      - Accuracy:     ~2–5 m (dedicated GPS chipset with better antenna).
      - Latency:      ~2–5 s (FMB920 → MQTT broker → Track A → Redis).
      - Availability: Always on (dedicated hardware, independent of driver phone).
      - Extra fields: Hardware units report GNSS accuracy (hdop, accuracy_m).

    The Teltonika MQTT pipeline (Track A IoT) writes data to the SAME Redis
    key format as the phone GPS provider.  The ``source`` tag in the
    LocationReading is the only observable difference.

    The hardware payload written by Track A includes an optional
    ``accuracy_meters`` field that hardware GPS units report but phone GPS
    does not.  This provider reads it if present.

    Args:
        redis_client: An async redis-py client shared across requests.
    """

    def __init__(self, redis_client: Redis) -> None:
        self._redis = redis_client
        _log.info("HardwareGPSProvider initialised (source=hardware_gps).")

    async def get_location(self, bus_id: str) -> LocationReading:
        """Fetch hardware GPS location from Redis for the given bus.

        Args:
            bus_id: Unique bus identifier.

        Returns:
            A LocationReading with source='hardware_gps'.

        Raises:
            LocationNotAvailableError: If the Redis key is missing.
            StaleLocationError:        If the fix is older than 45 seconds.
            ValueError:                If the payload is malformed.
        """
        redis_key = f"bus:{bus_id}:state"
        raw: Optional[bytes] = await self._redis.get(redis_key)

        if raw is None:
            raise LocationNotAvailableError(
                f"Redis key '{redis_key}' not found. "
                "Hardware GPS unit may be offline or MQTT pipeline is down."
            )

        try:
            payload: dict = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Malformed JSON in Redis key '{redis_key}': {exc}"
            ) from exc

        required_fields = {"lat", "lng", "speed_kmh", "heading", "updated_at"}
        missing = required_fields - payload.keys()
        if missing:
            raise ValueError(
                f"Redis key '{redis_key}' is missing required fields: {missing}"
            )

        updated_at_ms: int = int(payload["updated_at"])
        updated_at_utc = datetime.fromtimestamp(updated_at_ms / 1000.0, tz=timezone.utc)
        now_utc = datetime.now(tz=timezone.utc)
        age_seconds = (now_utc - updated_at_utc).total_seconds()

        if age_seconds > STALE_THRESHOLD_SECONDS:
            raise StaleLocationError(bus_id=bus_id, age_seconds=age_seconds)

        _log.debug(
            "HardwareGPSProvider: bus=%s lat=%.5f lng=%.5f speed=%.1f age=%.1fs",
            bus_id,
            payload["lat"],
            payload["lng"],
            payload["speed_kmh"],
            age_seconds,
        )

        # Hardware GPS units report accuracy — phone GPS does not.
        accuracy: Optional[float] = (
            float(payload["accuracy_meters"])
            if "accuracy_meters" in payload
            else None
        )

        return LocationReading(
            bus_id=bus_id,
            lat=float(payload["lat"]),
            lng=float(payload["lng"]),
            speed_kmh=float(payload["speed_kmh"]),
            heading=float(payload["heading"]),
            source="hardware_gps",
            timestamp=updated_at_utc,
            accuracy_meters=accuracy,
        )


# ---------------------------------------------------------------------------
# Concrete Implementation 3 — SimulatedProvider (testing only)
# ---------------------------------------------------------------------------


# Deterministic simulated positions for key Visakhapatnam stops.
# These are real coordinates so feature engineering (haversine, bbox) works.
_SIMULATED_POSITIONS: dict[str, tuple[float, float]] = {
    "BUS_28K_001": (17.7150, 83.2600),   # Between RLY station and Jagadamba
    "BUS_99_003":  (17.6900, 83.2100),   # Near Gajuwaka
    "BUS_14C_002": (17.7200, 83.3100),   # Near RTC complex
    "BUS_900D_001":(17.7180, 83.3050),   # Near Jagadamba
    "BUS_K10_001": (17.7050, 83.2050),   # Near RLY station
}

# Fallback position when bus_id is not in the map above (city centre)
_DEFAULT_SIMULATED_POSITION: tuple[float, float] = (17.7100, 83.2980)


class SimulatedProvider(LocationProvider):
    """Returns deterministic fake GPS readings for unit tests.

    This provider requires NO Redis connection and NO network access.
    It is designed to make unit tests fast, hermetic, and reproducible.

    Simulated readings:
      - Use hardcoded coordinates near real Visakhapatnam landmarks.
      - Speed and heading are fixed at realistic values (30 km/h, 90°).
      - Timestamps are always ``datetime.now(UTC)`` (predictable recency).
      - Source tag is always ``"simulated"``.
      - accuracy_meters is always 5.0 (ideal GPS accuracy).

    Active when:   ``LOCATION_PROVIDER=simulated``
    Never used in: production or staging environments.

    The SimulatedProvider can also be constructed directly in tests
    without relying on environment variables:

        provider = SimulatedProvider()
        reading = await provider.get_location("BUS_28K_001")
        assert reading.source == "simulated"

    To override a position for a specific test:

        provider = SimulatedProvider(
            overrides={"BUS_TEST_001": (17.7211, 83.3089)}
        )
    """

    def __init__(
        self,
        overrides: Optional[dict[str, tuple[float, float]]] = None,
        fixed_speed_kmh: float = 30.0,
        fixed_heading: float = 90.0,
    ) -> None:
        """Initialise the simulated provider.

        Args:
            overrides:        Optional mapping of bus_id → (lat, lng) to
                              override the default simulated positions.
            fixed_speed_kmh:  Speed value returned for all readings.
            fixed_heading:    Heading value returned for all readings.
        """
        self._positions = dict(_SIMULATED_POSITIONS)
        if overrides:
            self._positions.update(overrides)
        self._speed = fixed_speed_kmh
        self._heading = fixed_heading
        _log.info("SimulatedProvider initialised (source=simulated, TESTING ONLY).")

    async def get_location(self, bus_id: str) -> LocationReading:
        """Return a deterministic fake location for the given bus.

        Args:
            bus_id: Unique bus identifier. If not in the known positions
                    map, a central Visakhapatnam location is returned
                    rather than raising an error — tests should not fail
                    just because a bus_id is unknown.

        Returns:
            A LocationReading with source='simulated'.
        """
        lat, lng = self._positions.get(bus_id, _DEFAULT_SIMULATED_POSITION)
        _log.debug("SimulatedProvider: bus=%s lat=%.5f lng=%.5f", bus_id, lat, lng)

        return LocationReading(
            bus_id=bus_id,
            lat=lat,
            lng=lng,
            speed_kmh=self._speed,
            heading=self._heading,
            source="simulated",
            timestamp=datetime.now(tz=timezone.utc),
            accuracy_meters=5.0,
        )


# ---------------------------------------------------------------------------
# Factory — get_provider()
# ---------------------------------------------------------------------------


def get_provider(redis_client: Optional[Redis] = None) -> LocationProvider:
    """Instantiate and return the configured LocationProvider.

    Reads ``settings.location_provider`` (from the ``LOCATION_PROVIDER``
    environment variable) and constructs the appropriate implementation.

    This function is called once during FastAPI lifespan startup and the
    returned provider is stored in ``app.state.provider``.

    Args:
        redis_client: An async redis-py client.  Required for 'phone_gps'
                      and 'hardware_gps'.  Not required for 'simulated'.

    Returns:
        An instantiated LocationProvider ready for use.

    Raises:
        ValueError: If ``LOCATION_PROVIDER`` is set to an unsupported value.
        RuntimeError: If ``redis_client`` is None when a Redis-backed provider
                      is requested.
    """
    provider_name = settings.location_provider
    _log.info("Initialising LocationProvider: %s", provider_name)

    if provider_name == "phone_gps":
        if redis_client is None:
            raise RuntimeError(
                "PhoneGPSProvider requires a Redis client. "
                "Pass redis_client=<Redis instance> to get_provider()."
            )
        return PhoneGPSProvider(redis_client=redis_client)

    elif provider_name == "hardware_gps":
        if redis_client is None:
            raise RuntimeError(
                "HardwareGPSProvider requires a Redis client. "
                "Pass redis_client=<Redis instance> to get_provider()."
            )
        return HardwareGPSProvider(redis_client=redis_client)

    elif provider_name == "simulated":
        return SimulatedProvider()

    else:
        # This branch is unreachable if pydantic-settings validation is working,
        # because the Literal type on settings.location_provider would have
        # already rejected the value. Defensive guard nonetheless.
        raise ValueError(
            f"Unknown LOCATION_PROVIDER={provider_name!r}. "
            "Valid values: 'phone_gps', 'hardware_gps', 'simulated'."
        )
