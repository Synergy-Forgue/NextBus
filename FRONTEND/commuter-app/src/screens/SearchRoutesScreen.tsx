import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import { routeService } from '../services/routeService'
import { BRAND } from '../styles/brand'

/**
 * Search & Trip Planner:
 * Searches real routes, stops, and live bus positions from Railway backend.
 * Selecting a route establishes the Journey Context in useCommuterStore and
 * navigates directly to the live contextual map.
 */
const POPULAR = ['RTC Complex', 'RK Beach', 'Kailasagiri', 'Jagadamba', 'Bheemili', 'Gajuwaka']

export default function SearchRoutesScreen({ navigation }: any) {
  const [from, setFrom] = useState('RTC Complex')
  const [to, setTo] = useState('Kailasagiri')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const { setSelectedRoute, setSelectedBus, addSavedRoute } = useCommuterStore()

  const findRoutes = async () => {
    setLoading(true)
    try {
      const res = await routeService.searchRoutes(from, to, 'fastest')
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
      setSelectedBus({
        busId: res.bus.id || res.bus.license_plate,
        lat: res.bus.latitude,
        lng: res.bus.longitude,
        routeNo: res.route.route_number,
        speed: res.bus.speed,
        eta: res.eta,
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
          Find the quickest route across Visakhapatnam.
        </Text>

        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>🟢</Text>
          <TextInput
            style={styles.input}
            value={from}
            onChangeText={setFrom}
            placeholder="From (e.g. RTC Complex)"
            placeholderTextColor={BRAND.textTertiary}
          />
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>📍</Text>
          <TextInput
            style={styles.input}
            value={to}
            onChangeText={setTo}
            placeholder="To: Enter destination (e.g. Kailasagiri)"
            placeholderTextColor={BRAND.textTertiary}
          />
        </View>

        <TouchableOpacity onPress={findRoutes} activeOpacity={0.85} disabled={loading}>
          <LinearGradient
            colors={BRAND.gradient}
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
      </View>

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

      {/* Popular destinations */}
      <Text style={styles.sectionLabel}>POPULAR DESTINATIONS</Text>
      <View style={styles.chipsWrap}>
        {POPULAR.map((p) => (
          <TouchableOpacity
            key={p}
            style={styles.chip}
            onPress={() => {
              setTo(p)
              findRoutes()
            }}
          >
            <Text style={styles.chipText}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.text,
  },
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
