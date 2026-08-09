import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useDriverStore } from '../src/store/driverStore';
import { BRAND } from '../src/styles/brand';

/**
 * Scan Driver QR — the CONDUCTOR side of dual-login (Figma).
 * The conductor points their camera at the driver's Trip QR to link both
 * to the same trip. "Simulate Scan" stands in for the camera in the MVP.
 * Trip linking works offline; data syncs when connected.
 */
export default function ScanDriverQR() {
  const router = useRouter();
  const { linkConductor } = useDriverStore();

  const simulate = () => {
    linkConductor('9876543299');
    router.back(); // returns to Pairing, now in Paired state
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Text style={{ fontSize: 16 }}>🚌</Text>
        </View>
        <Text style={styles.title}>Scan Driver QR</Text>
      </View>
      <Text style={styles.subtitle}>Point camera at driver's Trip QR Code</Text>

      {/* Camera frame */}
      <View style={styles.camera}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />

        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.cameraText}>Camera active</Text>
        <Text style={styles.cameraHint}>Align QR code within frame</Text>
        <View style={styles.scanLine} />

        <TouchableOpacity style={styles.simulateBtn} onPress={simulate}>
          <Text style={styles.simulateBtnText}>Simulate Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Offline note */}
      <View style={styles.offlineCard}>
        <Text style={styles.offlineTitle}>📵  Offline Mode Ready</Text>
        <Text style={styles.offlineBody}>
          Trip linking works without internet. Data syncs when connected.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F1A', padding: 20, paddingTop: 52 },
  back: { fontSize: 24, color: '#94A3B8', marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#9CA3AF', fontSize: 14, marginTop: 8, marginLeft: 52 },
  camera: {
    flex: 1,
    marginTop: 20,
    borderRadius: BRAND.radius.xl,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: BRAND.primary },
  tl: { top: 24, left: 24, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 24, right: 24, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 24, left: 24, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 24, right: 24, borderBottomWidth: 3, borderRightWidth: 3 },
  cameraIcon: { fontSize: 44, color: '#6B7280', marginBottom: 8 },
  cameraText: { color: '#9CA3AF', fontSize: 17, fontWeight: '600' },
  cameraHint: { color: '#6B7280', fontSize: 13, marginTop: 6, marginBottom: 14 },
  scanLine: { width: 240, height: 2, backgroundColor: BRAND.primary, opacity: 0.7, marginBottom: 24 },
  simulateBtn: {
    borderRadius: BRAND.radius.pill,
    borderWidth: 1.5,
    borderColor: '#374151',
    backgroundColor: '#1F2937',
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  simulateBtnText: { color: '#E5E7EB', fontSize: 15, fontWeight: '700' },
  offlineCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 18,
    marginTop: 16,
  },
  offlineTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text, marginBottom: 4 },
  offlineBody: { fontSize: 13, color: BRAND.textSecondary, lineHeight: 19 },
});
