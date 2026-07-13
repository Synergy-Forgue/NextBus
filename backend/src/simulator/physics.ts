/**
 * physics.ts
 * Models realistic bus motion between two stops.
 * Outputs an array of waypoints (lat, lng, speed) that simulate:
 *   - Acceleration from a bus stop
 *   - Cruise speed with natural variation
 *   - Random traffic slowdowns
 *   - Deceleration into the next stop
 */

export interface Waypoint {
  latitude:  number;
  longitude: number;
  speedKmh:  number;
}

// Typical city bus speeds
const CRUISE_MIN_KMH  = 22;
const CRUISE_MAX_KMH  = 38;
const STOP_SPEED_KMH  = 0;
const TRAFFIC_MIN_KMH = 6;
const TRAFFIC_MAX_KMH = 12;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generates N waypoints interpolated along the straight line
 * between two stop coordinates, with a realistic speed profile.
 */
export function generateWaypoints(
  fromLat: number, fromLon: number,
  toLat:   number, toLon:   number,
  steps:   number = 20
): Waypoint[] {
  const waypoints: Waypoint[] = [];
  const cruiseSpeed = rand(CRUISE_MIN_KMH, CRUISE_MAX_KMH);

  // Randomly inject a traffic event in the middle segment
  const hasTraffic  = Math.random() < 0.35; // 35% chance of a traffic slowdown
  const trafficStart = rand(0.3, 0.5);
  const trafficEnd   = trafficStart + rand(0.1, 0.2);
  const trafficSpeed = rand(TRAFFIC_MIN_KMH, TRAFFIC_MAX_KMH);

  for (let i = 0; i <= steps; i++) {
    const t   = i / steps;
    const lat = lerp(fromLat, toLat, t);
    const lon = lerp(fromLon, toLon, t);

    let speed: number;

    if (t < 0.15) {
      // Accelerating out of the stop
      speed = lerp(STOP_SPEED_KMH, cruiseSpeed, t / 0.15);
    } else if (t > 0.85) {
      // Braking into the next stop
      speed = lerp(cruiseSpeed, STOP_SPEED_KMH, (t - 0.85) / 0.15);
    } else if (hasTraffic && t >= trafficStart && t <= trafficEnd) {
      // Traffic slowdown
      speed = trafficSpeed;
    } else {
      // Cruise with minor random flutter (±3 km/h)
      speed = cruiseSpeed + rand(-3, 3);
    }

    waypoints.push({ latitude: lat, longitude: lon, speedKmh: Math.max(0, speed) });
  }

  return waypoints;
}
