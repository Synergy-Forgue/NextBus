import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';

export default function OTP() {
  const router = useRouter();
  const { pendingPhone, loginCommuter } = useCommuterStore();
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(59);
  const [verifying, setVerifying] = useState(false);

  if (!pendingPhone) {
    router.replace('/login');
    return null;
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOTPChange = (idx: number, val: string) => {
    if (val.length > 1) return;
    const newOTP = [...otp];
    newOTP[idx] = val;
    setOtp(newOTP);
  };

  const handleVerify = async () => {
    const otpStr = otp.join('');
    if (otpStr.length !== 4) {
      Alert.alert('Incomplete', 'Please enter all 4 digits');
      return;
    }
    setVerifying(true);
    try {
      await new Promise((r) => setTimeout(r, 1000));
      loginCommuter(pendingPhone);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Error', 'Invalid OTP');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.back}>←</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Verify Your Number</Text>
        <Text style={styles.subtitle}>We sent a code to {pendingPhone}</Text>
      </View>

      <View style={styles.otpWrap}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            style={[styles.otpBox, digit && styles.otpBoxFilled]}
            value={digit}
            onChangeText={(val) => handleOTPChange(i, val)}
            keyboardType="number-pad"
            maxLength={1}
            editable={!verifying}
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity onPress={handleVerify} disabled={verifying || otp.join('').length !== 4} activeOpacity={0.8}>
        <LinearGradient
          colors={BRAND.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, (verifying || otp.join('').length !== 4) && styles.btnDisabled]}
        >
          {verifying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.btnText}>Verify & Continue</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.footer}>
        {timer > 0 ? (
          <Text style={styles.resendText}>Resend OTP in {timer}s</Text>
        ) : (
          <TouchableOpacity>
            <Text style={styles.resendLink}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, padding: 20, paddingTop: 52, justifyContent: 'space-between' },
  back: { fontSize: 24, color: BRAND.textSecondary, marginBottom: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: BRAND.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: BRAND.textSecondary },
  otpWrap: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 32 },
  otpBox: {
    width: 60,
    height: 70,
    borderRadius: BRAND.radius.lg,
    backgroundColor: BRAND.surface,
    borderWidth: 2,
    borderColor: BRAND.border,
    fontSize: 24,
    fontWeight: '900',
    color: BRAND.text,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  otpBoxFilled: { borderColor: BRAND.primary, backgroundColor: BRAND.surfaceMuted },
  btn: { height: 56, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  footer: { alignItems: 'center' },
  resendText: { fontSize: 14, color: BRAND.textSecondary },
  resendLink: { fontSize: 14, fontWeight: '700', color: BRAND.primary },
});
