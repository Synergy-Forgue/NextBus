import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../src/styles/brand';

/** Splash — "Next Bus / Driver & Conductor Portal" */
export default function Splash() {
  const router = useRouter();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
    }).start();
    const t = setTimeout(() => router.replace('/login'), 2000);
    return () => clearTimeout(t);
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <LinearGradient colors={BRAND.gradient} style={styles.logoCard}>
          <Text style={styles.logoEmoji}>🚌</Text>
        </LinearGradient>
        <Text style={styles.title}>Next Bus</Text>
        <Text style={styles.subtitle}>Driver & Conductor Portal</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.connecting}>ESTABLISHING CONNECTION</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.surface, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...BRAND.shadow,
  },
  logoEmoji: { fontSize: 48 },
  title: { fontSize: 34, fontWeight: '800', color: BRAND.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: BRAND.textSecondary, marginTop: 8, fontWeight: '500' },
  footer: { alignItems: 'center', paddingBottom: 56, paddingHorizontal: 60 },
  connecting: {
    fontSize: 11,
    letterSpacing: 2,
    color: BRAND.textTertiary,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: BRAND.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: BRAND.primary },
});
