# 🚌 NXTBus Backend

Real-time public bus tracking and AI-powered transit platform for Visakhapatnam, Andhra Pradesh.

Built for APSRTC's MVP pilot (5 buses, 5 routes) with full end-to-end telemetry — from driver smartphone GPS to passenger ETA display.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + TypeScript |
| Database | PostgreSQL |
| Real-time | WebSockets (`ws`) |
| Maps | Google Maps API (React Native client) |
| Deployment | Render / Railway |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [PostgreSQL](https://www.postgresql.org/download/) v14 or higher
- Git

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-org/nxtbus.git
cd nxtbus/backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your PostgreSQL password and any other values.

### 4. Create the database

Open `psql` (or any Postgres client) and run:

```sql
CREATE DATABASE nxtbus;
\q
```

### 5. Load schema and seed data

This creates all tables and inserts the 5 Vizag pilot routes with real stop coordinates:

```bash
npm run setup-db
```

### 6. Start the backend

```bash
npm run dev
```

You should see:

```
🔌 WebSocket server attached.

🚌 NXTBus Backend running on http://localhost:3000
   Health:    GET  http://localhost:3000/health
   Fleet:     GET  http://localhost:3000/api/tracking/fleet
   ...
   Subscribe: WS   ws://localhost:3000/ws/subscribe?route_id=<id>
```

### 7. Start the GPS simulator (optional, for demo)

In a second terminal, with the backend already running:

```bash
npm run sim
```

The simulator loads all 5 active trips from the database and drives each bus along its route indefinitely with realistic speed profiles, dwell times at stops, traffic events, and AI occupancy data.

---

## REST API Reference

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Returns server + database status |

### Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/routes` | All routes |
| `GET` | `/api/routes/:id` | Single route by ID |
| `GET` | `/api/routes/:id/stops` | Ordered stops for a route |

### Stops

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stops` | All stops |
| `GET` | `/api/stops/:id` | Single stop by ID |
| `GET` | `/api/stops/nearby?lat=&lng=&radius=` | Stops within radius km of a coordinate |

### Buses

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/buses` | All buses |
| `GET` | `/api/buses/:id` | Single bus |

### Drivers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/drivers` | All drivers |
| `GET` | `/api/drivers/:id` | Single driver |

### Trips

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/trips` | All trips (filter: `?status=active`) |
| `GET` | `/api/trips/:id` | Single enriched trip |
| `POST` | `/api/trips/start` | **Driver App login** — see below |
| `POST` | `/api/trips` | Start trip with raw IDs |
| `PATCH` | `/api/trips/:id/end` | Mark trip completed |

#### `POST /api/trips/start` — Driver App Login

The React Native Driver App calls this endpoint after the driver selects their route. No hardcoded database IDs needed.

**Request body:**
```json
{
  "route_number": "10K",
  "driver_phone": "9876543210"
}
```

**Response:**
```json
{
  "id": 6,
  "trip_id": 6,
  "route_number": "10K",
  "route_name": "RTC Complex ↔ Kailasagiri",
  "license_plate": "BUS001",
  "driver_name": "Ravi Kumar",
  "status": "active",
  "started_at": "2026-07-13T17:00:00.000Z"
}
```

The `id` field is the `trip_id` the Driver App uses when publishing GPS telemetry.

### Tracking

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tracking/fleet` | HTTP snapshot of all live buses with ETAs |

---

## WebSocket Protocol

### Publisher — Driver App (`ws://host/ws/publish`)

The Driver App connects here and streams GPS + occupancy data continuously while the trip is active.

**Send (every 2–5 seconds):**
```json
{
  "trip_id": 6,
  "latitude": 17.7261,
  "longitude": 83.3085,
  "speed": 28.5,
  "occupancy_count": 42,
  "vision_confidence_score": 0.94,
  "recorded_at": "2026-07-13T17:00:00.000Z"
}
```

> For MVP, `occupancy_count` is set manually by the driver via a button tap (Low/Medium/High maps to approximate counts). The `vision_confidence_score` can be set to `1.0` from the app since it's a manual count.

**Receive (ACK):**
```json
{ "type": "ACK", "trip_id": 6 }
```

### Subscriber — Commuter App (`ws://host/ws/subscribe?route_id=1`)

Subscribe to live updates for a specific route, or omit `route_id` to receive all bus updates.

**On connect (snapshot):**
```json
{
  "type": "SNAPSHOT",
  "data": [ ...array of LiveBusState objects... ]
}
```

**On each bus update:**
```json
{
  "type": "BUS_UPDATE",
  "data": {
    "trip_id": 6,
    "bus_id": 1,
    "route_id": 1,
    "license_plate": "BUS001",
    "latitude": 17.7284,
    "longitude": 83.3142,
    "speed": 28.5,
    "occupancy_count": 42,
    "vision_confidence_score": 0.94,
    "last_updated": "2026-07-13T17:00:00.000Z",
    "nextStopIndex": 2,
    "stop_etas": [
      { "stop_id": 1, "stop_name": "RTC Complex", "stop_order": 1, "eta_seconds": null },
      { "stop_id": 2, "stop_name": "Dwaraka Bus Station", "stop_order": 2, "eta_seconds": null },
      { "stop_id": 3, "stop_name": "Jagadamba Junction", "stop_order": 3, "eta_seconds": 68 },
      { "stop_id": 5, "stop_name": "RK Beach", "stop_order": 5, "eta_seconds": 214 }
    ]
  }
}
```

**When a bus goes offline:**
```json
{ "type": "BUS_OFFLINE", "trip_id": 6 }
```

---

## Project Structure

```
backend/
├── src/
│   ├── db/
│   │   ├── pool.ts           # PostgreSQL connection pool
│   │   ├── schema.sql        # Table definitions
│   │   ├── seed.sql          # Vizag pilot data (5 routes, 30 stops)
│   │   └── setup-db.ts       # One-time DB setup script
│   ├── middleware/
│   │   └── errorHandler.ts   # Global error + 404 handler
│   ├── routers/
│   │   ├── routes.router.ts
│   │   ├── stops.router.ts
│   │   ├── buses.router.ts
│   │   ├── drivers.router.ts
│   │   └── trips.router.ts
│   ├── simulator/
│   │   ├── simulator.ts      # Main simulator entry point
│   │   ├── busAgent.ts       # Per-bus simulation loop
│   │   ├── physics.ts        # Speed profiles, traffic events
│   │   └── occupancy.ts      # AI occupancy model
│   ├── tracking/
│   │   ├── liveState.ts      # In-memory bus fleet store
│   │   ├── eta.service.ts    # Stop-by-stop ETA calculation
│   │   └── tracking.ws.ts    # WebSocket server
│   ├── types/
│   │   └── index.ts          # Shared TypeScript interfaces
│   ├── utils/
│   │   └── haversine.ts      # GPS distance math
│   └── index.ts              # Server entry point
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

---

## Seeded Pilot Data (Visakhapatnam)

| Bus | Route | Stops |
|---|---|---|
| BUS001 | 10K — RTC Complex ↔ Kailasagiri | 9 stops |
| BUS002 | 900K — Bheemili ↔ Railway Station | 10 stops |
| BUS003 | 28K — Kothavalasa ↔ RK Beach | 7 stops |
| BUS004 | 55T — Old Gajuwaka ↔ Tagarapuvalasa | 7 stops |
| BUS005 | 300N — Sabbavaram ↔ RK Beach | 8 stops |

Stop coordinates sourced from OpenStreetMap Visakhapatnam APSRTC route data.

---

## Demo Day Instructions

1. Start the backend: `npm run dev`
2. Each driver installs the React Native Driver App on their phone
3. Driver selects their route and taps **Start Trip** → app calls `POST /api/trips/start`
4. App starts streaming phone GPS to `ws://<server>/ws/publish` every 3 seconds
5. Commuter App connects to `ws://<server>/ws/subscribe?route_id=<id>` and receives live locations + ETAs in real time
6. For demo without real driver phones: `npm run sim` (runs all 5 buses automatically)

---

## License

MIT — NXTBus, 2026
