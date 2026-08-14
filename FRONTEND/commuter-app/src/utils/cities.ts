/**
 * City grouping for stops.
 *
 * The `stops` table has no city column — it stores only id, name, latitude and
 * longitude. Rather than require a schema migration before the UI can group
 * stops by city, cities are derived from coordinates using bounding boxes.
 * The pilot networks are hundreds of kilometres apart, so this is unambiguous.
 *
 * If a `city` column is added to the backend later, prefer it over this and
 * keep the boxes only as a fallback for rows that predate the column.
 */

export interface CityDef {
  id: string;
  name: string;
  /** Shown next to the name so the user knows which network they are browsing. */
  region: string;
  emoji: string;
  /** [minLat, maxLat, minLng, maxLng] */
  bounds: [number, number, number, number];
  /** Fallback map centre when the city has no stops loaded yet. */
  center: { latitude: number; longitude: number };
}

export const CITIES: CityDef[] = [
  {
    id: 'vizag',
    name: 'Visakhapatnam',
    region: 'Andhra Pradesh · APSRTC',
    emoji: '🌊',
    bounds: [17.4, 18.1, 82.9, 83.6],
    center: { latitude: 17.7261, longitude: 83.3085 },
  },
  {
    id: 'mysuru',
    name: 'Mysuru',
    region: 'Karnataka · KSRTC',
    emoji: '🏛️',
    bounds: [12.2, 12.5, 76.5, 76.8],
    center: { latitude: 12.3052, longitude: 76.6552 },
  },
];

/** A stop as the UI needs it, regardless of which endpoint shape it came from. */
export interface CityStop {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  cityId: string | null;
}

/**
 * GET /api/stops returns { id, name, latitude, longitude } while
 * GET /api/routes/:id/stops returns { stop_id, stop_name, ... }. Accept either.
 */
export function normaliseStop(row: any): CityStop | null {
  const stop_id = Number(row?.stop_id ?? row?.id);
  const stop_name = row?.stop_name ?? row?.name;
  const latitude = Number(row?.latitude);
  const longitude = Number(row?.longitude);

  if (!Number.isFinite(stop_id) || !stop_name) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { stop_id, stop_name, latitude, longitude, cityId: cityIdForCoords(latitude, longitude) };
}

export function cityIdForCoords(latitude: number, longitude: number): string | null {
  for (const city of CITIES) {
    const [minLat, maxLat, minLng, maxLng] = city.bounds;
    if (latitude >= minLat && latitude <= maxLat && longitude >= minLng && longitude <= maxLng) {
      return city.id;
    }
  }
  return null;
}

export function getCity(cityId: string | null | undefined): CityDef | undefined {
  return CITIES.find((c) => c.id === cityId);
}

/**
 * Buckets stops by city and drops cities with no stops, so the picker only
 * offers networks that actually exist in the connected database. The Bengaluru
 * network is defined in the repo seed but may not be present in every
 * deployment — this keeps the UI honest about what is really available.
 */
export function groupStopsByCity(rows: any[]): { city: CityDef; stops: CityStop[] }[] {
  const byCity = new Map<string, CityStop[]>();

  for (const row of rows || []) {
    const stop = normaliseStop(row);
    if (!stop || !stop.cityId) continue;
    const list = byCity.get(stop.cityId) || [];
    list.push(stop);
    byCity.set(stop.cityId, list);
  }

  return CITIES.filter((c) => (byCity.get(c.id) || []).length > 0).map((city) => ({
    city,
    stops: (byCity.get(city.id) || []).sort((a, b) => a.stop_name.localeCompare(b.stop_name)),
  }));
}
