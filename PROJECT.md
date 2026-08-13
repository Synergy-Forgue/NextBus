# Project: NXTBus Smart Transit Platform Upgrade

## Architecture
NXTBus is a multi-tier smart transit platform composed of:
1. **Backend (`backend/`)**: Node.js, Express, WebSocket (`ws`), PostgreSQL (`pg`). Core tracking engine with in-memory `liveFleet` store, Haversine ETA engine, and broadcast WS channels (`/ws/publish`, `/ws/subscribe`).
2. **Commuter App (`FRONTEND/commuter-app/`)**: React Native / Expo application for commuters. Displays routes, stops, map tracking, search, and saved routes.
3. **Driver App (`FRONTEND/driver-app/`)**: React Native / Expo application for transit drivers. Manages trip lifecycle (start/end) and emits real-time location telemetry to `/ws/publish`.
4. **RTC Dashboard (`FRONTEND/rtc-dashboard/`)**: React / Vite web dashboard for operations staff. Real-time fleet monitoring, alert management, and route analytics via `/ws/subscribe`.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Stop Order & Directionality | Data model and APIs ordered by `route_stops.stop_order`; route detail views displaying sequence (Passed → Approaching → Next → Destination) | M1, M2 | R1, Survey |
| F2 | Backend Vehicle State Machine | Serialization of enums (`LIVE`, `APPROACHING STOP`, `AT STOP`, `STALE`, `SIGNAL LOST`, `OFFLINE`) in WS and REST payloads | M1 | R3, Survey |
| F3 | Backend WS SNAPSHOT & `stop_etas` | Enriching `/ws/subscribe` initial `SNAPSHOT` payload with computed `stop_etas` array | M1 | R2, Survey |
| F4 | Commuter Search & Placeholder Elimination | Wiring `q`, `from`, `to` params, eliminating mock math/placeholders in `index.tsx`, `explore.tsx`, `saved-routes.tsx`, `routeService.ts` | M2 | R5, Survey |
| F5 | Commuter Multi-Stop ETAs & Badges | Rendering ordered stop list with multi-stop ETAs (`LIVE` green vs `SCHEDULED` grey badges) and client Haversine fallback | M2 | R2, Survey |
| F6 | Context-Preserving Navigation | Preserving selected route, trip, and stop context across tab transitions in commuter app | M2 | R5, Survey |
| F7 | Commuter Map Auto-Framing & Motion | Bounding-box map camera auto-framing for active trip context (`onRegionChangeComplete`) and smooth marker motion | M3 | R4, Survey |
| F8 | RTC Dashboard Interactive Map & Badges | Upgrading `rtc-dashboard` to an interactive fleet map with live vehicle markers and state badges (`LIVE`, `STALE`, `OFFLINE`) | M3 | R3, R4, Survey |
| F9 | Driver App Telemetry & Trip State | Enhancing driver telemetry payload emission (heading, speed, state) and robust trip start/end management | M4 | R3, Survey |
| F10| E2E Verification & Integration | 100% pass on `test_commuter_e2e.js` and all 4 package build/typecheck commands | M5 | Criteria, Survey |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Telemetry, State Machine & ETA Engine | `backend/` | none | PLANNED |
| M2 | Commuter App Navigation, Search & ETA UX | `FRONTEND/commuter-app/` | M1 | PLANNED |
| M3 | Map Camera Auto-Framing & RTC Dashboard Map | `FRONTEND/commuter-app/`, `FRONTEND/rtc-dashboard/` | M1, M2 | PLANNED |
| M4 | Driver App Telemetry & State Transitions | `FRONTEND/driver-app/` | M1 | PLANNED |
| M5 | E2E Testing Track & Final Verification | Full system E2E testing | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. WebSocket Messages (`/ws/subscribe`)
```typescript
export type VehicleStatus = 'LIVE' | 'APPROACHING STOP' | 'AT STOP' | 'STALE' | 'SIGNAL LOST' | 'OFFLINE';

export interface StopEta {
  stop_id: number;
  stop_name: string;
  stop_order: number;
  latitude: number;
  longitude: number;
  eta_seconds: number | null; // null if passed
}

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
  last_updated: string; // ISO string
  nextStopIndex: number;
  status: VehicleStatus;
  stop_etas: StopEta[];
}

// Emitted on connection:
export interface WsSnapshotMessage {
  type: 'SNAPSHOT';
  data: LiveBusState[];
}

// Emitted on telemetry update:
export interface WsBusUpdateMessage {
  type: 'BUS_UPDATE';
  data: LiveBusState;
}

// Emitted when bus goes offline or stale:
export interface WsBusOfflineMessage {
  type: 'BUS_OFFLINE';
  trip_id: number;
}
```

### 2. REST Endpoint Contracts
- `GET /health` -> `{ status: 'ok', database: 'connected', timestamp: string }`
- `GET /api/tracking/fleet` -> `LiveBusState[]`
- `GET /api/routes/search?q=...&from=...&to=...` -> `Route[]`
- `GET /api/routes/:id/stops` -> `RouteStop[]` ordered by `stop_order` ASC
- `POST /api/alerts` -> `{ type, description, latitude, longitude, route_number }` returns status 201 with Alert object
- `PATCH /api/alerts/:id/resolve` -> returns status 200 with resolved Alert object

---

## Code Layout
- `backend/src/`
  - `index.ts` - HTTP & WebSocket server entrypoint
  - `types/index.ts` - Domain models and WS payload interfaces
  - `db/` (`schema.sql`, `seed.sql`, `pool.ts`, `setup-db.ts`)
  - `tracking/` (`tracking.ws.ts`, `eta.service.ts`, `liveState.ts`)
  - `routers/` (`routes.router.ts`, `stops.router.ts`, `trips.router.ts`, `alerts.router.ts`, `tracking.router.ts`)
- `FRONTEND/commuter-app/`
  - `app/(tabs)/` (`index.tsx`, `explore.tsx`, `saved-routes.tsx`, `map.tsx`)
  - `src/services/` (`routeService.ts`, `savedRoutesService.ts`, `api.ts`)
  - `src/hooks/` (`useRealTimeBus.ts`)
  - `src/store/` (`useCommuterStore.ts`)
- `FRONTEND/driver-app/`
  - `app/(tabs)/` (`index.tsx`)
  - `src/hooks/` (`useTelemetry.ts`, `useRealTimeLocation.ts`)
  - `src/services/` (`tripService.ts`)
- `FRONTEND/rtc-dashboard/`
  - `src/pages/Dashboard.jsx`
  - `src/components/` (`LiveFleetMap.jsx`, `GapDetector.jsx`, etc.)
