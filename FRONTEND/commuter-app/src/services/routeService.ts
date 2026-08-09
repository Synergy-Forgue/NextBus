import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface Route {
  id: number;
  route_number: string;
  route_name: string;
  start_stop: string;
  end_stop: string;
}

interface Bus {
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
}

interface RouteResult {
  route: Route;
  bus: Bus;
  eta: number; // minutes
  crowd: number; // 0-100 %
  fare: number; // in rupees
  femaleOnly: boolean;
  distance: number; // km
}

export default class RouteService {
  // Get all available routes
  async getRoutes(): Promise<Route[]> {
    try {
      const res = await axios.get(`${API_URL}/api/routes`);
      return res.data;
    } catch {
      return [];
    }
  }

  // Get all stops
  async getStops() {
    try {
      const res = await axios.get(`${API_URL}/api/stops`);
      return res.data;
    } catch {
      return [];
    }
  }

  // Get live fleet (all buses with locations)
  async getFleet(): Promise<Bus[]> {
    try {
      const res = await axios.get(`${API_URL}/api/buses`);
      return res.data.buses || [];
    } catch (err) {
      console.error('Fleet error:', err);
      return [];
    }
  }

  // Smart Route Search: Find best routes between two stops
  // Returns routes FILTERED by crowd/fare/time preference
  async searchRoutes(
    fromStop: string,
    toStop: string,
    preference: 'fastest' | 'cheapest' | 'least-crowded' = 'fastest'
  ): Promise<RouteResult[]> {
    try {
      // Get all routes and buses
      const routes = await this.getRoutes();
      const buses = await this.getFleet();

      if (!routes.length || !buses.length) return [];

      // Filter routes that connect from→to (mock logic for now)
      // In production, this would use route_stops table
      const matchingRoutes = routes.slice(0, 5).map((route) => {
        // Find first bus on this route
        const bus = buses.find((b) => b.route_id === route.id);
        if (!bus) return null;

        // Calculate fake but realistic values based on bus occupancy
        const crowdLevel = Math.floor(Math.random() * 100); // 0-100%
        const eta = Math.floor(Math.random() * 20) + 5; // 5-25 min
        const fare = Math.floor(Math.random() * 15) + 10; // ₹10-25

        return {
          route,
          bus,
          eta,
          crowd: crowdLevel,
          fare,
          femaleOnly: Math.random() > 0.5, // 50% have female-only section
          distance: Math.random() * 8 + 2, // 2-10 km
        };
      }).filter(Boolean) as RouteResult[];

      // FILTER by preference
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

  // Get stops for a specific route
  async getRouteStops(routeId: number) {
    try {
      const res = await axios.get(`${API_URL}/api/routes/${routeId}/stops`);
      return res.data;
    } catch {
      return [];
    }
  }
}

export const routeService = new RouteService();

