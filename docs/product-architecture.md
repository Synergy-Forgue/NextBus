# NXTBus — Product Architecture Specification

**Version:** 1.0  
**Status:** Approved System Architecture Baseline  
**Scope:** Smart Public Transit Operations & Real-Time Tracking Platform  

---

## 1. Core Product Vision

NXTBus is a smart urban transit platform designed to eliminate uncertainty from public bus commuting in Visakhapatnam. It connects three distinct operational roles through a unified real-time tracking architecture:

1. **Passenger / Commuter App (`FRONTEND/commuter-app/`)**: Discover routes, search stops/destinations, compare transit options, view live bus positions, track vehicle progression, and manage transit passes.
2. **Driver Application (`FRONTEND/driver-app/`)**: Authenticate, receive trip assignments, initiate active trips, stream live GPS telemetry and occupancy, and finalize trip state.
3. **RTC Operations Dashboard (`FRONTEND/rtc-dashboard/`)**: Monitor live active fleet metrics, observe route punctuality, handle breakdown/emergency alerts (SOS), and track driver status.

---

## 2. Decoupled Role Boundaries

NXTBus strictly separates user role experiences to maintain clean information architecture and security boundaries:

```
NXTBus System Architecture
│
├── Passenger / Commuter App (Expo SDK 54 / React Native)
│   ├── Mental Model: "How do I get to my destination right now?"
│   ├── Key Views: Home, Route Search, Live Tracking Map, Saved Routes, Bus Pass
│   └── Data Access: Read-only transit & tracking data, client-side pass state
│
├── Driver Mobile App (Expo SDK 54 / React Native)
│   ├── Mental Model: "What trip am I driving and is my GPS publishing live telemetry?"
│   ├── Key Views: Conductor/Driver Pairing, Trip Assignment, Active Telemetry HUD, Trip Completion
│   └── Data Access: Write-access telemetry publisher (`/ws/publish`), trip state mutator (`/api/trips`)
│
└── RTC Operations Dashboard (Vite / React Web Application)
    ├── Mental Model: "What is the operational health of the entire city bus fleet?"
    ├── Key Views: Fleet Overview Map, Live Bus Telemetry, SOS Alert Manager, Route Performance
    └── Data Access: Full fleet WebSocket subscriber (`/ws/subscribe`), alert resolution mutator
```

---

## 3. Core Domain Entities

- **Route:** Named transit corridor between origin and destination stops (e.g. `Route 10K: RTC Complex ↔ Kailasagiri`).
- **Stop:** Physical bus stop location with latitude, longitude, sequence order (`stop_order`), and stop name.
- **Bus:** Physical vehicle with `license_plate`, `bus_number`, seating `capacity`, and status (`LIVE`, `OFFLINE`).
- **Driver:** Authorized driver personnel linked by phone number and employee ID.
- **Trip:** Operational execution instance linking a `bus_id`, `route_id`, and `driver_id` with status (`active`, `completed`).
- **Telemetry Update:** Real-time payload containing `trip_id`, `latitude`, `longitude`, `speed`, `occupancy`, and `recorded_at`.
- **Stop ETA:** Calculated or estimated arrival seconds (`eta_seconds`) for remaining downstream stops.

---

## 4. Explicit Non-Goals (Out of MVP Scope)

- Enterprise Fleet ERP & Payroll
- Turn-by-turn vehicle turn navigation
- Ticket purchase payment gateway (passes operate via deterministic offline QR token tokens)
- AI demand prediction modeling
