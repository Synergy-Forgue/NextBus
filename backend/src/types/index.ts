// ─── Shared TypeScript interfaces for NXTBus Backend ───────────────────────

export interface Route {
  id: number;
  route_number: string;
  route_name: string;
  start_stop: string;
  end_stop: string;
  created_at: Date;
}

export interface Stop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  created_at: Date;
}

export interface RouteStop {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
}

export interface Bus {
  id: number;
  license_plate: string;
  bus_number: string | null;
  capacity: number;
  created_at: Date;
}

export interface Driver {
  id: number;
  name: string;
  phone: string;
  created_at: Date;
}

export interface Trip {
  id: number;
  route_id: number;
  bus_id: number;
  driver_id: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
}

// Enriched trip with joined data (for API responses)
export interface TripDetail extends Trip {
  route_number: string;
  route_name: string;
  license_plate: string;
  bus_number: string | null;
  driver_name: string;
}

export type VehicleStatus = 'LIVE' | 'APPROACHING STOP' | 'AT STOP' | 'STALE' | 'SIGNAL LOST' | 'OFFLINE';

export interface StopEta {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
  eta_seconds: number | null; // null if passed
}

// Live state of a bus, held in-memory by the tracking module
export interface LiveBusState {
  trip_id: number;
  bus_id: number;
  route_id: number;
  route_number: string;
  license_plate: string;
  latitude: number;
  longitude: number;
  speed: number;
  occupancy_count: number;
  vision_confidence_score: number;
  last_updated: Date | string;
  nextStopIndex: number; // index into the route's stop array the bus is currently heading towards
  status: VehicleStatus;
  stop_etas?: StopEta[];
}

// Payload sent over WebSocket from Driver App / Simulator
export interface TelemetryPayload {
  trip_id: number;
  latitude: number;
  longitude: number;
  speed: number;
  occupancy_count: number;
  vision_confidence_score: number;
  recorded_at: string; // ISO 8601 timestamp
}

// Emergency Alert shape (SOS / Breakdown)
export interface Alert {
  id: number;
  type: 'sos' | 'breakdown';
  description: string | null;
  latitude: number;
  longitude: number;
  license_plate: string | null;
  route_number: string | null;
  driver_phone: string | null;
  status: 'active' | 'resolved';
  created_at: Date;
  resolved_at: Date | null;
}

// Generic API error response shape
export interface ApiError {
  error: string;
  message: string;
}
