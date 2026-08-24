# 🚌 NextBus — Real-Time Smart Transit Platform

NextBus is an enterprise-grade multi-city smart public transit platform providing real-time bus tracking, dynamic ETAs, crowd analytics, passenger safety tools, and live fleet management.

---

## 🌟 Overview & Supported Networks

NextBus supports live operations across multiple state transit networks:

1. **🌊 Visakhapatnam Network (APSRTC - Andhra Pradesh)**
   - **Line 10K**: **Metro Express** (RTC Complex ↔ Kailasagiri)
   - **Line 900K**: **Coastal Rider Deluxe** (Bheemili ↔ Railway Station)
   - **Line 28K**: **Steel City Express** (Kothavalasa ↔ RK Beach)
   - **Line 55T**: **Industrial Corridor Flyer** (Old Gajuwaka ↔ Tagarapuvalasa)
   - **Line 300N**: **Hilltop City Connector** (Sabbavaram ↔ RK Beach)

2. **🏛️ Mysuru Network (KSRTC - Karnataka)**
   - **Line 201M**: **Chamundi Heritage Line** (City Bus Stand ↔ Chamundi Hills)
   - **Line 150M**: **City Metro Feeder** (Railway Station ↔ Kuvempunagar)
   - **Line 303M**: **Palace Circular Express** (Bannimantap ↔ Bogadi)
   - **Line 412M**: **IT Corridor Shuttle** (City Bus Stand ↔ Hootagalli)
   - **Line 307M**: **Royal Intercity Liner** (City Bus Stand ↔ Srirangapatna)

---

## 📱 Frontend Suite (`FRONTEND/`)

### 1. Commuter App (`FRONTEND/commuter-app/`)
Cross-platform React Native / Expo application for passengers.

**Core Capabilities:**
- **Interactive Live Transit Radar**:
  - Live animated vehicle markers with heading rotation and status halos.
  - Multi-layer Google Maps navigation styling (electric blue active path + muted traversed slate).
  - High-density OSRM road geometries (223 to 1,957 points per route).
  - 1-tap city switcher (Visakhapatnam APSRTC ↔ Mysuru KSRTC).
- **Ama Bus / Mo Bus Inspired Transit Drawer**:
  - Service branding (`Metro Express`, `Chamundi Heritage Line`, `AC Deluxe`).
  - Next stop hero with pulsing emerald beacon and live minute arrival countdown.
  - Sequential upcoming stops timeline with arrival times.
  - Real-time seat occupancy bar (`X seats left · Y% full`).
- **Trip Planning & Search**:
  - Multi-criteria route search (Fastest, Cheapest, Least Crowded).
  - Inter-terminal connection support and popular stop chips.
- **Safety & Emergency Tools**:
  - SOS emergency broadcast with location sharing and one-tap police/ambulance dispatch.
  - Trusted emergency contacts manager.
  - Smart stop arrival alerts & notifications.
- **Multilingual Support**: English, Hindi, Telugu, and Kannada.

---

## ⚙️ Backend Architecture (`backend/`)

- **Runtime**: Node.js, Express, TypeScript, PostgreSQL.
- **Real-Time Telemetry Engine**:
  - In-memory vehicle state store with WebSocket publish (`/ws/publish`) and subscribe (`/ws/subscribe`) streams.
  - Haversine and OSRM road geometry ETA computation engine.
  - Direction-aware forward and reverse stop sequencing.
- **Transit Simulator**:
  - Standalone multi-trip simulator generating realistic GPS coordinates along real road paths, speed variations, and passenger boarding/alighting events.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+
- npm 9+
- Expo CLI (`npx expo`)

### 1. Backend Setup
```bash
cd backend
npm install
npm run build
npm start              # Starts backend server (port 3000)
npm run sim            # Starts telemetry simulator daemon
```

### 2. Commuter App Setup
```bash
cd FRONTEND/commuter-app
npm install
npx expo start         # Starts Metro bundler (press 'w' for web, scan QR for Expo Go)
```

**Environment Variables (`FRONTEND/commuter-app/.env`):**
```env
EXPO_PUBLIC_API_URL=https://nextbus-production.up.railway.app
EXPO_PUBLIC_WS_URL=wss://nextbus-production.up.railway.app/ws/subscribe
```

**Demo Credentials (Locked for presentation):**
- **Phone Number:** `8688105910`
- **OTP:** `1001`

---

## 📂 Repository Structure

```
NextBus/
├── backend/
│   ├── src/
│   │   ├── db/                 # PostgreSQL config, seeds, and migrations
│   │   ├── routes/             # REST endpoints (routes, stops, alerts, passes)
│   │   ├── simulator/          # Multi-city GPS & ETA simulation engine
│   │   ├── websocket/          # WebSocket broadcast hub
│   │   └── server.ts           # Express server entrypoint
│   └── package.json
│
├── FRONTEND/
│   ├── commuter-app/           # React Native / Expo Commuter App
│   │   ├── src/
│   │   │   ├── components/     # AnimatedBusMarker, MapComponents, StopPicker
│   │   │   ├── navigation/     # RootNavigator, Stack & Tab routing
│   │   │   ├── screens/        # HomeDashboard, HomeMap, Search, SOS, Profile, etc.
│   │   │   ├── services/       # telemetryService, routeService, languageService
│   │   │   ├── store/          # Zustand store (useCommuterStore)
│   │   │   ├── styles/         # Design system & BRAND constants
│   │   │   └── utils/          # busMeta, cities, routeGeometries
│   │   └── package.json
│   ├── driver-app/             # React Native Driver Telemetry App
│   └── rtc-dashboard/          # Vite Operations & Analytics Web Dashboard
│
└── README.md
```

---

## 📄 License
MIT License. Built for modern, transparent, and passenger-first public transportation.
