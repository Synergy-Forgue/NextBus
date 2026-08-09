# 🚌 NextBus Frontend Apps

Complete frontend suite for NextBus platform: commuter mobile app, driver mobile app, and operations dashboard.

## 📱 Apps Overview

### 1. Commuter App (`commuter-app/`)
React Native app for bus commuters to search routes, book tickets, and track buses in real-time.

**Features:**
- Smart route search with AI recommendations
- Live bus tracking with ETA countdown
- Crowd level indicators (% occupancy)
- Female-only section availability
- Trip sharing capability
- Late-night safety mode (21:00–06:00)
- Saved routes & favorite stops

**Tech Stack:** React Native, Expo Router, Zustand, Tailwind CSS

**Quick Start:**
```bash
cd commuter-app
npm install
npm run ios       # iOS simulator
npm run android   # Android emulator
```

---

### 2. Driver App (`driver-app/`)
React Native app for bus drivers to start trips, publish GPS, and manage route assignments.

**Features:**
- Route selection and trip start/end
- Real-time GPS publishing (5-10 sec intervals)
- Occupancy reporting (manual tap: Low/Medium/High)
- Safety & SOS emergency alerts
- Performance metrics dashboard
- Driver shift management
- Night mode support

**Tech Stack:** React Native, Expo Router, Context API, Zustand

**Quick Start:**
```bash
cd driver-app
npm install
npm run ios       # iOS simulator
npm run android   # Android emulator
```

---

### 3. RTC Dashboard (`rtc-dashboard/`)
React web app for depot/regional/HQ operators to monitor fleet, analyze profitability, and manage alerts.

**Features:**
- Live fleet map with GPS locations
- Route profitability P&L analysis
- Dead kilometer (non-revenue) tracking
- On-time punctuality reports
- Driver performance profiles
- Emergency alert management (breakdown/SOS)
- Bus bunching detection (gap analyzer)
- Real-time WebSocket updates

**Tech Stack:** React 18, Vite, Tailwind CSS, Lucide Icons

**Quick Start:**
```bash
cd rtc-dashboard
npm install
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # Production build
```

---

## 🏗️ Project Structure

```
FRONTEND/
├── commuter-app/               # React Native commuter app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx       # Home → Smart route search
│   │   │   ├── map.tsx         # Map → Live bus tracking
│   │   │   ├── saved.tsx       # Saved routes & stops
│   │   │   └── profile.tsx     # User profile
│   │   ├── login.tsx           # Auth login screen
│   │   ├── trip-sharing.tsx    # Trip share modal
│   │   └── sos.tsx             # Emergency SOS screen
│   ├── src/
│   │   ├── services/           # API + smart alerts
│   │   ├── store/              # Zustand state management
│   │   ├── styles/             # Brand constants, tailwind
│   │   └── utils/              # Haversine, formatters
│   ├── package.json
│   └── app.json
│
├── driver-app/                 # React Native driver app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── home.tsx        # Trip start/end UI
│   │   │   ├── tracking.tsx    # Occupancy counter
│   │   │   ├── analytics.tsx   # Performance stats
│   │   │   └── profile.tsx     # Driver info & settings
│   │   ├── login.tsx           # Driver login by phone
│   │   └── sos.tsx             # SOS alert screen
│   ├── src/
│   │   ├── services/           # GPS publisher, API calls
│   │   ├── store/              # Zustand store
│   │   ├── styles/             # Brand constants
│   │   └── utils/              # Helpers
│   ├── package.json
│   └── app.json
│
└── rtc-dashboard/              # React web dashboard
    ├── src/
    │   ├── pages/
    │   │   └── Dashboard.jsx   # Main layout + routing
    │   ├── components/
    │   │   ├── LiveFleetMap.jsx        # Map visualization
    │   │   ├── RouteProfitability.jsx  # P&L analysis
    │   │   ├── DeadKMAnalysis.jsx      # Non-revenue km
    │   │   ├── PunctualityReport.jsx   # On-time %
    │   │   ├── DriverProfiles.jsx      # Driver leaderboard
    │   │   └── RouteGapDetector.jsx    # Bus bunching alerts
    │   └── App.jsx
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 16+
- npm 8+
- iOS 13+ (for iOS simulator testing)
- Android SDK 11+ (for Android emulator)
- Expo CLI: `npm install -g expo-cli`

### Backend API Connection
All apps connect to backend at:
```
http://localhost:3000  (development)
```

Update environment variables in `.env` files:

**Commuter App (`.env`):**
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

**Driver App (`.env`):**
```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**RTC Dashboard (`.env.local`):**
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Install All Apps
```bash
# From FRONTEND directory
cd commuter-app && npm install && cd ..
cd driver-app && npm install && cd ..
cd rtc-dashboard && npm install && cd ..
```

---

## 🎯 Smart Route Search (Commuter App)

The home screen (`commuter-app/app/(tabs)/index.tsx`) implements AI-powered route recommendations:

**Features:**
- Search by start/end location or stop name
- Filter results by: Fastest, Cheapest, Least Crowded
- Inline route cards showing:
  - ETA (Estimated Time of Arrival)
  - Crowd % (occupancy level)
  - Fare (ticket price)
  - Female-only section available (♀️ badge)
- AI recommendation ("Our Recommendation") with reasoning
- Real-time preference switching

