# NXTBus — Complete End-to-End User Flows

---

## Flow 1: Passenger Journey Discovery & Live Tracking

```
[COMMUTER] Launch App
   │
   ▼
[HomeScreen] Enter Query (Keyword "10M" or Boarding "RTC Complex" -> Destination "Kailasagiri")
   │
   ▼
[routeService.searchRoutes] Fetch matching routes & live fleet positions from backend
   │
   ▼
[HomeScreen] Render Recommended Route + Other Options with LIVE / SCHED Badges
   │
   ▼
[Select Route] Store selectedRoute & selectedBus in useCommuterStore
   │
   ▼
[MapScreen] Render Map View:
   ├── Fetch ordered stops from GET /api/routes/:id/stops
   ├── Render Polyline route geometry & Stop Markers
   ├── Subscribe to WebSocket wss://.../ws/subscribe
   ├── Receive SNAPSHOT & LOCATION_UPDATE events
   ├── Update bus position smoothly & recalculate haversine ETA
   └── Display dynamic ETA, Distance (km), Speed (km/h), and Occupancy %
```

---

## Flow 2: Driver Active Trip Telemetry Pipeline

```
[DRIVER] Open App & Authenticate
   │
   ▼
[PairingScreen] Confirm Driver & Conductor Pairing
   │
   ▼
[DriverHomeScreen] View Assigned Trip (Route 10K, Bus #101)
   │
   ▼
[Tap "Start Trip"] Send POST /api/trips/start to backend
   │
   ▼
[Backend] Create active trip record in PostgreSQL, return trip_id
   │
   ▼
[Driver App] Request expo-location foreground permission & connect WebSocket to /ws/publish
   │
   ▼
[Telemetry Stream] Periodically publish GPS payload ({ trip_id, lat, lng, speed, occupancy })
   │
   ▼
[Backend Tracking Server] Update liveState, compute stop_etas, broadcast to WS subscribers
   │
   ▼
[Tap "End Trip"] Send PATCH /api/trips/:id/end to backend
   │
   ▼
[Backend & Clients] Purge trip from liveState, broadcast BUS_OFFLINE, close WS stream
```

---

## Flow 3: RTC Operator Fleet & SOS Alert Resolution

```
[RTC OPERATOR] Open Web Dashboard
   │
   ▼
[Dashboard.jsx] Connect to wss://.../ws/subscribe & poll REST fallbacks
   │
   ▼
[Live Fleet Map] View real-time active bus markers & operational metrics
   │
   ▼
[SOS Event Triggered] WebSocket receives ALERT event from Commuter or Driver app
   │
   ▼
[Alert Manager] Flash emergency alert banner & sound alert notification
   │
   ▼
[Tap "Resolve Alert"] Send PATCH /api/alerts/:id/resolve to backend
   │
   ▼
[Backend & Dashboard] Update alert status to 'resolved' and update active alert counter
```
