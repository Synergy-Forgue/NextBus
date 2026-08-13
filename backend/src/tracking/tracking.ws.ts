import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { pool } from '../db/pool';
import { TelemetryPayload, LiveBusState, RouteStop } from '../types';
import { updateBusState, getAllBusStates, getBusState, removeBusState } from './liveState';
import { getRouteStopsForTrip, calculateStopEtas, deriveVehicleStatus } from './eta.service';
import { haversineKm } from '../utils/haversine';

// ─── Constants ────────────────────────────────────────────────────────────────
// Distance threshold in km within which we consider a bus to have "arrived" at a stop
const STOP_ARRIVAL_THRESHOLD_KM = 0.15; // 150 metres

// ─── Subscriber Registry ──────────────────────────────────────────────────────
// Commuter clients subscribe to a specific route_id to receive live updates.
const subscribers = new Map<WebSocket, number | 'all'>(); // client → route_id | 'all'

// ─── Route Stops Cache ────────────────────────────────────────────────────────
// Loaded from DB once per route_id. Avoids a DB query on every telemetry tick.
const routeStopsCache = new Map<number, RouteStop[]>();

async function getCachedRouteStops(trip_id: number): Promise<RouteStop[]> {
  // First check if we already have this trip's stops cached
  for (const [cachedRouteId, stops] of routeStopsCache) {
    const state = [...getAllBusStates()].find(b => b.trip_id === trip_id);
    if (state && state.route_id === cachedRouteId) return stops;
  }
  // Load from DB and cache by route_id
  const stops = await getRouteStopsForTrip(trip_id);
  const state = getAllBusStates().find(b => b.trip_id === trip_id);
  if (state) routeStopsCache.set(state.route_id, stops);
  return stops;
}

// ─── Stop Advancement Logic ───────────────────────────────────────────────────
/**
 * Determines the next stop index a bus should be heading towards.
 * Advances the index when the bus comes within STOP_ARRIVAL_THRESHOLD_KM of the current target stop.
 */
