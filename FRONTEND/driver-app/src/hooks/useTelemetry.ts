import { useEffect, useRef, useState } from 'react';

/**
 * useTelemetry — the "GPS Ping" feature.
 *
 * Publishes live GPS telemetry to the NXTBus backend over its raw WebSocket
 * ingestion endpoint (ws://<server>/ws/publish) in the exact TelemetryPayload
 * shape the backend expects. Reconnects automatically while a trip is active.
 *
 * The backend replies { type: 'ACK', trip_id } for every accepted ping.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/publish';

export interface TelemetryLocation {
  latitude: number;
  longitude: number;
  /** metres per second (as reported by expo-location) */
  speed: number;
  heading?: number;
  bearing?: number;
  timestamp: number;
}

export type TelemetryStatus = 'LIVE' | 'READY' | 'OFFLINE';

export const useTelemetry = (
  tripId: number | null,
  location: TelemetryLocation | null,
  occupancyCount: number = 0
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastAck, setLastAck] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect / disconnect with the active trip
  useEffect(() => {
    if (!tripId) {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled) {
            ws.close();
            return;
          }
          setIsConnected(true);
          setError(null);
          console.log('[Telemetry] Connected to', WS_URL);
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string);
            if (msg.type === 'ACK') setLastAck(Date.now());
            if (msg.type === 'ERROR') setError(msg.message);
          } catch {
            /* ignore malformed frames */
          }
        };

        ws.onerror = () => {
          setIsConnected(false);
          setError('Telemetry connection error');
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Retry while the trip is still active with 3s reconnect interval
          if (!cancelled) {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            reconnectTimer.current = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        setIsConnected(false);
        setError('Failed to open telemetry socket');
        if (!cancelled) {
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [tripId]);

  // Send a ping on every location update (expo-location fires every ~10s)
  useEffect(() => {
    if (!tripId || !location) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      trip_id: tripId,
      latitude: location.latitude,
      longitude: location.longitude,
      // expo-location reports m/s; backend expects km/h
      speed: Math.max(0, (location.speed || 0) * 3.6),
      occupancy_count: occupancyCount,
      heading: location.heading ?? location.bearing ?? 0,
      bearing: location.heading ?? location.bearing ?? 0,
      // Manual count from the conductor → full confidence per the MVP spec
      vision_confidence_score: 1.0,
      recorded_at: new Date(location.timestamp || Date.now()).toISOString(),
    };

    ws.send(JSON.stringify(payload));
  }, [tripId, location, occupancyCount]);

  const status: TelemetryStatus = !tripId
    ? 'READY'
    : isConnected
    ? 'LIVE'
    : 'OFFLINE';

  return { isConnected, lastAck, error, status };
};
