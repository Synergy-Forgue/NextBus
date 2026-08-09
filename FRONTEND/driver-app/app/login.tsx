import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useDriverStore } from '../src/store/driverStore';
import { BRAND } from '../src/styles/brand';

/**
 * Login — phone number OR Employee ID + "Today's Assignment" card.
 * Assignment shows the real seeded pilot data (route 10K / BUS001) so
 * Start Trip works end-to-end against the backend.
 */
export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const { setPendingPhone } = useDriverStore();

  const sendOtp = () => {
    const clean = phone.replace(/\D/g, '');
    // Employee ID resolves to the seeded pilot driver (backend looks up by phone)
    const resolved = clean.length === 10 ? clean : employeeId.trim() ? '9876543210' : '';
    if (!resolved) {
      Alert.alert('Invalid', 'Enter a valid 10-digit mobile number or your Employee ID.');
      return;
    }
    setPendingPhone(resolved);
    router.push('/otp');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <LinearGradient colors={BRAND.gradient} style={styles.logoCard}>
          <Text style={styles.logoEmoji}>🚌</Text>
        </LinearGradient>

        <Text style={styles.title}>Enter your number</Text>
        <Text style={styles.subtitle}>
          We will send a 4-digit code to verify your account.
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Mobile number"
            placeholderTextColor={BRAND.textTertiary}
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or use Employee ID</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.inputFull}
          placeholder="Employee ID (e.g. DRV-2847)"
          placeholderTextColor={BRAND.textTertiary}
          autoCapitalize="characters"
          value={employeeId}
          onChangeText={setEmployeeId}
        />

        {/* Today's Assignment — real pilot data from the backend seed */}
        <View style={styles.assignment}>
          <Text style={styles.assignmentLabel}>TODAY'S ASSIGNMENT</Text>
          <View style={styles.assignmentGrid}>
            <View style={styles.assignmentCell}>
              <Text style={styles.cellLabel}>Route</Text>
              <Text style={styles.cellValue}>10K · RTC–Kailasagiri</Text>
            </View>
            <View style={styles.assignmentCell}>
              <Text style={styles.cellLabel}>Bus No.</Text>
              <Text style={styles.cellValue}>BUS001</Text>
            </View>
            <View style={styles.assignmentCell}>
              <Text style={styles.cellLabel}>Depot</Text>
              <Text style={styles.cellValue}>Visakhapatnam</Text>
            </View>
            <View style={styles.assignmentCell}>
              <Text style={styles.cellLabel}>Shift</Text>
              <Text style={styles.cellValue}>06:00 – 14:00</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={sendOtp} activeOpacity={0.85}>
          <LinearGradient
            colors={BRAND.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Send OTP</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.link}>Terms of Service</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.surface },
  scroll: { paddingHorizontal: 26, paddingTop: 56, paddingBottom: 40 },
  back: { fontSize: 24, color: BRAND.primary, marginBottom: 16 },
  logoCard: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    ...BRAND.shadow,
  },
  logoEmoji: { fontSize: 30 },
  title: { fontSize: 30, fontWeight: '800', color: BRAND.text, letterSpacing: -0.4, marginBottom: 10 },
  subtitle: { fontSize: 14, color: BRAND.textSecondary, lineHeight: 20, marginBottom: 26 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  prefix: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: BRAND.radius.pill,
    backgroundColor: BRAND.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: { fontSize: 16, fontWeight: '700', color: BRAND.text },
  input: {
    flex: 1,
    height: 56,
    borderRadius: BRAND.radius.pill,
    backgroundColor: BRAND.surfaceMuted,
    paddingHorizontal: 18,
    fontSize: 16,
    fontWeight: '600',
    color: BRAND.text,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BRAND.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: BRAND.textSecondary, fontWeight: '600' },
  inputFull: {
    height: 56,
    borderRadius: BRAND.radius.pill,
    backgroundColor: BRAND.surfaceMuted,
    paddingHorizontal: 18,
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.text,
    marginBottom: 20,
  },
  assignment: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BRAND.border,
    ...BRAND.shadow,
  },
  assignmentLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: BRAND.textSecondary,
    marginBottom: 14,
  },
  assignmentGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  assignmentCell: { width: '50%', marginBottom: 14 },
  cellLabel: { fontSize: 12, color: BRAND.textSecondary, marginBottom: 3 },
  cellValue: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  cta: {
    height: 56,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  terms: { fontSize: 12, color: BRAND.textTertiary, textAlign: 'center', marginTop: 18, lineHeight: 18 },
  link: { color: BRAND.primary, fontWeight: '600' },
});
