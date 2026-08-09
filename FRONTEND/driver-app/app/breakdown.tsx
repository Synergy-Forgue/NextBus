import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDriverStore } from '../src/store/driverStore';
import { useRealTimeLocation } from '../src/hooks/useRealTimeLocation';
import tripService from '../src/services/tripService';
import { BRAND } from '../src/styles/brand';

/**
 * Breakdown Indicator (spec 03) — one-tap breakdown reporting.
 * Pick a type, review what will be sent, send → POST /api/alerts →
 * flagged live on the RTC dashboard.
 */
const TYPES = ['Engine failure', 'Tyre puncture', 'Brake issue', 'Electrical fault', 'Accident', 'Other'];

export default function Breakdown() {
  const router = useRouter();
  const { driver, bus, route, activeTripId, currentLocation, isOnline } = useDriverStore();
  const { location } = useRealTimeLocation(isOnline);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const lat = location?.latitude ?? currentLocation.lat;
  const lng = location?.longitude ?? currentLocation.lng;

  const send = async () => {
    if (!selected) {
      Alert.alert('Select type', 'Please choose the breakdown type first.');
      return;
    }
    setSending(true);
    try {
      const cleanPhone = (driver?.phone || '').replace(/\D/g, '').slice(-10);
      await tripService.reportBreakdown({
        trip_id: activeTripId ?? undefined,
        license_plate: bus?.regNo,
        route_number: route?.number,
        driver_phone: cleanPhone,
        description: selected,
        latitude: lat,
        longitude: lng,
      });
      Alert.alert('Alert Sent', 'Depot control room has been notified. Help is on the way.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error('Breakdown error:', err);
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Could not reach the server. Try again or call depot radio.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Orange header card */}
      <LinearGradient
        colors={['#F59E0B', '#EA580C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 22 }}>⚠️</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Breakdown Report</Text>
            <Text style={styles.headerSub}>Alert sent to Depot Control</Text>
          </View>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerInfoText}>
            Bus: <Text style={styles.headerInfoBold}>{bus?.regNo || 'BUS001'}</Text>
            {'    '}Route: <Text style={styles.headerInfoBold}>{route?.number || '10K'}</Text>
          </Text>
          <Text style={styles.headerInfoText}>
            Location: <Text style={styles.headerInfoBold}>{location ? 'GPS Active' : 'Last known'}</Text>
            {'    '}Driver: <Text style={styles.headerInfoBold}>{driver?.name || '—'}</Text>
          </Text>
        </View>
      </LinearGradient>

      {/* Type chips */}
      <Text style={styles.sectionLabel}>BREAKDOWN TYPE</Text>
      <View style={styles.typeGrid}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, selected === t && styles.typeChipActive]}
            onPress={() => setSelected(t)}
          >
            <Text style={[styles.typeChipText, selected === t && styles.typeChipTextActive]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Will send summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>WILL SEND TO DEPOT</Text>
        <Text style={styles.summaryItem}>•  Bus: {bus?.regNo || 'BUS001'}</Text>
        <Text style={styles.summaryItem}>•  Route: {route?.name || '10K · RTC–Kailasagiri'}</Text>
        <Text style={styles.summaryItem}>
          •  Live GPS: {lat.toFixed(4)}°N {lng.toFixed(4)}°E
        </Text>
        <Text style={styles.summaryItem}>•  Type: {selected || 'Not selected'}</Text>
      </View>

      {/* Send */}
      <TouchableOpacity onPress={send} disabled={sending || !selected} activeOpacity={0.85}>
        <View style={[styles.sendBtn, (!selected || sending) && styles.sendBtnDisabled]}>
          {sending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.sendBtnText}>Send Breakdown Alert</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} disabled={sending}>
        <Text style={styles.cancel}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  scroll: { padding: 20, paddingTop: 28, paddingBottom: 48 },
  header: { borderRadius: BRAND.radius.xl, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  headerInfo: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BRAND.radius.lg,
    padding: 14,
    gap: 8,
  },
  headerInfoText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  headerInfoBold: { color: '#FFF', fontWeight: '800' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: BRAND.textSecondary,
    marginTop: 22,
    marginBottom: 12,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeChip: {
    width: '48%',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeChipActive: { backgroundColor: BRAND.warningSoft, borderColor: BRAND.warning },
  typeChipText: { fontSize: 16, fontWeight: '700', color: BRAND.text },
  typeChipTextActive: { color: '#92400E' },
  summary: {
    backgroundColor: '#FFFBEB',
    borderRadius: BRAND.radius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 16,
    marginTop: 20,
    gap: 8,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#92400E', marginBottom: 4 },
  summaryItem: { fontSize: 14, color: '#92400E' },
  sendBtn: {
    height: 56,
    borderRadius: BRAND.radius.pill,
    backgroundColor: BRAND.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancel: { textAlign: 'center', color: BRAND.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 16 },
});
