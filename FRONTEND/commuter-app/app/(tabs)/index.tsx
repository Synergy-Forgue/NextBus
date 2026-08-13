import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore, BusPass } from '@/src/store/useCommuterStore';
import { BRAND } from '@/src/styles/brand';
import { routeService, RouteResult } from '@/src/services/routeService';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function HomeScreen() {
  const router = useRouter();
  const { commuter, savedRoutes, activePass, setActivePass, loadActivePass } = useCommuterStore();

  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [allResults, setAllResults] = useState<RouteResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [preference, setPreference] = useState<'fastest' | 'cheapest' | 'least-crowded'>('fastest');
  const [fleetStats, setFleetStats] = useState({ activeBuses: '--', avgWait: '--', avgOccupancy: '--' });

  // Pass Modal States
  const [showPassModal, setShowPassModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    loadAlerts();
    loadFleetStats();
    loadActivePass();
  }, []);

  const loadFleetStats = async () => {
    try {
      const fleet = await routeService.getFleet();
      const count = fleet.length;
      const avgOcc =
        count > 0
          ? Math.round(fleet.reduce((s, b) => s + (b.occupancy_count ?? b.occupancy ?? 0), 0) / count)
          : 0;
      setFleetStats({
        activeBuses: String(count),
        avgWait: count > 0 ? `${Math.max(2, Math.round(15 / count))}m` : 'N/A',
        avgOccupancy: `${avgOcc}%`,
      });
    } catch {}
  };

  const loadAlerts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`);
      setAlerts((res.data || []).slice(0, 3));
    } catch {}
  };

  const searchRoutes = async () => {
    if (!q.trim() && !from.trim() && !to.trim()) return;
    setLoading(true);
    try {
      const results = await routeService.searchRoutes({
        q: q.trim(),
        from: from.trim(),
        to: to.trim(),
        preference,
      });
      setAllResults(results);
      applyPreference(results, preference);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyPreference = (results: RouteResult[], pref: 'fastest' | 'cheapest' | 'least-crowded') => {
    let sorted = [...results];
    if (pref === 'fastest') {
      sorted.sort((a, b) => (a.eta ?? 999) - (b.eta ?? 999));
    } else if (pref === 'cheapest') {
      sorted.sort((a, b) => a.fare - b.fare);
    } else if (pref === 'least-crowded') {
      sorted.sort((a, b) => a.crowd - b.crowd);
    }
    setFilteredResults(sorted);
  };

  const handlePreferenceChange = (pref: 'fastest' | 'cheapest' | 'least-crowded') => {
    setPreference(pref);
    applyPreference(allResults, pref);
  };

  const handleSelectRoute = (result: RouteResult) => {
    useCommuterStore.getState().setSelectedRoute({
      id: result.route.id,
      route_number: result.route.route_number,
      route_name: result.route.route_name,
      start_stop: result.route.start_stop,
      end_stop: result.route.end_stop,
      filterPreference: preference,
      stops: result.stops,
    });
    if (result.bus) {
      useCommuterStore.getState().setSelectedBus({
        busId: String(result.bus.trip_id || result.bus.id || result.route.id),
        trip_id: result.bus.trip_id,
        route_id: result.route.id,
        lat: result.bus.latitude,
        lng: result.bus.longitude,
        routeNo: result.route.route_number,
        crowdLevel: Math.round(result.crowd / 10),
        speed: result.bus.speed,
        eta: result.eta ?? undefined,
        licensePlate: result.bus.license_plate,
        status: result.bus.status || (result.etaStatus === 'LIVE' ? 'LIVE' : 'OFFLINE'),
        stop_etas: result.bus.stop_etas || [],
      });
    }
    router.push('/(tabs)/map');
  };

  const handleBuyPass = (type: 'Monthly' | 'Weekly' | 'Daily', title: string, price: number) => {
    const now = new Date();
    const expiry = new Date();
    if (type === 'Monthly') expiry.setDate(now.getDate() + 30);
    else if (type === 'Weekly') expiry.setDate(now.getDate() + 7);
    else expiry.setDate(now.getDate() + 1);

    const newPass: BusPass = {
      id: `pass_${Date.now()}`,
      type,
      title,
      price,
      purchaseDate: now.toISOString(),
      expiryDate: expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'ACTIVE',
      qrCode: `NXTBUS-PASS-${type.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
    };
    setActivePass(newPass);
    setShowPassModal(false);
  };

  // Dynamic Greeting & Date
  const currentHour = new Date().getHours();
  const timeOfDayGreeting =
    currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';
  const userNameText = commuter?.name ? `, ${commuter.name}` : '';
  const greetingText = `${timeOfDayGreeting}${userNameText}! 👋`;
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greetingText}</Text>
          <Text style={styles.city}>Visakhapatnam • {formattedDate}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.avatar}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Fleet Overview Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Active Fleet', value: fleetStats.activeBuses, emoji: '🚌' },
          { label: 'Avg Wait', value: fleetStats.avgWait, emoji: '⏱️' },
          { label: 'Avg Crowd', value: fleetStats.avgOccupancy, emoji: '👥' },
        ].map((stat, i) => (
          <View key={i} style={styles.statCard}>
            <Text style={styles.statEmoji}>{stat.emoji}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Unified Search Box with q, from, to */}
      <View style={styles.searchBox}>
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>🔍</Text>
          <TextInput
            style={styles.input}
            placeholder="Route number, stop, or keyword..."
            placeholderTextColor={BRAND.textTertiary}
            value={q}
            onChangeText={setQ}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>📍</Text>
          <TextInput
            style={styles.input}
            placeholder="From (Boarding stop)..."
            placeholderTextColor={BRAND.textTertiary}
            value={from}
            onChangeText={setFrom}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.inputRow}>
          <Text style={styles.inputIcon}>🎯</Text>
          <TextInput
            style={styles.input}
            placeholder="To (Destination stop)..."
            placeholderTextColor={BRAND.textTertiary}
            value={to}
            onChangeText={setTo}
          />
        </View>
        <TouchableOpacity onPress={searchRoutes} disabled={loading} activeOpacity={0.8}>
          <LinearGradient
            colors={BRAND.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.searchBtn}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Find Bus Routes →</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* NO RESULTS - Empty State */}
      {(q || from || to) && !loading && allResults.length === 0 && (
        <View style={styles.section}>
          <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🚌</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: BRAND.text, marginBottom: 6, textAlign: 'center' }}>
              No routes found
            </Text>
            <Text style={{ fontSize: 13, color: BRAND.textSecondary, marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
              We couldn't find matching bus routes for your query. Try searching by route number (e.g. "10M") or stop name.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setQ('');
                setFrom('');
                setTo('');
                setAllResults([]);
                setFilteredResults([]);
              }}
              style={{
                backgroundColor: BRAND.primary,
                borderRadius: BRAND.radius.pill,
                paddingHorizontal: 24,
                paddingVertical: 10,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>🔄 Clear Search</Text>
            </TouchableOpacity>

            <View style={{ width: '100%', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: BRAND.textSecondary, marginBottom: 10 }}>💡 POPULAR SEARCHES</Text>
              {[
                { text: 'Route 10M (RTC Complex → Kailasagiri)', q: '10M' },
                { text: 'Route 6A (Railway Station → Maddilapalem)', q: '6A' },
                { text: 'RTC Complex Stops', q: 'RTC Complex' },
              ].map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setQ(item.q);
                    setFrom('');
                    setTo('');
                    routeService.searchRoutes({ q: item.q, preference }).then((res) => {
                      setAllResults(res);
                      applyPreference(res, preference);
                    });
                  }}
                  style={{ paddingVertical: 10, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: BRAND.border }}
                >
                  <Text style={{ color: BRAND.primary, fontSize: 13, fontWeight: '700' }}>📍 {item.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Preferences Filter Bar */}
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

      {/* Recommended Route */}
      {filteredResults.length > 0 && (
        <View style={styles.section}>
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 16 }}>
              <Text style={{ ...styles.sectionTitle, flex: 1, marginBottom: 0 }}>🎯 Recommended Route</Text>
              <View style={{ backgroundColor: BRAND.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>BEST</Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => handleSelectRoute(filteredResults[0])} activeOpacity={0.8}>
              <LinearGradient
                colors={BRAND.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  ...styles.routeCard,
                  marginHorizontal: 16,
                  marginBottom: 8,
                  borderWidth: 2,
                  borderColor: BRAND.primary,
                }}
              >
                <View style={styles.routeLeft}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ ...styles.routeNum, color: '#FFFFFF' }}>
                      🚌 Route {filteredResults[0].route.route_number}
                    </Text>
                    <View
                      style={{
                        backgroundColor: filteredResults[0].etaStatus === 'LIVE' ? '#10B981' : '#6B7280',
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>
                        {filteredResults[0].etaStatus === 'LIVE' ? '🟢 LIVE' : '🔘 SCHEDULED'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ ...styles.routeName, color: 'rgba(255,255,255,0.9)' }}>
                    {filteredResults[0].route.route_name}
                  </Text>
                  <Text style={{ ...styles.routeDistance, color: 'rgba(255,255,255,0.85)' }}>
                    {filteredResults[0].route.start_stop} → {filteredResults[0].route.end_stop} • {filteredResults[0].distance}km
                  </Text>
                </View>

                <View style={styles.routeStats}>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>⏱️</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>
                      {filteredResults[0].eta !== null ? `${filteredResults[0].eta}m` : 'N/A'}
                    </Text>
                  </View>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>👥</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>{filteredResults[0].crowd}%</Text>
                  </View>
                  <View style={{ ...styles.statBadge, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                    <Text style={styles.statBadgeEmoji}>💵</Text>
                    <Text style={{ ...styles.statBadgeText, color: '#FFFFFF' }}>₹{filteredResults[0].fare}</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Other Matching Options */}
          {filteredResults.length > 1 && (
            <View>
              <Text style={{ ...styles.sectionTitle, paddingHorizontal: 16 }}>Other Matching Routes</Text>
              {filteredResults.slice(1, 4).map((result, i) => (
                <TouchableOpacity key={i} onPress={() => handleSelectRoute(result)} activeOpacity={0.8}>
                  <View style={{ ...styles.routeCard, marginHorizontal: 16, marginBottom: 8 }}>
                    <View style={styles.routeLeft}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={styles.routeNum}>Route {result.route.route_number}</Text>
                        <View
                          style={{
                            backgroundColor: result.etaStatus === 'LIVE' ? '#10B981' : '#6B7280',
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>
                            {result.etaStatus === 'LIVE' ? 'LIVE' : 'SCHED'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.routeName}>{result.route.route_name}</Text>
                      <Text style={styles.routeDistance}>
                        {result.route.start_stop} → {result.route.end_stop} ({result.distance} km)
                      </Text>
                    </View>
                    <View style={styles.routeStats}>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeEmoji}>⏱️</Text>
                        <Text style={styles.statBadgeText}>{result.eta !== null ? `${result.eta}m` : 'N/A'}</Text>
                      </View>
                      <View style={[styles.statBadge, result.crowd > 70 ? styles.statBadgeHigh : styles.statBadgeLow]}>
                        <Text style={styles.statBadgeEmoji}>👥</Text>
                        <Text style={styles.statBadgeText}>{result.crowd}%</Text>
                      </View>
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeEmoji}>💵</Text>
                        <Text style={styles.statBadgeText}>₹{result.fare}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Saved Routes Quick Access */}
      {savedRoutes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Saved Routes</Text>
          {savedRoutes.slice(0, 3).map((route: any, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                useCommuterStore.getState().setSelectedRoute(route);
                router.push('/(tabs)/map');
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.routeCard, styles.savedRouteCard]}>
                <View style={styles.routeLeft}>
                  <Text style={styles.savedRouteName}>
                    Route {route.route_number || route.routeId} • {route.name || route.route_name || 'Frequent Route'}
                  </Text>
                  <Text style={styles.savedRouteFreq}>
                    {route.start_stop && route.end_stop ? `${route.start_stop} → ${route.end_stop}` : 'Frequent commuter route'}
                  </Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Transit Updates & Alerts */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transit Updates & Alerts</Text>
          {alerts.map((alert, i) => (
            <View key={i} style={[styles.alertCard, alert.type === 'sos' && styles.alertCardSOS]}>
              <Text style={styles.alertIcon}>{alert.type === 'sos' ? '🚨' : '⚠️'}</Text>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.type === 'sos' ? 'Emergency Alert' : 'Service Notice'}</Text>
                <Text style={styles.alertDesc}>{alert.description || 'Route ' + alert.route_number}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Dynamic Active Pass Card OR Purchase Banner */}
      {activePass ? (
        <View style={{ marginHorizontal: 16, marginBottom: 20 }}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoCard}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.promoTag}>ACTIVE PASS</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>🟢 VALID</Text>
                </View>
              </View>
              <Text style={styles.promoTitle}>{activePass.title}</Text>
              <Text style={styles.promoDesc}>Expires: {activePass.expiryDate}</Text>
              <TouchableOpacity
                onPress={() => setShowQrModal(true)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: BRAND.radius.pill,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  alignSelf: 'flex-start',
                  marginTop: 12,
                }}
              >
                <Text style={{ color: '#059669', fontWeight: '900', fontSize: 12 }}>📱 Show Bus Pass QR</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.promoEmoji}>🎟️</Text>
          </LinearGradient>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowPassModal(true)}
          style={{ marginHorizontal: 16, marginBottom: 20 }}
        >
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoCard}
          >
            <View>
              <Text style={styles.promoTag}>Save 30%</Text>
              <Text style={styles.promoTitle}>Monthly Bus Pass</Text>
              <Text style={styles.promoDesc}>Unlimited rides for ₹499/month</Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  borderRadius: BRAND.radius.pill,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  alignSelf: 'flex-start',
                  marginTop: 10,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>Buy Pass Now →</Text>
              </View>
            </View>
            <Text style={styles.promoEmoji}>🎟️</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* PASS PURCHASE MODAL */}
      <Modal visible={showPassModal} transparent animationType="slide" onRequestClose={() => setShowPassModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Bus Pass</Text>
              <TouchableOpacity onPress={() => setShowPassModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: BRAND.textSecondary, marginBottom: 16 }}>
              Select a pass to enjoy unlimited rides across Visakhapatnam smart transit network.
            </Text>

            {[
              { type: 'Monthly' as const, title: 'Monthly Commuter Pass', price: 499, desc: '30 Days unlimited travel' },
              { type: 'Weekly' as const, title: 'Weekly Explorer Pass', price: 149, desc: '7 Days unlimited travel' },
              { type: 'Daily' as const, title: 'Day Transit Pass', price: 49, desc: '24 Hours unlimited travel' },
            ].map((p, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleBuyPass(p.type, p.title, p.price)}
                style={styles.passOptionCard}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.passOptionTitle}>{p.title}</Text>
                  <Text style={styles.passOptionDesc}>{p.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.passOptionPrice}>₹{p.price}</Text>
                  <View style={styles.buyBadge}>
                    <Text style={styles.buyBadgeText}>SELECT</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* PASS QR MODAL */}
      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={{ ...styles.modalContainer, alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: BRAND.text, marginBottom: 4 }}>
              Active Bus Pass QR
            </Text>
            <Text style={{ fontSize: 13, color: BRAND.textSecondary, marginBottom: 20 }}>
              Show this QR code to the bus conductor or scanner
            </Text>

            <View style={{ backgroundColor: '#F3F4F6', padding: 24, borderRadius: 16, alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 64, letterSpacing: 4 }}>📱</Text>
              <Text style={{ fontSize: 14, fontWeight: '900', color: BRAND.text, marginTop: 8 }}>
                {activePass?.qrCode || 'NXTBUS-PASS-ACTIVE'}
              </Text>
              <Text style={{ fontSize: 12, color: BRAND.success, fontWeight: '800', marginTop: 4 }}>
                Status: VALID & ACTIVE
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowQrModal(false)}
              style={{
                backgroundColor: BRAND.primary,
                borderRadius: BRAND.radius.pill,
                paddingHorizontal: 28,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Close QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: { fontSize: 26, fontWeight: '900', color: BRAND.text, lineHeight: 34 },
  city: { fontSize: 13, color: BRAND.textSecondary, marginTop: 4 },
  avatar: { fontSize: 36, padding: 4 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    alignItems: 'center',
    ...BRAND.shadow,
  },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '900', color: BRAND.text },
  statLabel: { fontSize: 11, color: BRAND.textSecondary, marginTop: 2 },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, color: BRAND.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: BRAND.border, marginVertical: 8 },
  searchBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: BRAND.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: BRAND.textSecondary, marginBottom: 12, letterSpacing: 0.5 },
  routeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    marginBottom: 10,
    ...BRAND.shadow,
  },
  routeLeft: { flex: 1 },
  routeNum: { fontSize: 16, fontWeight: '900', color: BRAND.primary },
  routeName: { fontSize: 13, fontWeight: '700', color: BRAND.text, marginTop: 2 },
  routeDistance: { fontSize: 11, color: BRAND.textTertiary, marginTop: 4 },
  routeStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 140 },
  statBadge: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2,
  },
  statBadgeHigh: { backgroundColor: BRAND.dangerSoft },
  statBadgeLow: { backgroundColor: BRAND.successSoft },
  statBadgeEmoji: { fontSize: 12 },
  statBadgeText: { fontSize: 10, fontWeight: '700', color: BRAND.text },
  savedRouteCard: { backgroundColor: BRAND.surfaceMuted },
  savedRouteName: { fontSize: 14, fontWeight: '800', color: BRAND.text },
  savedRouteFreq: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  arrow: { fontSize: 18, color: BRAND.textTertiary },
  alertCard: {
    backgroundColor: BRAND.warningSoft,
    borderRadius: BRAND.radius.lg,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.warning,
  },
  alertCardSOS: { backgroundColor: BRAND.dangerSoft, borderLeftColor: BRAND.danger },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#7C2D12' },
  alertDesc: { fontSize: 12, color: '#92400E', marginTop: 2 },
  promoCard: {
    borderRadius: BRAND.radius.xl,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promoTag: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
  promoTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginTop: 4 },
  promoDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  promoEmoji: { fontSize: 44 },

  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: BRAND.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: BRAND.text },
  modalClose: { fontSize: 20, color: BRAND.textSecondary, fontWeight: '800' },
  passOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  passOptionTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text },
  passOptionDesc: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  passOptionPrice: { fontSize: 18, fontWeight: '900', color: BRAND.primary },
  buyBadge: {
    backgroundColor: BRAND.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  buyBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
});