**Implementation:**
- Smart alerts service calculates Haversine distance
- ETA formula: distance / avg_speed_kmh (20 km/h default)
- Crowd color coding: Green (< 50%), Yellow (50–75%), Red (> 75%)
- Saved routes persisted to Zustand store

---

## 📍 Live Bus Tracking (Commuter App)

The map screen (`commuter-app/app/(tabs)/map.tsx`) displays real-time GPS positions:

**Features:**
- Selected bus highlighted (large, primary color marker)
- 3–4 nearby buses dimmed (smaller, secondary markers)
- Crowd % displayed on bus info panel
- ETA countdown (8 min shown as example)
- AI-proactive alerts (breakdowns, hazards)
- Crowd safety warnings (late night with high occupancy)
- Late-night mode badge (21:00–06:00)

**Implementation:**
- Buses loaded from `/api/buses` endpoint every 5 seconds
- MapView component from `react-native-maps`
- WebSocket support (future enhancement for real-time updates)

---

## 🔴 Emergency Alerts & Safety

**Commuter App:**
- SOS button (floating, bottom-right) on map screen
- Reports emergency to backend with GPS location
- Notification service integration

**Driver App:**
- SOS alert screen for emergency reporting
- Breakdown alert with vehicle status
- Safety & SOS settings in profile

**Dashboard:**
- Active alerts panel showing breakdown/SOS reports
- Resolve button per alert
- Driver alert history queries

---

## 📊 RTC Dashboard Tabs

1. **Fleet** — Live map of all buses with current GPS + crowd level
2. **Profitability** — Route P&L analysis (revenue vs. operating costs)
3. **Dead KM** — Empty kilometer tracking (non-revenue segments)
4. **Punctuality** — On-time performance per route (%)
5. **Drivers** — Driver leaderboard with rating/performance
6. **Alerts** — Bus bunching detection and emergency alerts

---

## 🌐 Real-time Features

### WebSocket (Future Enhancement)
All apps can subscribe to live updates from backend WebSocket server:

```javascript
// Commuter App subscribe to route updates
ws://localhost:3000/ws/subscribe?route_id=1

// Driver App publish GPS
ws://localhost:3000/ws/publish
```

### API Endpoints Used

**Commuter App:**
- `GET /api/buses` — All buses with positions
- `GET /api/routes` — All routes
- `GET /api/stops` — Stop master data

**Driver App:**
- `POST /api/trips/start` — Start trip with route
- `PATCH /api/trips/:id/end` — End trip
- `POST /api/gps-ping` — Publish GPS location

**RTC Dashboard:**
- `GET /api/fleet/live` — Live bus positions
- `GET /api/routes/profitability` — P&L data
- `GET /api/analytics/dead-km` — Empty km analysis
- `GET /api/analytics/punctuality` — On-time %
- `GET /api/alerts/active` — Emergency alerts

---

## 🎨 Design & Branding

All apps use consistent branding:

**Colors:**
- Primary: `#5A4FCF` (Purple)
- Success: `#10B981` (Green)
- Warning: `#F59E0B` (Amber)
- Danger: `#EF4444` (Red)

**Typography:**
- Brand: 20pt Bold
- Heading: 16–18pt Bold
- Body: 14–15pt Regular
- Caption: 12–13pt Regular

**Components:**
- Buttons: Gradient, pill-shaped (48px height)
- Cards: Rounded corners, subtle shadow
- Icons: Emoji + text labels
- Maps: Interactive with user location

---

## 🐛 Troubleshooting

### "Cannot connect to backend"
```bash
# Verify backend is running
curl http://localhost:3000/health

# Update API_URL in .env if backend is on different port
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### "Module not found" errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# For Expo apps, also clear cache:
npx expo start --clear
```

### Map not loading
```bash
# Verify Google Maps API key in .env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_valid_key

# On emulator, ensure location permission granted
```

### WebSocket connection failed
```bash
# Check backend WebSocket server is running
# Verify firewall allows WebSocket on port 3000
# Try URL: ws://localhost:3000 (without path initially)
```

---

## 📦 Deployment

### Commuter & Driver Apps (React Native + Expo)

**To Expo Cloud:**
```bash
npm run build:ios    # Creates iOS build
npm run build:android  # Creates Android build
# Distribute via Expo, TestFlight, or Google Play
```

**To Native App Stores:**
1. Generate signing certificates (iOS: `.p8` key, Android: keystore)
2. Build with `eas build --platform ios|android`
3. Submit to App Store / Play Store

### RTC Dashboard (React Web)

**Build for production:**
```bash
npm run build
# Creates dist/ folder

# Deploy to Vercel, Netlify, or any static host
npm run preview  # Test production build locally
```

**Deploy to Railway/Heroku:**
```bash
# With Dockerfile
docker build -t nextbus-dashboard .
docker run -p 3000:3000 nextbus-dashboard
```

---

## 📚 Development Workflow

1. **Start backend:** `cd BACKEND && npm start`
2. **Start commuter app:** `cd commuter-app && npm run ios` (or `android`)
3. **Start driver app:** `cd driver-app && npm run ios` (or `android`)
4. **Start dashboard:** `cd rtc-dashboard && npm run dev`

All apps hot-reload on file save.

---

## 📄 License

NextBus Frontend © 2026. All rights reserved.
