import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/src/styles/brand';
import { routeService, Route, Bus } from '@/src/services/routeService';
import { useCommuterStore } from '@/src/store/useCommuterStore';

export default function ExploreScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [fleet, setFleet] = useState<Bus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allRoutes, fleetBuses] = await Promise.all([
        routeService.getRoutes(),
        routeService.getFleet(),
      ]);
      setRoutes(allRoutes);
      setFilteredRoutes(allRoutes);
      setFleet(fleetBuses);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const cleanText = text.trim();
    if (!cleanText) {
      setFilteredRoutes(routes);
      return;
    }

    try {
      const results = await routeService.searchByQuery(cleanText);
      if (results.length > 0) {
        setFilteredRoutes(results.map((r) => r.route));
      } else {
        const lower = cleanText.toLowerCase();
        setFilteredRoutes(
          routes.filter(
            (r) =>
              r.route_number.toLowerCase().includes(lower) ||
              r.route_name.toLowerCase().includes(lower) ||
              r.start_stop.toLowerCase().includes(lower) ||
              r.end_stop.toLowerCase().includes(lower)
          )
        );
      }
    } catch {
      const lower = cleanText.toLowerCase();
      setFilteredRoutes(
        routes.filter(
          (r) =>
            r.route_number.toLowerCase().includes(lower) ||
            r.route_name.toLowerCase().includes(lower) ||
            r.start_stop.toLowerCase().includes(lower) ||
            r.end_stop.toLowerCase().includes(lower)
        )
      );
    }
  };

  const handleRoutePress = (route: Route) => {
    useCommuterStore.getState().setSelectedRoute({
      id: route.id,
      route_number: route.route_number,
      route_name: route.route_name,
      start_stop: route.start_stop,
      end_stop: route.end_stop,
    });
    const liveBus = fleet.find((b) => b.route_id === route.id || b.bus_number === route.route_number);
    if (liveBus) {
      useCommuterStore.getState().setSelectedBus({
        busId: String(liveBus.trip_id || liveBus.id || route.id),
        trip_id: liveBus.trip_id,
        route_id: route.id,
        lat: liveBus.latitude,
        lng: liveBus.longitude,
        routeNo: route.route_number,
        crowdLevel: Math.round((liveBus.occupancy_count ?? liveBus.occupancy ?? 10) / 5),
        speed: liveBus.speed,
        licensePlate: liveBus.license_plate,
        status: liveBus.status || 'LIVE',
        stop_etas: liveBus.stop_etas || [],
      });
    }
    router.push('/(tabs)/map');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <Text style={styles.title}>Discover Routes</Text>
        <Text style={styles.subtitle}>Explore bus routes & stops across Visakhapatnam</Text>
      </LinearGradient>

      {/* Keyword Search Input */}
      <View style={styles.searchBarContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search route number, name, or stop..."
          placeholderTextColor={BRAND.textTertiary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={{ fontSize: 16, color: BRAND.textSecondary, fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>
          {searchQuery ? `SEARCH RESULTS (${filteredRoutes.length})` : `ALL AVAILABLE ROUTES (${routes.length})`}
        </Text>
        {loading ? (
          <ActivityIndicator color={BRAND.primary} size="large" style={{ marginVertical: 32 }} />
        ) : filteredRoutes.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>🚌</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: BRAND.text, marginBottom: 4 }}>
              No matching routes found
            </Text>
            <Text style={{ fontSize: 13, color: BRAND.textSecondary }}>
              Try searching by route number (e.g. "10M") or stop name
            </Text>
          </View>
        ) : (
          filteredRoutes.map((route) => {
            const hasLiveBus = fleet.some((b) => b.route_id === route.id || b.bus_number === route.route_number);
            return (
              <TouchableOpacity key={route.id} activeOpacity={0.8} onPress={() => handleRoutePress(route)}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.routeNumber}>Route {route.route_number}</Text>
                      <View
                        style={{
                          backgroundColor: hasLiveBus ? '#10B981' : '#6B7280',
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>
                          {hasLiveBus ? '🟢 LIVE' : '🔘 SCHEDULED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.routeArrow}>→</Text>
                  </View>
                  <Text style={styles.cardTitle}>{route.route_name}</Text>
                  <Text style={styles.cardDesc}>
                    {route.start_stop} → {route.end_stop}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  banner: { paddingHorizontal: 20, paddingVertical: 28 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    marginHorizontal: 16,
    marginTop: -16,
    marginBottom: 16,
    borderRadius: BRAND.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...BRAND.shadow,
  },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: BRAND.text, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginTop: 8, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: BRAND.textSecondary, marginBottom: 12 },
  card: { backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, ...BRAND.shadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeNumber: { fontSize: 16, fontWeight: '900', color: BRAND.primary },
  routeArrow: { fontSize: 18, color: BRAND.textTertiary },
  cardTitle: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginTop: 4, marginBottom: 2 },
  cardDesc: { fontSize: 12, color: BRAND.textSecondary },
});

