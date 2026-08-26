/**
 * simulator.ts — NXTBus Smart GPS + AI Vision Simulator
 * ─────────────────────────────────────────────────────
 * Spawns one BusAgent per trip and pumps realistic telemetry into
 * the backend's WebSocket ingestion endpoint.
 *
 * Usage:
 *   npm run sim
 */

import dotenv from 'dotenv';
dotenv.config();

import WebSocket from 'ws';
import { Pool }  from 'pg';
import { BusAgent, StopInfo } from './busAgent';
import { buildPoolConfig, describeTarget } from '../db/config';
import { PRECOMPUTED_GEOMETRIES } from '../utils/routeGeometries';

// ─── Config ───────────────────────────────────────────────────────────────────
const WS_URL   = process.env.SIM_WS_URL   || 'ws://localhost:3000/ws/publish';
// Derive the REST base from the WS URL. Handle wss:// → https:// before ws:// → http://,
// otherwise a plain /^ws/ replace turns "wss://host" into the invalid "httpss://host".
const HTTP_URL =
  process.env.SIM_HTTP_URL ||
  WS_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/ws\/publish$/, '');
const TICK_MS  = parseInt(process.env.SIM_TICK_MS || '2000'); // 2s between GPS ticks

// ─── Database Pool ────────────────────────────────────────────────────────────
// Honours DATABASE_URL so a laptop run reaches the deployed database. See
// db/config.ts for why the discrete DB_* vars cannot do that.
const pool = new Pool(buildPoolConfig());

/** True once real trips are loaded, so we can warn when we are faking it. */
let usingFallbackData = false;

// ─── Static Offline Fallback Data ─────────────────────────────────────────────
const FALLBACK_TRIPS = [
  // Visakhapatnam (APSRTC)
  { trip_id: 1,  route_id: 1,  license_plate: 'AP-31-Z-1011', bus_number: '10K',  capacity: 50 },
  { trip_id: 2,  route_id: 2,  license_plate: 'AP-31-Z-9002', bus_number: '900K', capacity: 50 },
  { trip_id: 3,  route_id: 3,  license_plate: 'AP-31-Z-2803', bus_number: '28K',  capacity: 45 },
  { trip_id: 4,  route_id: 4,  license_plate: 'AP-31-Z-5504', bus_number: '55T',  capacity: 50 },
  { trip_id: 5,  route_id: 5,  license_plate: 'AP-31-Z-3005', bus_number: '300N', capacity: 45 },
  // Mysuru (KSRTC)
  { trip_id: 6,  route_id: 6,  license_plate: 'KA-09-F-2011', bus_number: '201M', capacity: 50 },
  { trip_id: 7,  route_id: 7,  license_plate: 'KA-09-F-1501', bus_number: '150M', capacity: 45 },
  { trip_id: 8,  route_id: 8,  license_plate: 'KA-09-F-3031', bus_number: '303M', capacity: 45 },
  { trip_id: 9,  route_id: 9,  license_plate: 'KA-09-F-4121', bus_number: '412M', capacity: 50 },
  { trip_id: 10, route_id: 10, license_plate: 'KA-09-F-3071', bus_number: '307M', capacity: 55 },
  // Kalaburagi (KKRTC)
  { trip_id: 11, route_id: 11, license_plate: 'KA-32-F-1011', bus_number: '101K', capacity: 50 },
  { trip_id: 12, route_id: 12, license_plate: 'KA-32-F-1021', bus_number: '102K', capacity: 45 },
  { trip_id: 13, route_id: 13, license_plate: 'KA-32-F-1031', bus_number: '103K', capacity: 45 },
  { trip_id: 14, route_id: 14, license_plate: 'KA-32-F-1041', bus_number: '104K', capacity: 50 },
  { trip_id: 15, route_id: 15, license_plate: 'KA-32-F-1051', bus_number: '105K', capacity: 50 },
];

