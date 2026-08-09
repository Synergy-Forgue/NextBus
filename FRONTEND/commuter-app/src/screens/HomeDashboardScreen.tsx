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

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * Home Dashboard (Figma): "Where to today?" header, quick stats,
 * Smart Picks (ranked from the LIVE fleet — nearest/soonest buses),
 * Saved Routes, Transit Alerts (live from /api/alerts), promo card.
 */
export default function HomeDashboardScreen({ navigation }: any) {
  const { userProfile } = useCommuterStore()
  const { busPositions, isConnected } = useRealTimeBus()
  const [alerts, setAlerts] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const liveBuses = Object.values(busPositions)

  const loadAlerts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts?status=active`)
      if (res.ok) setAlerts(await res.json())
    } catch {
      /* backend unreachable — leave list empty */
    }
  }

  useEffect(() => {
    loadAlerts()
    const t = setInterval(loadAlerts, 30000)
    return () => clearInterval(t)
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
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
    if (level <= 3) return { text: '😊 Low Crowd', color: BRAND.success }
    if (level <= 7) return { text: '😐 Medium Crowd', color: BRAND.warning }
    return { text: '🔥 High Crowd', color: BRAND.danger }
  }

  // Smart Picks: soonest-arriving live buses first
  const smartPicks = [...liveBuses]
    .sort((a: any, b: any) => (a.eta ?? 999) - (b.eta ?? 999))
    .slice(0, 4)

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

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📍</Text>
          <Text style={styles.statValue}>{liveBuses.length}</Text>
          <Text style={styles.statLabel}>Nearby</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⏱</Text>
          <Text style={styles.statValue}>94%</Text>
          <Text style={styles.statLabel}>On-time</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🚌</Text>
          <Text style={styles.statValue}>{liveBuses.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
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
              ? 'Waiting for live buses…'
              : 'Connecting to live tracking…'}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picksRow}>
          {smartPicks.map((bus: any) => {
            const crowd = crowdLabel(bus.crowdLevel)
            return (
              <TouchableOpacity
                key={bus.busId}
                style={styles.pickCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Map')}
              >
                <View style={styles.pickHeader}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>Bus {bus.routeNo}</Text>
                  </View>
                  {bus.eta != null && (
                    <Text style={styles.pickEta}>{bus.eta} min</Text>
                  )}
                </View>
                <Text style={styles.pickPlate}>{bus.licensePlate || 'Live bus'}</Text>
                <Text style={styles.pickSub}>
                  {bus.speed} km/h · live tracking
                </Text>
                <Text style={[styles.pickCrowd, { color: crowd.color }]}>
                  {crowd.text}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Saved Routes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saved Routes</Text>
      </View>
      <TouchableOpacity
        style={styles.savedRow}
        onPress={() => navigation.navigate('SavedRoutes')}
      >
        <Text style={styles.savedIcon}>🏠</Text>
        <View style={styles.savedInfo}>
          <Text style={styles.savedTitle}>Home → Office</Text>
          <Text style={styles.savedSub}>Tap to manage your saved routes</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Transit Alerts — live from the backend alerts pipeline */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Transit Alerts</Text>
      </View>
      {alerts.length === 0 ? (
        <View style={styles.allClearCard}>
          <Text style={styles.allClearText}>✅ All services running normally</Text>
        </View>
      ) : (
        alerts.slice(0, 3).map((a) => (
          <View key={a.id} style={styles.alertCard}>
            <Text style={styles.alertIcon}>
              {a.type === 'sos' ? '🚨' : '🔧'}
            </Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>
                {a.type === 'sos' ? 'Emergency reported' : 'Bus breakdown'} — Route{' '}
                {a.route_number || '?'}
              </Text>
              <Text style={styles.alertSub}>
                {a.description || 'Service may be affected on this route.'}
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
        <Text style={styles.promoTag}>Exclusive Offer</Text>
        <Text style={styles.promoTitle}>Unlimited Monthly Pass</Text>
        <Text style={styles.promoSub}>
          Save up to 40% on your daily commute with the Premium Pass.
        </Text>
        <View style={styles.promoBtn}>
          <Text style={styles.promoBtnText}>Coming Soon</Text>
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
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    ...BRAND.shadow,
  },
  savedIcon: {
    fontSize: 22,
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
  chevron: {
    fontSize: 22,
    color: BRAND.textTertiary,
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
