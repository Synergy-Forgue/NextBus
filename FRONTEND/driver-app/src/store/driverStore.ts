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
  Driver,
  Bus,
  DriverRoute,
  Stop,
  Conductor,
  Earnings,
  TripHistoryItem,
  Incident,
  SOSEvent,
} from '../data/mockData';

export interface CurrentTripState {
  id: string;
  startTime: Date;
  startStopId?: string | number;
  startStopName: string;
  currentStopOrder: number;
  passengersBoarded: number;
  passengersAlighted: number;
  stopHistory: any[];
}

export interface CurrentLocationState {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
}

export interface DriverStoreState {
  driver: Driver | null;
  conductor: Conductor | null;
  bus: Bus | null;
  route: DriverRoute | null;
  stops: Stop[];
  activeTripId: number | null;
  occupancy: number;
  pendingPhone: string | null;
  currentTrip: CurrentTripState | null;
  currentLocation: CurrentLocationState;
  isOnline: boolean;
  isLoggedIn: boolean;
  earnings: Earnings;
  tripHistory: TripHistoryItem[];
  breakdownIncidents: Incident[];
  sosEvents: SOSEvent[];

  setActiveTripId: (tripId: number | null) => void;
  setOccupancy: (count: number) => void;
  setPendingPhone: (phone: string | null) => void;
  setRealStops: (stops: Stop[]) => void;
  loginDriver: (phone?: string, password?: string) => void;
  logoutDriver: () => void;
  goOnline: () => void;
  goOffline: () => void;
  updateLocation: (lat: number, lng: number, speed: number, heading: number) => void;
  simulateLocationUpdate: () => void;
  startTrip: (startStopId?: string | number) => void;
  endTrip: () => void;
  updatePassengersBoarded: (count: number) => void;
  updatePassengersAlighted: (count: number) => void;
  moveToNextStop: () => void;
  reportBreakdown: (description: string) => void;
  triggerSOS: (type: string, description: string) => void;
  linkConductor: (conductorPhone: string) => void;
  unlinkConductor: () => void;
}

export const useDriverStore = create<DriverStoreState>((set) => ({
  // Driver data
  driver: null,
  conductor: null,
  bus: mockBus,
  // Pilot route — matches backend seeded data (route 10K / BUS001 / Ravi Kumar)
  route: {
    ...mockRoute,
    id: 1,
    number: '10K',
    name: '10K — RTC Complex ↔ Kailasagiri',
  },
  stops: mockStops,

  // Backend trip_id of active trip; keys GPS Ping publisher
  activeTripId: null,
  setActiveTripId: (tripId: number | null) =>
    set({
      activeTripId: tripId,
      // Setting active trip also sets isOnline so GPS tracking is active
      isOnline: !!tripId,
    }),

  // Live passenger count (conductor taps) — sent in telemetry ping
  occupancy: 0,
  setOccupancy: (count: number) => set({ occupancy: Math.max(0, count) }),

  // Phone captured at login
  pendingPhone: null,
  setPendingPhone: (phone: string | null) => set({ pendingPhone: phone }),

  // Replace mock stops with real route stops fetched from backend
  setRealStops: (stops: Stop[]) => set({ stops }),

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
  loginDriver: (phone?: string, password?: string) => {
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
      activeTripId: null,
      currentTrip: null,
    });
  },

  goOnline: () => {
    set({ isOnline: true });
  },

  goOffline: () => {
    set({ isOnline: false });
  },

  updateLocation: (lat: number, lng: number, speed: number, heading: number) => {
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

  startTrip: (startStopId?: string | number) => {
    set((state) => {
      const startStop = state.stops.find((s) => s.id === startStopId);
      return {
        isOnline: true,
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
      const trip = state.currentTrip;
      if (!trip) return { activeTripId: null, isOnline: false };

      const revenue = trip.passengersBoarded * (state.route?.fare || 25);
      const newTrip: TripHistoryItem = {
        id: trip.id,
        date: trip.startTime.toISOString(),
        startStop: trip.startStopName,
        endStop: state.stops[state.stops.length - 1]?.name || 'Unknown',
        passengers: trip.passengersBoarded,
        revenue: revenue,
        distance: state.route?.distance || 25.5,
        duration: Math.floor((Date.now() - trip.startTime.getTime()) / 60000),
      };

      return {
        activeTripId: null,
        isOnline: false,
        currentTrip: null,
        tripHistory: [newTrip, ...state.tripHistory],
        earnings: {
          ...state.earnings,
          today: {
            ...state.earnings.today,
            trips: state.earnings.today.trips + 1,
            revenue: state.earnings.today.revenue + revenue,
            bonus: state.earnings.today.bonus + revenue * 0.15,
            total: state.earnings.today.total + revenue + revenue * 0.15,
          },
        },
      };
    });
  },

  updatePassengersBoarded: (count: number) => {
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

  updatePassengersAlighted: (count: number) => {
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

  reportBreakdown: (description: string) => {
    const incident: Incident = {
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

  triggerSOS: (type: string, description: string) => {
    const sosEvent: SOSEvent = {
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

  linkConductor: (conductorPhone: string) => {
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
