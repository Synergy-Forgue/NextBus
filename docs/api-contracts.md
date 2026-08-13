# NXTBus — API Contracts & WebSocket Specification

---

## 1. REST API Specification

### Health Check
- **`GET /health`**
- **Response:** `{ "status": "ok", "database": "connected", "timestamp": "2026-08-13T12:00:00.000Z" }`

### Routes Engine
- **`GET /api/routes`**: Returns all available routes.
- **`GET /api/routes/search?q=...&from=...&to=...`**:
  - Semantic route & stop search engine.
  - Returns `Route[]` matching keyword `q`, origin `from`, or destination `to`.
- **`GET /api/routes/:id`**: Returns route details by ID.
- **`GET /api/routes/:id/stops`**: Returns ordered stop sequence for a route (`RouteStop[]`).

### Fleet Tracking REST Snapshot
- **`GET /api/tracking/fleet`**: Returns active live buses with `trip_id`, `bus_id`, `latitude`, `longitude`, `speed`, `occupancy`, and computed `stop_etas`.
- **`GET /api/buses`**: Fallback endpoint returning all registered buses.

### Trips & Operational State
- **`POST /api/trips/start`**:
  - Payload: `{ "route_number": "10K", "driver_phone": "9876543210" }`
  - Response: `{ "trip_id": 12, "bus_id": 1, "status": "active" }`
- **`PATCH /api/trips/:id/end`**:
  - Updates trip state to `'completed'`, purges `liveState`, and broadcasts `BUS_OFFLINE` to WebSocket clients.

### Alerts & Emergency SOS
- **`POST /api/alerts`**: Creates new SOS or breakdown alert.
- **`GET /api/alerts`**: Lists recent active alerts.
- **`PATCH /api/alerts/:id/resolve`**: Marks alert as resolved.

---

## 2. WebSocket Telemetry & Streaming Specification

- **Ingestion Endpoint:** `ws://<server>/ws/publish` (Driver App & Simulator)
  - **Payload:**
    ```json
    {
      "trip_id": 12,
      "latitude": 17.7261,
      "longitude": 83.3085,
      "speed": 28.5,
      "occupancy": 65,
      "recorded_at": "2026-08-13T12:00:00.000Z"
    }
    ```

- **Subscription Endpoint:** `wss://<server>/ws/subscribe` (Commuter App & RTC Dashboard)
  - **Event Types:**
    - `SNAPSHOT`: Full active fleet list sent on initial connection.
    - `LOCATION_UPDATE`: Live update carrying updated bus location, speed, occupancy, and `stop_etas` array.
    - `BUS_OFFLINE`: Event emitted when a bus completes its trip or goes stale.
    - `ALERT`: Live emergency SOS or breakdown event.
