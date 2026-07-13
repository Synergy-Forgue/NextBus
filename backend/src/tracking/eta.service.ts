import { pool } from '../db/pool';
import { RouteStop } from '../types';
import { etaSeconds } from '../utils/haversine';

export interface StopEta {
  stop_id:     number;
  stop_name:   string;
  latitude:    number;
  longitude:   number;
  stop_order:  number;
  eta_seconds: number | null; // null = already passed
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
  speedKmh:      number
): StopEta[] {
  if (!stops.length) return [];

  let cumulativeSecs = 0;

  return stops.map((stop, i) => {
    if (i < nextStopIndex) {
      // Bus has already passed this stop
      return { ...stop, eta_seconds: null };
    }

    if (i === nextStopIndex) {
      // ETA from bus's current position to the next stop
      cumulativeSecs = etaSeconds(busLat, busLon, stop.latitude, stop.longitude, speedKmh);
    } else {
      // ETA from the previous stop to this stop (cumulative)
      const prev = stops[i - 1];
      cumulativeSecs += etaSeconds(prev.latitude, prev.longitude, stop.latitude, stop.longitude, speedKmh);
    }

    return { ...stop, eta_seconds: cumulativeSecs };
  });
}
