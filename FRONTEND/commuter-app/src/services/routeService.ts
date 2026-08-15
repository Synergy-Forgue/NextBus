import axios from 'axios';

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

export default class RouteService {
  async getRoutes(): Promise<Route[]> {
    try {
      const res = await axios.get(`${API_URL}/api/routes`);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  async getStops(): Promise<RouteStop[]> {
    try {
      const res = await axios.get(`${API_URL}/api/stops`);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
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
    try {
      const res = await axios.get(`${API_URL}/api/routes/${routeId}/geometry`);
      const coords = res.data?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      // Stored as GeoJSON [lng, lat]; react-native-maps wants {latitude, longitude}.
      return coords
        .map((c: any) => ({ latitude: Number(c[1]), longitude: Number(c[0]) }))
        .filter((p: any) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    } catch {
      return null;
    }
  }

  async getRouteStops(routeId: number): Promise<RouteStop[]> {
    if (!routeId || isNaN(Number(routeId))) return [];
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

