import axios from 'axios';
import { PRECOMPUTED_GEOMETRIES } from '../utils/routeGeometries';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface Route {
  id: number;
  route_number: string;
  route_name: string;
  start_stop: string;
  end_stop: string;
  created_at?: string;
}

export interface StopEta {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
  eta_seconds: number | null;
}

export interface Bus {
  id?: number;
  trip_id?: number;
  bus_id?: number;
  route_id?: number;
  license_plate: string;
  bus_number?: string;
  route_number?: string;
  latitude: number;
  longitude: number;
  speed: number;
  occupancy_count?: number;
  occupancy?: number;
  capacity?: number;
  vision_confidence_score?: number;
  last_updated?: string;
  nextStopIndex?: number;
  status?: 'LIVE' | 'APPROACHING STOP' | 'AT STOP' | 'STALE' | 'SIGNAL LOST' | 'OFFLINE';
  stop_etas?: StopEta[];
  current_stop_name?: string;
  next_stop_name?: string;
  eta_seconds?: number;
}

export interface RouteStop {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

export interface RouteResult {
  route: Route;
  bus: Bus | null;
  eta: number | null; // ETA in minutes; null if no live/scheduled bus available
  etaStatus: 'LIVE' | 'SCHEDULED' | 'NO_SERVICE';
  crowd: number; // 0-100%
  fare: number; // rupees
  femaleOnly: boolean;
  distance: number; // km
  stops?: RouteStop[];
}

export interface SearchParams {
  q?: string;
  from?: string;
  to?: string;
  preference?: 'fastest' | 'cheapest' | 'least-crowded';
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeFallbackStopEtas(stops: RouteStop[], startIdx = 0): StopEta[] {
  let cumulativeSecs = 0;
  const SPEED_KMH = 25;
  return stops.map((stop, i) => {
    if (i < startIdx) return { ...stop, eta_seconds: null };
    if (i > startIdx) {
      const prev = stops[i - 1];
      const distKm = haversineKm(prev.latitude, prev.longitude, stop.latitude, stop.longitude);
      cumulativeSecs += Math.round((distKm / SPEED_KMH) * 3600);
    }
    return { ...stop, eta_seconds: cumulativeSecs };
  });
}

const FALLBACK_KALABURAGI_ROUTES: Route[] = [
  { id: 11, route_number: '101K', route_name: 'Central Bus Stand ↔ Gulbarga University', start_stop: 'Kalaburagi Central Bus Stand', end_stop: 'Gulbarga University' },
  { id: 12, route_number: '102K', route_name: 'Railway Station ↔ High Court Bench', start_stop: 'Kalaburagi Railway Station', end_stop: 'High Court Karnataka Bench' },
  { id: 13, route_number: '103K', route_name: 'Central Bus Stand ↔ Khwaja Bande Nawaz Dargah', start_stop: 'Kalaburagi Central Bus Stand', end_stop: 'Roza KBN Dargah' },
  { id: 14, route_number: '104K', route_name: 'Central Bus Stand ↔ Central University', start_stop: 'Kalaburagi Central Bus Stand', end_stop: 'Central University Kadaganchi' },
  { id: 15, route_number: '105K', route_name: 'Humnabad Ring Road ↔ Shahabad Road Terminal', start_stop: 'Humnabad Ring Road', end_stop: 'Shahabad Road Terminal' },
];

const FALLBACK_KALABURAGI_STOPS: Record<number, RouteStop[]> = {
  11: [
    { stop_id: 61, stop_name: 'Kalaburagi Central Bus Stand', latitude: 17.3255, longitude: 76.8288, stop_order: 1 },
    { stop_id: 62, stop_name: 'Jagat Circle', latitude: 17.3325, longitude: 76.8340, stop_order: 2 },
    { stop_id: 63, stop_name: 'SVP Circle', latitude: 17.3350, longitude: 76.8385, stop_order: 3 },
    { stop_id: 64, stop_name: 'Super Market', latitude: 17.3380, longitude: 76.8320, stop_order: 4 },
    { stop_id: 65, stop_name: 'District Court Complex', latitude: 17.3310, longitude: 76.8480, stop_order: 5 },
    { stop_id: 66, stop_name: 'Sedam Road Junction', latitude: 17.3120, longitude: 76.8680, stop_order: 6 },
    { stop_id: 67, stop_name: 'Gulbarga University', latitude: 17.2970, longitude: 76.8720, stop_order: 7 },
  ],
  12: [
    { stop_id: 68, stop_name: 'Kalaburagi Railway Station', latitude: 17.3400, longitude: 76.8375, stop_order: 1 },
    { stop_id: 63, stop_name: 'SVP Circle', latitude: 17.3350, longitude: 76.8385, stop_order: 2 },
    { stop_id: 69, stop_name: 'MSK Mill Road', latitude: 17.3270, longitude: 76.8430, stop_order: 3 },
    { stop_id: 70, stop_name: 'Ring Road Aland Junction', latitude: 17.3520, longitude: 76.8300, stop_order: 4 },
    { stop_id: 71, stop_name: 'High Court Karnataka Bench', latitude: 17.3620, longitude: 76.8520, stop_order: 5 },
  ],
  13: [
    { stop_id: 61, stop_name: 'Kalaburagi Central Bus Stand', latitude: 17.3255, longitude: 76.8288, stop_order: 1 },
    { stop_id: 62, stop_name: 'Jagat Circle', latitude: 17.3325, longitude: 76.8340, stop_order: 2 },
    { stop_id: 72, stop_name: 'Kalaburagi Fort Gate', latitude: 17.3435, longitude: 76.8225, stop_order: 3 },
    { stop_id: 73, stop_name: 'Roza KBN Dargah', latitude: 17.3510, longitude: 76.8260, stop_order: 4 },
    { stop_id: 74, stop_name: 'KBN Teaching Hospital', latitude: 17.3480, longitude: 76.8350, stop_order: 5 },
  ],
  14: [
    { stop_id: 61, stop_name: 'Kalaburagi Central Bus Stand', latitude: 17.3255, longitude: 76.8288, stop_order: 1 },
    { stop_id: 75, stop_name: 'Ram Mandir Circle', latitude: 17.3280, longitude: 76.8510, stop_order: 2 },
    { stop_id: 76, stop_name: 'Kusnoor Cross', latitude: 17.2950, longitude: 76.8620, stop_order: 3 },
    { stop_id: 77, stop_name: 'Ring Road University Bypass', latitude: 17.2800, longitude: 76.8500, stop_order: 4 },
    { stop_id: 78, stop_name: 'Central University Kadaganchi', latitude: 17.2150, longitude: 76.6350, stop_order: 5 },
  ],
  15: [
    { stop_id: 79, stop_name: 'Humnabad Ring Road', latitude: 17.3580, longitude: 76.8550, stop_order: 1 },
    { stop_id: 80, stop_name: 'Timmapuri Circle', latitude: 17.3420, longitude: 76.8460, stop_order: 2 },
    { stop_id: 64, stop_name: 'Super Market', latitude: 17.3380, longitude: 76.8320, stop_order: 3 },
    { stop_id: 81, stop_name: 'ESI Medical College', latitude: 17.3190, longitude: 76.8610, stop_order: 4 },
    { stop_id: 82, stop_name: 'Shahabad Road Terminal', latitude: 17.2900, longitude: 76.8750, stop_order: 5 },
  ],
};

export default class RouteService {
  async getRoutes(): Promise<Route[]> {
    try {
      const res = await axios.get(`${API_URL}/api/routes`);
      const list = Array.isArray(res.data) ? res.data : [];
      const ids = new Set(list.map((r: any) => r.id));
      for (const kr of FALLBACK_KALABURAGI_ROUTES) {
        if (!ids.has(kr.id)) list.push(kr);
      }
      return list;
    } catch {
      return FALLBACK_KALABURAGI_ROUTES;
    }
  }

