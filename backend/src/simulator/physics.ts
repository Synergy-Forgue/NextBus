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

/**
 * Speed profile for a normalised position along a leg, shared by the
 * straight-line and path-following generators so both behave identically.
 */
function speedAt(
  t: number,
  cruiseSpeed: number,
  traffic: { has: boolean; start: number; end: number; speed: number }
): number {
  if (t < 0.15) return lerp(STOP_SPEED_KMH, cruiseSpeed, t / 0.15);
  if (t > 0.85) return lerp(cruiseSpeed, STOP_SPEED_KMH, (t - 0.85) / 0.15);
  if (traffic.has && t >= traffic.start && t <= traffic.end) return traffic.speed;
  return cruiseSpeed + rand(-3, 3);
}

/** Equirectangular approximation — plenty accurate over a few km. */
function segmentMetres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dx = (bLon - aLon) * mPerDegLon;
  const dy = (bLat - aLat) * mPerDegLat;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Generates waypoints that follow an actual road polyline rather than the
 * straight line between two stops.
 *
 * Without this the simulator cut corners the drawn route goes around, so buses
 * visibly drifted off their own line — through buildings, across water. Points
 * are spaced by distance travelled, not by vertex index, because road geometry
 * is dense on bends and sparse on straights; stepping per vertex would make
 * buses crawl through corners and jump along straights.
 *
 * `path` is [[lng, lat], ...] as stored in route_geometry.
 */
export function generateWaypointsAlongPath(
  path: [number, number][],
  steps: number = 20
): Waypoint[] {
  if (!Array.isArray(path) || path.length < 2) return [];

  const cruiseSpeed = rand(CRUISE_MIN_KMH, CRUISE_MAX_KMH);
  const trafficStart = rand(0.3, 0.5);
  const traffic = {
    has: Math.random() < 0.35,
    start: trafficStart,
    end: trafficStart + rand(0.1, 0.2),
    speed: rand(TRAFFIC_MIN_KMH, TRAFFIC_MAX_KMH),
  };

  // Cumulative distance along the path so we can sample at even intervals.
  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const [pLon, pLat] = path[i - 1];
    const [cLon, cLat] = path[i];
    cumulative.push(cumulative[i - 1] + segmentMetres(pLat, pLon, cLat, cLon));
  }

  const total = cumulative[cumulative.length - 1];
  if (total <= 0) return [];

  const waypoints: Waypoint[] = [];
  let cursor = 1;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const targetDist = t * total;

    while (cursor < cumulative.length - 1 && cumulative[cursor] < targetDist) cursor++;

    const segStart = cumulative[cursor - 1];
    const segEnd = cumulative[cursor];
    const segLen = segEnd - segStart;
    const localT = segLen > 0 ? (targetDist - segStart) / segLen : 0;

    const [aLon, aLat] = path[cursor - 1];
    const [bLon, bLat] = path[cursor];

    waypoints.push({
      latitude: lerp(aLat, bLat, localT),
      longitude: lerp(aLon, bLon, localT),
      speedKmh: Math.max(0, speedAt(t, cruiseSpeed, traffic)),
    });
  }

  return waypoints;
}
