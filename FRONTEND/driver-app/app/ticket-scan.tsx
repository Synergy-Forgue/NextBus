import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../src/styles/brand';

/**
 * QR Scanner — Ticket Verification (spec: Phase 2, works offline).
 * Preview build: dark scanner frame + "Simulate Ticket Scan" → VALID card.
 * Activates fully alongside digital ticketing in the Commuter App.
 */
export default function TicketScan() {
  const router = useRouter();
  const [result, setResult] = useState<null | 'valid'>(null);

  const ticketNo = `TKT-${Math.floor(1000000 + Math.random() * 9000000)}`;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Text style={{ fontSize: 16 }}>⚡</Text>
        </View>
        <Text style={styles.title}>Ticket Verification</Text>
      </View>
      <Text style={styles.phase}>● Phase 2 · Offline Ready</Text>

      {/* Scanner frame */}
      <View style={styles.scanner}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />

        {result === 'valid' ? (
          <View style={styles.resultWrap}>
            <Text style={styles.validCheck}>✓</Text>
            <Text style={styles.validText}>VALID</Text>
            <Text style={styles.validSub}>Ticket accepted</Text>
          </View>
        ) : (
          <View style={styles.resultWrap}>
            <Text style={styles.qrGhost}>⌗</Text>
            <View style={styles.scanLine} />
            <Text style={styles.scanHint}>Scan commuter ticket</Text>
          </View>
        )}
      </View>

      {/* Bottom card */}
      <View style={styles.bottomCard}>
        {result === 'valid' ? (
          <>
            <View style={styles.approved}>
              <Text style={styles.approvedTitle}>TICKET APPROVED</Text>
              <View style={styles.approvedRow}>
                <Text style={styles.approvedLabel}>Ticket No.</Text>
                <Text style={styles.approvedValue}>{ticketNo}</Text>
              </View>
              <View style={styles.approvedRow}>
                <Text style={styles.approvedLabel}>Route</Text>
                <Text style={styles.approvedValue}>10K · RTC–Kailasagiri</Text>
              </View>
              <View style={styles.approvedRow}>
                <Text style={styles.approvedLabel}>Valid Till</Text>
                <Text style={styles.approvedValue}>10:30 AM · Today</Text>
              </View>
              <View style={styles.approvedRow}>
                <Text style={styles.approvedLabel}>Type</Text>
                <Text style={styles.approvedValue}>General</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setResult(null)} activeOpacity={0.85}>
              <LinearGradient
                colors={BRAND.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>Scan Next Ticket</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.offlineNote}>📵  OFFLINE READY · Cached ticket data</Text>
            <TouchableOpacity onPress={() => setResult('valid')} activeOpacity={0.85}>
              <LinearGradient
                colors={BRAND.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.cta}
              >
                <Text style={styles.ctaText}>Simulate Ticket Scan</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
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
    borderRadius: 12,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  phase: { color: BRAND.warning, fontSize: 13, fontWeight: '600', marginTop: 8, marginLeft: 52 },
  scanner: {
    flex: 1,
    marginTop: 20,
    borderRadius: BRAND.radius.xl,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderColor: BRAND.primary,
  },
  tl: { top: 24, left: 24, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 24, right: 24, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 24, left: 24, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 24, right: 24, borderBottomWidth: 3, borderRightWidth: 3 },
  resultWrap: { alignItems: 'center' },
  qrGhost: { fontSize: 54, color: '#374151', marginBottom: 10 },
  scanLine: { width: 240, height: 2, backgroundColor: BRAND.primary, opacity: 0.7, marginBottom: 14 },
  scanHint: { color: '#6B7280', fontSize: 15 },
  validCheck: { fontSize: 64, color: BRAND.success, fontWeight: '800' },
  validText: { color: BRAND.success, fontSize: 30, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  validSub: { color: '#9CA3AF', fontSize: 15, marginTop: 6 },
  bottomCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 18,
    marginTop: 16,
  },
  offlineNote: { fontSize: 13, fontWeight: '700', color: BRAND.textSecondary, marginBottom: 14 },
  approved: {
    backgroundColor: BRAND.successSoft,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    marginBottom: 14,
    gap: 8,
  },
  approvedTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#15803D', marginBottom: 4 },
  approvedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  approvedLabel: { fontSize: 14, color: '#166534' },
  approvedValue: { fontSize: 14, fontWeight: '800', color: '#14532D' },
  cta: { height: 52, borderRadius: BRAND.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
