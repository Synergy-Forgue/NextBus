-- ─────────────────────────────────────────────────────────────────────────────
-- 002_add_route_geometry.sql
--
-- Stores road-following geometry for each route.
--
-- Until now every map drew a route as straight lines between consecutive stop
-- coordinates, so lines cut across water, buildings and blocks. Real geometry
-- is static per route, so it is fetched once by scripts/fetch-route-geometry.ts
-- and stored here. Nothing calls a routing service at request time.
--
-- SAFE TO RUN AGAINST PRODUCTION:
--   * CREATE TABLE IF NOT EXISTS only. No DROP, no data loss.
--   * Re-running is a no-op.
--
--   npm run migrate -- src/db/migrations/002_add_route_geometry.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS route_geometry (
    route_id     INTEGER PRIMARY KEY REFERENCES routes(id) ON DELETE CASCADE,

    -- GeoJSON LineString coordinates: [[lng, lat], ...] in travel order.
    -- Stored as jsonb so the API can hand it straight to the client.
    coordinates  JSONB NOT NULL,

    -- Road distance along the polyline, from the routing engine. This is the
    -- honest figure for the route; straight-line stop hops understate it.
    distance_m   DOUBLE PRECISION,

    -- Engine's free-flow duration estimate, kept for reference. It is not a
    -- timetable and must not be presented to passengers as one.
    duration_s   DOUBLE PRECISION,

    -- Which engine produced this, so stale or demo-sourced geometry is
    -- identifiable later rather than being mistaken for surveyed data.
    source       VARCHAR(64) NOT NULL DEFAULT 'osrm',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

SELECT
  (SELECT COUNT(*) FROM routes)         AS routes,
  (SELECT COUNT(*) FROM route_geometry) AS routes_with_geometry;
