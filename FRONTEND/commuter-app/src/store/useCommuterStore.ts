import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../services/languageService';

export type VehicleStatus = 'LIVE' | 'APPROACHING STOP' | 'AT STOP' | 'STALE' | 'SIGNAL LOST' | 'OFFLINE';

export interface StopEta {
  stop_id: number;
  stop_name: string;
  latitude: number;
  longitude: number;
  stop_order: number;
  eta_seconds: number | null;
}

export interface BusPosition {
  busId: string;
  trip_id?: number;
  route_id?: number;
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
  occupancy_count?: number;
  status?: VehicleStatus;
  nextStopIndex?: number;
  last_updated?: string;
  stop_etas?: StopEta[];
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface UserProfile {
  id?: string;
  phone: string;
  name: string;
  language: Language;
  avatar?: string;
}

export interface AlertItem {
  id: string;
  busId?: string;
  route_number?: string;
  route_name?: string;
  stopId?: string;
  stop_name?: string;
  thresholdMinutes?: number;
  mode?: 'ai' | 'custom';
  paused?: boolean;
  type?: 'sos' | 'breakdown' | 'custom' | 'ai';
  description?: string;
  created_at?: string;
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
  stops?: any[];
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  relation?: string;
  isEmergency?: boolean;
  initial?: string;
  tag?: string;
  color?: string;
}

export interface BusPass {
  id: string;
  type: 'Monthly' | 'Weekly' | 'Daily';
  title: string;
  price: number;
  purchaseDate: string;
  expiryDate: string;
  status: 'ACTIVE' | 'EXPIRED';
  qrCode: string;
}

export type SmartPickPreference = 'fastest' | 'least-crowded' | 'cheapest';

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

  // Active Bus Pass
  activePass: BusPass | null;

  // Alerts & Notifications
  activeAlerts: AlertItem[];
  pushEnabled: boolean;
  smartAlertsEnabled: boolean;
  lateNightModeEnabled: boolean;

  // Preferences
  smartPickPreference: SmartPickPreference;

  // Persisted Lists
  savedRoutes: RouteItem[];
  trustedContacts: TrustedContact[];
  searchResults: any[];

  // System UI
  isLoading: boolean;
  darkMode: boolean;
  language: Language;
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
  setActivePass: (pass: BusPass | null) => void;
  loadActivePass: () => Promise<void>;

  setUserLocation: (lat: number, lng: number) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  clearUserProfile: () => void;
  loginCommuter: (phone: string, name?: string) => void;
  logoutCommuter: () => void;
  setPendingPhone: (phone: string | null) => void;

  addAlert: (alert: AlertItem) => void;
  removeAlert: (alertId: string) => void;
  toggleAlertPause: (alertId: string) => void;
  loadActiveAlerts: () => Promise<void>;

  setPushEnabled: (enabled: boolean) => void;
  setSmartAlertsEnabled: (enabled: boolean) => void;
  setLateNightMode: (enabled: boolean) => void;
  setSmartPickPreference: (pref: SmartPickPreference) => void;

  setSavedRoutes: (routes: RouteItem[]) => void;
  addSavedRoute: (route: RouteItem) => void;
  removeSavedRoute: (routeId: number | string) => void;
  loadSavedRoutes: () => Promise<void>;

  setTrustedContacts: (contacts: TrustedContact[]) => void;
  addTrustedContact: (contact: TrustedContact) => void;
  updateTrustedContact: (contactId: string, data: Partial<TrustedContact>) => void;
  removeTrustedContact: (contactId: string) => void;
  loadTrustedContacts: () => Promise<void>;

  setSearchResults: (results: any[]) => void;
  setLoading: (isLoading: boolean) => void;
  setDarkMode: (darkMode: boolean) => void;
  setLanguage: (lang: Language) => void;
  completeOnboarding: () => void;
  loadInitialStorage: () => Promise<void>;
  clearAll: () => void;
}

