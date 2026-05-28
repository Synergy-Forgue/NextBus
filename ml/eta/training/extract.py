"""
training/extract.py — Database Extraction Layer
================================================
Pulls raw training data from PostgreSQL into Pandas DataFrames.

This module is the ONLY place in the training pipeline that touches the
database.  Everything downstream (features.py, validate.py, train.py)
works exclusively with DataFrames — this keeps the training code testable
without a live database.

All queries are parameterised (no string interpolation) and read-only.
We do NOT write to any table owned by Track B.

Usage:
    from training.extract import DataExtractor

    extractor = DataExtractor(database_url="postgresql+asyncpg://...")
    data = await extractor.extract(days_back=90)
    # data.gps_df, data.stops_df, data.routes_df, data.route_stops_df, data.buses_df
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession
from sqlalchemy import text

from config import settings

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------


@dataclass
class ExtractedData:
    """Container for all DataFrames pulled from PostgreSQL.

    Attributes:
        gps_df:         Raw GPS history records. Columns:
                        id, bus_id, lat, lng, speed_kmh, heading,
                        occupancy, recorded_at.
        stops_df:       All stops. Columns: id (as stop_id), name, lat, lng.
        routes_df:      All routes. Columns: id (as route_id), waypoints.
        route_stops_df: Route-stop mapping. Columns:
                        route_id, stop_id, stop_order, lat, lng.
        buses_df:       All buses. Columns: id (as bus_id), route_id, capacity.
        segment_speed_df: Precomputed per-segment historical speeds.
                        Columns: grid_lat, grid_lng, hour, avg_speed_kmh.
        extracted_at:   UTC timestamp when extraction completed.
        date_from:      Start of the extraction window.
        date_to:        End of the extraction window.
        n_gps_rows:     Total GPS rows extracted.
    """

    gps_df: pd.DataFrame
    stops_df: pd.DataFrame
    routes_df: pd.DataFrame
    route_stops_df: pd.DataFrame
    buses_df: pd.DataFrame
    segment_speed_df: pd.DataFrame
    extracted_at: datetime
    date_from: datetime
    date_to: datetime
    n_gps_rows: int


# ---------------------------------------------------------------------------
# DataExtractor
# ---------------------------------------------------------------------------


class DataExtractor:
    """Async database extractor for the NXTBus ETA training pipeline.

    Connects to PostgreSQL (via asyncpg) and pulls all tables needed
    for feature engineering.  Logs row counts and date coverage for
    every extraction to aid debugging.

    Args:
        database_url: Async PostgreSQL DSN. Must use 'postgresql+asyncpg://'.
                      Defaults to settings.database_url.
    """

    def __init__(self, database_url: Optional[str] = None) -> None:
        self._database_url = database_url or str(settings.database_url)
        self._engine: Optional[AsyncEngine] = None

    async def _get_engine(self) -> AsyncEngine:
        """Lazily create the async SQLAlchemy engine.

        Returns:
            The async engine instance.
        """
        if self._engine is None:
            self._engine = create_async_engine(
                self._database_url,
                pool_size=3,
                max_overflow=5,
                pool_pre_ping=True,
                echo=settings.log_level == "DEBUG",
            )
        return self._engine

    async def close(self) -> None:
        """Dispose the engine and release all pooled connections.

        Call this when extraction is complete.
        """
        if self._engine is not None:
            await self._engine.dispose()
            self._engine = None
            _log.debug("DataExtractor: engine disposed.")

    async def extract(self, days_back: int = 90) -> ExtractedData:
        """Extract all training data for the last N days.

        Pulls gps_history, stops, routes, route_stops, and buses from
        PostgreSQL.  Also precomputes segment_speed_df (historical speed
        per 0.01° grid cell per hour) for the congestion_index feature.

        Logs:
          - Row count and date range for gps_history.
          - Row count for each reference table.

        Args:
            days_back: Number of days of GPS history to extract (default 90).
                       Must be ≥ 1.

        Returns:
            ExtractedData with all DataFrames populated.

        Raises:
            ValueError: If days_back < 1.
            RuntimeError: If the database connection fails.
        """
        if days_back < 1:
            raise ValueError(f"days_back must be ≥ 1, got {days_back}")

        now_utc = datetime.now(tz=timezone.utc)
        date_from = now_utc - timedelta(days=days_back)
        date_to = now_utc

        _log.info(
            "DataExtractor: extracting %d days of GPS history (%s → %s)",
            days_back,
            date_from.strftime("%Y-%m-%d"),
            date_to.strftime("%Y-%m-%d"),
        )

        engine = await self._get_engine()

        async with AsyncSession(engine) as session:
            gps_df = await self._extract_gps_history(session, date_from, date_to)
            stops_df = await self._extract_stops(session)
            routes_df = await self._extract_routes(session)
            route_stops_df = await self._extract_route_stops(session, stops_df)
            buses_df = await self._extract_buses(session)
            segment_speed_df = await self._compute_segment_speeds(session, date_from)

        result = ExtractedData(
            gps_df=gps_df,
            stops_df=stops_df,
            routes_df=routes_df,
            route_stops_df=route_stops_df,
            buses_df=buses_df,
            segment_speed_df=segment_speed_df,
            extracted_at=datetime.now(tz=timezone.utc),
            date_from=date_from,
            date_to=date_to,
            n_gps_rows=len(gps_df),
        )

        _log.info(
            "DataExtractor: complete. gps_rows=%d stops=%d routes=%d buses=%d",
            result.n_gps_rows,
            len(stops_df),
            len(routes_df),
            len(buses_df),
        )
        return result

    async def count_recent_gps_rows(self, window_days: int = 14) -> int:
        """Count GPS rows recorded in the last N days.

        Used by the predictor to decide whether enough data exists to
        activate the v2 XGBoost model.

        Args:
            window_days: Look-back window in days.

        Returns:
            Integer row count.
        """
        engine = await self._get_engine()
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=window_days)

        async with AsyncSession(engine) as session:
            result = await session.execute(
                text(
                    "SELECT COUNT(*) FROM gps_history WHERE recorded_at > :cutoff"
                ),
                {"cutoff": cutoff},
            )
            row = result.fetchone()
            count = int(row[0]) if row else 0

        _log.info(
            "GPS row count (last %d days): %d (threshold: %d)",
            window_days,
            count,
            settings.v2_activation_threshold,
        )
        return count

    # ------------------------------------------------------------------
    # Private extraction methods
    # ------------------------------------------------------------------

    async def _extract_gps_history(
        self,
        session: AsyncSession,
        date_from: datetime,
        date_to: datetime,
    ) -> pd.DataFrame:
        """Pull gps_history rows within the date range.

        Args:
            session:   Active async session.
            date_from: Start timestamp (inclusive).
            date_to:   End timestamp (inclusive).

        Returns:
            DataFrame with columns: id, bus_id, lat, lng, speed_kmh,
            heading, occupancy, recorded_at.
        """
        _log.info("Querying gps_history...")
        result = await session.execute(
            text(
                """
                SELECT
                    id,
                    bus_id,
                    CAST(lat AS FLOAT) AS lat,
                    CAST(lng AS FLOAT) AS lng,
                    CAST(speed_kmh AS FLOAT) AS speed_kmh,
                    CAST(heading AS FLOAT) AS heading,
                    occupancy,
                    recorded_at
                FROM gps_history
                WHERE recorded_at BETWEEN :date_from AND :date_to
                  AND lat IS NOT NULL
                  AND lng IS NOT NULL
                ORDER BY bus_id, recorded_at ASC
                """
            ),
            {"date_from": date_from, "date_to": date_to},
        )
        rows = result.fetchall()
        cols = ["id", "bus_id", "lat", "lng", "speed_kmh", "heading", "occupancy", "recorded_at"]

        if not rows:
            _log.warning("gps_history: 0 rows returned for date range.")
            return pd.DataFrame(columns=cols)

        df = pd.DataFrame(rows, columns=cols)
        df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)

        # Date coverage report
        min_ts = df["recorded_at"].min()
        max_ts = df["recorded_at"].max()
        n_buses = df["bus_id"].nunique()
        _log.info(
            "gps_history: %d rows | %d buses | %s → %s",
            len(df),
            n_buses,
            min_ts.strftime("%Y-%m-%d %H:%M"),
            max_ts.strftime("%Y-%m-%d %H:%M"),
        )
        return df

    async def _extract_stops(self, session: AsyncSession) -> pd.DataFrame:
        """Pull all stops from the database.

        Args:
            session: Active async session.

        Returns:
            DataFrame with columns: stop_id, name, lat, lng.
        """
        result = await session.execute(
            text(
                """
                SELECT
                    id AS stop_id,
                    name,
                    CAST(lat AS FLOAT) AS lat,
                    CAST(lng AS FLOAT) AS lng
                FROM stops
                ORDER BY id
                """
            )
        )
        rows = result.fetchall()
        df = pd.DataFrame(rows, columns=["stop_id", "name", "lat", "lng"])
        _log.info("stops: %d rows", len(df))
        return df

    async def _extract_routes(self, session: AsyncSession) -> pd.DataFrame:
        """Pull all routes from the database.

        Args:
            session: Active async session.

        Returns:
            DataFrame with columns: route_id, waypoints (JSONB as string).
        """
        result = await session.execute(
            text(
                "SELECT id AS route_id, waypoints::text AS waypoints FROM routes ORDER BY id"
            )
        )
        rows = result.fetchall()
        df = pd.DataFrame(rows, columns=["route_id", "waypoints"])
        _log.info("routes: %d rows", len(df))
        return df

    async def _extract_route_stops(
        self, session: AsyncSession, stops_df: pd.DataFrame
    ) -> pd.DataFrame:
        """Pull route_stops with stop coordinates joined in.

        Args:
            session:  Active async session.
            stops_df: Already-extracted stops DataFrame (for the join).

        Returns:
            DataFrame with columns: route_id, stop_id, stop_order, lat, lng.
        """
        result = await session.execute(
            text(
                """
                SELECT
                    rs.route_id,
                    rs.stop_id,
                    rs.stop_order,
                    CAST(s.lat AS FLOAT) AS lat,
                    CAST(s.lng AS FLOAT) AS lng
                FROM route_stops rs
                JOIN stops s ON s.id = rs.stop_id
                ORDER BY rs.route_id, rs.stop_order
                """
            )
        )
        rows = result.fetchall()
        df = pd.DataFrame(rows, columns=["route_id", "stop_id", "stop_order", "lat", "lng"])
        _log.info("route_stops: %d rows", len(df))
        return df

    async def _extract_buses(self, session: AsyncSession) -> pd.DataFrame:
        """Pull all buses with their route associations.

        Args:
            session: Active async session.

        Returns:
            DataFrame with columns: bus_id, route_id, capacity.
        """
        result = await session.execute(
            text(
                "SELECT id AS bus_id, route_id, capacity FROM buses ORDER BY id"
            )
        )
        rows = result.fetchall()
        df = pd.DataFrame(rows, columns=["bus_id", "route_id", "capacity"])
        _log.info("buses: %d rows", len(df))
        return df

    async def _compute_segment_speeds(
        self, session: AsyncSession, date_from: datetime
    ) -> pd.DataFrame:
        """Precompute historical average speed per GPS grid cell per hour.

        Groups gps_history into 0.01° × 0.01° grid cells and computes
        the average speed for each cell at each hour of day.  This is the
        data source for the `segment_hist_speed` feature.

        The query uses a 7-day look-back (from `date_from + 83 days` to end)
        to capture recent patterns.

        Args:
            session:   Active async session.
            date_from: Start of the full extraction window.

        Returns:
            DataFrame with columns: grid_lat, grid_lng, hour, avg_speed_kmh.
        """
        # Use last 7 days of the extraction window for segment speed
        segment_cutoff = datetime.now(tz=timezone.utc) - timedelta(
            days=settings.segment_hist_speed_window_days
        )

        _log.info("Computing segment speeds (last %d days)...", settings.segment_hist_speed_window_days)
        result = await session.execute(
            text(
                """
                SELECT
                    ROUND(CAST(lat AS NUMERIC), 2) AS grid_lat,
                    ROUND(CAST(lng AS NUMERIC), 2) AS grid_lng,
                    EXTRACT(HOUR FROM recorded_at)::INT AS hour,
                    AVG(CAST(speed_kmh AS FLOAT)) AS avg_speed_kmh
                FROM gps_history
                WHERE recorded_at > :cutoff
                  AND speed_kmh IS NOT NULL
                  AND speed_kmh > 0
                GROUP BY grid_lat, grid_lng, hour
                HAVING COUNT(*) >= 5
                ORDER BY grid_lat, grid_lng, hour
                """
            ),
            {"cutoff": segment_cutoff},
        )
        rows = result.fetchall()
        df = pd.DataFrame(
            rows, columns=["grid_lat", "grid_lng", "hour", "avg_speed_kmh"]
        )
        df["grid_lat"] = df["grid_lat"].astype(float)
        df["grid_lng"] = df["grid_lng"].astype(float)
        df["hour"] = df["hour"].astype(int)
        df["avg_speed_kmh"] = df["avg_speed_kmh"].astype(float)
        _log.info("segment_speed: %d grid cells", len(df))
        return df


# ---------------------------------------------------------------------------
# Typing fix for Optional
# ---------------------------------------------------------------------------
from typing import Optional  # noqa: E402 (import at module level is preferred but OK here)
