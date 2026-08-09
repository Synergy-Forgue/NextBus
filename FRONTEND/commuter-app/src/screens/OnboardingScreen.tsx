import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import { BRAND } from '../styles/brand'

const { width } = Dimensions.get('window')

/**
 * Onboarding — 3 swipeable pages matching the Figma flow:
 *  1. Track buses in real-time
 *  2. AI-powered Smart Picks
 *  3. Safer journeys, smarter alerts → Get Started
 */
const PAGES = [
  {
    key: 'tracking',
    emoji: '🚌',
    chip: '⏱ Route 42 North · Arriving in 3 min',
    title: 'Track buses in real-time',
    body: "See exactly where your bus is and when it'll arrive.",
  },
  {
    key: 'smartpicks',
    emoji: '⚡',
    chip: '✨ Smart Pick · 98% Faster',
    title: 'AI-powered Smart Picks',
    body: 'Get the fastest and smartest routes for your commute with real-time optimization.',
    accent: true,
  },
  {
    key: 'safety',
    emoji: '🛡️',
    chip: '👥 Low Crowd   ·   🚨 SOS Live',
    title: 'Safer journeys, smarter alerts',
    body: 'Crowd levels, SOS support, and live alerts in one app.',
    last: true,
  },
]

export default function OnboardingScreen({ navigation }: any) {
  const listRef = useRef<FlatList>(null)
  const [page, setPage] = useState(0)
  const { completeOnboarding } = useCommuterStore()

  const finish = () => {
    completeOnboarding()
    navigation.replace('Login')
  }

  const next = () => {
    if (page < PAGES.length - 1) {
      listRef.current?.scrollToIndex({ index: page + 1, animated: true })
    } else {
      finish()
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <View style={[styles.illustration, item.accent && styles.illustrationDark]}>
              <Text style={styles.illustrationEmoji}>{item.emoji}</Text>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item.chip}</Text>
              </View>
            </View>

            <Text style={styles.title}>
              {item.key === 'smartpicks' ? (
                <>
                  AI-powered <Text style={{ color: BRAND.purple }}>Smart Picks</Text>
                </>
              ) : (
                item.title
              )}
            </Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      {/* Page dots */}
      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity onPress={next} activeOpacity={0.85} style={styles.ctaWrap}>
        <LinearGradient
          colors={BRAND.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>
            {page === PAGES.length - 1 ? 'Get Started' : 'Continue  →'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.surface,
    paddingTop: 56,
  },
  skip: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: BRAND.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  page: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  illustration: {
    width: width - 96,
    height: width - 140,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    ...BRAND.shadow,
  },
  illustrationDark: {
    backgroundColor: '#1E1B4B',
  },
  illustrationEmoji: {
    fontSize: 88,
  },
  chip: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: BRAND.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BRAND.radius.pill,
    ...BRAND.shadow,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.text,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: BRAND.text,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    color: BRAND.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: BRAND.primary,
  },
  ctaWrap: {
    marginHorizontal: 24,
    marginBottom: 48,
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
})
