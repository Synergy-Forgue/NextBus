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
import { searchRoutes } from '../api/apiClient'
import { BRAND } from '../styles/brand'

/**
 * Search & Trip Planner (Figma): "Plan your trip" From/To card,
 * Find Routes CTA, popular destination chips, results with live buses.
 */
const POPULAR = ['RTC Complex', 'RK Beach', 'Kailasagiri', 'Jagadamba', 'Bheemili', 'Gajuwaka']

export default function SearchRoutesScreen({ navigation }: any) {
  const [from, setFrom] = useState('Current Location')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)

  const findRoutes = async () => {
    setLoading(true)
    const res = await searchRoutes(from, to, 'FASTEST')
    setResults(res.success ? res.data : [])
    setLoading(false)
  }

  const crowdLabel = (count: number) => {
    if (count <= 15) return { text: 'Low Crowd', color: BRAND.success }
    if (count <= 35) return { text: 'Medium Crowd', color: BRAND.warning }
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
            placeholder="From"
            placeholderTextColor={BRAND.textTertiary}
          />
        </View>

        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>📍</Text>
          <TextInput
            style={styles.input}
            value={to}
            onChangeText={setTo}
            placeholder="To: Enter destination"
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
          {results.map((r: any) => {
            const live = r.liveBus
            const crowd = live ? crowdLabel(live.occupancy_count) : null
            const eta = live?.stop_etas?.find((s: any) => s.eta_seconds != null)
            return (
              <TouchableOpacity
                key={r.id}
                style={styles.resultCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Map')}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.routeBadge}>
                    <Text style={styles.routeBadgeText}>{r.route_number}</Text>
                  </View>
                  {eta && (
                    <Text style={styles.resultEta}>
                      {Math.max(1, Math.round(eta.eta_seconds / 60))} min
                    </Text>
                  )}
                </View>
                <Text style={styles.resultName}>{r.route_name}</Text>
                <View style={styles.resultFooter}>
                  {live ? (
                    <>
                      <Text style={[styles.crowdText, { color: crowd!.color }]}>
                        👥 {crowd!.text}
                      </Text>
                      <Text style={styles.liveTag}>● LIVE</Text>
                    </>
                  ) : (
                    <Text style={styles.offlineTag}>No bus running right now</Text>
                  )}
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
            onPress={() => setTo(p)}
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
        <Text style={styles.mapPreviewText}>Explore City Map</Text>
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
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
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
  liveTag: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.success,
  },
  offlineTag: {
    fontSize: 12,
    color: BRAND.textTertiary,
    fontWeight: '600',
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
    height: 140,
    borderRadius: BRAND.radius.xl,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  mapPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.textSecondary,
  },
})