const STORAGE_SAVED_ROUTES = '@nxtbus_saved_routes';
const STORAGE_CONTACTS = '@nxtbus_trusted_contacts';
const STORAGE_PROFILE = '@nxtbus_user_profile';
const STORAGE_ALERTS = '@nxtbus_active_alerts';
const STORAGE_PASS = '@nxtbus_active_pass';
const STORAGE_SETTINGS = '@nxtbus_user_settings';

const DEFAULT_CONTACTS: TrustedContact[] = [
  {
    id: 'contact_1',
    name: 'Mom',
    phone: '+91 98765 43210',
    relationship: 'Mother',
    relation: 'Mother',
    isEmergency: true,
    initial: 'M',
    tag: 'Primary Contact',
    color: '#7C3AED',
  },
  {
    id: 'contact_2',
    name: 'Dad',
    phone: '+91 98765 43211',
    relationship: 'Father',
    relation: 'Father',
    isEmergency: true,
    initial: 'D',
    tag: '+91 98765 43211',
    color: '#4F46E5',
  },
];

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

  activePass: null,

  activeAlerts: [
    {
      id: 'sub_10k',
      route_number: '10K',
      route_name: 'RTC Complex ↔ Kailasagiri',
      thresholdMinutes: 10,
      mode: 'ai',
      paused: false,
      description: 'Daily morning commute alert',
      created_at: new Date().toISOString(),
    },
  ],
  pushEnabled: true,
  smartAlertsEnabled: true,
  lateNightModeEnabled: false,
  smartPickPreference: 'fastest',

  savedRoutes: [],
  trustedContacts: DEFAULT_CONTACTS,
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

  setActivePass: (pass) => {
    set({ activePass: pass });
    if (pass) {
      AsyncStorage.setItem(STORAGE_PASS, JSON.stringify(pass)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_PASS).catch(() => {});
    }
  },

  loadActivePass: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_PASS);
      if (data) {
        set({ activePass: JSON.parse(data) });
      }
    } catch {}
  },

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
    set((state) => {
      const updated = [alert, ...state.activeAlerts.filter((a) => a.id !== alert.id)];
      AsyncStorage.setItem(STORAGE_ALERTS, JSON.stringify(updated)).catch(() => {});
      return { activeAlerts: updated };
    }),

  removeAlert: (alertId) =>
    set((state) => {
      const updated = state.activeAlerts.filter((a) => a.id !== alertId);
      AsyncStorage.setItem(STORAGE_ALERTS, JSON.stringify(updated)).catch(() => {});
      return { activeAlerts: updated };
    }),

  toggleAlertPause: (alertId) =>
    set((state) => {
      const updated = state.activeAlerts.map((a) =>
        a.id === alertId ? { ...a, paused: !a.paused } : a
      );
      AsyncStorage.setItem(STORAGE_ALERTS, JSON.stringify(updated)).catch(() => {});
      return { activeAlerts: updated };
    }),

  loadActiveAlerts: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_ALERTS);
      if (data) {
        set({ activeAlerts: JSON.parse(data) });
      }
    } catch {}
  },

  setPushEnabled: (enabled) => {
    set({ pushEnabled: enabled });
    AsyncStorage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({
        pushEnabled: enabled,
        smartAlertsEnabled: get().smartAlertsEnabled,
        darkMode: get().darkMode,
        language: get().language,
        smartPickPreference: get().smartPickPreference,
      })
    ).catch(() => {});
  },

  setSmartAlertsEnabled: (enabled) => {
    set({ smartAlertsEnabled: enabled });
    AsyncStorage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({
        pushEnabled: get().pushEnabled,
        smartAlertsEnabled: enabled,
        darkMode: get().darkMode,
        language: get().language,
        smartPickPreference: get().smartPickPreference,
      })
    ).catch(() => {});
  },

  setLateNightMode: (enabled) => set({ lateNightModeEnabled: enabled }),

  setSmartPickPreference: (pref) => {
    set({ smartPickPreference: pref });
    AsyncStorage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({
        pushEnabled: get().pushEnabled,
        smartAlertsEnabled: get().smartAlertsEnabled,
        darkMode: get().darkMode,
        language: get().language,
        smartPickPreference: pref,
      })
    ).catch(() => {});
  },

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

  setTrustedContacts: (contacts) => {
    set({ trustedContacts: contacts });
    AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(contacts)).catch(() => {});
  },

  addTrustedContact: (contact) => {
    const current = get().trustedContacts;
    if (current.length >= 5) return;
    const updated = [...current, contact];
    set({ trustedContacts: updated });
    AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch(() => {});
  },

  updateTrustedContact: (contactId, data) => {
    const current = get().trustedContacts;
    const updated = current.map((c) => (c.id === contactId ? { ...c, ...data } : c));
    set({ trustedContacts: updated });
    AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch(() => {});
  },

  removeTrustedContact: (contactId) => {
    const updated = get().trustedContacts.filter((c) => c.id !== contactId && c.phone !== contactId);
    set({ trustedContacts: updated });
    AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch(() => {});
  },

  loadTrustedContacts: async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_CONTACTS);
      if (data) {
        set({ trustedContacts: JSON.parse(data) });
      } else {
        set({ trustedContacts: DEFAULT_CONTACTS });
      }
    } catch {}
  },

  setSearchResults: (results) => set({ searchResults: results }),
  setLoading: (isLoading) => set({ isLoading }),

  setDarkMode: (darkMode) => {
    set({ darkMode });
    AsyncStorage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({
        pushEnabled: get().pushEnabled,
        smartAlertsEnabled: get().smartAlertsEnabled,
        darkMode,
        language: get().language,
        smartPickPreference: get().smartPickPreference,
      })
    ).catch(() => {});
  },

  setLanguage: (lang) => {
    set({ language: lang });
    AsyncStorage.setItem(
      STORAGE_SETTINGS,
      JSON.stringify({
        pushEnabled: get().pushEnabled,
        smartAlertsEnabled: get().smartAlertsEnabled,
        darkMode: get().darkMode,
        language: lang,
        smartPickPreference: get().smartPickPreference,
      })
    ).catch(() => {});
  },

  completeOnboarding: () => set({ hasOnboarded: true }),

  loadInitialStorage: async () => {
    try {
      const [routesData, contactsData, profileData, alertsData, passData, settingsData] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_SAVED_ROUTES),
          AsyncStorage.getItem(STORAGE_CONTACTS),
          AsyncStorage.getItem(STORAGE_PROFILE),
          AsyncStorage.getItem(STORAGE_ALERTS),
          AsyncStorage.getItem(STORAGE_PASS),
          AsyncStorage.getItem(STORAGE_SETTINGS),
        ]);

      if (routesData) set({ savedRoutes: JSON.parse(routesData) });
      if (contactsData) set({ trustedContacts: JSON.parse(contactsData) });
      if (profileData) {
        const profile = JSON.parse(profileData);
        set({ userProfile: profile, commuter: profile, isLoggedIn: true });
      }
      if (alertsData) set({ activeAlerts: JSON.parse(alertsData) });
      if (passData) set({ activePass: JSON.parse(passData) });
      if (settingsData) {
        const settings = JSON.parse(settingsData);
        set({
          pushEnabled: settings.pushEnabled ?? true,
          smartAlertsEnabled: settings.smartAlertsEnabled ?? true,
          darkMode: settings.darkMode ?? false,
          language: settings.language ?? 'en',
          smartPickPreference: settings.smartPickPreference ?? 'fastest',
        });
      }
    } catch (err) {
      console.error('Failed to hydrate store from AsyncStorage:', err);
    }
  },

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
      activePass: null,
      activeAlerts: [],
      savedRoutes: [],
      trustedContacts: DEFAULT_CONTACTS,
      searchResults: [],
      isLoading: false,
      darkMode: false,
    }),
}));

export default useCommuterStore;
