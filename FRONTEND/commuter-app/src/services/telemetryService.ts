import useCommuterStore, { BusPosition } from '../store/useCommuterStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nextbus-production.up.railway.app';

/** Map a backend LiveBusState into the store's BusPosition shape */
function toBusPosition(bus: any, routeNumbers: Record<number, string>): BusPosition {
  const nextEta = (bus.stop_etas || []).find(
    (s: any) => s.eta_seconds !== null && s.eta_seconds !== undefined
  );
  return {
    busId: String(bus.trip_id),
    lat: Number(bus.latitude),
    lng: Number(bus.longitude),
    routeNo: bus.route_number || routeNumbers[bus.route_id] || String(bus.route_id || '10K'),
    crowdLevel: Math.min(10, Math.round((bus.occupancy_count || 0) / 5)),
    speed: Math.round(bus.speed || 0),
    eta: nextEta ? Math.max(1, Math.round(nextEta.eta_seconds / 60)) : undefined,
    licensePlate: bus.license_plate,
    trip_id: bus.trip_id,
    route_id: bus.route_id,
    occupancy_count: bus.occupancy_count,
    nextStopIndex: bus.nextStopIndex,
    status: bus.status || 'LIVE',
    last_updated: bus.last_updated || new Date().toISOString(),
    stop_etas: bus.stop_etas,
  };
}

class TelemetryService {
  private ws: WebSocket | null = null;
  private routeNumbers: Record<number, string> = {};
  private updateBuffer: Record<string, BusPosition> = {};
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private listeners: Set<(connected: boolean) => void> = new Set();
  private routeNumbersLoaded = false;

  constructor() {
    this.loadRouteNumbers();
  }

  private async loadRouteNumbers() {
    if (this.routeNumbersLoaded) return;
    try {
      const res = await fetch(`${API_URL}/api/routes`);
      if (res.ok) {
        const routes = await res.json();
        if (Array.isArray(routes)) {
          const map: Record<number, string> = {};
          for (const r of routes) map[r.id] = r.route_number;
          this.routeNumbers = map;
          this.routeNumbersLoaded = true;
        }
      }
    } catch {
      /* fallback */
    }
  }

  public subscribe(listener: (connected: boolean) => void) {
    this.listeners.add(listener);
    if (!this.ws && !this.isConnecting) {
      this.connect();
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      listener(true);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        // Keep alive for 30 seconds before disconnecting to prevent disconnect thrashing during navigation
        setTimeout(() => {
          if (this.listeners.size === 0) {
            this.disconnect();
          }
        }, 30000);
      }
    };
  }

  public connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    const wsUrl = API_URL.replace(/^http/, 'ws') + '/ws/subscribe';

    try {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        this.notifyListeners(true);
        this.startFlushTimer();
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type === 'SNAPSHOT' && Array.isArray(msg.data)) {
            const positions: Record<string, BusPosition> = {};
            for (const b of msg.data) {
              const pos = toBusPosition(b, this.routeNumbers);
              positions[pos.busId] = pos;
            }
            useCommuterStore.getState().setBusPositions(positions);
          } else if (msg.type === 'BUS_UPDATE' && msg.data) {
            const pos = toBusPosition(msg.data, this.routeNumbers);
            // Buffer updates rather than firing Zustand on every message
            this.updateBuffer[pos.busId] = pos;
          } else if (msg.type === 'BUS_OFFLINE' && msg.trip_id) {
            useCommuterStore.getState().removeBusPosition(String(msg.trip_id));
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => {
        this.isConnecting = false;
        this.notifyListeners(false);
      };

      ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        this.stopFlushTimer();
        this.notifyListeners(false);

        if (this.listeners.size > 0) {
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => this.connect(), 4000);
        }
      };
    } catch {
      this.isConnecting = false;
    }
  }

  public disconnect() {
    this.stopFlushTimer();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnecting = false;
    this.notifyListeners(false);
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    // Batch flush updates at a smooth 500ms cadence (2 updates/sec max instead of 30/sec)
    this.flushTimer = setInterval(() => {
      const keys = Object.keys(this.updateBuffer);
      if (keys.length === 0) return;

      const current = useCommuterStore.getState().busPositions;
      const updated = { ...current, ...this.updateBuffer };
      this.updateBuffer = {};
      useCommuterStore.getState().setBusPositions(updated);
    }, 500);
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private notifyListeners(connected: boolean) {
    this.listeners.forEach((l) => {
      try {
        l(connected);
      } catch {}
    });
  }
}

export const telemetryService = new TelemetryService();
