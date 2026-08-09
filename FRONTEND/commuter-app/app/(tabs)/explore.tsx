import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/src/styles/brand';

export default function ExploreScreen() {
  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <Text style={styles.title}>Discover Routes</Text>
        <Text style={styles.subtitle}>Explore new bus routes & destinations</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.label}>POPULAR ROUTES</Text>
        {['10K - RTC Complex ↔ Kailasagiri', '900K - Bheemili ↔ Railway Station', '28K - Kothavalasa ↔ RK Beach'].map((route, i) => (
          <TouchableOpacity key={i} activeOpacity={0.8}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{route}</Text>
              <Text style={styles.cardDesc}>15 buses • Avg 12 min</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>NEARBY STOPS</Text>
        {['RTC Complex', 'Dwaraka Bus Station', 'Jagadamba Junction'].map((stop, i) => (
          <TouchableOpacity key={i} activeOpacity={0.8}>
            <View style={styles.card}>
              <Text style={styles.cardEmoji}>📍</Text>
              <Text style={styles.cardTitle}>{stop}</Text>
              <Text style={styles.cardDesc}>2 routes passing</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  banner: { paddingHorizontal: 20, paddingVertical: 32 },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: BRAND.textSecondary, marginBottom: 12 },
  card: { backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, ...BRAND.shadow },
  cardEmoji: { fontSize: 20, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginBottom: 2 },
  cardDesc: { fontSize: 12, color: BRAND.textSecondary },
});
