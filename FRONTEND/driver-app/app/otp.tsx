import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDriverStore } from '../src/store/driverStore';
import { BRAND } from '../src/styles/brand';

/**
 * OTP Verification — 4 circles + resend countdown (Figma).
 * MVP: any 4-digit code verifies; logs the driver in and moves to
 * Conductor Pairing.
 */
export default function OTP() {
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(59);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { pendingPhone, loginDriver, goOnline } = useDriverStore();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 3) inputs.current[index + 1]?.focus();
    if (!v && index > 0) inputs.current[index - 1]?.focus();
  };

  const verify = () => {
    if (digits.some((d) => d === '')) {
      Alert.alert('Incomplete', 'Please enter the full 4-digit code.');
      return;
    }
    loginDriver(pendingPhone || '9876543210', '');
    goOnline(); // GPS Ping arms silently from login, per spec
    router.replace('/pairing');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to your phone via SMS to continue.
      </Text>

      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputs.current[i] = r; }}
            style={[styles.otpBox, d !== '' && styles.otpBoxFilled]}
            keyboardType="number-pad"
            maxLength={1}
            value={d}
            onChangeText={(v) => setDigit(i, v)}
            textAlign="center"
          />
        ))}
      </View>

      <View style={styles.resendRow}>
        {countdown > 0 ? (
          <Text style={styles.resendTimer}>
            ⏱ Resend code in 00:{String(countdown).padStart(2, '0')}
          </Text>
        ) : null}
        <TouchableOpacity onPress={() => setCountdown(59)} disabled={countdown > 0}>
          <Text style={[styles.resendLink, countdown > 0 && { opacity: 0.4 }]}>
            Resend OTP
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.illustration}>
        <View style={styles.shieldCard}>
          <Text style={styles.shieldEmoji}>🛡️</Text>
        </View>
      </View>

      <TouchableOpacity onPress={verify} activeOpacity={0.85}>
        <LinearGradient
          colors={BRAND.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Verify</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.securityRow}>
        <Text style={styles.securityIcon}>🛡</Text>
        <Text style={styles.securityText}>
          Your security is our priority. We never share your contact details with
          third parties.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.surface, paddingHorizontal: 26, paddingTop: 56 },
  back: { fontSize: 24, color: BRAND.primary, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: BRAND.text, letterSpacing: -0.4, marginBottom: 10 },
  subtitle: { fontSize: 14, color: BRAND.textSecondary, lineHeight: 20, marginBottom: 32 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 20 },
  otpBox: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: BRAND.surfaceMuted,
    fontSize: 24,
    fontWeight: '800',
    color: BRAND.text,
  },
  otpBoxFilled: { borderWidth: 2, borderColor: BRAND.primary, backgroundColor: '#EEF2FF' },
  resendRow: { alignItems: 'center', gap: 8, marginBottom: 26 },
  resendTimer: { fontSize: 13, color: BRAND.textSecondary, fontWeight: '600' },
  resendLink: { fontSize: 14, color: BRAND.primary, fontWeight: '700' },
  illustration: {
    backgroundColor: '#EEF2FF',
    borderRadius: BRAND.radius.xl,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  shieldCard: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldEmoji: { fontSize: 44 },
  cta: { height: 56, borderRadius: BRAND.radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  securityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4 },
  securityIcon: { fontSize: 14, marginTop: 1 },
  securityText: { flex: 1, fontSize: 12, color: BRAND.textSecondary, lineHeight: 18 },
});
