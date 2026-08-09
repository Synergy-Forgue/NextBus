import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDriverStore } from '../src/store/driverStore';
import tripService from '../src/services/tripService';
import { BRAND } from '../src/styles/brand';

/**
 * Conductor Pairing (spec: dual-login). The driver's screen shows a Trip QR;
 * the conductor scans it with their own login to link both to the same trip.
 * "Simulate Conductor Scan" stands in for the second device in the MVP demo.
 * Begin Trip → real POST /api/trips/start → GPS Ping starts flowing.
 */

// Deterministic decorative QR-style grid (visual stand-in for a real QR)
function QrGrid({ paired }: { paired: boolean }) {
  const cells = useMemo(() => {
    const seed = 987654321;
    const out: boolean[] = [];
    let x = seed;
    for (let i = 0; i < 81; i++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      out.push(x % 100 < 45);
    }
    return out;
  }, []);

  if (paired) {
    return (
      <View style={qr.wrap}>
        <View style={qr.scannedOverlay}>
          <Text style={qr.scannedCheck}>✓</Text>
          <Text style={qr.scannedText}>Scanned!</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={qr.wrap}>
      <View style={qr.grid}>
        {cells.map((on, i) => (
          <View key={i} style={[qr.cell, on ? qr.cellOn : null]} />
        ))}
      </View>
    </View>
  );
}

export default function Pairing() {
  const router = useRouter();
  const { driver, bus, route, conductor, linkConductor } = useDriverStore();
  const [starting, setStarting] = useState(false);
  const paired = !!conductor;

  const expires = useMemo(() => {
    const d = new Date(Date.now() + 15 * 60000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, []);

  const simulateScan = () => {
    linkConductor('9876543299'); // conductor logs in with their own credentials
  };

  const beginTrip = async () => {
    if (!driver || !route) {
      Alert.alert('Error', 'Driver or route not set');
      return;
    }
    setStarting(true);
    try {
      // Clean phone number (remove +91 if present)
      const cleanPhone = (driver.phone || '').replace(/\D/g, '').slice(-10);
      const trip = await tripService.startTrip(route.number, cleanPhone);
      const tripId = trip.id || trip.trip_id;
      useDriverStore.getState().setActiveTripId(tripId);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('❌ Begin Trip Error:', err.message);
      console.error('Full error:', err);
      if (err.response) console.error('Response:', err.response.status, err.response.data);
      Alert.alert(
        'Could not start trip',
        err?.response?.data?.message || err?.response?.data?.error || err.message || 'Is the backend reachable?'
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Conductor Pairing</Text>
        <View style={[styles.statusChip, paired ? styles.chipPaired : styles.chipWaiting]}>
          <Text style={[styles.statusChipText, paired ? styles.chipPairedText : styles.chipWaitingText]}>
            ● {paired ? 'Paired' : 'Waiting'}
          </Text>
        </View>
      </View>

      {/* QR card */}
      <View style={styles.qrCard}>
        <Text style={styles.qrLabel}>TRIP QR CODE</Text>
        <Text style={styles.qrValid}>Valid 15 min · Expires {expires}</Text>

        <QrGrid paired={paired} />

        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Bus No.</Text>
            <Text style={styles.infoValue}>{bus?.regNo || 'BUS001'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Route</Text>
            <Text style={styles.infoValue}>{route?.number || '10K'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Driver</Text>
            <Text style={styles.infoValue}>{driver?.name || '—'}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{driver?.phone || '—'}</Text>
          </View>
        </View>
      </View>

      {/* Status banner */}
      {paired ? (
        <View style={styles.bannerPaired}>
          <Text style={styles.bannerPairedTitle}>
            ✓ Conductor Linked — {conductor?.name || 'Conductor'}
          </Text>
          <Text style={styles.bannerPairedSub}>Trip ready to start</Text>
        </View>
      ) : (
        <View style={styles.bannerWaiting}>
          <Text style={styles.bannerWaitingTitle}>🔳 Ready for conductor scan</Text>
          <Text style={styles.bannerWaitingSub}>Show this QR to your conductor</Text>
        </View>
      )}

      {/* CTA */}
      {paired ? (
        <TouchableOpacity onPress={beginTrip} activeOpacity={0.85} disabled={starting}>
          <View style={styles.beginBtn}>
            {starting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.beginBtnText}>Begin Trip →</Text>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <LinearGradient
          colors={BRAND.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.waitingBtn}
        >
          <Text style={styles.waitingBtnText}>Waiting for Conductor…</Text>
        </LinearGradient>
      )}

      {/* MVP demo helper — stands in for the conductor's device */}
      {!paired && (
        <TouchableOpacity style={styles.simulateBtn} onPress={simulateScan}>
          <Text style={styles.simulateBtnText}>Simulate Conductor Scan</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => router.push('/scan-driver-qr')}>
        <Text style={styles.conductorLink}>I'm a conductor — scan a driver's QR</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const qr = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: BRAND.radius.lg,
    padding: 14,
    marginVertical: 18,
  },
  grid: {
    width: 198,
    height: 198,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: { width: 22, height: 22, borderRadius: 6 },
  cellOn: { backgroundColor: BRAND.primary },
  scannedOverlay: {
    width: 198,
    height: 198,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannedCheck: { fontSize: 64, color: BRAND.success, fontWeight: '800' },
  scannedText: { fontSize: 18, color: BRAND.success, fontWeight: '800', marginTop: 6 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  scroll: { padding: 24, paddingTop: 52, paddingBottom: 48 },
  back: { fontSize: 24, color: BRAND.primary, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: BRAND.text, letterSpacing: -0.4 },
  statusChip: { borderRadius: BRAND.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipWaiting: { backgroundColor: BRAND.warningSoft },
  chipPaired: { backgroundColor: BRAND.successSoft },
  statusChipText: { fontSize: 13, fontWeight: '700' },
  chipWaitingText: { color: '#B45309' },
  chipPairedText: { color: '#15803D' },
  qrCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 20,
    alignItems: 'center',
    ...BRAND.shadow,
  },
  qrLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 2, color: BRAND.textSecondary },
  qrValid: { fontSize: 13, color: BRAND.textSecondary, marginTop: 6 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  infoCell: {
    width: '48%',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
    padding: 12,
    margin: '1%',
  },
  infoLabel: { fontSize: 12, color: BRAND.textSecondary, marginBottom: 3 },
  infoValue: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  bannerWaiting: {
    backgroundColor: BRAND.warningSoft,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    marginTop: 16,
  },
  bannerWaitingTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  bannerWaitingSub: { fontSize: 13, color: '#B45309', marginTop: 3 },
  bannerPaired: {
    backgroundColor: BRAND.successSoft,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    marginTop: 16,
  },
  bannerPairedTitle: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  bannerPairedSub: { fontSize: 13, color: '#16A34A', marginTop: 3 },
  waitingBtn: {
    height: 56,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  waitingBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  beginBtn: {
    height: 56,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    backgroundColor: BRAND.success,
  },
  beginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  simulateBtn: {
    height: 48,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: BRAND.border,
    backgroundColor: BRAND.surface,
  },
  simulateBtnText: { color: BRAND.textSecondary, fontSize: 14, fontWeight: '700' },
  conductorLink: {
    textAlign: 'center',
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 18,
  },
});
