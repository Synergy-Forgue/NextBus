# NXTBus — Technical Architecture Specification

---

## 1. Technology Stack

- **Backend:** Node.js, Express, TypeScript (`backend/`)
- **Database:** PostgreSQL (with `pg` connection pool & `schema.sql` tables)
- **Real-Time Layer:** `ws` WebSocket library (Publisher at `/ws/publish`, Subscriber at `/ws/subscribe`)
- **Commuter Mobile App:** Expo SDK 54 / React Native, Expo Router, Zustand (`useCommuterStore.ts`), `react-native-maps` (`FRONTEND/commuter-app/`)
- **Driver Mobile App:** Expo SDK 54 / React Native, Expo Router, Zustand (`driverStore.ts`), `expo-location` (`FRONTEND/driver-app/`)
- **RTC Dashboard:** Vite / React Web Application, Leaflet/Map rendering (`FRONTEND/rtc-dashboard/`)
- **Production Infrastructure:** Deployed on Railway at `https://nextbus-production.up.railway.app`

---

## 2. Real-Time Tracking Data Pipeline

```
[Driver Device / Simulator]
       │
       │ WebSocket publish (ws://.../ws/publish)
       ▼
[Backend Tracking Server (tracking.ws.ts)]
       │
       ├── Validate payload & extract trip_id
       ├── Update in-memory LiveState store (liveState.ts)
       ├── Execute ETA Engine (eta.service.ts) to compute stop_etas
       │
       ▼
[WebSocket Broadcast (wss://.../ws/subscribe)]
       │
       ├── Commuter App (map.tsx - Update live bus marker & stop ETAs)
       └── RTC Dashboard (Dashboard.jsx - Update active fleet map)
```

---

## 3. Verification & Build Strategy

- **TypeScript Compilation:** Enforced strictly via `npx tsc --noEmit` across `backend/`, `FRONTEND/commuter-app/`, and `FRONTEND/driver-app/`.
- **Dashboard Bundling:** Verified via `npm run build` using Vite.
- **E2E Automation:** Verified via `scratch/test_commuter_e2e.js` testing Health, Routes/Stops Ingestion, Live Fleet REST Snapshot, SOS Pipeline, and WebSocket Real-Time Telemetry.
