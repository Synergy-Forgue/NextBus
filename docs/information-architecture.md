# NXTBus — Information Architecture (IA) Specification

---

## 1. Commuter / Passenger App IA (`commuter-app`)

```
Passenger App Root
├── (tabs) Bottom Tab Navigator
│   ├── HomeScreen (`app/(tabs)/index.tsx`)
│   │   ├── Dynamic Greeting & Header Profile Link
│   │   ├── Fleet Overview Quick Stats (Active Fleet, Avg Wait, Crowd)
│   │   ├── Unified Search Bar (Keyword, Boarding Stop, Destination)
│   │   ├── Preference Filter (Fastest, Cheapest, Least Crowded)
│   │   ├── Recommended Route Card (Best match)
│   │   ├── Other Matching Routes List
│   │   ├── Saved Routes Quick Access
│   │   ├── Transit Updates & Alerts Banner
│   │   └── Bus Pass Banner / Active Pass QR Card
│   │
│   ├── ExploreScreen (`app/(tabs)/explore.tsx`)
│   │   ├── Banner Header ("Discover Routes")
│   │   ├── Keyword Filter Input
│   │   └── All Routes List (with LIVE / SCHEDULED status badges)
│   │
│   ├── MapScreen (`app/(tabs)/map.tsx`)
│   │   ├── Header Overlay (Back CTA, Visakhapatnam Live indicator, Refresh)
│   │   ├── Map View Overlay (User location, Polyline route geometry, Stop markers, Selected Bus)
│   │   ├── Selected Route Context Banner
│   │   ├── AI Proactive Alert Banner / Crowd Warning / Late Night Mode Badge
│   │   ├── Bus Info Bottom Sheet (Route #, License, Live Distance/ETA, Occupancy %, Speed, Share CTA)
│   │   └── Floating SOS Emergency Button
│   │
│   ├── SavedRoutesScreen (`app/(tabs)/saved-routes.tsx`)
│   │   ├── Header Banner
│   │   ├── Saved Routes List (Enriched with live bus telemetry & ETAs)
│   │   └── Delete Route Action
│   │
│   └── ProfileScreen (`app/(tabs)/profile.tsx`)
│       ├── User Avatar & Info
│       ├── Travel History / Report Card Link
│       └── Emergency Contacts Settings
│
└── Contextual Screens & Modals
    ├── LoginScreen (`app/login.tsx`)
    ├── OtpScreen (`app/otp.tsx`)
    ├── TripSharingScreen (`app/trip-sharing.tsx`)
    ├── SosScreen (`app/sos.tsx`)
    ├── ReportCardScreen (`app/report-card.tsx`)
    └── PassPurchaseModal & PassQrModal (In `index.tsx`)
```

---

## 2. Driver App IA (`driver-app`)

```
Driver App Root
├── Authentication & Setup Stack
│   ├── LoginScreen (`app/login.tsx`)
│   └── PairingScreen (`app/pairing.tsx` - Conductor/Driver Pairing)
│
└── (tabs) Operational Navigation
    ├── DriverHomeScreen (`app/(tabs)/index.tsx`)
    │   ├── Driver & Conductor Header
    │   ├── Today's Assigned Trip Card (Route 10K, Bus, Schedule)
    │   ├── Start Trip / End Trip Controls
    │   ├── Active Trip Telemetry HUD (Live Coordinates, Speed, Occupancy, Telemetry status)
    │   └── GPS & Connection Indicator
    │
    ├── TripLogScreen (`app/(tabs)/trip-log.tsx`)
    │   └── Historical Trips & Completed Trip Summary
    │
    └── Settings / Profile Tab
```

---

## 3. RTC Operations Dashboard IA (`rtc-dashboard`)

```
RTC Dashboard Web App Root
├── Header Bar (System Health, Active Fleet Count, Live Time)
├── Sidebar Navigation
│   ├── Dashboard Overview (`Dashboard.jsx`)
│   │   ├── Metrics Grid (Active Fleet, Daily Revenue, Active Alerts, Profitable Routes)
│   │   ├── Live Fleet Map View (Real-time vehicle markers)
│   │   └── Active SOS Alert Resolution List
│   │
│   ├── Fleet Monitoring View
│   ├── Route Performance View
│   └── Alert & Incident Manager
```
