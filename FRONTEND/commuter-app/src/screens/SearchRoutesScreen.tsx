import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import { routeService } from '../services/routeService'
import { BRAND } from '../styles/brand'
import StopPicker from '../components/StopPicker'
import { groupStopsByCity, CityDef, CityStop } from '../utils/cities'

/**
 * Search & Trip Planner:
 * Searches real routes, stops, and live bus positions from the backend.
 *
 * Origin and destination are chosen from the real stop list for the selected
 * city rather than typed free-hand — a typo used to produce an unexplained
 * "no routes found", because the backend matches stop names with ILIKE.
 * Cities are derived from stop coordinates, and only cities that actually have
 * stops in the connected database are offered.
 */
export default function SearchRoutesScreen({ navigation }: any) {
  const [cities, setCities] = useState<{ city: CityDef; stops: CityStop[] }[]>([])
  const [cityId, setCityId] = useState<string | null>(null)
  const [from, setFrom] = useState<CityStop | null>(null)
  const [to, setTo] = useState<CityStop | null>(null)
  const [picking, setPicking] = useState<'from' | 'to' | null>(null)

  const [loadingStops, setLoadingStops] = useState(true)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const { setSelectedRoute, setSelectedBus, addSavedRoute } = useCommuterStore()

  // Load the stop master list once and bucket it into cities.
  useEffect(() => {
    let cancelled = false
    routeService
      .getStops()
      .then((rows) => {
        if (cancelled) return
        const grouped = groupStopsByCity(rows as any[])
        setCities(grouped)
        setCityId((current) => current ?? grouped[0]?.city.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setCities([])
      })
      .finally(() => {
        if (!cancelled) setLoadingStops(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeCity = useMemo(() => cities.find((c) => c.city.id === cityId), [cities, cityId])
  const cityStops = activeCity?.stops ?? []

  // Switching city invalidates a journey planned in the previous one.
  const handleCityChange = (id: string) => {
    if (id === cityId) return
    setCityId(id)
    setFrom(null)
    setTo(null)
    setResults(null)
  }

  const canSearch = !!from && !!to && from.stop_id !== to.stop_id

  const swapEnds = () => {
    setFrom(to)
    setTo(from)
    setResults(null)
  }

  const findRoutes = async () => {
    if (!canSearch) return
    setLoading(true)
    try {
      const res = await routeService.searchRoutes(from!.stop_name, to!.stop_name, 'fastest')
      setResults(res)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectRoute = (res: any) => {
    const routeObj = {
      id: res.route.id,
      route_number: res.route.route_number,
      route_name: res.route.route_name,
      start_stop: res.route.start_stop,
      end_stop: res.route.end_stop,
    }
    setSelectedRoute(routeObj)
    if (res.bus) {
      // Carry the full live state through, not just position. Dropping
      // stop_etas/status here made the map banner read "ETA unavailable" for a
      // bus that was in fact reporting ETAs.
      setSelectedBus({
        busId: String(res.bus.trip_id ?? res.bus.id ?? res.bus.license_plate),
        trip_id: res.bus.trip_id,
        route_id: res.route.id,
        lat: res.bus.latitude,
        lng: res.bus.longitude,
        routeNo: res.route.route_number,
        crowdLevel: Math.min(10, Math.round((res.bus.occupancy_count ?? 0) / 5)),
        speed: res.bus.speed,
        eta: res.eta ?? undefined,
        licensePlate: res.bus.license_plate,
        occupancy_count: res.bus.occupancy_count,
        nextStopIndex: res.bus.nextStopIndex,
        status: res.bus.status ?? 'LIVE',
        last_updated: res.bus.last_updated,
        stop_etas: res.bus.stop_etas ?? [],
      })
    }
    addSavedRoute(routeObj)
    navigation.navigate('Map')
  }

  const crowdLabel = (count: number) => {
    if (count <= 35) return { text: 'Low Crowd', color: BRAND.success }
    if (count <= 70) return { text: 'Medium Crowd', color: BRAND.warning }
    return { text: 'High Crowd', color: BRAND.danger }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>🚌 Next Bus</Text>
      </View>

      {/* Plan your trip card */}
      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Plan your trip</Text>
        <Text style={styles.planSub}>
          {activeCity
            ? `Find the quickest route across ${activeCity.city.name}.`
            : 'Choose a city to start planning.'}
        </Text>

        {/* City selector — only cities with stops in this database */}
        {loadingStops ? (
          <ActivityIndicator color={BRAND.primary} style={{ marginVertical: 14 }} />
        ) : cities.length === 0 ? (
          <Text style={styles.warn}>
            Could not load stops from the server. Check your connection and try again.
          </Text>
        ) : (
          <>
            <Text style={styles.fieldLabel}>CITY</Text>
            <View style={styles.cityRow}>
              {cities.map(({ city, stops }) => {
                const active = city.id === cityId
                return (
                  <TouchableOpacity
                    key={city.id}
                    style={[styles.cityChip, active && styles.cityChipActive]}
                    onPress={() => handleCityChange(city.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.cityEmoji}>{city.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cityName, active && styles.cityNameActive]}>{city.name}</Text>
                      <Text style={[styles.cityMeta, active && styles.cityMetaActive]}>
                        {city.region} · {stops.length} stops
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={styles.fieldLabel}>JOURNEY</Text>

            <TouchableOpacity
              style={styles.selectWrap}
              onPress={() => setPicking('from')}
              activeOpacity={0.8}
            >
              <Text style={styles.inputIcon}>🟢</Text>
              <Text style={[styles.selectText, !from && styles.selectPlaceholder]} numberOfLines={1}>
                {from ? from.stop_name : 'From — select boarding stop'}
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
                <Text style={styles.swapText}>⇅ Swap</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.selectWrap}
              onPress={() => setPicking('to')}
              activeOpacity={0.8}
            >
              <Text style={styles.inputIcon}>📍</Text>
              <Text style={[styles.selectText, !to && styles.selectPlaceholder]} numberOfLines={1}>
                {to ? to.stop_name : 'To — select destination stop'}
              </Text>
              <Text style={styles.chevron}>▾</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={findRoutes}
              activeOpacity={0.85}
              disabled={loading || !canSearch}
            >
              <LinearGradient
                colors={canSearch ? BRAND.gradient : ['#C7C9D9', '#B8BACB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.ctaText}>🧭  Find Routes</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </View>

      <StopPicker
        visible={picking === 'from'}
        title={`Boarding stop · ${activeCity?.city.name ?? ''}`}
        stops={cityStops}
        excludeStopId={to?.stop_id ?? null}
        onSelect={(s) => {
          setFrom(s)
          setPicking(null)
          setResults(null)
        }}
        onClose={() => setPicking(null)}
      />

      <StopPicker
        visible={picking === 'to'}
        title={`Destination · ${activeCity?.city.name ?? ''}`}
        stops={cityStops}
        excludeStopId={from?.stop_id ?? null}
        onSelect={(s) => {
          setTo(s)
          setPicking(null)
          setResults(null)
        }}
        onClose={() => setPicking(null)}
      />

      {/* Results */}
      {results !== null && (
        <>
          <Text style={styles.sectionLabel}>
            {results.length ? 'AVAILABLE ROUTES' : 'NO ROUTES FOUND'}
          </Text>
          {results.map((r: any, idx: number) => {
            const crowd = crowdLabel(r.crowd || 30)
            return (
              <TouchableOpacity
                key={r.route.id || idx}
                style={styles.resultCard}
                activeOpacity={0.85}
                onPress={() => handleSelectRoute(r)}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>Route {r.route.route_number}</Text>
                  </View>
                  <Text style={styles.resultEta}>
                    ⏱ {r.eta} min
                  </Text>
                </View>
                <Text style={styles.resultName}>{r.route.route_name}</Text>
                <Text style={styles.resultStops}>
                  {r.route.start_stop} ➔ {r.route.end_stop}
                </Text>
                <View style={styles.resultFooter}>
                  <Text style={[styles.crowdText, { color: crowd.color }]}>
                    👥 {crowd.text} ({r.crowd}%)
                  </Text>
                  <Text style={styles.fareTag}>₹{r.fare}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </>
      )}

      {/* Popular destinations — real stops from the selected city, not a
          hardcoded list that only made sense for one network. */}
      {cityStops.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>POPULAR IN {activeCity?.city.name.toUpperCase()}</Text>
          <View style={styles.chipsWrap}>
            {cityStops.slice(0, 8).map((s) => (
              <TouchableOpacity
                key={s.stop_id}
                style={styles.chip}
                onPress={() => {
                  setTo(s)
                  setResults(null)
                }}
              >
                <Text style={styles.chipText}>{s.stop_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Map preview */}
      <TouchableOpacity
        style={styles.mapPreview}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Map')}
      >
        <Text style={styles.mapPreviewEmoji}>🗺️</Text>
        <Text style={styles.mapPreviewText}>Explore Full City Map</Text>
      </TouchableOpacity>

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
  planCard: {
    margin: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 20,
    ...BRAND.shadow,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.text,
    letterSpacing: -0.3,
  },
  planSub: {
    fontSize: 13,
    color: BRAND.textSecondary,
    marginTop: 4,
    marginBottom: 18,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  inputIcon: {
    fontSize: 13,
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginBottom: 8,
    marginTop: 4,
  },
  cityRow: { gap: 8, marginBottom: 6 },
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
    height: 48,
  },
  selectText: { flex: 1, fontSize: 14, fontWeight: '600', color: BRAND.text },
  selectPlaceholder: { color: BRAND.textTertiary, fontWeight: '500' },
  chevron: { fontSize: 14, color: BRAND.textSecondary, marginLeft: 8 },
  swapRow: { alignItems: 'flex-end', paddingVertical: 6 },
  swapBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  swapText: { fontSize: 12, fontWeight: '700', color: BRAND.primary },
  warn: { fontSize: 13, color: BRAND.danger, fontWeight: '600', marginVertical: 12 },
  cta: {
    height: 50,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
  },
  resultCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    ...BRAND.shadow,
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
    paddingVertical: 5,
  },
  routeBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  resultEta: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.success,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.text,
  },
  resultStops: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crowdText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fareTag: {
    fontSize: 13,
    fontWeight: '800',
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
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.text,
  },
  mapPreview: {
    marginHorizontal: 16,
    marginTop: 20,
    height: 120,
    borderRadius: BRAND.radius.xl,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  mapPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.textSecondary,
  },
})
