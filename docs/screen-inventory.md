# NXTBus — Screen Inventory & Data Dependencies

---

## 1. Commuter Mobile App Screens (`FRONTEND/commuter-app/`)

| Screen Name | File Path | Purpose | Primary CTA | Data Dependencies | API Dependencies |
|---|---|---|---|---|---|
| **HomeScreen** | `app/(tabs)/index.tsx` | Main commuter hub, search, stats, recommendations, pass management | Find Bus Routes | `commuter`, `savedRoutes`, `activePass` | `GET /api/routes/search`, `GET /api/alerts`, `GET /api/tracking/fleet` |
| **ExploreScreen** | `app/(tabs)/explore.tsx` | Discover all available bus routes across Visakhapatnam | Select Route | `routes`, `fleet` | `GET /api/routes`, `GET /api/tracking/fleet`, `GET /api/routes/search` |
| **MapScreen** | `app/(tabs)/map.tsx` | Live vehicle tracking map, polyline route view, stop markers, ETA | Share Trip / Refresh | `selectedRoute`, `selectedBus`, `buses`, `routeStops` | `GET /api/routes/:id/stops`, `wss://.../ws/subscribe` |
| **SavedRoutesScreen** | `app/(tabs)/saved-routes.tsx` | View & manage saved frequent routes | Open Saved Route | `savedRoutes` | `AsyncStorage` (@nxtbus_saved_routes), `GET /api/tracking/fleet` |
| **ProfileScreen** | `app/(tabs)/profile.tsx` | User profile, travel statistics, emergency contacts | Open Report Card | `commuter` | Local store & AsyncStorage |
| **TripSharingScreen** | `app/trip-sharing.tsx` | Share active journey status with family/friends | Share Link | `selectedRoute`, `selectedBus` | Native Share API |
| **SosScreen** | `app/sos.tsx` | Broadcast emergency alert to RTC operations | Trigger SOS Alert | `userLocation`, `commuter` | `POST /api/alerts` |
| **ReportCardScreen** | `app/report-card.tsx` | Commuter travel report card (CO2 saved, trips count) | View History | `tripHistory` | `savedRoutesService.getWeeklyStats()` |

---

## 2. Driver App Screens (`FRONTEND/driver-app/`)

| Screen Name | File Path | Purpose | Primary CTA | Data / API Dependencies |
|---|---|---|---|---|
| **LoginScreen** | `app/login.tsx` | Driver phone authentication | Next | Local auth store |
| **PairingScreen** | `app/pairing.tsx` | Driver & Conductor pairing setup | Pair & Continue | `POST /api/drivers/pair` |
| **DriverHomeScreen** | `app/(tabs)/index.tsx` | Operational trip dashboard & telemetry HUD | Start Trip / End Trip | `POST /api/trips/start`, `PATCH /api/trips/:id/end`, `ws://.../ws/publish` |
| **TripLogScreen** | `app/(tabs)/trip-log.tsx` | Historical trip log & summary | View Details | `GET /api/trips` |

---

## 3. RTC Operations Dashboard Screens (`FRONTEND/rtc-dashboard/`)

| View Name | File Path | Purpose | Primary CTA | Data / API Dependencies |
|---|---|---|---|---|
| **Dashboard Overview** | `src/pages/Dashboard.jsx` | Operations monitoring, active fleet, SOS alert manager | Resolve Alert | `GET /api/tracking/fleet`, `wss://.../ws/subscribe`, `PATCH /api/alerts/:id/resolve` |
| **LiveFleetMap** | `src/components/LiveFleetMap.jsx` | Interactive map of active bus markers | Inspect Bus | Live WebSocket feed |
