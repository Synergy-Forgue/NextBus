import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/src/styles/brand';

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/onboarding');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>🚌</Text>
        <Text style={styles.title}>NextBus</Text>
        <Text style={styles.subtitle}>Real-time Transit for Vizag & Mysuru</Text>

        <View style={styles.progressBar}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
        <Text style={styles.loading}>Establishing connection...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  content: { alignItems: 'center' },
  logo: { fontSize: 80, marginBottom: 24 },
  title: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginBottom: 40 },
  progressBar: { marginBottom: 20 },
  loading: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
});
