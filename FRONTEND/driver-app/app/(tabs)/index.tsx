import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDriverStore } from '../../src/store/driverStore';
import { useRealTimeLocation } from '../../src/hooks/useRealTimeLocation';
import { useTelemetry } from '../../src/hooks/useTelemetry';
import tripService from '../../src/services/tripService';
import { BRAND } from '../../src/styles/brand';

/**
 * Home (Figma): gradient header with Route/Status/GPS chips,
 * Trip Control (one-tap Start/End → real backend), Crew on Duty,
 * Quick Actions. GPS Ping (spec 01) runs SILENTLY here — the telemetry
 * hook publishes every location fix while a trip is active.
 */
export default function Home() {
  const router = useRouter();
  const {
    driver,
    bus,
    route,
    conductor,
    isOnline,
    activeTripId,
    setActiveTripId,
    occupancy,
    goOnline,
    goOffline,
  } = useDriverStore();

  const tripActive = !!activeTripId;
  const { location } = useRealTimeLocation(tripActive || isOnline);
  const telemetry = useTelemetry(activeTripId, location, occupancy);
  const [busy, setBusy] = useState(false);

  const startTrip = async () => {
    if (!driver || !route) {
      Alert.alert('Error', 'Driver or route not set');
      return;
    }
    setBusy(true);
    try {
      const cleanPhone = (driver.phone || '').replace(/\D/g, '').slice(-10);
      const trip = await tripService.startTrip(route.number, cleanPhone);
      const tripId = trip.id || trip.trip_id;
      if (tripId) {
        setActiveTripId(tripId);
        goOnline();
        Alert.alert('Trip started', `Trip #${tripId} is live — GPS tracking active.`);
      } else {
        Alert.alert('Error', 'Invalid trip ID returned from server.');
      }
    } catch (err: any) {
      console.error('Trip start error:', err);
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Backend unreachable.'
      );
    } finally {
      setBusy(false);
    }
  };

  const endTrip = async () => {
    if (!activeTripId) return;
    setBusy(true);
    try {
      await tripService.endTrip(activeTripId);
      setActiveTripId(null);
      goOffline();
      Alert.alert('Trip ended', 'Trip marked completed.');
    } catch (err: any) {
      console.error('Trip end error:', err);
      Alert.alert(
        'Error',
        err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Backend unreachable.'
      );
    } finally {
      setBusy(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const initials = (name?: string) =>
    (name || 'D')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const actions = [
    { icon: '📄', bg: '#EEF2FF', title: 'Trip Log', sub: "View today's trips", go: () => router.push('/(tabs)/trip-log') },
    { icon: '📡', bg: BRAND.successSoft, title: 'Depot Radio', sub: 'Contact control room', go: () => Linking.openURL('tel:1912') },
    { icon: '⚠️', bg: BRAND.warningSoft, title: 'Breakdown', sub: 'Report bus issue', go: () => router.push('/breakdown') },
    { icon: '🛡️', bg: BRAND.dangerSoft, title: 'Driver SOS', sub: 'Emergency alert', go: () => router.push('/driver-sos') },
    { icon: '🎫', bg: BRAND.surfaceMuted, title: 'Ticket Scan', sub: 'Phase 2 · Offline', go: () => router.push('/ticket-scan') },
    { icon: '🔗', bg: '#EEF2FF', title: 'Pair Conductor', sub: 'Show trip QR', go: () => router.push('/pairing') },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Gradient header */}
      <LinearGradient
        colors={BRAND.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{driver?.name || 'Driver'}</Text>
            <Text style={styles.meta}>
              {driver?.phone || '—'} · {bus?.regNo || 'BUS001'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/(tabs)/alerts')}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipValue}>{route?.number || '10K'}</Text>
            <Text style={styles.chipLabel}>Route</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipValue}>{tripActive ? 'On Trip' : 'Ready'}</Text>
            <Text style={styles.chipLabel}>Status</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipValue}>
              {telemetry.status === 'LIVE'
                ? 'LIVE'
                : telemetry.status === 'OFFLINE'
                ? 'OFFLINE'
                : 'Armed'}
            </Text>
            <Text style={styles.chipLabel}>GPS</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Trip Control */}
      <Text style={styles.sectionLabel}>TRIP CONTROL</Text>
      <View style={styles.tripCard}>
        <View style={styles.tripButtons}>
          <TouchableOpacity
            style={[styles.startBtn, (tripActive || busy) && styles.btnDisabled]}
            onPress={startTrip}
            disabled={tripActive || busy}
          >
            {busy && !tripActive ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.startBtnText}>▶  Start Trip</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.endBtn, (!tripActive || busy) && styles.btnDisabled]}
            onPress={endTrip}
            disabled={!tripActive || busy}
          >
            {busy && tripActive ? (
              <ActivityIndicator color={BRAND.danger} size="small" />
            ) : (
              <Text style={styles.endBtnText}>⏹  End Trip</Text>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.tripStatusRow}>
          <Text style={styles.tripStatusText}>
            ● {tripActive ? `Trip #${activeTripId} in progress` : 'Awaiting trip start'}
          </Text>
          <View
            style={[
              styles.liveBadge,
              telemetry.status === 'OFFLINE' && styles.offlineBadge,
              telemetry.status === 'LIVE' && styles.liveBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.liveBadgeText,
                telemetry.status === 'OFFLINE' && styles.offlineBadgeText,
                telemetry.status === 'LIVE' && styles.liveBadgeTextActive,
              ]}
            >
              {telemetry.status === 'LIVE'
                ? '📶 LIVE'
                : telemetry.status === 'OFFLINE'
                ? '⚠️ OFFLINE'
                : '📶 READY'}
            </Text>
          </View>
        </View>
      </View>

      {/* Crew on Duty */}
      <Text style={styles.sectionLabel}>CREW ON DUTY</Text>
      <View style={styles.crewRow}>
        <View style={styles.crewCard}>
          <View style={[styles.crewAvatar, { backgroundColor: BRAND.primary }]}>
            <Text style={styles.crewInitials}>{initials(driver?.name)}</Text>
          </View>
          <Text style={styles.crewRole}>DRIVER</Text>
          <Text style={styles.crewName}>{driver?.name || '—'}</Text>
          <Text style={styles.crewId}>{driver?.phone || ''}</Text>
        </View>
        <View style={styles.crewCard}>
          <View style={[styles.crewAvatar, { backgroundColor: BRAND.purple }]}>
            <Text style={styles.crewInitials}>
              {conductor ? initials(conductor.name) : '?'}
            </Text>
          </View>
          <Text style={[styles.crewRole, { color: BRAND.purple }]}>CONDUCTOR</Text>
          <Text style={styles.crewName}>{conductor?.name || 'Not linked'}</Text>
          <Text style={styles.crewId}>{conductor?.phone || 'Pair via QR'}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        {actions.map((a) => (
          <TouchableOpacity key={a.title} style={styles.actionCard} onPress={a.go}>
            <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
              <Text style={{ fontSize: 20 }}>{a.icon}</Text>
            </View>
            <Text style={styles.actionTitle}>{a.title}</Text>
            <Text style={styles.actionSub}>{a.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  name: { color: '#FFF', fontSize: 26, fontWeight: '800', marginTop: 2 },
  meta: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  chip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 12,
  },
  chipValue: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  chipLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: BRAND.textSecondary,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 10,
  },
  tripCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
  },
  tripButtons: { flexDirection: 'row', gap: 12 },
  startBtn: {
    flex: 1,
    height: 52,
    borderRadius: BRAND.radius.pill,
    backgroundColor: BRAND.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  endBtn: {
    flex: 1,
    height: 52,
    borderRadius: BRAND.radius.pill,
    backgroundColor: BRAND.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtnText: { color: BRAND.danger, fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },
  tripStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  tripStatusText: { fontSize: 13, color: BRAND.textSecondary, fontWeight: '600' },
  liveBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  liveBadgeText: { fontSize: 12, fontWeight: '800', color: BRAND.primary },
  liveBadgeActive: { backgroundColor: '#DCFCE7' },
  liveBadgeTextActive: { color: '#15803D' },
  offlineBadge: { backgroundColor: '#FEE2E2' },
  offlineBadgeText: { color: '#B91C1C' },
  crewRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  crewCard: {
    flex: 1,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
  },
  crewAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  crewInitials: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  crewRole: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: BRAND.primary },
  crewName: { fontSize: 16, fontWeight: '700', color: BRAND.text, marginTop: 4 },
  crewId: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  actionCard: {
    width: '46%',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    margin: '2%',
    ...BRAND.shadow,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text },
  actionSub: { fontSize: 12, color: BRAND.textSecondary, marginTop: 3 },
});
