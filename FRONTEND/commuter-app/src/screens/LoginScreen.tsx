import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useCommuterStore from '../store/useCommuterStore';
import { BRAND } from '../styles/brand';

const DEMO_PHONE = '8688105910';

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const { setPendingPhone } = useCommuterStore();

  const handleQuickFill = () => {
    setPhone(DEMO_PHONE);
  };

  const sendOtp = () => {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean !== DEMO_PHONE) {
      Alert.alert(
        '🔐 Demo Access Only',
        `For this live presentation demo, please use authorized demo number:\n\n📱 ${DEMO_PHONE}\n\nOr tap "Quick Demo Fill" below.`,
        [
          { text: 'Auto-Fill Demo Number', onPress: handleQuickFill },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    setPendingPhone(clean);
    navigation.navigate('OTP');
  };

  const isDemoReady = phone.replace(/\D/g, '').slice(-10) === DEMO_PHONE;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Branding */}
        <View style={styles.header}>
          <View style={styles.logoCard}>
            <Text style={styles.logoEmoji}>🚌</Text>
          </View>
          <Text style={styles.appName}>Next Bus</Text>
          <Text style={styles.appTagline}>Effortless Urban Mobility · Pilot Demo</Text>
        </View>

        {/* Demo Mode Badge */}
        <View style={styles.demoBadge}>
          <View style={styles.demoPulseDot} />
          <Text style={styles.demoBadgeText}>DEMO PRESENTATION MODE</Text>
        </View>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Sign in with Mobile</Text>
          <Text style={styles.subtitle}>
            Enter your mobile number to access real-time transit telemetry.
          </Text>

          {/* Quick Demo Fill Shortcut Button */}
          <TouchableOpacity
            style={[styles.quickFillBtn, isDemoReady && styles.quickFillBtnActive]}
            onPress={handleQuickFill}
            activeOpacity={0.85}
          >
            <Text style={styles.quickFillIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickFillTitle}>1-Tap Demo Credentials</Text>
              <Text style={styles.quickFillSub}>Fills authorized number: {DEMO_PHONE}</Text>
            </View>
            <Text style={styles.quickFillAction}>{isDemoReady ? '✓ Selected' : 'Auto-Fill →'}</Text>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
            <View style={[styles.inputRow, isDemoReady && styles.inputRowActive]}>
              <View style={styles.prefix}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="8688105910"
                placeholderTextColor={BRAND.textTertiary}
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
              {isDemoReady && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkBadgeText}>✓</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity onPress={sendOtp} activeOpacity={0.85} style={styles.ctaWrap}>
            <LinearGradient
              colors={BRAND.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Get Verification Code  →</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.securityNote}>
            🔒 Secured for executive presentation demo. Visakhapatnam & Mysuru pilot transit systems.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCard: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...BRAND.shadow,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: BRAND.text,
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 13,
    color: BRAND.textSecondary,
    fontWeight: '600',
    marginTop: 3,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  demoPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BRAND.primary,
    marginRight: 8,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.primary,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 22,
    ...BRAND.shadowLg,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: BRAND.textSecondary,
    lineHeight: 18,
    marginBottom: 18,
  },
  quickFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  quickFillBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: BRAND.primary,
  },
  quickFillIcon: {
    fontSize: 20,
    marginRight: 10,
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
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BRAND.radius.lg,
    backgroundColor: BRAND.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    height: 56,
  },
  inputRowActive: {
    borderColor: BRAND.primary,
    backgroundColor: '#FFFFFF',
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 4,
  },
  flag: {
    fontSize: 16,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.text,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
    height: '100%',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },
  ctaWrap: {
    marginBottom: 16,
    ...BRAND.shadowPrimary,
  },
  cta: {
    height: 52,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  securityNote: {
    fontSize: 11,
    color: BRAND.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
