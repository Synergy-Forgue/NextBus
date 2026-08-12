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

// ─── Config ───────────────────────────────────────────────────────────────────
const WS_URL   = process.env.SIM_WS_URL   || 'ws://localhost:3000/ws/publish';
const HTTP_URL = process.env.SIM_HTTP_URL || WS_URL.replace(/^ws/, 'http').replace(/\/ws\/publish$/, '');
const TICK_MS  = parseInt(process.env.SIM_TICK_MS || '2000'); // 2s between GPS ticks

// ─── Database Pool (optional fallback for local dev) ──────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'nxtbus',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// ─── Static Offline Fallback Data ─────────────────────────────────────────────
const FALLBACK_TRIPS = [
  { trip_id: 1, route_id: 1, license_plate: 'BUS001', bus_number: '10K',  capacity: 50 },
  { trip_id: 2, route_id: 2, license_plate: 'BUS002', bus_number: '900K', capacity: 50 },
  { trip_id: 3, route_id: 3, license_plate: 'BUS003', bus_number: '28K',  capacity: 45 },
  { trip_id: 4, route_id: 4, license_plate: 'BUS004', bus_number: '55T',  capacity: 50 },
  { trip_id: 5, route_id: 5, license_plate: 'BUS005', bus_number: '300N', capacity: 45 },
];

const FALLBACK_STOPS: Record<number, StopInfo[]> = {
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
};

async function loadTrips() {
  try {
    const res = await fetch(`${HTTP_URL}/api/trips?status=active`);
    if (res.ok) {
      const data = (await res.json()) as any[];
      if (data.length > 0) {
        return data.map((t) => ({
          trip_id:       t.id,
          route_id:      t.route_id,
          license_plate: t.license_plate,
          bus_number:    t.bus_number || t.route_number,
          capacity:      50,
        }));
      }
    }
  } catch {}

  try {
    const result = await pool.query(
      `SELECT t.id AS trip_id, t.route_id, b.license_plate, b.bus_number, b.capacity
       FROM trips t JOIN buses b ON b.id = t.bus_id WHERE t.status = 'active' ORDER BY t.id`
    );
    if (result.rows.length > 0) return result.rows;
  } catch {}

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

function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
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

  let ws: WebSocket;
  try {
    ws = await connectWs();
    console.log(`🔌 Connected to backend WebSocket at ${WS_URL}\n`);
  } catch (err) {
    console.error(`❌ Could not connect to backend WebSocket at ${WS_URL}\n`);
    process.exit(1);
  }

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ERROR') {
        console.warn(`[WS ACK] ⚠️  Error from server: ${msg.message}`);
      }
    } catch {}
  });

  ws.on('close', () => {
    console.warn('\n⚠️  WebSocket connection closed. Reconnecting in 3s...');
    setTimeout(() => {
      main().catch(console.error);
    }, 3000);
  });

  const agents: BusAgent[] = [];
  for (const trip of trips) {
    const stops = await loadStopsForRoute(trip.route_id);
    if (stops.length < 2) continue;

    const agent = new BusAgent({
      trip_id:       trip.trip_id,
      license_plate: trip.license_plate,
      capacity:      trip.capacity,
      stops,
      ws,
      intervalMs:    TICK_MS,
    });

    agents.push(agent);
    const staggerMs = agents.length * 3000;
    setTimeout(() => agent.start(), staggerMs);
  }

  process.on('SIGINT', () => {
    console.log('\n\n⛔ Shutting down simulator...');
    agents.forEach((a) => a.stop());
    ws.close();
    try { pool.end(); } catch {}
    setTimeout(() => process.exit(0), 500);
  });
}

main().catch((err) => {
  console.error('Fatal simulator error:', err);
  process.exit(1);
});
