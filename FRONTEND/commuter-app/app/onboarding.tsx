import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/src/styles/brand';

const { width } = Dimensions.get('window');

const slides = [
  {
    emoji: '🗺️',
    title: 'Smart Routes',
    desc: 'AI suggests the best bus route based on real-time data, crowd, and your preferences.',
  },
  {
    emoji: '🚌',
    title: 'Live Tracking',
    desc: 'See your bus move in real-time. Never miss a trip with accurate ETAs.',
  },
  {
    emoji: '🛡️',
    title: 'Stay Safe',
    desc: 'Share trips with trusted contacts, one-tap SOS, and safe zone alerts.',
  },
  {
    emoji: '🌱',
    title: 'Save the Planet',
    desc: 'Track your CO₂ saved and earn credits for choosing public transport.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const scroll = (dir: number) => {
    const newPage = Math.max(0, Math.min(slides.length - 1, page + dir));
    setPage(newPage);
    scrollRef.current?.scrollTo({ x: newPage * width, animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setPage(idx);
        }}
      >
        {slides.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.grid}>
              {Array.from({ length: 12 }).map((_, j) => (
                <View key={j} style={[styles.gridCell, (j + i) % 3 === 0 && styles.gridCellActive]} />
              ))}
            </LinearGradient>

            <View style={styles.content}>
              <Text style={styles.emoji}>{slide.emoji}</Text>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.desc}>{slide.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>

        {page < slides.length - 1 ? (
          <TouchableOpacity onPress={() => scroll(1)} activeOpacity={0.8}>
            <LinearGradient
              colors={BRAND.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>Next →</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.replace('/login')} activeOpacity={0.8}>
            <LinearGradient
              colors={BRAND.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>Get Started →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  slide: { flex: 1, justifyContent: 'space-between', padding: 24 },
  grid: { height: 200, borderRadius: BRAND.radius.xl, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' },
  gridCell: { width: '33.33%', height: '33.33%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gridCellActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  content: { alignItems: 'center', marginVertical: 40 },
  emoji: { fontSize: 64, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: BRAND.text, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 15, color: BRAND.textSecondary, textAlign: 'center', lineHeight: 22 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.border },
  dotActive: { backgroundColor: BRAND.primary, width: 24 },
  btn: { height: 56, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
