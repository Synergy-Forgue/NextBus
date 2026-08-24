import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useCommuterStore from '../store/useCommuterStore';
import { BRAND } from '../styles/brand';

const DEMO_OTP = '1001';

export default function OTPScreen({ navigation }: any) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [countdown, setCountdown] = useState(59);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { pendingPhone, setUserProfile, addSavedRoute } = useCommuterStore();

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

  const handleQuickFillOtp = () => {
    setDigits(['1', '0', '0', '1']);
  };

  const verify = () => {
    const entered = digits.join('');
    if (entered.length < 4) {
      Alert.alert('Incomplete Code', 'Please enter the full 4-digit verification code.');
      return;
    }

    if (entered !== DEMO_OTP) {
      Alert.alert(
        '🔐 Demo Access Code',
        `For this live presentation demo, the authorized verification code is:\n\n🔑 ${DEMO_OTP}\n\nOr tap "Quick-Fill Demo Code".`,
        [
          { text: 'Auto-Fill 1001', onPress: handleQuickFillOtp },
          { text: 'Retry', style: 'cancel' },
        ]
      );
      return;
    }

    // Populate rich executive commuter profile
    setUserProfile({
      id: `commuter_${pendingPhone || '8688105910'}`,
      phone: pendingPhone || '8688105910',
      name: 'Kalyan Varma',
      language: 'en',
      avatar: '👤',
    });

    // Pre-seed demo favorite routes if empty
    addSavedRoute({
      id: 1,
      route_number: '10K',
      route_name: 'RTC Complex ↔ Kailasagiri',
      start_stop: 'RTC Complex',
      end_stop: 'Kailasagiri',
    });
    addSavedRoute({
      id: 6,
      route_number: '201M',
      route_name: 'City Bus Stand ↔ Chamundi Hills',
      start_stop: 'City Bus Stand',
      end_stop: 'Chamundi Hills',
    });
  };

  const isOtpReady = digits.join('') === DEMO_OTP;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back Button */}
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        {/* Demo Mode Pill */}
        <View style={styles.demoBadge}>
          <View style={styles.demoPulseDot} />
          <Text style={styles.demoBadgeText}>DEMO AUTHORIZATION</Text>
        </View>

        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          Enter the 4-digit demo code sent to{' '}
          <Text style={styles.phoneHighlight}>+91 {pendingPhone || '8688105910'}</Text>
        </Text>

        {/* Quick Demo OTP Auto-fill Card */}
        <TouchableOpacity
          style={[styles.quickFillCard, isOtpReady && styles.quickFillCardActive]}
          onPress={handleQuickFillOtp}
          activeOpacity={0.85}
        >
          <Text style={styles.quickFillEmoji}>🔑</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.quickFillTitle}>Demo Passcode: {DEMO_OTP}</Text>
            <Text style={styles.quickFillSub}>Tap to fill authorized 4-digit OTP</Text>
          </View>
          <Text style={styles.quickFillAction}>{isOtpReady ? '✓ Filled' : 'Quick-Fill →'}</Text>
        </TouchableOpacity>

        {/* 4-Digit Box Inputs */}
        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputs.current[i] = r;
              }}
              style={[
                styles.otpBox,
                d !== '' && styles.otpBoxFilled,
                isOtpReady && styles.otpBoxValid,
              ]}
              keyboardType="number-pad"
              maxLength={1}
              value={d}
              onChangeText={(v) => setDigit(i, v)}
              textAlign="center"
            />
          ))}
        </View>

        {/* Resend Timer */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>
              ⏱ Resend demo OTP in 00:{String(countdown).padStart(2, '0')}
            </Text>
          ) : (
            <TouchableOpacity onPress={() => setCountdown(59)}>
              <Text style={styles.resendLink}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Verify CTA */}
        <TouchableOpacity onPress={verify} activeOpacity={0.85} style={styles.ctaWrap}>
          <LinearGradient
            colors={BRAND.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Verify & Launch App  →</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            🛡️ Authorized for NextBus Executive Demo. Real-time telemetry connection to Railway backend will initialize upon login.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.surface,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  back: {
    marginBottom: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: BRAND.text,
    fontWeight: '800',
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  demoPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.primary,
    marginRight: 6,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: BRAND.text,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: BRAND.textSecondary,
    lineHeight: 19,
    marginBottom: 20,
  },
  phoneHighlight: {
    fontWeight: '800',
    color: BRAND.primary,
  },
  quickFillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: BRAND.border,
  },
  quickFillCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: BRAND.primary,
  },
  quickFillEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  quickFillTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.text,
  },
  quickFillSub: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 1,
  },
  quickFillAction: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.primary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  otpBox: {
    flex: 1,
    height: 68,
    borderRadius: BRAND.radius.lg,
    backgroundColor: BRAND.surfaceMuted,
    fontSize: 28,
    fontWeight: '900',
    color: BRAND.text,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  otpBoxFilled: {
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  otpBoxValid: {
    borderColor: BRAND.primary,
    backgroundColor: '#EEF2FF',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 28,
  },
  resendTimer: {
    fontSize: 13,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 13,
    color: BRAND.primary,
    fontWeight: '800',
  },
  ctaWrap: {
    marginBottom: 20,
    ...BRAND.shadowPrimary,
  },
  cta: {
    height: 54,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  securityNote: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
    padding: 14,
  },
  securityText: {
    fontSize: 11,
    color: BRAND.textSecondary,
    lineHeight: 16,
    textAlign: 'center',
  },
});