const FALLBACK_STOPS: Record<number, StopInfo[]> = {
  // ─── Visakhapatnam ──────────────────────────────────────────────
  1: [
    { stop_id: 1, stop_name: 'RTC Complex', latitude: 17.7261, longitude: 83.3085, stop_order: 1 },
    { stop_id: 2, stop_name: 'Dwaraka Bus Station', latitude: 17.7270, longitude: 83.3075, stop_order: 2 },
    { stop_id: 3, stop_name: 'Jagadamba Junction', latitude: 17.7126, longitude: 83.3023, stop_order: 3 },
    { stop_id: 4, stop_name: 'Collector Office', latitude: 17.7150, longitude: 83.3050, stop_order: 4 },
    { stop_id: 5, stop_name: 'RK Beach', latitude: 17.7134, longitude: 83.3323, stop_order: 5 },
    { stop_id: 6, stop_name: 'VMRDA Park', latitude: 17.7230, longitude: 83.3360, stop_order: 6 },
    { stop_id: 7, stop_name: 'Lawsons Bay', latitude: 17.7320, longitude: 83.3420, stop_order: 7 },
    { stop_id: 8, stop_name: 'Tenneti Park', latitude: 17.7450, longitude: 83.3450, stop_order: 8 },
    { stop_id: 9, stop_name: 'Kailasagiri', latitude: 17.7490, longitude: 83.3421, stop_order: 9 },
  ],
  2: [
    { stop_id: 10, stop_name: 'Bheemili', latitude: 17.8860, longitude: 83.4475, stop_order: 1 },
    { stop_id: 11, stop_name: 'INS Kalinga', latitude: 17.8500, longitude: 83.4000, stop_order: 2 },
    { stop_id: 12, stop_name: 'Rushikonda Beach', latitude: 17.7820, longitude: 83.3850, stop_order: 3 },
    { stop_id: 13, stop_name: 'Gitam University', latitude: 17.7810, longitude: 83.3760, stop_order: 4 },
    { stop_id: 14, stop_name: 'Sagar Nagar', latitude: 17.7600, longitude: 83.3550, stop_order: 5 },
    { stop_id: 15, stop_name: 'Hanumanthuwaka', latitude: 17.7500, longitude: 83.3250, stop_order: 6 },
    { stop_id: 16, stop_name: 'MVP Complex', latitude: 17.7397, longitude: 83.3330, stop_order: 7 },
    { stop_id: 17, stop_name: 'Maddilapalem', latitude: 17.7385, longitude: 83.3223, stop_order: 8 },
    { stop_id: 1,  stop_name: 'RTC Complex', latitude: 17.7261, longitude: 83.3085, stop_order: 9 },
    { stop_id: 18, stop_name: 'Railway Station', latitude: 17.7275, longitude: 83.2982, stop_order: 10 },
  ],
  3: [
    { stop_id: 19, stop_name: 'Kothavalasa', latitude: 17.8865, longitude: 83.1558, stop_order: 1 },
    { stop_id: 20, stop_name: 'Pendurthi', latitude: 17.8250, longitude: 83.2000, stop_order: 2 },
    { stop_id: 21, stop_name: 'NAD Junction', latitude: 17.7402, longitude: 83.2386, stop_order: 3 },
    { stop_id: 22, stop_name: 'Kancharapalem', latitude: 17.7371, longitude: 83.2796, stop_order: 4 },
    { stop_id: 1,  stop_name: 'RTC Complex', latitude: 17.7261, longitude: 83.3085, stop_order: 5 },
    { stop_id: 3,  stop_name: 'Jagadamba Junction', latitude: 17.7126, longitude: 83.3023, stop_order: 6 },
    { stop_id: 5,  stop_name: 'RK Beach', latitude: 17.7134, longitude: 83.3323, stop_order: 7 },
  ],
  4: [
    { stop_id: 23, stop_name: 'Old Gajuwaka', latitude: 17.6896, longitude: 83.2081, stop_order: 1 },
    { stop_id: 24, stop_name: 'Kurmannapalem', latitude: 17.6750, longitude: 83.1700, stop_order: 2 },
    { stop_id: 21, stop_name: 'NAD Junction', latitude: 17.7402, longitude: 83.2386, stop_order: 3 },
    { stop_id: 20, stop_name: 'Pendurthi', latitude: 17.8250, longitude: 83.2000, stop_order: 4 },
    { stop_id: 25, stop_name: 'Sontyam', latitude: 17.8800, longitude: 83.2500, stop_order: 5 },
    { stop_id: 26, stop_name: 'Anandapuram', latitude: 17.8920, longitude: 83.2850, stop_order: 6 },
    { stop_id: 27, stop_name: 'Tagarapuvalasa', latitude: 17.9300, longitude: 83.4200, stop_order: 7 },
  ],
  5: [
    { stop_id: 28, stop_name: 'Sabbavaram', latitude: 17.8000, longitude: 83.1200, stop_order: 1 },
    { stop_id: 29, stop_name: 'Narava', latitude: 17.7500, longitude: 83.1700, stop_order: 2 },
    { stop_id: 30, stop_name: 'Old Gopalapatnam', latitude: 17.7550, longitude: 83.2100, stop_order: 3 },
    { stop_id: 21, stop_name: 'NAD Junction', latitude: 17.7402, longitude: 83.2386, stop_order: 4 },
    { stop_id: 22, stop_name: 'Kancharapalem', latitude: 17.7371, longitude: 83.2796, stop_order: 5 },
    { stop_id: 1,  stop_name: 'RTC Complex', latitude: 17.7261, longitude: 83.3085, stop_order: 6 },
    { stop_id: 3,  stop_name: 'Jagadamba Junction', latitude: 17.7126, longitude: 83.3023, stop_order: 7 },
    { stop_id: 5,  stop_name: 'RK Beach', latitude: 17.7134, longitude: 83.3323, stop_order: 8 },
  ],

  // ─── Mysuru ─────────────────────────────────────────────────────
  6: [
    { stop_id: 31, stop_name: 'Mysuru City Bus Stand', latitude: 12.3095, longitude: 76.6540, stop_order: 1 },
    { stop_id: 34, stop_name: 'K R Circle', latitude: 12.3072, longitude: 76.6524, stop_order: 2 },
    { stop_id: 35, stop_name: 'Mysuru Palace', latitude: 12.3052, longitude: 76.6552, stop_order: 3 },
    { stop_id: 36, stop_name: 'Mysuru Zoo', latitude: 12.3022, longitude: 76.6640, stop_order: 4 },
    { stop_id: 37, stop_name: 'Lalitha Mahal Road', latitude: 12.2960, longitude: 76.6720, stop_order: 5 },
    { stop_id: 38, stop_name: 'Nandi Statue', latitude: 12.2790, longitude: 76.6720, stop_order: 6 },
    { stop_id: 39, stop_name: 'Chamundi Hills', latitude: 12.2724, longitude: 76.6706, stop_order: 7 },
  ],
  7: [
    { stop_id: 33, stop_name: 'Mysuru Railway Station', latitude: 12.3172, longitude: 76.6427, stop_order: 1 },
    { stop_id: 32, stop_name: 'Sub Urban Bus Stand', latitude: 12.3140, longitude: 76.6440, stop_order: 2 },
    { stop_id: 40, stop_name: 'Devaraja Market', latitude: 12.3085, longitude: 76.6512, stop_order: 3 },
    { stop_id: 41, stop_name: 'K R Hospital', latitude: 12.3060, longitude: 76.6480, stop_order: 4 },
    { stop_id: 42, stop_name: 'Ramaswamy Circle', latitude: 12.3110, longitude: 76.6390, stop_order: 5 },
    { stop_id: 43, stop_name: 'Saraswathipuram', latitude: 12.3055, longitude: 76.6300, stop_order: 6 },
    { stop_id: 44, stop_name: 'JSS Hospital', latitude: 12.2958, longitude: 76.6300, stop_order: 7 },
    { stop_id: 45, stop_name: 'Kuvempunagar', latitude: 12.2861, longitude: 76.6191, stop_order: 8 },
  ],
  8: [
    { stop_id: 46, stop_name: 'Bannimantap', latitude: 12.3300, longitude: 76.6600, stop_order: 1 },
    { stop_id: 47, stop_name: 'Yadavagiri', latitude: 12.3270, longitude: 76.6470, stop_order: 2 },
    { stop_id: 48, stop_name: 'Gokulam', latitude: 12.3210, longitude: 76.6330, stop_order: 3 },
    { stop_id: 42, stop_name: 'Ramaswamy Circle', latitude: 12.3110, longitude: 76.6390, stop_order: 4 },
    { stop_id: 49, stop_name: 'Vijayanagar', latitude: 12.3260, longitude: 76.6120, stop_order: 5 },
    { stop_id: 50, stop_name: 'Bogadi', latitude: 12.3120, longitude: 76.5950, stop_order: 6 },
  ],
  9: [
    { stop_id: 31, stop_name: 'Mysuru City Bus Stand', latitude: 12.3095, longitude: 76.6540, stop_order: 1 },
    { stop_id: 51, stop_name: 'Paduvarahalli', latitude: 12.3230, longitude: 76.6280, stop_order: 2 },
    { stop_id: 52, stop_name: 'Metagalli', latitude: 12.3400, longitude: 76.6220, stop_order: 3 },
    { stop_id: 53, stop_name: 'Hebbal Industrial Area', latitude: 12.3480, longitude: 76.6100, stop_order: 4 },
    { stop_id: 54, stop_name: 'Hootagalli', latitude: 12.3450, longitude: 76.5980, stop_order: 5 },
  ],
  10: [
    { stop_id: 31, stop_name: 'Mysuru City Bus Stand', latitude: 12.3095, longitude: 76.6540, stop_order: 1 },
    { stop_id: 32, stop_name: 'Sub Urban Bus Stand', latitude: 12.3140, longitude: 76.6440, stop_order: 2 },
    { stop_id: 55, stop_name: 'Hinkal', latitude: 12.3390, longitude: 76.6180, stop_order: 3 },
    { stop_id: 56, stop_name: 'Belagola', latitude: 12.3800, longitude: 76.6500, stop_order: 4 },
    { stop_id: 57, stop_name: 'Ranganathittu', latitude: 12.4090, longitude: 76.6650, stop_order: 5 },
    { stop_id: 58, stop_name: 'Srirangapatna', latitude: 12.4181, longitude: 76.6947, stop_order: 6 },
  ],

  // ─── Kalaburagi ─────────────────────────────────────────────────
  11: [
    { stop_id: 61, stop_name: 'Kalaburagi Central Bus Stand', latitude: 17.3255, longitude: 76.8288, stop_order: 1 },
    { stop_id: 62, stop_name: 'Jagat Circle', latitude: 17.3325, longitude: 76.8340, stop_order: 2 },
    { stop_id: 63, stop_name: 'SVP Circle', latitude: 17.3350, longitude: 76.8385, stop_order: 3 },
    { stop_id: 64, stop_name: 'Super Market', latitude: 17.3380, longitude: 76.8320, stop_order: 4 },
    { stop_id: 65, stop_name: 'District Court Complex', latitude: 17.3310, longitude: 76.8480, stop_order: 5 },
    { stop_id: 66, stop_name: 'Sedam Road Junction', latitude: 17.3120, longitude: 76.8680, stop_order: 6 },
    { stop_id: 67, stop_name: 'Gulbarga University', latitude: 17.2970, longitude: 76.8720, stop_order: 7 },
  ],
  12: [
    { stop_id: 68, stop_name: 'Kalaburagi Railway Station', latitude: 17.3400, longitude: 76.8375, stop_order: 1 },
    { stop_id: 63, stop_name: 'SVP Circle', latitude: 17.3350, longitude: 76.8385, stop_order: 2 },
    { stop_id: 69, stop_name: 'MSK Mill Road', latitude: 17.3270, longitude: 76.8430, stop_order: 3 },
    { stop_id: 70, stop_name: 'Ring Road Aland Junction', latitude: 17.3520, longitude: 76.8300, stop_order: 4 },
    { stop_id: 71, stop_name: 'High Court Karnataka Bench', latitude: 17.3620, longitude: 76.8520, stop_order: 5 },
  ],
  13: [
    { stop_id: 61, stop_name: 'Kalaburagi Central Bus Stand', latitude: 17.3255, longitude: 76.8288, stop_order: 1 },
    { stop_id: 62, stop_name: 'Jagat Circle', latitude: 17.3325, longitude: 76.8340, stop_order: 2 },
    { stop_id: 72, stop_name: 'Kalaburagi Fort Gate', latitude: 17.3435, longitude: 76.8225, stop_order: 3 },
    { stop_id: 73, stop_name: 'Roza KBN Dargah', latitude: 17.3510, longitude: 76.8260, stop_order: 4 },
    { stop_id: 74, stop_name: 'KBN Teaching Hospital', latitude: 17.3480, longitude: 76.8350, stop_order: 5 },
  ],
  14: [
    { stop_id: 61, stop_name: 'Kalaburagi Central Bus Stand', latitude: 17.3255, longitude: 76.8288, stop_order: 1 },
    { stop_id: 75, stop_name: 'Ram Mandir Circle', latitude: 17.3280, longitude: 76.8510, stop_order: 2 },
    { stop_id: 76, stop_name: 'Kusnoor Cross', latitude: 17.2950, longitude: 76.8620, stop_order: 3 },
    { stop_id: 77, stop_name: 'Ring Road University Bypass', latitude: 17.2800, longitude: 76.8500, stop_order: 4 },
    { stop_id: 78, stop_name: 'Central University Kadaganchi', latitude: 17.2150, longitude: 76.6350, stop_order: 5 },
  ],
  15: [
    { stop_id: 79, stop_name: 'Humnabad Ring Road', latitude: 17.3580, longitude: 76.8550, stop_order: 1 },
    { stop_id: 80, stop_name: 'Timmapuri Circle', latitude: 17.3420, longitude: 76.8460, stop_order: 2 },
    { stop_id: 64, stop_name: 'Super Market', latitude: 17.3380, longitude: 76.8320, stop_order: 3 },
    { stop_id: 81, stop_name: 'ESI Medical College', latitude: 17.3190, longitude: 76.8610, stop_order: 4 },
    { stop_id: 82, stop_name: 'Shahabad Road Terminal', latitude: 17.2900, longitude: 76.8750, stop_order: 5 },
  ],
};

