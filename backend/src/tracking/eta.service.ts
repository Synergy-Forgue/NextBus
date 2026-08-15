import { pool } from '../db/pool';
import { RouteStop, StopEta, VehicleStatus } from '../types';
import { etaSeconds, haversineKm } from '../utils/haversine';

export { StopEta };

/**
 * Computes explicit vehicle status ('LIVE', 'APPROACHING STOP', 'AT STOP', 'STALE', 'SIGNAL LOST', 'OFFLINE')
 * based on speed, distance to next stop (<150m), vision confidence, and age of last_updated.
 */
export function deriveVehicleStatus(
  speedKmh: number,
  lastUpdated: Date | string | number,
  distToNextStopKm?: number | null,
  visionConfidence?: number,
  nowMs: number = Date.now()
): VehicleStatus {
  const lastMs = new Date(lastUpdated).getTime();
  const ageMs = nowMs - lastMs;

  if (ageMs > 120000) return 'OFFLINE';
  if (ageMs > 60000) return 'STALE';
  if (ageMs > 30000 || (visionConfidence !== undefined && visionConfidence < 0.3)) {
    return 'SIGNAL LOST';
  }

  if (distToNextStopKm != null && distToNextStopKm < 0.15) {
    return speedKmh <= 5 ? 'AT STOP' : 'APPROACHING STOP';
  }

  return 'LIVE';
}

/**
 * Fetches all stops for the route attached to a given trip.
 * Results are ordered by stop_order (ascending).
 */
export async function getRouteStopsForTrip(trip_id: number): Promise<RouteStop[]> {
  const tripResult = await pool.query<{ route_id: number }>(
    `SELECT t.route_id FROM trips t WHERE t.id = $1`,
    [trip_id]
  );
  if (!tripResult.rowCount) return [];

  const { route_id } = tripResult.rows[0];
  const stopsResult = await pool.query<RouteStop>(
    `SELECT s.id AS stop_id, s.name AS stop_name, s.latitude, s.longitude, rs.stop_order
     FROM route_stops rs
     JOIN stops s ON s.id = rs.stop_id
     WHERE rs.route_id = $1
     ORDER BY rs.stop_order`,
    [route_id]
  );
  return stopsResult.rows;
}

/**
 * Calculates ETAs for all stops on a route.
 *
 * @param stops          - Ordered stop list for the route
 * @param nextStopIndex  - The index of the stop the bus is currently heading towards
 *                         (tracked in liveState, not computed by proximity to avoid errors on curved routes)
 * @param busLat / busLon - Current bus position
 * @param speedKmh       - Current bus speed
 */
export function calculateStopEtas(
  stops:         RouteStop[],
  nextStopIndex: number,
  busLat:        number,
  busLon:        number,
  speedKmh:      number,
  roadFactor:    number = 1
): StopEta[] {
  if (!stops.length) return [];

  // Straight-line distance between stops always understates the driving
  // distance, so raw ETAs promised arrivals sooner than any bus could manage.
  // roadFactor is the route's stored road distance divided by the straight-line
  // chain through its stops; 1 leaves behaviour unchanged when unknown.
  const factor = Number.isFinite(roadFactor) && roadFactor > 0 ? roadFactor : 1;

  let cumulativeSecs = 0;

  return stops.map((stop, i) => {
    if (i < nextStopIndex) {
      // Bus has already passed this stop
      return { ...stop, eta_seconds: null };
    }

    if (i === nextStopIndex) {
      // ETA from bus's current position to the next stop
      cumulativeSecs = etaSeconds(busLat, busLon, stop.latitude, stop.longitude, speedKmh) * factor;
    } else {
      // ETA from the previous stop to this stop (cumulative)
      const prev = stops[i - 1];
      cumulativeSecs +=
        etaSeconds(prev.latitude, prev.longitude, stop.latitude, stop.longitude, speedKmh) * factor;
    }

    return { ...stop, eta_seconds: Math.round(cumulativeSecs) };
  });
}

/**
 * How much longer the real road is than a straight line through the stops.
 *
 * Computed once per route from stored geometry. Returns 1 when geometry is
 * missing, which leaves ETAs exactly as they were rather than guessing.
 */
export function roadFactorFor(stops: RouteStop[], roadDistanceM?: number | null): number {
  if (!roadDistanceM || !Number.isFinite(roadDistanceM) || stops.length < 2) return 1;

  let straight = 0;
  for (let i = 1; i < stops.length; i++) {
    straight += haversineKm(
      stops[i - 1].latitude, stops[i - 1].longitude,
      stops[i].latitude,     stops[i].longitude
    ) * 1000;
  }

  if (straight <= 0) return 1;

  // Clamp: a factor below 1 means the geometry disagrees with the stops, and
  // anything above 2 suggests bad data rather than a winding road.
  return Math.min(2, Math.max(1, roadDistanceM / straight));
}
