import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDriverStore } from '../../src/store/driverStore';
import { BRAND } from '../../src/styles/brand';

/**
 * Profile (Figma): gradient header with avatar + Senior Driver tag,
 * Trips/Service/CO2 stats, license & assignment rows, settings,
 * End Shift & Logout.
 */
export default function Profile() {
  const router = useRouter();
  const { driver, bus, route, logoutDriver, setActiveTripId } = useDriverStore();
  const [darkMode, setDarkMode] = useState(false);

  const initials = (name?: string) =>
    (name || 'D')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const infoRows = [
    { label: 'License No.', value: driver?.licenseNo || 'AP-MV-08742' },
    { label: 'Vehicle Class', value: 'HMV / PSV' },
    { label: 'Current Route', value: route?.name || '10K · RTC–Kailasagiri' },
    { label: 'Depot', value: 'Visakhapatnam Central' },
    { label: 'Shift', value: '06:00 – 14:00' },
  ];

  const endShift = () => {
    Alert.alert('End Shift & Logout', 'This will stop GPS tracking and log you out.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Shift',
        style: 'destructive',
        onPress: () => {
          setActiveTripId(null); // stops GPS publishing
          logoutDriver();
          router.replace('/login');
        },
      },
    ]);
  };

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
          <Text style={styles.brand}>Next Bus</Text>
          <View style={styles.bell}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
          </View>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(driver?.name)}</Text>
        </View>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>SENIOR DRIVER</Text>
        </View>
        <Text style={styles.name}>{driver?.name || 'Driver'}</Text>
        <Text style={styles.phone}>+91 {driver?.phone || '—'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{driver?.totalTrips ?? 128}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{driver?.yearsExperience ?? 5} yrs</Text>
            <Text style={styles.statLabel}>Service</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>15 kg</Text>
            <Text style={styles.statLabel}>CO₂ Saved</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Info rows */}
      <View style={styles.card}>
        {infoRows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.rowValue}>{r.value}</Text>
          </View>
        ))}
      </View>

      {/* Settings */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => Alert.alert('Language', 'Telugu arrives with the Vizag launch.')}
        >
          <Text style={styles.rowLabel}>Language</Text>
          <Text style={styles.rowValue}>English (IN)  ›</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Dark mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: BRAND.border, true: '#C7D2FE' }}
            thumbColor={darkMode ? BRAND.primary : '#FFF'}
          />
        </View>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/driver-sos')}>
          <Text style={styles.rowLabel}>Safety & SOS settings</Text>
          <Text style={styles.rowValue}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.row, { borderBottomWidth: 0 }]}
          onPress={() => Alert.alert('Help', 'depot-support@nextbus.in')}
        >
          <Text style={styles.rowLabel}>Help center</Text>
          <Text style={styles.rowValue}>›</Text>
        </TouchableOpacity>
      </View>

      {/* End shift */}
      <TouchableOpacity style={styles.logout} onPress={endShift}>
        <Text style={styles.logoutText}>End Shift & Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0 (MVP)</Text>
      <Text style={styles.legal}>Privacy Policy  ·  Terms of Service</Text>

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  brand: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  roleTag: {
    marginTop: -10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  roleTagText: { fontSize: 11, fontWeight: '800', color: BRAND.primary, letterSpacing: 1 },
  name: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 12 },
  phone: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 20, paddingHorizontal: 24 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 14,
  },
  statValue: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 3 },
  card: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    paddingHorizontal: 18,
    ...BRAND.shadow,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.surfaceMuted,
  },
  rowLabel: { fontSize: 15, color: BRAND.textSecondary, fontWeight: '500' },
  rowValue: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  logout: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: BRAND.radius.pill,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: BRAND.dangerSoft,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: { color: BRAND.danger, fontSize: 16, fontWeight: '800' },
  version: { textAlign: 'center', color: BRAND.textTertiary, fontSize: 12, marginTop: 18 },
  legal: { textAlign: 'center', color: BRAND.primary, fontSize: 12, fontWeight: '600', marginTop: 6 },
});
