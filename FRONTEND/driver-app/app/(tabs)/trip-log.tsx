import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDriverStore } from '../../src/store/driverStore';
import tripService, { BackendTrip } from '../../src/services/tripService';
import { BRAND } from '../../src/styles/brand';

/**
 * Trip Log (spec 02): one-tap Log Start / Log End (same real trip API as
 * Home), the GPS auto-detection fallback notice, and Today's Trips pulled
 * live from GET /api/trips.
 */
export default function TripLog() {
  const { driver, route, activeTripId, setActiveTripId } = useDriverStore();
  const [trips, setTrips] = useState<BackendTrip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const all = await tripService.getTrips();
    // Show this driver's trips (fallback: all trips if phone lookup empty)
    const mine = all.filter((t) => t.route_number === (route?.number || '10K'));
    setTrips(mine.length ? mine : all.slice(0, 6));
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const logStart = async () => {
    if (!driver || !route) {
      Alert.alert('Error', 'Driver or route not set');
      return;
    }
    setBusy(true);
    try {
      const cleanPhone = (driver.phone || '').replace(/\D/g, '').slice(-10);
      const trip = await tripService.startTrip(route.number, cleanPhone);
      const tripId = trip.id || trip.trip_id;
      setActiveTripId(tripId);
      await load();
      Alert.alert('Trip started', `Trip #${tripId} logged — GPS live.`);
    } catch (err: any) {
      console.error('Trip start error:', err);
      Alert.alert('Error', err?.response?.data?.message || err?.response?.data?.error || err.message || 'Backend unreachable.');
    } finally {
      setBusy(false);
    }
  };

  const logEnd = async () => {
    if (!activeTripId) return;
    setBusy(true);
    try {
      await tripService.endTrip(activeTripId);
      setActiveTripId(null);
      await load();
      Alert.alert('Trip ended', 'Trip marked completed.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Backend unreachable.');
    } finally {
      setBusy(false);
    }
  };

  const fmtTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const completedCount = trips.filter((t) => t.status === 'completed').length;
  const activeCount = trips.filter((t) => t.status === 'active').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Text style={styles.title}>Trip Log</Text>
        <View style={styles.dateChip}>
          <Text style={styles.dateChipText}>{today}</Text>
        </View>
      </View>

      {/* Manual entry */}
      <Text style={styles.sectionLabel}>MANUAL ENTRY</Text>
      <View style={styles.entryCard}>
        <View style={styles.entryButtons}>
          <TouchableOpacity
            style={[styles.startBtn, (!!activeTripId || busy) && styles.btnDisabled]}
            onPress={logStart}
            disabled={!!activeTripId || busy}
          >
            {busy && !activeTripId ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.startBtnText}>▶  Log Start</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.endBtn, (!activeTripId || busy) && styles.btnDisabled]}
            onPress={logEnd}
            disabled={!activeTripId || busy}
          >
            <Text style={styles.endBtnText}>⏹  Log End</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Auto-detection fallback (spec 02) */}
      <View style={styles.autoCard}>
        <Text style={styles.autoTitle}>🧭 Auto-Detection Active</Text>
        <Text style={styles.autoBody}>
          GPS will detect depot departure if trip is not manually marked.
        </Text>
      </View>

      {/* Today's trips — live from the backend */}
      <Text style={styles.sectionLabel}>TODAY'S TRIPS</Text>
      {trips.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No trips logged yet today</Text>
        </View>
      ) : (
        trips.map((t) => (
          <View key={t.id} style={styles.tripCard}>
            <View style={styles.tripHeader}>
              <View style={styles.tripHeaderLeft}>
                <View
                  style={[
                    styles.routeBadge,
                    t.status === 'active' && { backgroundColor: BRAND.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.routeBadgeText,
                      t.status === 'active' && { color: '#FFF' },
                    ]}
                  >
                    {t.route_number}
                  </Text>
                </View>
                <Text style={styles.tripId}>T-{t.id}</Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  t.status === 'active' ? styles.statusActive : styles.statusDone,
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    t.status === 'active' ? styles.statusActiveText : styles.statusDoneText,
                  ]}
                >
                  {t.status === 'active' ? '● Active' : 'Completed'}
                </Text>
              </View>
            </View>

            <View style={styles.timeline}>
              <View style={styles.timelineRow}>
                <Text style={styles.dotBlue}>○</Text>
                <View>
                  <Text style={styles.timelineLabel}>Departed</Text>
                  <Text style={styles.timelineStop}>{t.route_name?.split('↔')[0]?.replace('—', '').trim() || 'Origin'}</Text>
                  <Text style={styles.timeBlue}>{fmtTime(t.started_at)}</Text>
                </View>
              </View>
              <View style={styles.timelineRow}>
                <Text style={t.ended_at ? styles.dotGreen : styles.dotAmber}>○</Text>
                <View>
                  <Text style={styles.timelineLabel}>
                    {t.ended_at ? 'Arrived' : 'Destination'}
                  </Text>
                  <Text style={styles.timelineStop}>{t.route_name?.split('↔')[1]?.trim() || 'Destination'}</Text>
                  <Text style={t.ended_at ? styles.timeGreen : styles.timeAmber}>
                    {t.ended_at ? fmtTime(t.ended_at) : '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))
      )}

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.sectionLabelInner}>TODAY'S SUMMARY</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: BRAND.primary }]}>
              {trips.length}
            </Text>
            <Text style={styles.summaryLabel}>Trips</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: BRAND.purple }]}>
              {completedCount}
            </Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: BRAND.success }]}>
              {activeCount}
            </Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: BRAND.text, letterSpacing: -0.4 },
  dateChip: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dateChipText: { fontSize: 13, fontWeight: '700', color: BRAND.textSecondary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: BRAND.textSecondary,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLabelInner: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: BRAND.textSecondary,
    marginBottom: 14,
  },
  entryCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
  },
  entryButtons: { flexDirection: 'row', gap: 12 },
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
  autoCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#EEF2FF',
    borderRadius: BRAND.radius.lg,
    padding: 16,
  },
  autoTitle: { fontSize: 14, fontWeight: '800', color: BRAND.primary, marginBottom: 4 },
  autoBody: { fontSize: 13, color: '#4338CA', lineHeight: 19 },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: BRAND.textSecondary, fontSize: 13, fontWeight: '600' },
  tripCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeBadge: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  routeBadgeText: { fontSize: 13, fontWeight: '800', color: BRAND.textSecondary },
  tripId: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  statusChip: { borderRadius: BRAND.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  statusActive: { backgroundColor: BRAND.successSoft },
  statusDone: { backgroundColor: BRAND.surfaceMuted },
  statusChipText: { fontSize: 12, fontWeight: '700' },
  statusActiveText: { color: '#15803D' },
  statusDoneText: { color: BRAND.textSecondary },
  timeline: { gap: 14 },
  timelineRow: { flexDirection: 'row', gap: 12 },
  dotBlue: { fontSize: 16, color: BRAND.primary, fontWeight: '800' },
  dotGreen: { fontSize: 16, color: BRAND.success, fontWeight: '800' },
  dotAmber: { fontSize: 16, color: BRAND.warning, fontWeight: '800' },
  timelineLabel: { fontSize: 12, color: BRAND.textSecondary },
  timelineStop: { fontSize: 15, fontWeight: '700', color: BRAND.text, marginTop: 1 },
  timeBlue: { fontSize: 13, fontWeight: '700', color: BRAND.primary, marginTop: 2 },
  timeGreen: { fontSize: 13, fontWeight: '700', color: BRAND.success, marginTop: 2 },
  timeAmber: { fontSize: 13, fontWeight: '700', color: BRAND.warning, marginTop: 2 },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 18,
    ...BRAND.shadow,
  },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCell: {
    flex: 1,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
  },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 12, color: BRAND.textSecondary, marginTop: 3 },
});
