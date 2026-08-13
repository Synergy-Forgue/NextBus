# NXTBus — Navigation Map & Hierarchy Specification

---

## 1. Commuter App Navigation Graph (`FRONTEND/commuter-app/`)

```mermaid
graph TD
    Splash[Splash / App Launch] --> Home[HomeScreen - tabs/index]
    
    Home -->|Search Query / Select Route| Map[MapScreen - tabs/map]
    Home -->|Tap Explore Tab| Explore[ExploreScreen - tabs/explore]
    Home -->|Tap Saved Tab| Saved[SavedRoutesScreen - tabs/saved-routes]
    Home -->|Tap Profile Icon| Profile[ProfileScreen - tabs/profile]
    Home -->|Tap Buy Pass| PassModal[Pass Purchase Modal]
    Home -->|Tap View QR| QrModal[Pass QR Modal]
    
    Explore -->|Select Route| Map
    Saved -->|Select Saved Route| Map
    
    Map -->|Tap Back| Home
    Map -->|Tap Share Trip| TripSharing[TripSharingScreen]
    Map -->|Tap SOS Button| SOS[SosScreen]
    
    Profile -->|Tap Report Card| ReportCard[ReportCardScreen]
    Profile -->|Tap Emergency Contacts| AlertSettings[AlertSettingsScreen]
```

### Back Behavior Rules:
- Tapping **Back** (`←`) on `MapScreen` returns to the previous originating view (`HomeScreen`, `ExploreScreen`, or `SavedRoutesScreen`).
- Tapping **Back** on Modal dialogs (`PassModal`, `QrModal`) dismisses the overlay without resetting active tab context.

---

## 2. Driver App Navigation Graph (`FRONTEND/driver-app/`)

```mermaid
graph TD
    DriverLaunch[Driver Launch] --> DriverLogin[LoginScreen - app/login]
    DriverLogin --> Pairing[PairingScreen - app/pairing]
    Pairing --> DriverHome[DriverHomeScreen - tabs/index]
    
    DriverHome -->|Start Trip| ActiveHUD[Active Telemetry HUD]
    ActiveHUD -->|End Trip| TripLog[TripLogScreen - tabs/trip-log]
    TripLog --> DriverHome
```

---

## 3. RTC Operations Dashboard Navigation Graph (`FRONTEND/rtc-dashboard/`)

```mermaid
graph TD
    DashboardLaunch[Dashboard Launch] --> MainDashboard[Dashboard.jsx Overview]
    MainDashboard -->|Select Bus Marker| BusDetailSheet[Bus Telemetry Panel]
    MainDashboard -->|Resolve SOS| AlertResolver[PATCH /api/alerts/:id/resolve]
    MainDashboard -->|Filter Fleet| LiveMapFilter[Live Map Filter]
```
