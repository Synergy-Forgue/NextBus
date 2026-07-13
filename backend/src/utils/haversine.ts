/**
 * haversine.ts
 * Calculates the great-circle distance between two GPS coordinates.
 * Returns distance in kilometres.
 */
export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Estimates ETA in seconds to reach a target coordinate.
 * @param speedKmh - Current speed in km/h. Falls back to 20 km/h if ≤ 0.
 */
export function etaSeconds(
  fromLat: number, fromLon: number,
  toLat: number,   toLon: number,
  speedKmh: number
): number {
  const distKm = haversineKm(fromLat, fromLon, toLat, toLon);
  const effectiveSpeed = speedKmh > 0 ? speedKmh : 20;
  return Math.round((distKm / effectiveSpeed) * 3600);
}
