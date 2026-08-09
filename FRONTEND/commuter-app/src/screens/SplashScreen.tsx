import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import useCommuterStore from '../store/useCommuterStore'
import { BRAND } from '../styles/brand'

/**
 * Splash Screen — "Next Bus / Effortless Urban Mobility"
 * Shows a short "establishing connection" progress, then hands off
 * to onboarding (first run) or login.
 */
export default function SplashScreen({ navigation }: any) {
  const progress = useRef(new Animated.Value(0)).current
  const { hasOnboarded } = useCommuterStore()

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
    }).start()

    const timer = setTimeout(() => {
      // Returning users skip straight to login
      navigation.replace(hasOnboarded ? 'Login' : 'Onboarding')
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '100%'],
  })

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.logoCard}>
          <Text style={styles.logoEmoji}>🚌</Text>
        </View>
        <Text style={styles.title}>Next Bus</Text>
        <Text style={styles.subtitle}>Effortless Urban Mobility</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barWidth }]} />
        </View>
        <Text style={styles.connecting}>ESTABLISHING CONNECTION</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.surface,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...BRAND.shadow,
  },
  logoEmoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: BRAND.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: BRAND.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 56,
    paddingHorizontal: 80,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND.surfaceMuted,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: BRAND.primary,
  },
  connecting: {
    fontSize: 10,
    letterSpacing: 2,
    color: BRAND.textTertiary,
    fontWeight: '600',
  },
})