  async getStops(): Promise<RouteStop[]> {
    try {
      const res = await axios.get(`${API_URL}/api/stops`);
      const list = Array.isArray(res.data) ? res.data : [];
      const ids = new Set(list.map((s: any) => s.id ?? s.stop_id));
      for (const stops of Object.values(FALLBACK_KALABURAGI_STOPS)) {
        for (const s of stops) {
          if (!ids.has(s.stop_id)) {
            ids.add(s.stop_id);
            list.push(s);
          }
        }
      }
      return list;
    } catch {
      const all: RouteStop[] = [];
      for (const stops of Object.values(FALLBACK_KALABURAGI_STOPS)) {
        all.push(...stops);
      }
      return all;
    }
  }

  async getFleet(): Promise<Bus[]> {
    try {
      const res = await axios.get(`${API_URL}/api/tracking/fleet`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
      const fallback = await axios.get(`${API_URL}/api/buses`);
      return Array.isArray(fallback.data) ? fallback.data : fallback.data.buses || [];
    } catch (err) {
      console.error('Fleet fetch error:', err);
      return [];
    }
  }

  /**
   * Road-following polyline for a route, as {latitude, longitude} in travel
   * order. Precomputed server-side; returns null when a route has no stored
   * geometry so callers can fall back to joining stop coordinates.
   */
  async getRouteGeometry(routeId: number): Promise<{ latitude: number; longitude: number }[] | null> {
    if (!routeId || isNaN(Number(routeId))) return null;
    const cached = PRECOMPUTED_GEOMETRIES[Number(routeId)];
    if (cached && cached.length >= 2) {
      return cached;
    }
    try {
      const res = await axios.get(`${API_URL}/api/routes/${routeId}/geometry`);
      const coords = res.data?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        return coords
          .map((c: any) => ({ latitude: Number(c[1]), longitude: Number(c[0]) }))
          .filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
      }
    } catch {}
    return null;
  }

