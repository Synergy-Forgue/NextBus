/**
 * fetch-route-geometry.ts
 *
 * Fetches road-following geometry for every route and stores it in
 * route_geometry, so maps stop drawing straight lines between stops.
 *
 * Run once after adding or changing routes — geometry is static, and nothing
 * calls a routing service at request time.
 *
 *   npm run fetch-geometry              # only routes missing geometry
 *   npm run fetch-geometry -- --force   # refetch everything
 *
 * Engine: OSRM. The public demo server is the default and needs no API key,
 * but it is rate limited and explicitly not for production traffic — which is
 * fine here because this is a one-off backfill, not a runtime dependency. Point
 * OSRM_URL at a self-hosted instance for anything beyond the pilot.
 */

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';

const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';
const FORCE = process.argv.includes('--force');

/** Public demo server asks for gentle use; one route per second is polite. */
const DELAY_MS = Number(process.env.OSRM_DELAY_MS || 1200);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost')
        ? undefined
        : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'nxtbus',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });

interface RouteRow {
  id: number;
  route_number: string;
  route_name: string;
}

interface StopRow {
  latitude: number;
  longitude: number;
  name: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * OSRM caps how many coordinates fit in a URL. Long routes are requested in
 * overlapping legs and stitched back together, so the result is still one
 * continuous line.
 */
const MAX_WAYPOINTS = 25;

async function routeLeg(stops: StopRow[]): Promise<{
  coordinates: [number, number][];
  distance: number;
  duration: number;
}> {
  const path = stops.map((s) => `${s.longitude},${s.latitude}`).join(';');
  const url = `${OSRM_URL}/route/v1/driving/${path}?overview=full&geometries=geojson&continue_straight=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data: any = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM returned ${data.code}${data.message ? `: ${data.message}` : ''}`);
  }

  const r = data.routes[0];
  return {
    coordinates: r.geometry.coordinates as [number, number][],
    distance: Number(r.distance) || 0,
    duration: Number(r.duration) || 0,
  };
}

async function geometryForStops(stops: StopRow[]) {
  if (stops.length <= MAX_WAYPOINTS) return routeLeg(stops);

  const coordinates: [number, number][] = [];
  let distance = 0;
  let duration = 0;

  // Legs overlap by one stop so the joins are seamless.
  for (let i = 0; i < stops.length - 1; i += MAX_WAYPOINTS - 1) {
    const leg = stops.slice(i, i + MAX_WAYPOINTS);
    if (leg.length < 2) break;
    const result = await routeLeg(leg);
    // Drop the duplicated first point of every leg after the first.
    coordinates.push(...(coordinates.length ? result.coordinates.slice(1) : result.coordinates));
    distance += result.distance;
    duration += result.duration;
    await sleep(DELAY_MS);
  }

  return { coordinates, distance, duration };
}

async function main(): Promise<void> {
  const target = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : `${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'nxtbus'}`;

  console.log(`\n🛣️  Fetching route geometry`);
  console.log(`   Engine: ${OSRM_URL}`);
  console.log(`   Target: ${target}`);
  console.log(`   Mode:   ${FORCE ? 'refetch all' : 'only routes missing geometry'}\n`);

  const { rows: routes } = await pool.query<RouteRow>(
    FORCE
      ? `SELECT id, route_number, route_name FROM routes ORDER BY id`
      : `SELECT r.id, r.route_number, r.route_name
           FROM routes r
           LEFT JOIN route_geometry g ON g.route_id = r.id
          WHERE g.route_id IS NULL
          ORDER BY r.id`
  );

  if (routes.length === 0) {
    console.log('✅ Every route already has geometry. Use --force to refetch.\n');
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const route of routes) {
    const { rows: stops } = await pool.query<StopRow>(
      `SELECT s.name, s.latitude, s.longitude
         FROM route_stops rs
         JOIN stops s ON s.id = rs.stop_id
        WHERE rs.route_id = $1
        ORDER BY rs.stop_order`,
      [route.id]
    );

    const label = `${route.route_number} (${stops.length} stops)`;

    if (stops.length < 2) {
      console.log(`   ⏭️  ${label} — needs at least 2 stops, skipped`);
      failed++;
      continue;
    }

    try {
      const { coordinates, distance, duration } = await geometryForStops(stops);

      await pool.query(
        `INSERT INTO route_geometry (route_id, coordinates, distance_m, duration_s, source, generated_at)
         VALUES ($1, $2::jsonb, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (route_id) DO UPDATE
            SET coordinates  = EXCLUDED.coordinates,
                distance_m   = EXCLUDED.distance_m,
                duration_s   = EXCLUDED.duration_s,
                source       = EXCLUDED.source,
                generated_at = CURRENT_TIMESTAMP`,
        [route.id, JSON.stringify(coordinates), distance, duration, 'osrm']
      );

      console.log(
        `   ✅ ${label} → ${coordinates.length} points, ${(distance / 1000).toFixed(1)} km`
      );
      ok++;
    } catch (err: any) {
      console.log(`   ❌ ${label} — ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n${ok} route(s) stored, ${failed} failed.\n`);
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
