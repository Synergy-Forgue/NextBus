import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import { BRAND } from '../styles/brand'

/**
 * Login — "Enter your number" (Figma).
 * Collects a +91 mobile number and moves to OTP verification.
 * (MVP: OTP is mocked locally — no SMS gateway yet.)
 */
export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('')
  const { setPendingPhone } = useCommuterStore()

  const sendOtp = () => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length !== 10) {
      Alert.alert('Invalid number', 'Please enter a valid 10-digit mobile number.')
      return
    }
    setPendingPhone(clean)
    navigation.navigate('OTP')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>🚌</Text>

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
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 96,
  },
  logo: {
    fontSize: 40,
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: BRAND.text,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: BRAND.textSecondary,
    lineHeight: 20,
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  prefix: {
    height: 56,
    paddingHorizontal: 18,
    borderRadius: BRAND.radius.md,
    backgroundColor: BRAND.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.text,
  },
  input: {
    flex: 1,
    height: 56,
    borderRadius: BRAND.radius.md,
    backgroundColor: BRAND.surfaceMuted,
    paddingHorizontal: 18,
    fontSize: 16,
    fontWeight: '600',
    color: BRAND.text,
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
    fontWeight: '700',
  },
  terms: {
    fontSize: 12,
    color: BRAND.textTertiary,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  link: {
    color: BRAND.primary,
    fontWeight: '600',
  },
})