async function loadTrips() {
  try {
    const res = await fetch(`${HTTP_URL}/api/trips?status=active`);
    if (res.ok) {
      const data = (await res.json()) as any[];
      if (data.length > 0) {
        const existingRouteIds = new Set(data.map((t) => t.route_id));
        const merged = data.map((t) => ({
          trip_id:       t.id,
          route_id:      t.route_id,
          license_plate: t.license_plate,
          bus_number:    t.bus_number || t.route_number,
          capacity:      50,
        }));
        // Ensure Kalaburagi and any un-migrated routes from FALLBACK_TRIPS are actively simulated
        for (const ft of FALLBACK_TRIPS) {
          if (!existingRouteIds.has(ft.route_id)) {
            merged.push(ft);
          }
        }
        return merged;
      }
    }
  } catch {}

  let dbError: string | null = null;
  try {
    const result = await pool.query(
      `SELECT t.id AS trip_id, t.route_id, b.license_plate, b.bus_number, b.capacity
       FROM trips t JOIN buses b ON b.id = t.bus_id WHERE t.status = 'active' ORDER BY t.id`
    );
    if (result.rows.length > 0) return result.rows;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Reaching here means neither the API nor the database answered. The old code
  // returned this hardcoded list silently, which is the worst possible outcome:
  // the simulator looks healthy while publishing five invented Vizag buses with
  // no road geometry. Say so loudly instead.
  usingFallbackData = true;
  console.warn('');
  console.warn('⚠️  Could not load trips from the API or the database.');
  console.warn(`    API : ${HTTP_URL}`);
  console.warn(`    DB  : ${describeTarget()}`);
  if (dbError) console.warn(`    DB error: ${dbError}`);
  console.warn('');
  console.warn('    Falling back to 15 hardcoded buses (Vizag, Mysuru, Kalaburagi).');
  console.warn('    Set DATABASE_URL to the public proxy URL (…proxy.rlwy.net)');
  console.warn('    and SIM_WS_URL to your deployed backend.');
  console.warn('');
  return FALLBACK_TRIPS;
}

async function loadStopsForRoute(route_id: number): Promise<StopInfo[]> {
  try {
    const res = await fetch(`${HTTP_URL}/api/routes/${route_id}/stops`);
    if (res.ok) {
      const data = (await res.json()) as any[];
      if (data.length > 0) {
        return data.map((s) => ({
          stop_id:    s.stop_id,
          stop_name:  s.stop_name,
          latitude:   parseFloat(s.latitude),
          longitude:  parseFloat(s.longitude),
          stop_order: s.stop_order,
        }));
      }
    }
  } catch {}

  try {
    const result = await pool.query<StopInfo>(
      `SELECT s.id AS stop_id, s.name AS stop_name, s.latitude, s.longitude, rs.stop_order
       FROM route_stops rs JOIN stops s ON s.id = rs.stop_id WHERE rs.route_id = $1 ORDER BY rs.stop_order`,
      [route_id]
    );
    if (result.rows.length > 0) return result.rows;
  } catch {}

  return FALLBACK_STOPS[route_id] || FALLBACK_STOPS[1];
}

/**
 * Road geometry for a route, as [[lng, lat], ...]. Returns null when the route
 * has none stored — the agent then drives straight lines between stops, which
 * is visibly wrong but better than not moving at all.
 */
async function loadGeometryForRoute(route_id: number): Promise<[number, number][] | null> {
  const clean = PRECOMPUTED_GEOMETRIES[route_id];
  if (clean && clean.length > 1) {
    return clean.map((p) => [p.longitude, p.latitude]);
  }

  try {
    const res = await fetch(`${HTTP_URL}/api/routes/${route_id}/geometry`);
    if (res.ok) {
      const data = (await res.json()) as any;
      const coords = data?.coordinates;
      if (Array.isArray(coords) && coords.length > 1) return coords as [number, number][];
    }
  } catch {}

  try {
    const result = await pool.query(
      `SELECT coordinates FROM route_geometry WHERE route_id = $1`,
      [route_id]
    );
    const coords = result.rows[0]?.coordinates;
    if (Array.isArray(coords) && coords.length > 1) return coords as [number, number][];
  } catch {}

  return null;
}

function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS  = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Keeps a live publisher socket, retrying indefinitely with capped exponential
 * backoff. Hosted backends drop idle sockets routinely, so a single failed
 * retry must not take the simulator down — it is meant to run for a whole demo.
 * Existing agents are re-pointed at the new socket so buses keep their place on
 * the route instead of restarting from the first stop, and so that reconnecting
 * does not spawn a second set of agents publishing duplicate telemetry.
 */
async function maintainConnection(agents: BusAgent[]): Promise<void> {
  let attempt = 0;

  for (;;) {
    let ws: WebSocket;
    try {
      ws = await connectWs();
    } catch {
      attempt += 1;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
      console.warn(`⚠️  Cannot reach ${WS_URL} (attempt ${attempt}). Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      continue;
    }

    attempt = 0;
    console.log(`🔌 Connected to backend WebSocket at ${WS_URL}\n`);
    agents.forEach((a) => a.setSocket(ws));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ERROR') {
          console.warn(`[WS ACK] ⚠️  Error from server: ${msg.message}`);
        }
      } catch {}
    });

    // Wait for this socket to die, then loop round and reconnect.
    await new Promise<void>((resolve) => {
      ws.once('close', () => {
        console.warn('\n⚠️  WebSocket connection closed. Reconnecting...');
        resolve();
      });
      // 'error' is always followed by 'close', so resolving here would double-fire.
      ws.on('error', () => {});
    });

    await sleep(RECONNECT_BASE_MS);
  }
}

async function main(): Promise<void> {
  console.log('\n🛰️  NXTBus Smart Simulator starting...');
  console.log(`   Backend WS : ${WS_URL}`);
  console.log(`   Tick rate  : ${TICK_MS}ms\n`);

  const trips = await loadTrips();
  console.log(`✅ Loaded ${trips.length} active trip(s):`);
  trips.forEach((t) =>
    console.log(`   Trip ${t.trip_id} | Bus ${t.bus_number} (${t.license_plate}) | Capacity: ${t.capacity}`)
  );
  console.log('');

  // Agents are built once and reused across reconnects. They start with no
  // socket and simply drop ticks until maintainConnection() hands them one.
  const agents: BusAgent[] = [];
  let onRoads = 0;
  for (const trip of trips) {
    const stops = await loadStopsForRoute(trip.route_id);
    if (stops.length < 2) continue;

    const geometry = await loadGeometryForRoute(trip.route_id);
    if (geometry) onRoads++;

    agents.push(
      new BusAgent({
        trip_id:       trip.trip_id,
        license_plate: trip.license_plate,
        capacity:      trip.capacity,
        stops,
        geometry,
        ws:            null,
        intervalMs:    TICK_MS,
      })
    );
  }

  console.log(
    `\n🛣️  ${onRoads}/${agents.length} bus(es) following real road geometry` +
      (onRoads < agents.length
        ? ` — the rest fall back to straight lines. Run "npm run fetch-geometry" to fill the gaps.`
        : '')
  );

  // Repeat the warning here: the trip list scrolls past on startup, and this is
  // the last thing printed before telemetry begins.
  if (usingFallbackData) {
    console.warn('🚨 Publishing HARDCODED fallback buses — not your real network.');
  }

  process.on('SIGINT', () => {
    console.log('\n\n⛔ Shutting down simulator...');
    agents.forEach((a) => a.stop());
    try { pool.end(); } catch {}
    setTimeout(() => process.exit(0), 500);
  });

  const connection = maintainConnection(agents);

  agents.forEach((agent, i) => {
    setTimeout(() => agent.start(), (i + 1) * 3000);
  });

  await connection;
}

main().catch((err) => {
  console.error('Fatal simulator error:', err);
  process.exit(1);
});
