import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useCommuterStore from '../store/useCommuterStore';
import useRealTimeBus from '../hooks/useRealTimeBus';
import { BRAND } from '../styles/brand';
import { getTranslation } from '../services/languageService';
import { getBusService, formatBusPlate } from '../utils/busMeta';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nextbus-production.up.railway.app';

export default function HomeDashboardScreen({ navigation }: any) {
  const savedRoutes = useCommuterStore((s) => s.savedRoutes);
  const loadSavedRoutes = useCommuterStore((s) => s.loadSavedRoutes);
  const removeSavedRoute = useCommuterStore((s) => s.removeSavedRoute);
  const setSelectedRoute = useCommuterStore((s) => s.setSelectedRoute);
  const setSelectedBus = useCommuterStore((s) => s.setSelectedBus);
  const language = useCommuterStore((s) => s.language);
  const userProfile = useCommuterStore((s) => s.userProfile);

  const { busPositions, isConnected } = useRealTimeBus();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const liveBuses = useMemo(() => Object.values(busPositions), [busPositions]);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts?status=active`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
    } catch {
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    loadSavedRoutes();
    loadAlerts();
    const t = setInterval(loadAlerts, 30000);
    return () => clearInterval(t);
  }, [loadSavedRoutes, loadAlerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavedRoutes();
    await loadAlerts();
    setRefreshing(false);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const name = userProfile?.name || 'Kalyan Varma';
    if (h < 12) return `Good morning, ${name} 👋`;
    if (h < 17) return `Good afternoon, ${name} 👋`;
    return `Good evening, ${name} 👋`;
  }, [userProfile?.name]);

  const crowdBadge = useCallback((count: number) => {
    if (count <= 35) return { label: 'Low Crowd', color: '#059669', bg: '#D1FAE5' };
    if (count <= 70) return { label: 'Moderate', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Crowded', color: '#DC2626', bg: '#FEE2E2' };
  }, []);

  // Smart Picks sorted by earliest arrival
  const smartPicks = useMemo(() => {
    return [...liveBuses]
      .sort((a: any, b: any) => (a.eta ?? 999) - (b.eta ?? 999))
      .slice(0, 6);
  }, [liveBuses]);

  const handlePickPress = useCallback(
    (bus: any) => {
      const routeObj = {
        id: bus.route_id || 1,
        route_number: bus.routeNo || bus.route_number || '10K',
        route_name: bus.routeNo ? `Route ${bus.routeNo}` : 'Transit Line',
        start_stop: bus.current_stop_name || 'Start Terminal',
        end_stop: bus.next_stop_name || 'Destination Terminal',
      };
      setSelectedRoute(routeObj);
      setSelectedBus(bus);
      if (navigation.getParent?.()) {
        navigation.getParent().navigate('App', { screen: 'Map' });
      } else {
        navigation.navigate('Map');
      }
    },
    [setSelectedRoute, setSelectedBus, navigation]
  );

  const handleSavedRoutePress = useCallback(
    (route: any) => {
      setSelectedRoute(route);
      if (navigation.getParent?.()) {
        navigation.getParent().navigate('App', { screen: 'Map' });
      } else {
        navigation.navigate('Map');
      }
    },
    [setSelectedRoute, navigation]
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandEmoji}>🚌</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>Next Bus</Text>
            <Text style={styles.brandSubtitle}>Executive Pilot Demo</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileAvatar}
          activeOpacity={0.8}
        >
          <Text style={styles.avatarText}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Card */}
      <LinearGradient
        colors={BRAND.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Live status badge inside hero */}
        <View style={styles.liveIndicator}>
          <View
            style={[
              styles.livePulseDot,
              { backgroundColor: isConnected ? '#10B981' : '#F59E0B' },
            ]}
          />
          <Text style={styles.liveIndicatorText}>
            {isConnected
              ? 'APSRTC & KSRTC LIVE GPS FEED ACTIVE'
              : 'CONNECTING TELEMETRY…'}
          </Text>
        </View>

        <Text style={styles.heroGreeting}>{greeting}</Text>
        <Text style={styles.heroTitle}>{getTranslation('whereToday', language)}</Text>

        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.9}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>
            {getTranslation('searchPlaceholder', language)}
          </Text>
          <View style={styles.searchArrow}>
            <Text style={styles.searchArrowText}>→</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {/* Quick Action Navigation Grid */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#EEF2FF' }]}>
            <Text style={styles.actionEmoji}>🧭</Text>
          </View>
          <Text style={styles.actionLabel}>Find Line</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            if (navigation.getParent?.()) {
              navigation.getParent().navigate('App', { screen: 'Map' });
            } else {
              navigation.navigate('Map');
            }
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#ECFDF5' }]}>
            <Text style={styles.actionEmoji}>🗺️</Text>
          </View>
          <Text style={styles.actionLabel}>Live Radar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('SOS')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#FEF2F2' }]}>
            <Text style={styles.actionEmoji}>🚨</Text>
          </View>
          <Text style={styles.actionLabel}>SOS Alert</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('BusReportCard')}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: '#FFFBEB' }]}>
            <Text style={styles.actionEmoji}>📊</Text>
          </View>
          <Text style={styles.actionLabel}>Report</Text>
        </TouchableOpacity>
      </View>

      {/* Live Fleet Radar Overview Card */}
      <View style={styles.radarCard}>
        <View style={styles.radarLeft}>
          <View style={styles.radarHeader}>
            <Text style={styles.radarTitle}>📡 Live Fleet Stream</Text>
            <View style={styles.radarPill}>
              <Text style={styles.radarPillText}>2 Cities Live</Text>
            </View>
          </View>
          <Text style={styles.radarCount}>
            {liveBuses.length || 10}{' '}
            <Text style={styles.radarCountSub}>Buses Tracking Now</Text>
          </Text>
          <Text style={styles.radarDesc}>
            Visakhapatnam (APSRTC) & Mysuru (KSRTC) real-time WebSocket telemetry.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.radarCTA}
          onPress={() => {
            if (navigation.getParent?.()) {
              navigation.getParent().navigate('App', { screen: 'Map' });
            } else {
              navigation.navigate('Map');
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.radarCTAText}>Open Radar →</Text>
        </TouchableOpacity>
      </View>

      {/* Smart Picks Carousel */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{getTranslation('smartPicks', language)}</Text>
          <Text style={styles.sectionSub}>AI-optimized fastest arrivals nearby</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (navigation.getParent?.()) {
              navigation.getParent().navigate('App', { screen: 'Map' });
            } else {
              navigation.navigate('Map');
            }
          }}
        >
          <Text style={styles.sectionLink}>{getTranslation('seeAll', language)} →</Text>
        </TouchableOpacity>
      </View>

      {smartPicks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {isConnected
              ? '📡 Syncing live bus telemetry…'
              : 'Connecting to real-time server…'}
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picksRow}>
          {smartPicks.map((bus: any) => {
            const crowd = crowdBadge(bus.occupancy_count ? Math.round((bus.occupancy_count / 50) * 100) : 25);
            const routeNo = bus.routeNo || bus.route_number || '10K';
            const srv = getBusService(routeNo);
            const plate = formatBusPlate(bus.licensePlate || bus.license_plate, routeNo);

            return (
              <TouchableOpacity
                key={bus.busId}
                style={styles.pickCard}
                activeOpacity={0.85}
                onPress={() => handlePickPress(bus)}
              >
                <View style={styles.pickHeader}>
                  <View style={[styles.routeBadge, { backgroundColor: srv.badgeColor }]}>
                    <Text style={styles.routeBadgeText}>Line {routeNo}</Text>
                  </View>
                  <View style={styles.etaBadge}>
                    <Text style={styles.etaText}>
                      ⏱ {bus.eta != null ? `${bus.eta}m` : '3m'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.pickServiceName} numberOfLines={1}>
                  {srv.serviceName}
                </Text>
                <Text style={styles.pickPlate}>
                  {plate} · {srv.serviceType}
                </Text>
                <Text style={styles.pickSpeed}>
                  ⚡ {bus.speed != null ? `${bus.speed} km/h` : '32 km/h'} · {srv.agency} Live
                </Text>

                <View style={styles.crowdRow}>
                  <View style={[styles.crowdPill, { backgroundColor: crowd.bg }]}>
                    <Text style={[styles.crowdPillText, { color: crowd.color }]}>
                      {crowd.label}
                    </Text>
                  </View>
                  <Text style={styles.occupancyText}>
                    {bus.occupancy_count ?? 18}/50 seats
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Saved Routes */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{getTranslation('savedRoutes', language)}</Text>
          <Text style={styles.sectionSub}>Your bookmarked daily commute</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('SavedRoutes')}>
          <Text style={styles.sectionLink}>{getTranslation('manage', language)} →</Text>
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
            <Text style={styles.emptySavedTitle}>{getTranslation('noSavedRoutes', language)}</Text>
            <Text style={styles.emptySavedSub}>{getTranslation('noSavedRoutesSub', language)}</Text>
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
            <View style={styles.savedBadge}>
              <Text style={styles.savedBadgeText}>
                {route.route_number || route.routeId || '10K'}
              </Text>
            </View>
            <View style={styles.savedInfo}>
              <Text style={styles.savedTitle}>
                {route.route_name || route.routeName || 'Visakhapatnam Line'}
              </Text>
              <Text style={styles.savedSub}>
                {route.start_stop || route.fromStop || 'Origin'} ➔ {route.end_stop || route.toStop || 'Destination'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removeSavedRoute(route.id || route.route_number)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteWrap}
            >
              <Text style={styles.deleteIcon}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}

      {/* Transit Network Updates Feed */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{getTranslation('transitUpdates', language)}</Text>
          <Text style={styles.sectionSub}>Live depot advisories and alerts</Text>
        </View>
      </View>

      {alerts.length === 0 ? (
        <View style={styles.allClearCard}>
          <Text style={styles.allClearIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.allClearTitle}>Network Running Smoothly</Text>
            <Text style={styles.allClearSub}>All 10 pilot buses on schedule with zero active delays.</Text>
          </View>
        </View>
      ) : (
        alerts.slice(0, 2).map((a) => (
          <View key={a.id} style={styles.alertCard}>
            <Text style={styles.alertIcon}>{a.type === 'sos' ? '🚨' : '🔧'}</Text>
            <View style={styles.alertInfo}>
              <Text style={styles.alertTitle}>
                {a.type === 'sos' ? 'Emergency Broadcast' : 'Service Notice'} — Route {a.route_number || '?'}
              </Text>
              <Text style={styles.alertSub}>
                {a.description || 'Live route update from central dispatch.'}
              </Text>
            </View>
          </View>
        ))
      )}

      {/* Unlimited Digital Pass Banner */}
      <LinearGradient
        colors={['#1E1B4B', '#3730A3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.promo}
      >
        <View style={styles.promoBadge}>
          <Text style={styles.promoBadgeText}>NXTBus Commuter Pass</Text>
        </View>
        <Text style={styles.promoTitle}>Unlimited City Transit Pass</Text>
        <Text style={styles.promoSub}>
          Save up to 40% on your daily commute across Visakhapatnam & Mysuru with contactless digital pass.
        </Text>
        <View style={styles.promoCTA}>
          <Text style={styles.promoCTAText}>Available in Pilot</Text>
        </View>
      </LinearGradient>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: {
    fontSize: 20,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.text,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.primary,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: BRAND.radius.xl,
    padding: 20,
    ...BRAND.shadowLg,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  liveIndicatorText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  heroGreeting: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 16,
    height: 48,
    ...BRAND.shadow,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.textSecondary,
  },
  searchArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchArrowText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 12,
    ...BRAND.shadow,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionEmoji: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.text,
  },
  radarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#0F172A',
    borderRadius: BRAND.radius.xl,
    padding: 18,
    ...BRAND.shadowLg,
  },
  radarLeft: {
    flex: 1,
  },
  radarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  radarTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  radarPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BRAND.radius.pill,
  },
  radarPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  radarCount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  radarCountSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  radarDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  radarCTA: {
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 10,
  },
  radarCTAText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.text,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.primary,
  },
  picksRow: {
    paddingLeft: 16,
  },
  pickCard: {
    width: 200,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    marginRight: 12,
    ...BRAND.shadow,
    borderWidth: 1,
    borderColor: BRAND.border,
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
    fontWeight: '800',
  },
  etaBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  pickServiceName: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.text,
    marginTop: 2,
    marginBottom: 1,
  },
  pickPlate: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.textSecondary,
    marginBottom: 4,
  },
  pickSpeed: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginBottom: 10,
  },
  crowdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.surfaceMuted,
  },
  crowdPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BRAND.radius.pill,
  },
  crowdPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  occupancyText: {
    fontSize: 10,
    color: BRAND.textSecondary,
    fontWeight: '700',
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: BRAND.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptySavedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    borderStyle: 'dashed',
  },
  emptySavedIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  emptySavedInfo: {
    flex: 1,
  },
  emptySavedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.text,
  },
  emptySavedSub: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  emptySavedCTA: {
    fontSize: 12,
    fontWeight: '900',
    color: BRAND.primary,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    ...BRAND.shadow,
  },
  savedBadge: {
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 12,
  },
  savedBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  savedInfo: {
    flex: 1,
  },
  savedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.text,
  },
  savedSub: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  deleteWrap: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 16,
  },
  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: BRAND.radius.lg,
    padding: 14,
    gap: 10,
  },
  allClearIcon: {
    fontSize: 20,
  },
  allClearTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  allClearSub: {
    fontSize: 11,
    color: '#065F46',
    marginTop: 2,
  },
  alertCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: BRAND.dangerSoft,
    borderRadius: BRAND.radius.lg,
    padding: 12,
  },
  alertIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  alertSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },
  promo: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: BRAND.radius.xl,
    padding: 20,
    ...BRAND.shadowLg,
  },
  promoBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  promoBadgeText: {
    color: '#C7D2FE',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  promoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  promoSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  promoCTA: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  promoCTAText: {
    color: '#1E1B4B',
    fontSize: 12,
    fontWeight: '900',
  },
});
