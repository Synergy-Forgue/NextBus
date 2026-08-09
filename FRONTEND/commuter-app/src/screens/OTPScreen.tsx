import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import { BRAND } from '../styles/brand'

/**
 * OTP Verification — "Verify your number" (Figma).
 * 4 digit boxes + resend countdown. MVP: any 4-digit code verifies
 * (no SMS gateway yet); creates the local commuter profile.
 */
export default function OTPScreen({ navigation }: any) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [countdown, setCountdown] = useState(59)
  const inputs = useRef<(TextInput | null)[]>([])
  const { pendingPhone, setUserProfile } = useCommuterStore()

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const setDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = v
    setDigits(next)
    if (v && index < 3) inputs.current[index + 1]?.focus()
    if (!v && index > 0) inputs.current[index - 1]?.focus()
  }

  const verify = () => {
    if (digits.some((d) => d === '')) {
      Alert.alert('Incomplete', 'Please enter the full 4-digit code.')
      return
    }
    // MVP: local verification — creates the commuter profile
    setUserProfile({
      id: `user-${pendingPhone}`,
      phone: pendingPhone || '',
      name: 'Commuter',
      language: 'ENGLISH',
    })
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to your phone via SMS to continue.
      </Text>

      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputs.current[i] = r }}
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
        ) : (
          <TouchableOpacity onPress={() => setCountdown(59)}>
            <Text style={styles.resendLink}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.illustration}>
        <Text style={styles.illustrationEmoji}>🔐</Text>
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

      <View style={styles.securityNote}>
        <Text style={styles.securityText}>
          🛡️ Your security is our priority. We never share your contact details
          with third parties.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 28,
    paddingTop: 56,
  },
  back: {
    marginBottom: 20,
  },
  backArrow: {
    fontSize: 24,
    color: BRAND.text,
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
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  otpBox: {
    width: 64,
    height: 64,
    borderRadius: BRAND.radius.lg,
    backgroundColor: BRAND.surfaceMuted,
    fontSize: 24,
    fontWeight: '800',
    color: BRAND.text,
  },
  otpBoxFilled: {
    borderWidth: 2,
    borderColor: BRAND.primary,
    backgroundColor: '#EEF2FF',
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resendTimer: {
    fontSize: 13,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 13,
    color: BRAND.primary,
    fontWeight: '700',
  },
  illustration: {
    height: 160,
    borderRadius: BRAND.radius.xl,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  illustrationEmoji: {
    fontSize: 64,
  },
  cta: {
    height: 54,
    borderRadius: BRAND.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  securityNote: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
    padding: 14,
  },
  securityText: {
    fontSize: 12,
    color: BRAND.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
})
