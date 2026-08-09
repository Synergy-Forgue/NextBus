import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';

export default function Login() {
  const router = useRouter();
  const { setPendingPhone } = useCommuterStore();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Invalid phone', 'Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      // Mock OTP send delay
      await new Promise((r) => setTimeout(r, 1200));
      setPendingPhone(phone);
      router.push('/otp');
    } catch {
      Alert.alert('Error', 'Could not send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
          <Text style={styles.badgeEmoji}>🚌</Text>
        </LinearGradient>
        <Text style={styles.title}>Welcome to NextBus</Text>
        <Text style={styles.subtitle}>Your real-time transit companion</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.prefix}>+91</Text>
          <TextInput
            style={styles.input}
            placeholder="9876543210"
            placeholderTextColor={BRAND.textTertiary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={10}
            editable={!loading}
          />
        </View>
        <Text style={styles.hint}>We'll send you a 4-digit OTP to verify</Text>

        <TouchableOpacity onPress={handleSendOTP} disabled={loading} activeOpacity={0.8}>
          <LinearGradient
            colors={BRAND.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.btn, loading && styles.btnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>Send OTP</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.terms}>
          By signing up, you agree to our <Text style={styles.link}>Terms</Text> and <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, padding: 20, paddingTop: 52, justifyContent: 'space-between' },
  back: { fontSize: 24, color: BRAND.textSecondary, marginBottom: 24 },
  header: { alignItems: 'center' },
  badge: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  badgeEmoji: { fontSize: 40 },
  title: { fontSize: 28, fontWeight: '900', color: BRAND.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: BRAND.textSecondary },
  form: { gap: 16 },
  label: { fontSize: 13, fontWeight: '800', color: BRAND.textSecondary, letterSpacing: 0.5 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, paddingHorizontal: 14, borderWidth: 1.5, borderColor: BRAND.border },
  prefix: { fontSize: 16, fontWeight: '700', color: BRAND.textSecondary, marginRight: 4 },
  input: { flex: 1, paddingVertical: 16, fontSize: 18, color: BRAND.text, fontWeight: '600' },
  hint: { fontSize: 12, color: BRAND.textTertiary, marginTop: -4 },
  btn: { height: 56, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footer: { alignItems: 'center' },
  terms: { fontSize: 12, color: BRAND.textTertiary, textAlign: 'center', lineHeight: 18 },
  link: { color: BRAND.primary, fontWeight: '700' },
});
