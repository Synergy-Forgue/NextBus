import WebSocket from 'ws';
import { TelemetryPayload } from '../types';
import { generateWaypoints }  from './physics';
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
  ws:           WebSocket;
  intervalMs:   number; // how often to emit a telemetry tick (e.g. 2000ms)
}

const DWELL_TIME_MS_MIN = 12_000; // 12 seconds minimum stop dwell
const DWELL_TIME_MS_MAX = 40_000; // 40 seconds maximum stop dwell

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function send(ws: WebSocket, payload: TelemetryPayload): void {
  if (ws.readyState === WebSocket.OPEN) {
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
          const waypoints = generateWaypoints(
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
