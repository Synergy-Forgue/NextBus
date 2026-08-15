import WebSocket from 'ws';
import { TelemetryPayload } from '../types';
import { generateWaypoints, generateWaypointsAlongPath }  from './physics';
import { simulateOccupancy, simulateConfidence } from './occupancy';

export interface StopInfo {
  stop_id:    number;
  stop_name:  string;
  latitude:   number;
  longitude:  number;
  stop_order: number;
}

export interface BusAgentConfig {
  trip_id:      number;
  license_plate: string;
  capacity:     number;
  stops:        StopInfo[];
  /**
   * Road geometry for the route as [[lng, lat], ...], from route_geometry.
   * When present the bus drives along the real road path; without it, it falls
   * back to straight lines between stops and visibly cuts corners.
   */
  geometry?:    [number, number][] | null;
  /** Null while the publisher socket is down; ticks are dropped until it returns. */
  ws:           WebSocket | null;
  intervalMs:   number; // how often to emit a telemetry tick (e.g. 2000ms)
}

const DWELL_TIME_MS_MIN = 12_000; // 12 seconds minimum stop dwell
const DWELL_TIME_MS_MAX = 40_000; // 40 seconds maximum stop dwell

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function send(ws: WebSocket | null, payload: TelemetryPayload): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * BusAgent — simulates one bus driving its full route, stop-by-stop, in a loop.
 * When the bus reaches the final stop it reverses direction and drives back
 * (simulating a round trip), keeping the demo running indefinitely.
 */
export class BusAgent {
  private cfg: BusAgentConfig;
  private currentOccupancy: number = 0;
  private running: boolean = false;

  constructor(cfg: BusAgentConfig) {
    this.cfg = cfg;
  }

  /**
   * Point this agent at a new socket after a reconnect, so the bus keeps its
   * position and occupancy instead of being rebuilt from the first stop.
   */
  setSocket(ws: WebSocket): void {
    this.cfg.ws = ws;
  }

  /** Index of the geometry vertex closest to a coordinate. */
  private nearestVertex(lat: number, lon: number): number {
    const path = this.cfg.geometry!;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < path.length; i++) {
      const dLon = path[i][0] - lon;
      const dLat = path[i][1] - lat;
      const d = dLat * dLat + dLon * dLon; // squared degrees suffices for ordering
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * The slice of route geometry between two consecutive stops, oriented in the
   * direction of travel. Returns null when there is no usable geometry, so the
   * caller falls back to a straight line.
   */
  private legGeometry(from: StopInfo, to: StopInfo): [number, number][] | null {
    const path = this.cfg.geometry;
    if (!path || path.length < 2) return null;

    const a = this.nearestVertex(from.latitude, from.longitude);
    const b = this.nearestVertex(to.latitude, to.longitude);
    if (a === b) return null;

    // Geometry is stored in forward order; on the return leg the slice runs
    // backwards and has to be reversed.
    const slice = a < b ? path.slice(a, b + 1) : path.slice(b, a + 1).reverse();
    return slice.length >= 2 ? (slice as [number, number][]) : null;
  }

  /** Start the simulation loop */
  async start(): Promise<void> {
    this.running = true;
    console.log(`[Simulator] 🚌 Bus ${this.cfg.license_plate} (trip ${this.cfg.trip_id}) started.`);

    let stops = [...this.cfg.stops];

    while (this.running) {
      // Drive forward then reverse to simulate a full round trip
      for (const direction of ['forward', 'reverse'] as const) {
        const orderedStops = direction === 'forward' ? stops : [...stops].reverse();

        for (let i = 0; i < orderedStops.length - 1; i++) {
          if (!this.running) return;

          const fromStop = orderedStops[i];
          const toStop   = orderedStops[i + 1];

          // ── Dwell at the current stop ────────────────────────────────────
          const dwellMs = DWELL_TIME_MS_MIN + Math.random() * (DWELL_TIME_MS_MAX - DWELL_TIME_MS_MIN);
          console.log(
            `[Simulator] 🚏 Bus ${this.cfg.license_plate} dwelling at "${fromStop.stop_name}" for ${(dwellMs / 1000).toFixed(0)}s`
          );

          // Update occupancy at stop
          this.currentOccupancy = simulateOccupancy(
            this.cfg.capacity,
            fromStop.stop_order,
            stops.length,
            this.currentOccupancy
          );

          // Emit a stationary telemetry tick while dwelling
          send(this.cfg.ws, {
            trip_id:                  this.cfg.trip_id,
            latitude:                 fromStop.latitude,
            longitude:                fromStop.longitude,
            speed:                    0,
            occupancy_count:          this.currentOccupancy,
            vision_confidence_score:  simulateConfidence(),
            recorded_at:              new Date().toISOString(),
          });

          await sleep(dwellMs);

          // ── Drive to next stop ───────────────────────────────────────────
          // Follow the real road path for this leg when geometry is available,
          // so the bus stays on the line the apps draw.
          const legPath = this.legGeometry(fromStop, toStop);
          const waypoints = legPath
            ? generateWaypointsAlongPath(legPath, 20)
            : generateWaypoints(
                fromStop.latitude, fromStop.longitude,
                toStop.latitude,   toStop.longitude,
                20
              );

          for (const wp of waypoints) {
            if (!this.running) return;

            send(this.cfg.ws, {
              trip_id:                  this.cfg.trip_id,
              latitude:                 wp.latitude,
              longitude:                wp.longitude,
              speed:                    parseFloat(wp.speedKmh.toFixed(1)),
              occupancy_count:          this.currentOccupancy,
              vision_confidence_score:  simulateConfidence(),
              recorded_at:              new Date().toISOString(),
            });

            await sleep(this.cfg.intervalMs);
          }
        }

        // Brief pause at the terminal stop before reversing
        await sleep(DWELL_TIME_MS_MAX);
      }
    }
  }

  stop(): void {
    this.running = false;
    console.log(`[Simulator] 🛑 Bus ${this.cfg.license_plate} stopped.`);
  }
}
