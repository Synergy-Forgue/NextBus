import { create } from 'zustand';

export const useCommuterStore = create((set) => ({
  // Auth
  commuter: null,
  isLoggedIn: false,
  pendingPhone: null,

  // Trip & Location
  currentLocation: { lat: 17.7261, lng: 83.3085 },
  selectedRoute: null,
  selectedBus: null,
  activeTripId: null,

  // Safety
  trustedContacts: [],
  tripSharingActive: false,
  latNightModeEnabled: false,

  // Saved Routes
  savedRoutes: [],

  // Settings
  language: 'en',
  pushEnabled: true,
  smartAlertsEnabled: true,

  // Trip History (for Report Card)
  weeklyTrips: [],

  // Actions
  loginCommuter: (phone) => {
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    set({
      commuter: {
        phone: cleanPhone,
        name: 'Commuter',
        avatar: '👤',
      },
      isLoggedIn: true,
      pendingPhone: null,
    });
  },

  logoutCommuter: () => {
    set({
      commuter: null,
      isLoggedIn: false,
      selectedRoute: null,
      selectedBus: null,
      activeTripId: null,
      tripSharingActive: false,
    });
  },

  setPendingPhone: (phone) => set({ pendingPhone: phone }),

  setCurrentLocation: (lat, lng) => set({ currentLocation: { lat, lng } }),

  setSelectedRoute: (route) => set({ selectedRoute: route }),

  setSelectedBus: (bus) => set({ selectedBus: bus }),

  setActiveTripId: (tripId) => set({ activeTripId: tripId }),

  addTrustedContact: (contact) =>
    set((state) => ({
      trustedContacts: state.trustedContacts.length < 5 ? [...state.trustedContacts, contact] : state.trustedContacts,
    })),

  removeTrustedContact: (phone) =>
    set((state) => ({
      trustedContacts: state.trustedContacts.filter((c) => c.phone !== phone),
    })),

  setTripSharingActive: (active) => set({ tripSharingActive: active }),

  setLateNightMode: (enabled) => set({ latNightModeEnabled: enabled }),

  setSavedRoutes: (routes) => set({ savedRoutes: routes }),

  addSavedRoute: (route) =>
    set((state) => ({
      savedRoutes: state.savedRoutes.some((r) => r.id === route.id)
        ? state.savedRoutes
        : [...state.savedRoutes, route],
    })),

  setLanguage: (lang) => set({ language: lang }),

  setPushEnabled: (enabled) => set({ pushEnabled: enabled }),

  setSmartAlertsEnabled: (enabled) => set({ smartAlertsEnabled: enabled }),

  addWeeklyTrip: (trip) => set((state) => ({ weeklyTrips: [...state.weeklyTrips, trip] })),

  clearWeeklyTrips: () => set({ weeklyTrips: [] }),
}));
