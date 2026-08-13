# NXTBus — Screen State Specifications & Matrix

---

## Mandatory Screen States

Every view in the NXTBus application must handle and visually present the following 10 standard states:

| State | Trigger / Condition | Visual Representation | Recovery / Action |
|---|---|---|---|
| **1. Initial** | Screen mount before data fetch | Skeleton placeholder / loading spinner | Automatic fetch on mount |
| **2. Loading** | Async API request in progress | ActivityIndicator / smooth progress bar | Cancelable / Non-blocking |
| **3. Success** | Data successfully fetched and populated | Complete UI with interactive cards & map | Pull-to-refresh / auto-update |
| **4. Empty** | Query returned 0 results (`[]`) | Friendly empty state vector + clear message | "Clear Search" or "Try Popular Routes" CTA |
| **5. Error** | API 500 error or network exception | Error message banner / card | "Retry Connection" button |
| **6. Offline** | Device loses internet connectivity | Top warning pill ("Network Offline - Using cached data") | Auto-reconnect listener |
| **7. Permission Denied** | User denies Location permission | Educational banner ("Location needed for nearby ETAs") | "Grant Permission" settings link |
| **8. Stale Data (>60s)** | Vehicle telemetry older than 60 seconds | Dimmed bus marker + "STALE (Last update 2m ago)" badge | Auto-purge worker / refresh WS |
| **9. Signal Lost** | WebSocket disconnects unexpectedly | Top bar status pill ("Reconnecting live stream...") | Exponential backoff reconnect loop (3s) |
| **10. Retry** | User manually taps refresh | Refresh spinner icon (`⟳`) | Re-execute fetch / reconnect WS |

---

## Transit-Specific Vehicle Telemetry States

For real-time bus tracking on `map.tsx`, `explore.tsx`, and `Dashboard.jsx`:

- **🟢 LIVE:** Active telemetry arriving via WebSocket within 60s.
- **🟡 APPROACHING STOP:** Vehicle position within 200m of upcoming stop.
- **🔵 AT STOP:** Vehicle speed < 5 km/h at stop coordinates.
- **🟠 STALE:** No telemetry updates received for 60s - 120s.
- **🔴 OFFLINE:** Bus telemetry timestamp > 120s or trip ended by driver (`PATCH /api/trips/:id/end`).
