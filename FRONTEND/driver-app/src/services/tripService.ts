import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/** Enriched trip returned by the backend (see BACKEND/src/types) */
export interface BackendTrip {
  id: number;
  route_id: number;
  bus_id: number;
  driver_id: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  ended_at: string | null;
  route_number: string;
  route_name: string;
  license_plate: string;
  bus_number: string | null;
  driver_name: string;
}

export interface BackendRouteStop {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

class TripService {
  /**
   * Start a trip the way the backend expects:
   * POST /api/trips/start  { route_number, driver_phone }
   * The server resolves route/driver/bus IDs internally.
   */
  async startTrip(route_number: string, driver_phone: string): Promise<BackendTrip> {
    const response = await axios.post(`${API_URL}/api/trips/start`, {
      route_number,
      driver_phone,
    });
    return response.data;
  }

  /** PATCH /api/trips/:id/end — marks the trip completed. */
  async endTrip(tripId: number) {
    const response = await axios.patch(`${API_URL}/api/trips/${tripId}/end`);
    return response.data;
  }

  /** GET /api/trips — all trips (newest first). Used by the Trip Log tab. */
  async getTrips(): Promise<BackendTrip[]> {
    try {
      const response = await axios.get(`${API_URL}/api/trips`);
      return response.data;
    } catch {
      return [];
    }
  }

  /** GET /api/trips/:id — single enriched trip. */
  async getTripDetails(tripId: number): Promise<BackendTrip | null> {
    try {
      const response = await axios.get(`${API_URL}/api/trips/${tripId}`);
      return response.data;
    } catch {
      return null;
    }
  }

  /** GET /api/routes/:id/stops — ordered stops for the trip's route. */
  async getRouteStops(routeId: number): Promise<BackendRouteStop[]> {
    const response = await axios.get(`${API_URL}/api/routes/${routeId}/stops`);
    return response.data;
  }

  /** POST /api/alerts — breakdown report (goes straight to the depot dashboard). */
  async reportBreakdown(data: {
    trip_id?: number;
    license_plate?: string;
    route_number?: string;
    driver_phone?: string;
    description: string;
    latitude: number;
    longitude: number;
  }) {
    const response = await axios.post(`${API_URL}/api/alerts`, {
      type: 'breakdown',
      ...data,
    });
    return response.data;
  }

  /** POST /api/alerts — driver SOS (human safety emergency). */
  async sendSOS(data: {
    trip_id?: number;
    license_plate?: string;
    route_number?: string;
    driver_phone?: string;
    description?: string;
    latitude: number;
    longitude: number;
  }) {
    const response = await axios.post(`${API_URL}/api/alerts`, {
      type: 'sos',
      ...data,
    });
    return response.data;
  }
}

export default new TripService();
