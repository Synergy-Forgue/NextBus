/**
 * simulator.ts — NXTBus Smart GPS + AI Vision Simulator
 * ─────────────────────────────────────────────────────
 * Loads all active trips from PostgreSQL, spawns one BusAgent per trip,
 * and pumps realistic telemetry into the backend's WebSocket ingestion endpoint.
 *
 * Usage:
 *   npm run sim
 *
 * The simulator connects to: ws://localhost:3000/ws/publish
 * Make sure the NXTBus backend is running first.
 */

import dotenv from 'dotenv';
dotenv.config();

import WebSocket from 'ws';
import { Pool }  from 'pg';
import { BusAgent, StopInfo } from './busAgent';

// ─── Config ───────────────────────────────────────────────────────────────────
const WS_URL  = process.env.SIM_WS_URL  || 'ws://localhost:3000/ws/publish';
const TICK_MS = parseInt(process.env.SIM_TICK_MS || '2000'); // 2s between GPS ticks

// ─── Database Pool ────────────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'nxtbus',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface TripRow {
  trip_id:       number;
  route_id:      number;
  license_plate: string;
  bus_number:    string;
  capacity:      number;
}

interface StopRow extends StopInfo {}

// ─── Load active trips + their stop sequences ─────────────────────────────────
async function loadTrips(): Promise<TripRow[]> {
  const result = await pool.query<TripRow>(
    `SELECT
       t.id   AS trip_id,
       t.route_id,
       b.license_plate,
       b.bus_number,
       b.capacity
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     WHERE t.status = 'active'
     ORDER BY t.id`
  );
  return result.rows;
}

async function loadStopsForRoute(route_id: number): Promise<StopRow[]> {
  const result = await pool.query<StopRow>(
    `SELECT
       s.id        AS stop_id,
       s.name      AS stop_name,
       s.latitude,
       s.longitude,
       rs.stop_order
     FROM route_stops rs
     JOIN stops s ON s.id = rs.stop_id
     WHERE rs.route_id = $1
     ORDER BY rs.stop_order`,
    [route_id]
  );
  return result.rows;
}

// ─── Wait for WS connection ───────────────────────────────────────────────────
function connectWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open',  () => resolve(ws));
    ws.on('error', (err) => reject(err));
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('\n🛰️  NXTBus Smart Simulator starting...');
  console.log(`   Backend WS : ${WS_URL}`);
  console.log(`   Tick rate  : ${TICK_MS}ms\n`);

  // Load trips
  const trips = await loadTrips();
  if (!trips.length) {
    console.error('❌ No active trips found in the database. Run schema.sql + seed.sql first.');
    process.exit(1);
  }

  console.log(`✅ Loaded ${trips.length} active trip(s):`);
  trips.forEach((t) =>
    console.log(`   Trip ${t.trip_id} | Bus ${t.bus_number} (${t.license_plate}) | Capacity: ${t.capacity}`)
  );
  console.log('');

  // Connect to backend WebSocket
  let ws: WebSocket;
  try {
    ws = await connectWs();
    console.log(`🔌 Connected to backend WebSocket at ${WS_URL}\n`);
  } catch (err) {
    console.error(`❌ Could not connect to backend WebSocket at ${WS_URL}`);
    console.error('   Make sure the NXTBus backend server is running first.\n');
    process.exit(1);
  }

  // Handle server ACK / ERROR messages
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ERROR') {
        console.warn(`[WS ACK] ⚠️  Error from server: ${msg.message}`);
      }
    } catch {
      // ignore non-JSON
    }
  });

  ws.on('close', () => {
    console.warn('\n⚠️  WebSocket connection closed. Simulator will exit.');
    process.exit(0);
  });

  // Spawn a BusAgent for each active trip
  const agents: BusAgent[] = [];

  for (const trip of trips) {
    const stops = await loadStopsForRoute(trip.route_id);
    if (stops.length < 2) {
      console.warn(`[Simulator] Skipping trip ${trip.trip_id} — route has fewer than 2 stops.`);
      continue;
    }

    const agent = new BusAgent({
      trip_id:       trip.trip_id,
      license_plate: trip.license_plate,
      capacity:      trip.capacity,
      stops,
      ws,
      intervalMs:    TICK_MS,
    });

    agents.push(agent);

    // Stagger bus start times by 3s each to avoid thundering-herd on the WS
    const staggerMs = agents.length * 3000;
    setTimeout(() => agent.start(), staggerMs);
  }

  // Graceful shutdown on Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\n⛔ Shutting down simulator...');
    agents.forEach((a) => a.stop());
    ws.close();
    pool.end();
    setTimeout(() => process.exit(0), 500);
  });
}

main().catch((err) => {
  console.error('Fatal simulator error:', err);
  process.exit(1);
});
