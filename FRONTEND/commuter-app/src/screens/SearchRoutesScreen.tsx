import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useCommuterStore from '../store/useCommuterStore';
import { routeService } from '../services/routeService';
import { BRAND } from '../styles/brand';
import StopPicker from '../components/StopPicker';
import { groupStopsByCity, CityDef, CityStop } from '../utils/cities';
import { getTranslation } from '../services/languageService';
import { getBusService } from '../utils/busMeta';

export default function SearchRoutesScreen({ navigation }: any) {
  const [cities, setCities] = useState<{ city: CityDef; stops: CityStop[] }[]>([]);
  const [cityId, setCityId] = useState<string | null>(null);
  const [from, setFrom] = useState<CityStop | null>(null);
  const [to, setTo] = useState<CityStop | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);

  const [loadingStops, setLoadingStops] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const {
    setSelectedRoute,
    setSelectedBus,
    addSavedRoute,
    busPositions,
    language,
    smartPickPreference,
  } = useCommuterStore();

  useEffect(() => {
    let cancelled = false;
    routeService
      .getStops()
      .then((rows) => {
        if (cancelled) return;
        const grouped = groupStopsByCity(rows as any[]);
        setCities(grouped);
        setCityId((current) => current ?? grouped[0]?.city.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStops(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCity = useMemo(() => cities.find((c) => c.city.id === cityId), [cities, cityId]);
  const cityStops = activeCity?.stops ?? [];

  const handleCityChange = (id: string) => {
    if (id === cityId) return;
    setCityId(id);
    setFrom(null);
    setTo(null);
    setResults(null);
  };

  const canSearch = !!from && !!to && from.stop_id !== to.stop_id;

  const swapEnds = () => {
    setFrom(to);
    setTo(from);
    setResults(null);
  };

  const findRoutes = async () => {
    if (!canSearch) return;
    setLoading(true);
    try {
      const res = await routeService.searchRoutes(from!.stop_name, to!.stop_name, smartPickPreference);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoute = (res: any) => {
    const routeObj = {
      id: res.route.id,
      route_number: res.route.route_number,
      route_name: res.route.route_name,
      start_stop: res.route.start_stop,
      end_stop: res.route.end_stop,
    };
    setSelectedRoute(routeObj);

    // Match live bus from telemetry
    const matchedBus =
      Object.values(busPositions).find(
        (b) => b.route_id === res.route.id || b.routeNo === res.route.route_number
      ) || res.bus;

    if (matchedBus) {
      setSelectedBus({
        busId: String(matchedBus.trip_id ?? matchedBus.busId ?? matchedBus.id ?? '1'),
        trip_id: matchedBus.trip_id,
        route_id: res.route.id,
        lat: matchedBus.lat || matchedBus.latitude,
        lng: matchedBus.lng || matchedBus.longitude,
        routeNo: res.route.route_number,
        crowdLevel: Math.min(10, Math.round((matchedBus.occupancy_count ?? 20) / 5)),
        speed: matchedBus.speed,
        eta: res.eta ?? matchedBus.eta,
        licensePlate: matchedBus.licensePlate || matchedBus.license_plate,
        occupancy_count: matchedBus.occupancy_count,
        nextStopIndex: matchedBus.nextStopIndex,
        status: matchedBus.status ?? 'LIVE',
        last_updated: matchedBus.last_updated,
        stop_etas: matchedBus.stop_etas ?? [],
      });
    }

    addSavedRoute(routeObj);
    if (navigation.getParent?.()) {
      navigation.getParent().navigate('App', { screen: 'Map' });
    } else {
      navigation.navigate('Map');
    }
  };

  const crowdBadge = (count: number) => {
    if (count <= 35) return { label: 'Low Crowd', color: '#059669', bg: '#D1FAE5' };
    if (count <= 70) return { label: 'Moderate', color: '#D97706', bg: '#FEF3C7' };
    return { label: 'Crowded', color: '#DC2626', bg: '#FEE2E2' };
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>🧭  {getTranslation('planYourTrip', language)}</Text>
      </View>

      {/* Journey Configuration Card */}
      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Find Transit Routes</Text>
        <Text style={styles.planSub}>
          {activeCity
            ? `Real-time routing across ${activeCity.city.name} Network.`
            : 'Select a city network to begin.'}
        </Text>

        {loadingStops ? (
          <ActivityIndicator color={BRAND.primary} style={{ marginVertical: 16 }} />
        ) : (
          <>
            <Text style={styles.fieldLabel}>SELECT CITY NETWORK</Text>
            <View style={styles.cityRow}>
              {cities.map(({ city, stops }) => {
                const active = city.id === cityId;
                return (
                  <TouchableOpacity
                    key={city.id}
                    style={[styles.cityChip, active && styles.cityChipActive]}
                    onPress={() => handleCityChange(city.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.cityEmoji}>{city.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, active && styles.cityNameActive]}>
                        {city.name}
                      </Text>
                      <Text style={[styles.cityMeta, active && styles.cityMetaActive]}>
                        {city.region} · {stops.length} Stops
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>JOURNEY STOPS</Text>

            {/* Boarding Stop */}
            <TouchableOpacity
              style={styles.selectWrap}
              onPress={() => setPicking('from')}
              activeOpacity={0.8}
            >
              <Text style={styles.inputIcon}>🟢</Text>
              <Text style={[styles.selectText, !from && styles.selectPlaceholder]} numberOfLines={1}>
                {from ? from.stop_name : 'Choose Boarding Stop…'}
              </Text>
              <Text style={styles.chevron}>▾</Text>
            </TouchableOpacity>

            <View style={styles.swapRow}>
              <TouchableOpacity
                style={styles.swapBtn}
                onPress={swapEnds}
                disabled={!from && !to}
                activeOpacity={0.8}
              >
                <Text style={styles.swapText}>⇅ Swap Direction</Text>
              </TouchableOpacity>
            </View>

            {/* Destination Stop */}
            <TouchableOpacity
              style={styles.selectWrap}
              onPress={() => setPicking('to')}
              activeOpacity={0.8}
            >
              <Text style={styles.inputIcon}>📍</Text>
              <Text style={[styles.selectText, !to && styles.selectPlaceholder]} numberOfLines={1}>
                {to ? to.stop_name : 'Choose Destination Stop…'}
              </Text>
              <Text style={styles.chevron}>▾</Text>
            </TouchableOpacity>

            {/* Search CTA */}
            <TouchableOpacity
              onPress={findRoutes}
              activeOpacity={0.85}
              disabled={loading || !canSearch}
            >
              <LinearGradient
                colors={canSearch ? BRAND.gradient : ['#CBD5E1', '#94A3B8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.ctaText}>🔍  Search Available Buses</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Stop Pickers */}
      <StopPicker
        visible={picking === 'from'}
        title={`Boarding Stop · ${activeCity?.city.name ?? ''}`}
        stops={cityStops}
        excludeStopId={to?.stop_id ?? null}
        onSelect={(s) => {
          setFrom(s);
          setPicking(null);
          setResults(null);
        }}
        onClose={() => setPicking(null)}
      />

      <StopPicker
        visible={picking === 'to'}
        title={`Destination · ${activeCity?.city.name ?? ''}`}
        stops={cityStops}
        excludeStopId={from?.stop_id ?? null}
        onSelect={(s) => {
          setTo(s);
          setPicking(null);
          setResults(null);
        }}
        onClose={() => setPicking(null)}
      />

      {/* Search Results */}
      {results !== null && (
        <>
          <Text style={styles.sectionLabel}>
            {results.length
              ? `AVAILABLE DIRECT ROUTES (${results.length})`
              : 'NO DIRECT ROUTES FOUND'}
          </Text>

          {results.length === 0 ? (
            <View style={styles.noResultsCard}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
              <Text style={styles.noResultsTitle}>No direct route between these stops</Text>
              <Text style={styles.noResultsSub}>
                Try selecting major interchange terminals such as{' '}
                {activeCity?.city.name === 'Mysuru'
                  ? 'City Bus Stand or Suburb Bus Stand'
                  : 'RTC Complex, Railway Station, or Maddilapalem'}.
              </Text>
            </View>
          ) : (
            results.map((r: any, idx: number) => {
              const crowd = crowdBadge(r.crowd || 30);
              const srv = getBusService(r.route.route_number);

              return (
                <TouchableOpacity
                  key={r.route.id || idx}
                  style={styles.resultCard}
                  activeOpacity={0.85}
                  onPress={() => handleSelectRoute(r)}
                >
                  <View style={styles.resultHeader}>
                    <View style={[styles.routeBadge, { backgroundColor: srv.badgeColor }]}>
                      <Text style={styles.routeBadgeText}>Line {r.route.route_number}</Text>
                    </View>
                    <View style={styles.etaBadge}>
                      <Text style={styles.etaText}>⏱ {r.eta} min arrival</Text>
                    </View>
                  </View>

                  <Text style={styles.resultName}>{srv.serviceName}</Text>
                  <Text style={styles.resultStops}>
                    {r.route.start_stop} ➔ {r.route.end_stop}
                  </Text>
                  <Text style={styles.serviceCategoryTag}>
                    {srv.serviceType} · {srv.agency} · Every {srv.frequencyMins} mins
                  </Text>

                  {r.route.direction === 'reverse' && (
                    <Text style={styles.returnTag}>↩ Return Direction</Text>
                  )}

                  <View style={styles.resultFooter}>
                    <View style={[styles.crowdPill, { backgroundColor: crowd.bg }]}>
                      <Text style={[styles.crowdPillText, { color: crowd.color }]}>
                        {crowd.label} ({r.crowd}%)
                      </Text>
                    </View>
                    <Text style={styles.fareTag}>₹{r.fare || srv.fareStarting} Standard Fare</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}

      {/* Popular Stops Shortcuts */}
      {cityStops.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>
            POPULAR TERMINALS IN {activeCity?.city.name.toUpperCase()}
          </Text>
          <View style={styles.chipsWrap}>
            {cityStops.slice(0, 8).map((s) => (
              <TouchableOpacity
                key={s.stop_id}
                style={styles.chip}
                onPress={() => {
                  setTo(s);
                  setResults(null);
                }}
              >
                <Text style={styles.chipText}>{s.stop_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Map Explorer Preview */}
      <TouchableOpacity
        style={styles.mapPreview}
        activeOpacity={0.9}
        onPress={() => {
          if (navigation.getParent?.()) {
            navigation.getParent().navigate('App', { screen: 'Map' });
          } else {
            navigation.navigate('Map');
          }
        }}
      >
        <Text style={styles.mapPreviewEmoji}>🗺️</Text>
        <Text style={styles.mapPreviewText}>Explore Full Interactive City Map →</Text>
      </TouchableOpacity>

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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: BRAND.surface,
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    color: BRAND.text,
  },
  planCard: {
    margin: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 20,
    ...BRAND.shadowLg,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.text,
    letterSpacing: -0.3,
  },
  planSub: {
    fontSize: 13,
    color: BRAND.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginBottom: 8,
    marginTop: 6,
  },
  cityRow: { gap: 8, marginBottom: 8 },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cityChipActive: {
    borderColor: BRAND.primary,
    backgroundColor: '#EEF2FF',
  },
  cityEmoji: { fontSize: 20 },
  cityName: { fontSize: 14, fontWeight: '800', color: BRAND.text },
  cityNameActive: { color: BRAND.primary },
  cityMeta: { fontSize: 11, color: BRAND.textSecondary, marginTop: 1 },
  cityMetaActive: { color: BRAND.primary },
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 16,
    height: 50,
  },
  inputIcon: { fontSize: 13, marginRight: 10 },
  selectText: { flex: 1, fontSize: 14, fontWeight: '700', color: BRAND.text },
  selectPlaceholder: { color: BRAND.textTertiary, fontWeight: '500' },
  chevron: { fontSize: 14, color: BRAND.textSecondary, marginLeft: 8 },
  swapRow: { alignItems: 'flex-end', paddingVertical: 4 },
  swapBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  swapText: { fontSize: 12, fontWeight: '800', color: BRAND.primary },
  cta: {
    height: 52,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 24,
    alignItems: 'center',
    ...BRAND.shadow,
  },
  noResultsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.text,
  },
  noResultsSub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  resultCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeBadge: {
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  resultName: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.text,
  },
  resultStops: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
    marginBottom: 4,
  },
  serviceCategoryTag: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.primary,
    marginBottom: 8,
  },
  returnTag: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.warning,
    marginBottom: 6,
  },
  resultFooter: {
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
  fareTag: {
    fontSize: 13,
    fontWeight: '900',
    color: BRAND.primary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.text,
  },
  mapPreview: {
    marginHorizontal: 16,
    marginTop: 18,
    height: 90,
    borderRadius: BRAND.radius.xl,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  mapPreviewText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.primary,
  },
});
