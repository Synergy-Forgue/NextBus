import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BusPosition {
  busId: string;
  lat: number;
  lng: number;
  routeNo: string;
  crowdLevel: number;
  speed?: number;
  eta?: number;
  licensePlate?: string;
  route_number?: string;
  bus_number?: string;
  occupancy?: number;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface UserProfile {
  id?: string;
  phone: string;
  name: string;
  language: string;
  avatar?: string;
}

export interface Alert {
  id: string;
  busId?: string;
  stopId?: string;
  thresholdMinutes?: number;
  type?: string;
  description?: string;
  route_number?: string;
}

export interface RouteItem {
  id?: number | string;
  route_number: string;
  route_name?: string;
  name?: string;
  start_stop?: string;
  end_stop?: string;
  frequency?: number;
  lastUsed?: number;
  filterPreference?: 'fastest' | 'cheapest' | 'least-crowded';
}

export interface TrustedContact {
  id?: string;
  name: string;
  phone: string;
  relation?: string;
  initial?: string;
  tag?: string;
  color?: string;
}

interface CommuterStoreState {
  // Real-time Telemetry & Live Map
  busPositions: Record<string, BusPosition>;
  selectedBus: BusPosition | any | null;
  selectedRoute: RouteItem | any | null;
  selectedStop: any | null;

  // Journey Context
  activeTripId: number | string | null;
  tripSharingActive: boolean;

  // User Profile & Location
  userLocation: UserLocation | null;
  userProfile: UserProfile | null;
  commuter: UserProfile | null;
  isLoggedIn: boolean;
  pendingPhone: string | null;

  // Alerts & Notifications
  activeAlerts: Alert[];
  pushEnabled: boolean;
  smartAlertsEnabled: boolean;
  lateNightModeEnabled: boolean;

  // Persisted Lists
  savedRoutes: RouteItem[];
  trustedContacts: TrustedContact[];
  searchResults: any[];

  // System UI
  isLoading: boolean;
  darkMode: boolean;
  language: string;
  hasOnboarded: boolean;

  // Actions
  setBusPositions: (positions: Record<string, BusPosition>) => void;
  updateBusPosition: (busId: string, data: Partial<BusPosition>) => void;
  removeBusPosition: (busId: string) => void;
  setSelectedBus: (bus: any | null) => void;
  setSelectedRoute: (route: any | null) => void;
  setSelectedStop: (stop: any | null) => void;
  setActiveTripId: (tripId: number | string | null) => void;
  setTripSharingActive: (active: boolean) => void;

  setUserLocation: (lat: number, lng: number) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  clearUserProfile: () => void;
  loginCommuter: (phone: string, name?: string) => void;
  logoutCommuter: () => void;
  setPendingPhone: (phone: string | null) => void;

  addAlert: (alert: Alert) => void;
  removeAlert: (alertId: string) => void;
  setPushEnabled: (enabled: boolean) => void;
  setSmartAlertsEnabled: (enabled: boolean) => void;
  setLateNightMode: (enabled: boolean) => void;

  setSavedRoutes: (routes: RouteItem[]) => void;
  addSavedRoute: (route: RouteItem) => void;
  removeSavedRoute: (routeId: number | string) => void;
  loadSavedRoutes: () => Promise<void>;

  addTrustedContact: (contact: TrustedContact) => void;
  removeTrustedContact: (phone: string) => void;
  loadTrustedContacts: () => Promise<void>;

  setSearchResults: (results: any[]) => void;
  setLoading: (isLoading: boolean) => void;
  setDarkMode: (darkMode: boolean) => void;
  setLanguage: (lang: string) => void;
  completeOnboarding: () => void;
  clearAll: () => void;
}

const STORAGE_SAVED_ROUTES = '@nxtbus_saved_routes';
const STORAGE_CONTACTS = '@nxtbus_trusted_contacts';
const STORAGE_PROFILE = '@nxtbus_user_profile';

export const useCommuterStore = create<CommuterStoreState>((set, get) => ({
  // Initial State
  busPositions: {},
  selectedBus: null,
  selectedRoute: null,
  selectedStop: null,
  activeTripId: null,
  tripSharingActive: false,

  userLocation: null,
  userProfile: null,
  commuter: null,
  isLoggedIn: false,
  pendingPhone: null,

  activeAlerts: [],
  pushEnabled: true,
  smartAlertsEnabled: true,
  lateNightModeEnabled: false,

  savedRoutes: [],
  trustedContacts: [],
  searchResults: [],

  isLoading: false,
  darkMode: false,
  language: 'en',
  hasOnboarded: false,

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

  setSelectedBus: (bus) => set({ selectedBus: bus }),
  setSelectedRoute: (route) => set({ selectedRoute: route }),
  setSelectedStop: (stop) => set({ selectedStop: stop }),
  setActiveTripId: (tripId) => set({ activeTripId: tripId }),
  setTripSharingActive: (active) => set({ tripSharingActive: active }),

  setUserLocation: (lat, lng) => set({ userLocation: { lat, lng } }),

  setUserProfile: (profile) => {
    set({ userProfile: profile, commuter: profile, isLoggedIn: !!profile });
    if (profile) {
      AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_PROFILE).catch(() => {});
    }
  },

  clearUserProfile: () => {
    set({
      userProfile: null,
      commuter: null,
      isLoggedIn: false,
      selectedRoute: null,
      selectedBus: null,
      activeTripId: null,
      tripSharingActive: false,
    });
    AsyncStorage.removeItem(STORAGE_PROFILE).catch(() => {});
  },

  loginCommuter: (phone, name = 'Commuter') => {
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const profile: UserProfile = {
      id: `commuter_${cleanPhone}`,
      phone: cleanPhone,
      name,
      language: get().language,
      avatar: '👤',
    };
    get().setUserProfile(profile);
  },

  logoutCommuter: () => {
    get().clearUserProfile();
  },

  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  addAlert: (alert) =>
    set((state) => ({
      activeAlerts: [...state.activeAlerts, alert],
    })),

  removeAlert: (alertId) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.filter((a) => a.id !== alertId),
    })),

  setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
  setSmartAlertsEnabled: (enabled) => set({ smartAlertsEnabled: enabled }),
  setLateNightMode: (enabled) => set({ lateNightModeEnabled: enabled }),

  setSavedRoutes: (routes) => {
    set({ savedRoutes: routes });
    AsyncStorage.setItem(STORAGE_SAVED_ROUTES, JSON.stringify(routes)).catch(() => {});
  },

  addSavedRoute: (route) => {
    const current = get().savedRoutes;
    const exists = current.some((r) => r.id === route.id || r.route_number === route.route_number);
    if (exists) return;
    const updated = [...current, route];
    set({ savedRoutes: updated });
    AsyncStorage.setItem(STORAGE_SAVED_ROUTES, JSON.stringify(updated)).catch(() => {});
  },

  removeSavedRoute: (routeId) => {
    const updated = get().savedRoutes.filter((r) => r.id !== routeId && r.route_number !== String(routeId));
    set({ savedRoutes: updated });
    AsyncStorage.setItem(STORAGE_SAVED_ROUTES, JSON.stringify(updated)).catch(() => {});
  },

  loadSavedRoutes: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_SAVED_ROUTES);
      if (data) {
        set({ savedRoutes: JSON.parse(data) });
      }
    } catch {}
  },

  addTrustedContact: (contact) => {
    const current = get().trustedContacts;
    if (current.length >= 5) return;
    const updated = [...current, contact];
    set({ trustedContacts: updated });
    AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch(() => {});
  },

  removeTrustedContact: (phone) => {
    const updated = get().trustedContacts.filter((c) => c.phone !== phone);
    set({ trustedContacts: updated });
    AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch(() => {});
  },

  loadTrustedContacts: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_CONTACTS);
      if (data) {
        set({ trustedContacts: JSON.parse(data) });
      }
    } catch {}
  },

  setSearchResults: (results) => set({ searchResults: results }),
  setLoading: (isLoading) => set({ isLoading }),
  setDarkMode: (darkMode) => set({ darkMode }),
  setLanguage: (lang) => set({ language: lang }),
  completeOnboarding: () => set({ hasOnboarded: true }),

  clearAll: () =>
    set({
      busPositions: {},
      selectedBus: null,
      selectedRoute: null,
      selectedStop: null,
      activeTripId: null,
      userLocation: null,
      userProfile: null,
      commuter: null,
      isLoggedIn: false,
      activeAlerts: [],
      savedRoutes: [],
      trustedContacts: [],
      searchResults: [],
      isLoading: false,
      darkMode: false,
    }),
}));

export default useCommuterStore;
