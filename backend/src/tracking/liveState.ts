import { LiveBusState } from '../types';

/**
 * liveState.ts
 * Central in-memory store for the real-time state of all active buses.
 * Keyed by trip_id for O(1) reads and writes.
 *
 * This is intentionally a plain Map — no Redis needed for 5 buses.
 * When scaling to 100+ buses across multiple servers, replace this
 * module with a Redis pub/sub adapter without touching any other code.
 */

const liveFleet = new Map<number, LiveBusState>();

/** Upsert the latest telemetry for a bus */
export function updateBusState(state: LiveBusState): void {
  liveFleet.set(state.trip_id, state);
}

/** Get live state of one bus by trip_id */
export function getBusState(trip_id: number): LiveBusState | undefined {
  return liveFleet.get(trip_id);
}

/** Get all currently tracked buses */
export function getAllBusStates(): LiveBusState[] {
  return Array.from(liveFleet.values());
}

/** Remove a bus from the live fleet (trip ended / bus went offline) */
export function removeBusState(trip_id: number): void {
  liveFleet.delete(trip_id);
}
