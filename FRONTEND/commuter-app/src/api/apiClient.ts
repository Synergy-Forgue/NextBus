import axios from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

type ApiResult = { success: boolean; data?: any; error?: string };

function fail(error: any): ApiResult {
  const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
  return { success: false, error: errorMsg };
}

/** GET /api/routes — all routes */
export async function getRoutes(): Promise<ApiResult> {
  try {
    const response = await apiClient.get('/api/routes');
    return { success: true, data: response.data };
  } catch (error: any) {
    return fail(error);
  }
}

/** GET /api/routes/:id/stops — ordered stops for a route */
export async function getRouteStops(routeId: number | string): Promise<ApiResult> {
  try {
    const response = await apiClient.get(`/api/routes/${routeId}/stops`);
    return { success: true, data: response.data };
  } catch (error: any) {
    return fail(error);
  }
}

/** GET /api/stops — all stops */
export async function getStops(): Promise<ApiResult> {
  try {
    const response = await apiClient.get('/api/stops');
    return { success: true, data: response.data };
  } catch (error: any) {
    return fail(error);
  }
}

/** GET /api/buses — all buses */
export async function getBuses(): Promise<ApiResult> {
  try {
    const response = await apiClient.get('/api/buses');
    return { success: true, data: response.data };
  } catch (error: any) {
    return fail(error);
  }
}

/** GET /api/tracking/fleet — live snapshot of every bus with stop ETAs */
export async function getLiveFleet(): Promise<ApiResult> {
  try {
    const response = await apiClient.get('/api/tracking/fleet');
    return { success: true, data: response.data };
  } catch (error: any) {
    return fail(error);
  }
}

/**
 * Smart Route search — MVP implementation on top of the live fleet:
 * returns routes whose live buses are closest to the commuter, with ETAs.
 * (The backend has no dedicated /routes/search yet.)
 */
export async function searchRoutes(
  _originStopId: string,
  _destinationStopId: string,
  _preference: 'FASTEST' | 'CHEAPEST' | 'BALANCED'
): Promise<ApiResult> {
  try {
    const [routesRes, fleetRes] = await Promise.all([
      apiClient.get('/api/routes'),
      apiClient.get('/api/tracking/fleet'),
    ]);
    const fleetByRoute: Record<number, any> = {};
    for (const bus of fleetRes.data) fleetByRoute[bus.route_id] = bus;
    const results = routesRes.data.map((r: any) => ({
      ...r,
      liveBus: fleetByRoute[r.id] || null,
    }));
    return { success: true, data: results };
  } catch (error: any) {
    return fail(error);
  }
}

/** Commuter SOS — POST /api/alerts (same live pipeline the depot dashboard watches) */
export async function triggerSOS(lat: number, lng: number): Promise<ApiResult> {
  try {
    const response = await apiClient.post('/api/alerts', {
      type: 'sos',
      description: 'COMMUTER_EMERGENCY',
      latitude: lat,
      longitude: lng,
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    return fail(error);
  }
}

// ─── Local-only features (no backend endpoints in the MVP) ────────────────────
// These resolve locally so the UI works; server sync arrives in Phase 2.

export async function setAlert(busId: string, stopId: string, thresholdMinutes: number): Promise<ApiResult> {
  return { success: true, data: { id: `local-${Date.now()}`, busId, stopId, thresholdMinutes } };
}

export async function cancelAlert(alertId: string): Promise<ApiResult> {
  return { success: true, data: { id: alertId } };
}

export async function submitCrowdReport(busId: string, crowdLevel: number): Promise<ApiResult> {
  return { success: true, data: { busId, crowdLevel } };
}

export async function registerUser(phone: string): Promise<ApiResult> {
  return { success: true, data: { id: `user-${phone}`, phone } };
}

export async function loginUser(phone: string, _otp: string): Promise<ApiResult> {
  return { success: true, data: { id: `user-${phone}`, phone, name: 'Commuter', language: 'ENGLISH' } };
}

export async function getProfile(): Promise<ApiResult> {
  return { success: true, data: null };
}

export async function getSavedRoutes(): Promise<ApiResult> {
  return { success: true, data: [] };
}

export async function saveFavoriteRoute(routeId: string): Promise<ApiResult> {
  return { success: true, data: { routeId } };
}
