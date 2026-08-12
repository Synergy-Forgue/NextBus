import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import useRealTimeBus from '../hooks/useRealTimeBus'
import { BRAND } from '../styles/brand'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nextbus-production.up.railway.app'

/**
 * Home Dashboard:
 * 1. Live greeting & real stats from live WebSocket stream & API
 * 2. Smart Picks (soonest arriving live buses — tapping establishes journey context)
 * 3. Saved Routes (Empty State if 0 saved, real routes if saved)
 * 4. Transit Alerts (Real active alerts from Railway backend)
 */
export default function HomeDashboardScreen({ navigation }: any) {
  const {
    savedRoutes,
    loadSavedRoutes,
    removeSavedRoute,
    setSelectedRoute,
    setSelectedBus,
  } = useCommuterStore()
  const { busPositions, isConnected } = useRealTimeBus()
  const [alerts, setAlerts] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const liveBuses = Object.values(busPositions)

  const loadAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts?status=active`)
      if (res.ok) {
        const data = await res.json()
        setAlerts(Array.isArray(data) ? data : [])
      }
    } catch {
      setAlerts([])
    }
  }

  useEffect(() => {
    loadSavedRoutes()
    loadAlerts()
    const t = setInterval(loadAlerts, 30000)
    return () => clearInterval(t)
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadSavedRoutes()
    await loadAlerts()
    setRefreshing(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const crowdLabel = (level: number) => {
    if (level <= 35) return { text: '😊 Low Crowd', color: BRAND.success }
    if (level <= 70) return { text: '😐 Medium Crowd', color: BRAND.warning }
    return { text: '🔥 High Crowd', color: BRAND.danger }
  }

  // Smart Picks: soonest arriving live buses first
  const smartPicks = [...liveBuses]
    .sort((a: any, b: any) => (a.eta ?? 999) - (b.eta ?? 999))
    .slice(0, 4)

  const handlePickPress = (bus: any) => {
    const routeObj = {
      id: bus.route_id || 1,
      route_number: bus.routeNo || '10K',
      route_name: `Route ${bus.routeNo || '10K'}`,
      start_stop: bus.current_stop_name || 'RTC Complex',
      end_stop: bus.next_stop_name || 'Kailasagiri',
    }
    setSelectedRoute(routeObj)
    setSelectedBus(bus)
    navigation.navigate('Map')
  }

  const handleSavedRoutePress = (route: any) => {
    setSelectedRoute(route)
    navigation.navigate('Map')
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>🚌 Next Bus</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.avatar}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Hero card */}
      <LinearGradient
        colors={BRAND.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroGreeting}>{greeting()}</Text>
        <Text style={styles.heroTitle}>Where to today?</Text>
        <TouchableOpacity
          style={styles.searchField}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.9}
        >
          <Text style={styles.searchPlaceholder}>
            🔍  Search destinations, lines, or stops
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick stats — Real dynamic data */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📍</Text>
          <Text style={styles.statValue}>{liveBuses.length}</Text>
          <Text style={styles.statLabel}>Active Buses</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⏱</Text>
          <Text style={styles.statValue}>{isConnected ? 'Live' : 'Connecting'}</Text>
          <Text style={styles.statLabel}>Network</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🚨</Text>
          <Text style={styles.statValue}>{alerts.length}</Text>
          <Text style={styles.statLabel}>Active Alerts</Text>
        </View>
      </View>

      {/* Smart Picks */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Smart Picks</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Map')}>
          <Text style={styles.sectionLink}>See all</Text>
        </TouchableOpacity>
      </View>

      {smartPicks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {isConnected
              ? 'Waiting for live bus positions…'
              : 'Connecting to live tracking server…'}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picksRow}>
          {smartPicks.map((bus: any) => {
            const crowd = crowdLabel(bus.crowdLevel || 20)
            return (
              <TouchableOpacity
                key={bus.busId}
                style={styles.pickCard}
                activeOpacity={0.85}
                onPress={() => handlePickPress(bus)}
              >
                <View style={styles.pickHeader}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>Bus {bus.routeNo}</Text>
                  </View>
                  {bus.eta != null && (
                    <Text style={styles.pickEta}>{bus.eta} min</Text>
                  )}
                </View>
                <Text style={styles.pickPlate}>{bus.licensePlate || bus.busId || 'Live bus'}</Text>
                <Text style={styles.pickSub}>
                  {bus.speed || 25} km/h · live tracking
                </Text>
                <Text style={[styles.pickCrowd, { color: crowd.color }]}>
                  {crowd.text}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Saved Routes — Semantic State Model (Empty vs Populated) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saved Routes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SavedRoutes')}>
          <Text style={styles.sectionLink}>Manage</Text>
        </TouchableOpacity>
      </View>

      {savedRoutes.length === 0 ? (
        <TouchableOpacity
          style={styles.emptySavedCard}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.85}
        >
          <Text style={styles.emptySavedIcon}>🔖</Text>
          <View style={styles.emptySavedInfo}>
            <Text style={styles.emptySavedTitle}>No saved routes yet</Text>
            <Text style={styles.emptySavedSub}>Search your daily route to bookmark it here</Text>
          </View>
          <Text style={styles.emptySavedCTA}>Search →</Text>
        </TouchableOpacity>
      ) : (
        savedRoutes.slice(0, 3).map((route: any, index: number) => (
          <TouchableOpacity
            key={route.id || index}
            style={styles.savedRow}
            onPress={() => handleSavedRoutePress(route)}
            activeOpacity={0.85}
          >
            <Text style={styles.savedIcon}>⭐</Text>
            <View style={styles.savedInfo}>
              <Text style={styles.savedTitle}>
                Route {route.route_number || route.routeId}: {route.route_name || route.routeName}
              </Text>
              <Text style={styles.savedSub}>
                {route.start_stop || route.fromStop || 'Start'} ➔ {route.end_stop || route.toStop || 'Destination'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeSavedRoute(route.id || route.route_number)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}

      {/* Transit Alerts — Real backend updates */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Transit Updates</Text>
      </View>
      {alerts.length === 0 ? (
        <View style={styles.allClearCard}>
          <Text style={styles.allClearText}>✅ All services running normally across Visakhapatnam</Text>
        </View>
      ) : (
        alerts.slice(0, 3).map((a) => (
          <View key={a.id} style={styles.alertCard}>
            <Text style={styles.alertIcon}>
              {a.type === 'sos' ? '🚨' : '🔧'}
            </Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>
                {a.type === 'sos' ? 'Emergency reported' : 'Service Alert'} — Route{' '}
                {a.route_number || '?'}
              </Text>
              <Text style={styles.alertSub}>
                {a.description || 'Service disruption reported on this route.'}
              </Text>
            </View>
          </View>
        ))
      )}

      {/* Promo card */}
      <LinearGradient
        colors={['#1E1B4B', '#312E81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.promo}
      >
        <Text style={styles.promoTag}>APSRTC Pass</Text>
        <Text style={styles.promoTitle}>Unlimited Monthly Pass</Text>
        <Text style={styles.promoSub}>
          Save up to 40% on your daily commute with the NXTBus Digital Pass.
        </Text>
        <View style={styles.promoBtn}>
          <Text style={styles.promoBtnText}>Available Soon</Text>
        </View>
      </LinearGradient>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: BRAND.surface,
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.text,
  },
  avatar: {
    fontSize: 22,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: BRAND.radius.xl,
    padding: 22,
  },
  heroGreeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  searchField: {
    backgroundColor: '#FFFFFF',
    borderRadius: BRAND.radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  searchPlaceholder: {
    color: BRAND.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
    ...BRAND.shadow,
  },
  statIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.text,
  },
  statLabel: {
    fontSize: 11,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.text,
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 13,
    color: BRAND.primary,
    fontWeight: '700',
  },
  picksRow: {
    paddingLeft: 16,
  },
  pickCard: {
    width: 190,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    marginRight: 12,
    ...BRAND.shadow,
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  routeBadge: {
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  routeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickEta: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.success,
  },
  pickPlate: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.text,
    marginBottom: 2,
  },
  pickSub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginBottom: 8,
  },
  pickCrowd: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: BRAND.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptySavedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderStyle: 'dashed',
  },
  emptySavedIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  emptySavedInfo: {
    flex: 1,
  },
  emptySavedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  emptySavedSub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  emptySavedCTA: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.primary,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    ...BRAND.shadow,
  },
  savedIcon: {
    fontSize: 20,
    marginRight: 14,
  },
  savedInfo: {
    flex: 1,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  savedSub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  deleteIcon: {
    fontSize: 16,
    paddingLeft: 10,
  },
  allClearCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.successSoft,
    borderRadius: BRAND.radius.lg,
    padding: 16,
  },
  allClearText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
  },
  alertCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: BRAND.dangerSoft,
    borderRadius: BRAND.radius.lg,
    padding: 14,
  },
  alertIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
  },
  alertSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  promo: {
    marginHorizontal: 16,
    marginTop: 26,
    borderRadius: BRAND.radius.xl,
    padding: 22,
  },
  promoTag: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  promoSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  promoBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  promoBtnText: {
    color: '#1E1B4B',
    fontSize: 13,
    fontWeight: '800',
  },
})
