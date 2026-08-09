import { create } from 'zustand';
import {
  mockDriver,
  mockBus,
  mockRoute,
  mockStops,
  mockConductor,
  mockEarnings,
  mockTrips,
  mockBreakdownIncidents,
  mockSOSEvents,
} from '../data/mockData';

export const useDriverStore = create((set) => ({
  // Driver data
  driver: null,
  conductor: null,
  bus: mockBus,
  // Pilot route — matches the backend's seeded Vizag data (route 10K / BUS001 / Ravi Kumar)
  route: {
    ...mockRoute,
    id: 1,
    number: '10K',
    name: '10K — RTC Complex ↔ Kailasagiri',
  },
  stops: mockStops,

  // The backend trip_id of the running trip; the GPS Ping publisher keys off this
  activeTripId: null,
  setActiveTripId: (tripId) => set({ activeTripId: tripId }),

  // Live passenger count (conductor taps) — sent inside every GPS telemetry ping
  occupancy: 0,
  setOccupancy: (count) => set({ occupancy: Math.max(0, count) }),

  // Phone captured at login, verified at the OTP step
  pendingPhone: null,
  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  // Replace mock stops with the real route stops fetched from the backend
  setRealStops: (stops) => set({ stops }),

  // Trip state
  currentTrip: null,
  currentLocation: {
    lat: mockBus.lat,
    lng: mockBus.lng,
    speed: 0,
    heading: 0,
    accuracy: 5,
  },

  // Driver state
  isOnline: false,
  isLoggedIn: false,

  // Earnings
  earnings: mockEarnings,
  tripHistory: mockTrips,

  // Incidents
  breakdownIncidents: mockBreakdownIncidents,
  sosEvents: mockSOSEvents,

  // Actions
  loginDriver: (phone, password) => {
    // Keep the real phone the driver typed — the backend looks drivers up by
    // phone in POST /api/trips/start (seeded pilot driver: 9876543210)
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    set({
      driver: { ...mockDriver, phone: cleanPhone || mockDriver.phone },
      isLoggedIn: true,
    });
  },

  logoutDriver: () => {
    set({
      driver: null,
      isLoggedIn: false,
      isOnline: false,
      currentTrip: null,
    });
  },

  goOnline: () => {
    set({ isOnline: true });
    // Start GPS simulation
  },

  goOffline: () => {
    set({ isOnline: false });
    // Stop GPS simulation
  },

  updateLocation: (lat, lng, speed, heading) => {
    set({
      currentLocation: {
        lat,
        lng,
        speed,
        heading,
        accuracy: Math.random() * 10 + 5,
      },
    });
  },

  simulateLocationUpdate: () => {
    set((state) => {
      const { currentLocation } = state;
      const newLat = currentLocation.lat + (Math.random() - 0.5) * 0.001;
      const newLng = currentLocation.lng + (Math.random() - 0.5) * 0.001;
      const newSpeed = Math.random() * 60;

      return {
        currentLocation: {
          lat: newLat,
          lng: newLng,
          speed: newSpeed,
          heading: Math.random() * 360,
          accuracy: Math.random() * 10 + 5,
        },
      };
    });
  },

  startTrip: (startStopId) => {
    set((state) => {
      const startStop = state.stops.find((s) => s.id === startStopId);
      return {
        currentTrip: {
          id: `TRIP${Date.now()}`,
          startTime: new Date(),
          startStopId: startStopId,
          startStopName: startStop?.name || 'Unknown',
          currentStopOrder: startStop?.order || 1,
          passengersBoarded: 0,
          passengersAlighted: 0,
          stopHistory: [],
        },
      };
    });
  },

  endTrip: () => {
    set((state) => {
      if (!state.currentTrip) return {};

      const trip = state.currentTrip;
      const revenue = trip.passengersBoarded * state.route.fare;
      const newTrip = {
        id: trip.id,
        date: trip.startTime.toISOString(),
        startStop: trip.startStopName,
        endStop: state.stops[state.stops.length - 1]?.name || 'Unknown',
        passengers: trip.passengersBoarded,
        revenue: revenue,
        distance: state.route.distance,
        duration: Math.floor((new Date() - trip.startTime) / 60000),
      };

      return {
        currentTrip: null,
        tripHistory: [newTrip, ...state.tripHistory],
        earnings: {
          ...state.earnings,
          today: {
            ...state.earnings.today,
            trips: state.earnings.today.trips + 1,
            revenue: state.earnings.today.revenue + revenue,
            bonus: state.earnings.today.bonus + (revenue * 0.15),
            total: state.earnings.today.total + revenue + (revenue * 0.15),
          },
        },
      };
    });
  },

  updatePassengersBoarded: (count) => {
    set((state) => {
      if (!state.currentTrip) return {};
      return {
        currentTrip: {
          ...state.currentTrip,
          passengersBoarded: Math.max(0, state.currentTrip.passengersBoarded + count),
        },
      };
    });
  },

  updatePassengersAlighted: (count) => {
    set((state) => {
      if (!state.currentTrip) return {};
      return {
        currentTrip: {
          ...state.currentTrip,
          passengersAlighted: Math.max(0, state.currentTrip.passengersAlighted + count),
        },
      };
    });
  },

  moveToNextStop: () => {
    set((state) => {
      if (!state.currentTrip) return {};

      const currentOrder = state.currentTrip.currentStopOrder;
      const nextStop = state.stops.find((s) => s.order === currentOrder + 1);

      if (nextStop) {
        return {
          currentTrip: {
            ...state.currentTrip,
            currentStopOrder: nextStop.order,
          },
        };
      }
      return {};
    });
  },

  reportBreakdown: (description) => {
    const incident = {
      id: `INC${Date.now()}`,
      date: new Date().toISOString(),
      description: description,
      status: 'REPORTED',
      type: 'BREAKDOWN',
    };

    set((state) => ({
      breakdownIncidents: [incident, ...state.breakdownIncidents],
    }));
  },

  triggerSOS: (type, description) => {
    const sosEvent = {
      id: `SOS${Date.now()}`,
      date: new Date().toISOString(),
      type: type,
      description: description,
      status: 'ACTIVE',
      lat: Math.random() * 180 - 90,
      lng: Math.random() * 360 - 180,
    };

    set((state) => ({
      sosEvents: [sosEvent, ...state.sosEvents],
    }));
  },

  linkConductor: (conductorPhone) => {
    set({
      conductor: {
        ...mockConductor,
        phone: conductorPhone,
      },
    });
  },

  unlinkConductor: () => {
    set({ conductor: null });
  },
}));
