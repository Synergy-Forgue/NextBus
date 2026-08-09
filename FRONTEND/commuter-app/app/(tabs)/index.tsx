import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Picker } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';
import { routeService } from '@/src/services/routeService';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function HomeScreen() {
  const router = useRouter();
  const { commuter, savedRoutes, addSavedRoute, selectedRoute } = useCommuterStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allResults, setAllResults] = useState<any[]>([]); // ALL routes from search
  const [filteredResults, setFilteredResults] = useState<any[]>([]); // Filtered by preference
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [preference, setPreference] = useState<'fastest' | 'cheapest' | 'least-crowded'>('fastest');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`);
      setAlerts((res.data || []).slice(0, 3));
    } catch {}
  };

  // SPEC: AI analyzes routes and suggests BEST option
  const searchRoutes = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      // Get all routes for the journey
      const results = await routeService.searchRoutes(from, to, 'fastest');
      setAllResults(results);

      // Apply current preference filter
      applyPreference(results, preference);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply preference filter and sort
  const applyPreference = (results: any[], pref: 'fastest' | 'cheapest' | 'least-crowded') => {
    let sorted = [...results];
    if (pref === 'fastest') {
      sorted.sort((a, b) => a.eta - b.eta);
    } else if (pref === 'cheapest') {
      sorted.sort((a, b) => a.fare - b.fare);
    } else if (pref === 'least-crowded') {
      sorted.sort((a, b) => a.crowd - b.crowd);
    }
    setFilteredResults(sorted);
  };

  // When preference changes, re-filter
  const handlePreferenceChange = (pref: 'fastest' | 'cheapest' | 'least-crowded') => {
    setPreference(pref);
    applyPreference(allResults, pref);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Where to today?</Text>
          <Text style={styles.city}>Visakhapatnam • {new Date().toLocaleDateString('en-US', { weekday: 'short' })}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.avatar}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Active Buses', value: '15', emoji: '🚌' },
          { label: 'Avg Wait', value: '3m', emoji: '⏱️' },
          { label: 'Occupancy', value: '62%', emoji: '👥' },
        ].map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.statEmoji}>{stat.emoji}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchBox}>
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>📍</Text>
          <TextInput style={styles.input} placeholder="From..." placeholderTextColor={BRAND.textTertiary} value={from} onChangeText={setFrom} />
        </View>
        <View style={styles.divider} />
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>🎯</Text>
          <TextInput style={styles.input} placeholder="To..." placeholderTextColor={BRAND.textTertiary} value={to} onChangeText={setTo} />
        </View>
        <TouchableOpacity onPress={searchRoutes} disabled={loading} activeOpacity={0.8}>
          <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.searchBtn}>
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.searchBtnText}>Find Routes →</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* NO RESULTS - Empty State */}
      {from && to && !loading && allResults.length === 0 && (
        <View style={styles.section}>
          <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🚌</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: BRAND.text, marginBottom: 8, textAlign: 'center' }}>No buses available</Text>
            <Text style={{ fontSize: 13, color: BRAND.textSecondary, marginBottom: 24, textAlign: 'center', lineHeight: 20 }}>
              We couldn't find any buses for this route right now. Try a different time or change your destination.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setFrom('');
                setTo('');
                setAllResults([]);
                setFilteredResults([]);
              }}
              style={{
                backgroundColor: BRAND.primary,
                borderRadius: BRAND.radius.pill,
                paddingHorizontal: 24,
                paddingVertical: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>🔄 New Search</Text>
            </TouchableOpacity>

            <View style={{ width: '100%', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: BRAND.textSecondary, marginBottom: 12 }}>💡 TRY THESE POPULAR ROUTES</Text>
              {['RTC Complex → Kailasagiri', 'Bheemili → Railway Station', 'Kothavalasa → RK Beach'].map((route, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    const [f, t] = route.split(' → ');
                    setFrom(f);
                    setTo(t);
                  }}
                  style={{ paddingVertical: 10, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: BRAND.border }}
                >
                  <Text style={{ color: BRAND.primary, fontSize: 13, fontWeight: '700' }}>📍 {route}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* SPEC: Filter by Preference (Crowd, Fare, Time) */}
      {allResults.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>Filter by preference:</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {['fastest', 'cheapest', 'least-crowded'].map((pref) => (
              <TouchableOpacity
                key={pref}
                onPress={() => handlePreferenceChange(pref as any)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 16,
                  backgroundColor: preference === pref ? BRAND.primary : BRAND.surface,
                  borderWidth: preference === pref ? 0 : 1.5,
                  borderColor: preference === pref ? 'transparent' : BRAND.border,
                }}
              >
                <Text style={{ color: preference === pref ? '#FFF' : BRAND.text, fontWeight: '700', fontSize: 12 }}>
                  {pref === 'fastest' ? '⏱️ Fastest' : pref === 'cheapest' ? '💰 Cheapest' : '👥 Least Crowded'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* SPEC: "AI suggests best option" - Show RECOMMENDED first */}
      {filteredResults.length > 0 && (
        <View style={styles.section}>
          {/* BEST/RECOMMENDED OPTION */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 16 }}>
              <Text style={{ ...styles.sectionTitle, flex: 1, marginBottom: 0 }}>🎯 Our Recommendation</Text>
              <View style={{ backgroundColor: BRAND.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>BEST</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                useCommuterStore.getState().setSelectedRoute(filteredResults[0].route);
                useCommuterStore.getState().setSelectedRoute({ ...filteredResults[0].route, filterPreference: preference });
                addSavedRoute(filteredResults[0].route);
                router.push('/(tabs)/map');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...styles.routeCard, marginHorizontal: 16, marginBottom: 8, borderWidth: 2, borderColor: BRAND.primary }}>
                <View style={styles.routeLeft}>
                  <Text style={{ ...styles.routeNum, color: '#FFFFFF' }}>🚌 Route {filteredResults[0].route.route_number}</Text>
                  <Text style={{ ...styles.routeName, color: 'rgba(255,255,255,0.9)' }}>{filteredResults[0].route.route_name}</Text>
                  <Text style={{ ...styles.routeDistance, color: 'rgba(255,255,255,0.85)' }}>Best for {preference === 'fastest' ? 'speed' : preference === 'cheapest' ? 'budget' : 'comfort'} • {filteredResults[0].distance}km</Text>
                </View>
                <View style={styles.routeStats}>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>⏱️</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>{filteredResults[0].eta}m</Text>
                  </View>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>👥</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>{filteredResults[0].crowd}%</Text>
                  </View>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>💵</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>₹{filteredResults[0].fare}</Text>
                  </View>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>{filteredResults[0].femaleOnly ? '♀️' : '—'}</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>{filteredResults[0].femaleOnly ? 'Yes' : 'No'}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* OTHER OPTIONS (3-4 more) */}
          {filteredResults.length > 1 && (
            <View>
              <Text style={{ ...styles.sectionTitle, paddingHorizontal: 16 }}>Other Options</Text>
              {filteredResults.slice(1, 4).map((result, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    useCommuterStore.getState().setSelectedRoute({ ...result.route, filterPreference: preference });
                    addSavedRoute(result.route);
                    router.push('/(tabs)/map');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ ...styles.routeCard, marginHorizontal: 16, marginBottom: 8, opacity: 0.7 }}>
                    <View style={styles.routeLeft}>
                      <Text style={styles.routeNum}>Route {result.route.route_number}</Text>
                      <Text style={styles.routeName}>{result.route.route_name}</Text>
                      <Text style={styles.routeDistance}>Distance: {result.distance} km</Text>
                    </View>
                    <View style={styles.routeStats}>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeEmoji}>⏱️</Text>
                        <Text style={styles.statBadgeText}>{result.eta}m</Text>
                      </View>
                      <View style={[styles.statBadge, result.crowd > 70 ? styles.statBadgeHigh : result.crowd > 40 ? styles.statBadgeCrowd : styles.statBadgeLow]}>
                        <Text style={styles.statBadgeEmoji}>👥</Text>
                        <Text style={styles.statBadgeText}>{result.crowd}%</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeEmoji}>💵</Text>
                        <Text style={styles.statBadgeText}>₹{result.fare}</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeEmoji}>{result.femaleOnly ? '♀️' : '—'}</Text>
                        <Text style={styles.statBadgeText}>{result.femaleOnly ? 'Yes' : 'No'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {savedRoutes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Saved Routes</Text>
          {savedRoutes.map((route, i) => (
            <TouchableOpacity key={i} onPress={() => { useCommuterStore.getState().setSelectedRoute(route); router.push('/(tabs)/map'); }} activeOpacity={0.8}>
              <View style={[styles.routeCard, styles.savedRouteCard]}>
                <View style={styles.routeLeft}>
                  <Text style={styles.savedRouteName}>{route.name || route.route_name}</Text>
                  <Text style={styles.savedRouteFreq}>Frequent • Last used today</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transit Updates</Text>
          {alerts.map((alert, i) => (
            <View key={i} style={[styles.alertCard, alert.type === 'sos' && styles.alertCardSOS]}>
              <Text style={styles.alertIcon}>{alert.type === 'sos' ? '🚨' : '⚠️'}</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.type === 'sos' ? 'Emergency' : 'Breakdown'}</Text>
                <Text style={styles.alertDesc}>{alert.description || 'Route ' + alert.route_number}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity activeOpacity={0.8} style={{ marginHorizontal: 16 }}>
        <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promoCard}>
          <View><Text style={styles.promoTag}>Save 30%</Text><Text style={styles.promoTitle}>Monthly Bus Pass</Text><Text style={styles.promoDesc}>Unlimited rides for ₹499/month</Text></View>
          <Text style={styles.promoEmoji}>🎟️</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  greeting: { fontSize: 32, fontWeight: '900', color: BRAND.text, lineHeight: 40 },
  city: { fontSize: 13, color: BRAND.textSecondary, marginTop: 4 },
  avatar: { fontSize: 40, padding: 8 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, alignItems: 'center', ...BRAND.shadow },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '900', color: BRAND.text },
  statLabel: { fontSize: 11, color: BRAND.textSecondary, marginTop: 2 },
  searchBox: { marginHorizontal: 16, marginBottom: 24, backgroundColor: BRAND.surface, borderRadius: BRAND.radius.xl, padding: 16, ...BRAND.shadow },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: BRAND.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: BRAND.border, marginVertical: 14 },
  searchBtn: { marginTop: 14, height: 48, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  searchBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: BRAND.textSecondary, marginBottom: 12, letterSpacing: 0.5 },
  routeCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, ...BRAND.shadow },
  routeLeft: { flex: 1 },
  routeNum: { fontSize: 16, fontWeight: '900', color: BRAND.primary },
  routeName: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  routeDistance: { fontSize: 11, color: BRAND.textTertiary, marginTop: 4 },
  routeStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 140 },
  statBadge: { backgroundColor: BRAND.surfaceMuted, borderRadius: BRAND.radius.md, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', gap: 2 },
  statBadgeCrowd: { backgroundColor: BRAND.warningSoft },
  statBadgeHigh: { backgroundColor: BRAND.dangerSoft },
  statBadgeLow: { backgroundColor: BRAND.successSoft },
  statBadgeEmoji: { fontSize: 12 },
  statBadgeText: { fontSize: 10, fontWeight: '700', color: BRAND.text },
  savedRouteCard: { backgroundColor: BRAND.surfaceMuted },
  savedRouteName: { fontSize: 15, fontWeight: '800', color: BRAND.text },
  savedRouteFreq: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  arrow: { fontSize: 18, color: BRAND.textTertiary },
  alertCard: { backgroundColor: BRAND.warningSoft, borderRadius: BRAND.radius.lg, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12, borderLeftWidth: 4, borderLeftColor: BRAND.warning },
  alertCardSOS: { backgroundColor: BRAND.dangerSoft, borderLeftColor: BRAND.danger },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#7C2D12' },
  alertDesc: { fontSize: 12, color: '#92400E', marginTop: 2 },
  promoCard: { borderRadius: BRAND.radius.xl, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16 },
  promoTag: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  promoTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  promoDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  promoEmoji: { fontSize: 48 },
});
