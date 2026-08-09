import { useState, useCallback } from 'react';
import tripService, { BackendTrip, BackendRouteStop } from '../services/tripService';
import { useDriverStore } from '../store/driverStore';

export interface ActiveTrip {
  /** trip_id from the backend — used for GPS telemetry publishing */
  id: number;
  routeId: number;
  routeNumber: string;
  routeName: string;
  licensePlate: string;
  startTime: string;
  passengersBoarded: number;
  passengersAlighted: number;
  currentStopIndex: number;
}

export const useTrip = () => {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setActiveTripId, setRealStops, setOccupancy } = useDriverStore();

  /**
   * Trip Logging (spec 02) — one-tap trip start.
   * Calls POST /api/trips/start with route_number + driver_phone;
   * the backend resolves all IDs and returns the enriched trip.
   * Then loads the real route stops so the UI reflects the actual route.
   */
  const startTrip = useCallback(
    async (routeNumber: string, driverPhone: string) => {
      setLoading(true);
      setError(null);
      try {
        const backendTrip: BackendTrip = await tripService.startTrip(routeNumber, driverPhone);

        const stops: BackendRouteStop[] = await tripService.getRouteStops(backendTrip.route_id);
        // Map to the shape the screens use
        setRealStops(
          stops.map((s) => ({
            id: s.stop_id,
            name: s.stop_name,
            order: s.stop_order,
            lat: s.latitude,
            lng: s.longitude,
            isServed: false,
          }))
        );

        const active: ActiveTrip = {
          id: backendTrip.id,
          routeId: backendTrip.route_id,
          routeNumber: backendTrip.route_number,
          routeName: backendTrip.route_name,
          licensePlate: backendTrip.license_plate,
          startTime: backendTrip.started_at || new Date().toISOString(),
          passengersBoarded: 0,
          passengersAlighted: 0,
          currentStopIndex: 0,
        };
        setTrip(active);
        setActiveTripId(backendTrip.id); // hands the trip_id to the GPS Ping publisher
        return active;
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          (err instanceof Error ? err.message : 'Failed to start trip');
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setActiveTripId, setRealStops]
  );

  /** Trip Logging (spec 02) — one-tap trip end. PATCH /api/trips/:id/end */
  const endTrip = useCallback(async () => {
    if (!trip) {
      setError('No active trip');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await tripService.endTrip(trip.id);
      setTrip(null);
      setActiveTripId(null); // stops GPS publishing
      return result;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to end trip');
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [trip, setActiveTripId]);

  /**
   * Log passenger activity at a stop (kept client-side for the MVP —
   * the net occupancy flows to the backend inside every GPS telemetry ping).
   */
  const logStopActivity = useCallback(
    async (_stopId: number, _stopName: string, boarded: number, alighted: number) => {
      if (!trip) {
        setError('No active trip');
        return null;
      }
      setTrip((prev) => {
        if (!prev) return null;
        const next = {
          ...prev,
          passengersBoarded: prev.passengersBoarded + boarded,
          passengersAlighted: prev.passengersAlighted + alighted,
          currentStopIndex: prev.currentStopIndex + 1,
        };
        // Net occupancy rides along in every GPS ping to power the crowd indicator
        setOccupancy(next.passengersBoarded - next.passengersAlighted);
        return next;
      });
      return true;
    },
    [trip, setOccupancy]
  );

  const clearError = useCallback(() => setError(null), []);

  return { trip, loading, error, startTrip, endTrip, logStopActivity, clearError };
};
