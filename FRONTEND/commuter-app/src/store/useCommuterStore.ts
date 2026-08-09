import { create } from 'zustand';

interface BusPosition {
  busId: string;
  lat: number;
  lng: number;
  routeNo: string;
  crowdLevel: number;
  speed?: number;
  eta?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface UserProfile {
  id: string;
  phone: string;
  name: string;
  language: string;
}

interface Alert {
  id: string;
  busId: string;
  stopId: string;
  thresholdMinutes: number;
}

interface CommuterStoreState {
  // Bus & Route Data
  busPositions: Record<string, BusPosition>;

  // User Data
  userLocation: UserLocation | null;
  userProfile: UserProfile | null;

  // Alerts
  activeAlerts: Alert[];

  // Routes & Stops
  searchResults: any[];
  savedRoutes: any[];

  // UI State
  selectedBus: any | null;
  isLoading: boolean;
  darkMode: boolean;

  // Auth / onboarding flow
  hasOnboarded: boolean;
  pendingPhone: string | null;
  completeOnboarding: () => void;
  setPendingPhone: (phone: string | null) => void;

  // Actions
  setBusPositions: (positions: Record<string, BusPosition>) => void;
  updateBusPosition: (busId: string, data: Partial<BusPosition>) => void;
  removeBusPosition: (busId: string) => void;
  setUserLocation: (lat: number, lng: number) => void;
  setUserProfile: (profile: UserProfile) => void;
  clearUserProfile: () => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (alertId: string) => void;
  setSearchResults: (results: any[]) => void;
  setSavedRoutes: (routes: any[]) => void;
  setSavedRoute: (route: any) => void;
  setSelectedBus: (bus: any | null) => void;
  setLoading: (isLoading: boolean) => void;
  setDarkMode: (darkMode: boolean) => void;
  clearAll: () => void;
}

const useCommuterStore = create<CommuterStoreState>((set) => ({
  // Initial state
  busPositions: {},
  userLocation: null,
  userProfile: null,
  activeAlerts: [],
  searchResults: [],
  savedRoutes: [],
  selectedBus: null,
  isLoading: false,
  darkMode: false,

  hasOnboarded: false,
  pendingPhone: null,
  completeOnboarding: () => set({ hasOnboarded: true }),
  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  // Actions
  setBusPositions: (positions) => set({ busPositions: positions }),

  updateBusPosition: (busId, data) =>
    set((state) => ({
      busPositions: {
        ...state.busPositions,
        [busId]: {
          ...state.busPositions[busId],
          ...data,
        },
      },
    })),

  removeBusPosition: (busId) =>
    set((state) => {
      const next = { ...state.busPositions };
      delete next[busId];
      return { busPositions: next };
    }),

  setUserLocation: (lat, lng) =>
    set({ userLocation: { lat, lng } }),

  setUserProfile: (profile) =>
    set({ userProfile: profile }),

  clearUserProfile: () =>
    set({ userProfile: null }),

  addAlert: (alert) =>
    set((state) => ({
      activeAlerts: [...state.activeAlerts, alert],
    })),

  removeAlert: (alertId) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.filter((alert) => alert.id !== alertId),
    })),

  setSearchResults: (results) =>
    set({ searchResults: results }),

  setSavedRoutes: (routes) =>
    set({ savedRoutes: routes }),

  setSavedRoute: (route) =>
    set((state) => ({
      savedRoutes: [...state.savedRoutes, route],
    })),

  setSelectedBus: (bus) =>
    set({ selectedBus: bus }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  setDarkMode: (darkMode) =>
    set({ darkMode }),

  clearAll: () =>
    set({
      busPositions: {},
      userLocation: null,
      userProfile: null,
      activeAlerts: [],
      searchResults: [],
      savedRoutes: [],
      selectedBus: null,
      isLoading: false,
      darkMode: false,
    }),
}));

export default useCommuterStore;