function computeNextStopIndex(
  currentIndex: number,
  stops:        RouteStop[],
  busLat:       number,
  busLon:       number
): number {
  if (!stops.length || currentIndex >= stops.length) return currentIndex;
  const targetStop = stops[currentIndex];
  const dist = haversineKm(busLat, busLon, targetStop.latitude, targetStop.longitude);
  if (dist < STOP_ARRIVAL_THRESHOLD_KM && currentIndex < stops.length - 1) {
    return currentIndex + 1;
  }
  return currentIndex;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function send(ws: WebSocket, data: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/** Broadcast emergency alerts to all connected subscriber clients (RTC Dashboard) */
export function broadcastAlert(alert: object): void {
  const message = { type: 'ALERT', data: alert };
  subscribers.forEach((_, client) => send(client, message));
}

/** Broadcast alert resolved status to all connected subscriber clients */
export function broadcastAlertResolved(alert: object): void {
  const message = { type: 'ALERT_RESOLVED', data: alert };
  subscribers.forEach((_, client) => send(client, message));
}

/** Broadcast bus offline notification to all connected subscriber clients */
export function broadcastBusOffline(tripId: number): void {
  removeBusState(tripId);
  const message = { type: 'BUS_OFFLINE', trip_id: tripId };
  subscribers.forEach((_, client) => send(client, message));
}

function parseMessage<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Persist Telemetry to DB ──────────────────────────────────────────────────
async function persistTelemetry(payload: TelemetryPayload): Promise<void> {
  await pool.query(
    `INSERT INTO telemetry_logs
       (trip_id, latitude, longitude, speed, occupancy_count, vision_confidence_score, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      payload.trip_id,
      payload.latitude,
      payload.longitude,
      payload.speed,
      payload.occupancy_count,
      payload.vision_confidence_score,
      payload.recorded_at,
    ]
  );
}

// ─── Broadcast to Subscribers ─────────────────────────────────────────────────
async function broadcastUpdate(state: LiveBusState, stops: RouteStop[]): Promise<void> {
  const stopEtas = calculateStopEtas(
    stops,
    state.nextStopIndex,
    state.latitude,
    state.longitude,
    state.speed
  );

  const nextStop = stops[state.nextStopIndex];
  const distToNextStop = nextStop
    ? haversineKm(state.latitude, state.longitude, nextStop.latitude, nextStop.longitude)
    : null;

  const status = deriveVehicleStatus(
    state.speed,
    state.last_updated,
    distToNextStop,
    state.vision_confidence_score
  );

  const updatedState: LiveBusState = {
    ...state,
    status,
    stop_etas: stopEtas,
  };

  updateBusState(updatedState);

  const message = {
    type: 'BUS_UPDATE',
    data: updatedState,
  };

  subscribers.forEach((routeFilter, client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      (routeFilter === 'all' || routeFilter === state.route_id)
    ) {
      send(client, message);
    }
  });
}

// ─── Fetch trip meta from DB ──────────────────────────────────────────────────
async function getTripMeta(
  trip_id: number
): Promise<{ bus_id: number; route_id: number; route_number: string; license_plate: string } | null> {
  const result = await pool.query(
    `SELECT t.bus_id, t.route_id, r.route_number, b.license_plate
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.id = $1 AND t.status = 'active'`,
    [trip_id]
  );
  return result.rowCount ? result.rows[0] : null;
}

// ─── WebSocket Server Setup ───────────────────────────────────────────────────
export function attachWebSocketServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer });

  console.log('🔌 WebSocket server attached.');

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url || '';

    // ── PUBLISHER channel ── (Driver App / GPS Simulator)
    if (url.startsWith('/ws/publish')) {
      console.log('[WS] Publisher connected');
      let publisherTripId: number | null = null;

      ws.on('message', async (raw) => {
        const payload = parseMessage<TelemetryPayload>(raw.toString());
        if (!payload) {
          send(ws, { type: 'ERROR', message: 'Invalid JSON payload.' });
          return;
        }

        const { trip_id, latitude, longitude, speed, occupancy_count, vision_confidence_score, recorded_at } = payload;

        if (!trip_id || latitude == null || longitude == null) {
          send(ws, { type: 'ERROR', message: 'trip_id, latitude, and longitude are required.' });
          return;
        }

        // Fetch trip metadata (also validates the trip is still active)
        const meta = await getTripMeta(trip_id);
        if (!meta) {
          send(ws, { type: 'ERROR', message: `No active trip found with id ${trip_id}.` });
          return;
        }

        publisherTripId = trip_id;

        // Load route stops (cached after first load)
        let stops = routeStopsCache.get(meta.route_id);
        if (!stops) {
          stops = await getRouteStopsForTrip(trip_id);
          routeStopsCache.set(meta.route_id, stops);
        }

        // Get or initialise nextStopIndex from previous state
        const prevState = getBusState(trip_id);
        const prevNextStopIndex = prevState?.nextStopIndex ?? 0;

        // Advance the next stop index if the bus is close enough
        const nextStopIndex = computeNextStopIndex(prevNextStopIndex, stops, latitude, longitude);

        const nextStop = stops[nextStopIndex];
        const distToNextStop = nextStop
          ? haversineKm(latitude, longitude, nextStop.latitude, nextStop.longitude)
          : null;

        const status = deriveVehicleStatus(
          speed ?? 0,
          recorded_at || Date.now(),
          distToNextStop,
          vision_confidence_score
        );

        const stop_etas = calculateStopEtas(
          stops,
          nextStopIndex,
          latitude,
          longitude,
          speed ?? 0
        );

        // Build the live state object
        const liveState: LiveBusState = {
          trip_id,
          bus_id:                   meta.bus_id,
          route_id:                 meta.route_id,
          route_number:             meta.route_number,
          license_plate:            meta.license_plate,
          latitude,
          longitude,
          speed:                    speed ?? 0,
          occupancy_count:          occupancy_count ?? 0,
          vision_confidence_score:  vision_confidence_score ?? 0,
          last_updated:             new Date(recorded_at || Date.now()),
          nextStopIndex,
          status,
          stop_etas,
        };

        // Update in-memory state
        updateBusState(liveState);

        // Persist to DB asynchronously (non-blocking)
        persistTelemetry(payload).catch((err) =>
          console.error('[DB] Telemetry persist error:', err.message)
        );

        // Broadcast to all subscribed commuter clients
        broadcastUpdate(liveState, stops).catch((err) =>
          console.error('[WS] Broadcast error:', err.message)
        );

        // ACK back to publisher
        send(ws, { type: 'ACK', trip_id });
      });

      ws.on('close', () => {
        console.log('[WS] Publisher disconnected');
        // Remove the bus from the live fleet so the commuter app stops showing it
        if (publisherTripId !== null) {
          removeBusState(publisherTripId);
          // Notify all subscribers that this bus went offline
          subscribers.forEach((_, client) => {
            send(client, { type: 'BUS_OFFLINE', trip_id: publisherTripId });
          });
        }
      });
    }

    // ── SUBSCRIBER channel ── (Commuter App / React Native)
    else if (url.startsWith('/ws/subscribe')) {
      const routeParam = new URL(url, 'http://localhost').searchParams.get('route_id');
      const routeFilter: number | 'all' = routeParam ? parseInt(routeParam) : 'all';

      subscribers.set(ws, routeFilter);
      console.log(`[WS] Subscriber connected (route_id: ${routeFilter})`);

      // Immediately send snapshot with computed status and stop_etas
      getFleetWithEtas(routeFilter).then((snapshot) => {
        send(ws, { type: 'SNAPSHOT', data: snapshot });
      }).catch((err) => {
        console.error('[WS] Snapshot error:', err);
      });

      ws.on('close', () => {
        subscribers.delete(ws);
        console.log('[WS] Subscriber disconnected');
      });
    }

    // ── Unknown path ──
    else {
      send(ws, { type: 'ERROR', message: 'Unknown endpoint. Use /ws/publish or /ws/subscribe' });
      ws.close();
    }
  });

  // ── Periodic Stale Fleet Cleanup Worker (60s STALE threshold, 120s OFFLINE threshold) ──
  setInterval(async () => {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 60000;
    const OFFLINE_THRESHOLD_MS = 120000;

    const fleet = getAllBusStates();
    for (const bus of fleet) {
      const last = new Date(bus.last_updated).getTime();
      const ageMs = now - last;

      if (ageMs > OFFLINE_THRESHOLD_MS) {
        console.log(`[WS] Purging offline bus ${bus.license_plate} (trip #${bus.trip_id})`);
        broadcastBusOffline(bus.trip_id);
      } else if (ageMs > STALE_THRESHOLD_MS) {
        if (bus.status !== 'STALE') {
          console.log(`[WS] Marking bus ${bus.license_plate} as STALE (trip #${bus.trip_id})`);
          bus.status = 'STALE';
          updateBusState(bus);

          const stops = routeStopsCache.get(bus.route_id)
            ?? await getRouteStopsForTrip(bus.trip_id);
          await broadcastUpdate(bus, stops);
        }
      }
    }
  }, 10000);
}

// ─── Fleet Snapshot with ETAs & Status (for REST endpoint) ──────────────────
export async function getFleetWithEtas(routeFilter: number | 'all' = 'all'): Promise<LiveBusState[]> {
  const fleet = getAllBusStates().filter(
    (b) => routeFilter === 'all' || b.route_id === routeFilter
  );
  const results = await Promise.all(
    fleet.map(async (state) => {
      const stops = routeStopsCache.get(state.route_id)
        ?? await getRouteStopsForTrip(state.trip_id);
      const stop_etas = calculateStopEtas(
        stops, state.nextStopIndex,
        state.latitude, state.longitude, state.speed
      );
      const nextStop = stops[state.nextStopIndex];
      const distToNextStop = nextStop
        ? haversineKm(state.latitude, state.longitude, nextStop.latitude, nextStop.longitude)
        : null;
      const status = deriveVehicleStatus(
        state.speed,
        state.last_updated,
        distToNextStop,
        state.vision_confidence_score
      );
      const updatedState: LiveBusState = { ...state, status, stop_etas };
      updateBusState(updatedState);
      return updatedState;
    })
  );
  return results;
}