  async getRouteStops(routeId: number): Promise<RouteStop[]> {
    if (!routeId || isNaN(Number(routeId))) return [];
    if (FALLBACK_KALABURAGI_STOPS[routeId]) {
      return FALLBACK_KALABURAGI_STOPS[routeId];
    }
    try {
      const res = await axios.get(`${API_URL}/api/routes/${routeId}/stops`);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  private calculateFare(stopCount: number): number {
    return Math.max(15, 15 + Math.max(0, stopCount - 2) * 2);
  }

  private calculateCrowdPercent(bus: Bus | null): number {
    if (!bus) return 0;
    const capacity = bus.capacity || 50;
    const occupancy = bus.occupancy_count ?? bus.occupancy ?? 0;
    return Math.min(100, Math.round((occupancy / capacity) * 100));
  }

  private extractEtaMinutes(
    bus: Bus | null,
    targetStopName?: string
  ): { etaMinutes: number | null; etaStatus: 'LIVE' | 'SCHEDULED' | 'NO_SERVICE' } {
    if (!bus) return { etaMinutes: null, etaStatus: 'SCHEDULED' };

    if (bus.stop_etas && bus.stop_etas.length > 0) {
      if (targetStopName) {
        const matched = bus.stop_etas.find((s) =>
          s.stop_name.toLowerCase().includes(targetStopName.toLowerCase())
        );
        if (matched && matched.eta_seconds !== null) {
          return { etaMinutes: Math.max(1, Math.round(matched.eta_seconds / 60)), etaStatus: 'LIVE' };
        }
      }
      const nextEta = bus.stop_etas.find((s) => s.eta_seconds !== null);
      if (nextEta && nextEta.eta_seconds !== null) {
        return { etaMinutes: Math.max(1, Math.round(nextEta.eta_seconds / 60)), etaStatus: 'LIVE' };
      }
    }

    if (bus.eta_seconds !== undefined && bus.eta_seconds !== null) {
      return { etaMinutes: Math.max(1, Math.round(bus.eta_seconds / 60)), etaStatus: 'LIVE' };
    }

    return { etaMinutes: null, etaStatus: 'SCHEDULED' };
  }

  private computeRouteDistance(stops: RouteStop[]): number {
    if (!stops || stops.length < 2) return 5.0;
    let totalKm = 0;
    for (let i = 1; i < stops.length; i++) {
      totalKm += haversineKm(stops[i - 1].latitude, stops[i - 1].longitude, stops[i].latitude, stops[i].longitude);
    }
    return Number(totalKm.toFixed(1));
  }

  async searchRoutes(
    paramsOrFrom?: string | SearchParams,
    toStopParam?: string,
    preference: 'fastest' | 'cheapest' | 'least-crowded' = 'fastest',
    qParam?: string
  ): Promise<RouteResult[]> {
    try {
      let q = '';
      let from = '';
      let to = '';
      let pref = preference;

      if (typeof paramsOrFrom === 'object' && paramsOrFrom !== null) {
        q = (paramsOrFrom.q || '').trim();
        from = (paramsOrFrom.from || '').trim();
        to = (paramsOrFrom.to || '').trim();
        if (paramsOrFrom.preference) pref = paramsOrFrom.preference;
      } else {
        from = (paramsOrFrom || '').trim();
        to = (toStopParam || '').trim();
        q = (qParam || '').trim();
      }

      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (from) params.from = from;
      if (to) params.to = to;

      const res = await axios.get(`${API_URL}/api/routes/search`, { params });
      const routes: Route[] = Array.isArray(res.data) ? res.data : [];

      if (!routes.length) return [];

      const fleet = await this.getFleet();

      const results = await Promise.all(
        routes.map(async (route) => {
          const liveBus =
            fleet.find((b) => b.route_id === route.id || b.bus_number === route.route_number || b.route_number === route.route_number) || null;
          const stops = await this.getRouteStops(route.id);
          const stopCount = stops.length || 4;

          const { etaMinutes, etaStatus } = this.extractEtaMinutes(liveBus, to || from);
          const crowd = this.calculateCrowdPercent(liveBus);
          const fare = this.calculateFare(stopCount);
          const distance = this.computeRouteDistance(stops);

          const scheduledEta = Math.max(3, Math.round((distance / 25) * 60));

          return {
            route,
            bus: liveBus,
            eta: etaMinutes !== null ? etaMinutes : scheduledEta,
            etaStatus,
            crowd,
            fare,
            femaleOnly: false,
            distance,
            stops,
          };
        })
      );

      if (pref === 'fastest') {
        return results.sort((a, b) => (a.eta ?? 999) - (b.eta ?? 999));
      } else if (pref === 'cheapest') {
        return results.sort((a, b) => a.fare - b.fare);
      } else if (pref === 'least-crowded') {
        return results.sort((a, b) => a.crowd - b.crowd);
      }

      return results;
    } catch (err) {
      console.error('searchRoutes error:', err);
      return [];
    }
  }

  async searchByQuery(query: string): Promise<RouteResult[]> {
    return this.searchRoutes({ q: query });
  }
}

export const routeService = new RouteService();

