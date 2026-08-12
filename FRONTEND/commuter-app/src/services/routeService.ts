import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nextbus-production.up.railway.app';

export interface Route {
  id: number;
  route_number: string;
  route_name: string;
  start_stop: string;
  end_stop: string;
}

export interface Bus {
  id: number;
  license_plate: string;
  bus_number: string;
  route_id: number;
  latitude: number;
  longitude: number;
  speed: number;
  occupancy?: number;
  trip_id?: number;
  route_number?: string;
  capacity?: number;
  current_stop_name?: string;
  next_stop_name?: string;
  eta_seconds?: number;
}

export interface RouteResult {
  route: Route;
  bus: Bus;
  eta: number; // minutes
  crowd: number; // 0-100 %
  fare: number; // in rupees
  femaleOnly: boolean;
  distance: number; // km
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

  async getStops() {
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
      // Fall back to /api/buses
      const fallback = await axios.get(`${API_URL}/api/buses`);
      return Array.isArray(fallback.data) ? fallback.data : fallback.data.buses || [];
    } catch (err) {
      console.error('Fleet fetch error:', err);
      return [];
    }
  }

  async searchRoutes(
    fromStop: string,
    toStop: string,
    preference: 'fastest' | 'cheapest' | 'least-crowded' = 'fastest'
  ): Promise<RouteResult[]> {
    try {
      const routes = await this.getRoutes();
      const buses = await this.getFleet();

      if (!routes.length) return [];

      const cleanFrom = (fromStop || '').toLowerCase().trim();
      const cleanTo = (toStop || '').toLowerCase().trim();

      const matchingRoutes = routes.map((route) => {
        // Find matching live bus on this route
        const bus = buses.find((b) => b.route_id === route.id || b.route_number === route.route_number) || {
          id: route.id,
          license_plate: `BUS00${route.id}`,
          bus_number: route.route_number,
          route_id: route.id,
          latitude: 17.7261,
          longitude: 83.3085,
          speed: 25,
          occupancy: 20 + route.id * 5,
        };

        const capacity = bus.capacity || 50;
        const occCount = bus.occupancy || 15;
        const crowdPercent = Math.min(100, Math.round((occCount / capacity) * 100));

        // Estimate ETA in minutes from speed or ETA seconds
        const etaMinutes = bus.eta_seconds ? Math.max(1, Math.round(bus.eta_seconds / 60)) : Math.max(4, 12 - route.id);
        const fare = 15 + route.id * 2;
        const distance = 3.5 + route.id * 1.5;

        // Match relevance: route start/end matches search query or default list
        const matchesQuery =
          cleanFrom === '' ||
          cleanTo === '' ||
          route.route_name.toLowerCase().includes(cleanFrom) ||
          route.route_name.toLowerCase().includes(cleanTo) ||
          route.start_stop.toLowerCase().includes(cleanFrom) ||
          route.end_stop.toLowerCase().includes(cleanTo);

        if (!matchesQuery && cleanFrom !== 'current location') {
          return null;
        }

        return {
          route,
          bus,
          eta: etaMinutes,
          crowd: crowdPercent,
          fare,
          femaleOnly: route.id % 2 === 1,
          distance,
        };
      }).filter(Boolean) as RouteResult[];

      if (preference === 'fastest') {
        return matchingRoutes.sort((a, b) => a.eta - b.eta);
      } else if (preference === 'cheapest') {
        return matchingRoutes.sort((a, b) => a.fare - b.fare);
      } else if (preference === 'least-crowded') {
        return matchingRoutes.sort((a, b) => a.crowd - b.crowd);
      }

      return matchingRoutes;
    } catch {
      return [];
    }
  }

  async getRouteStops(routeId: number) {
    try {
      const res = await axios.get(`${API_URL}/api/routes/${routeId}/stops`);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }
}

export const routeService = new RouteService();
