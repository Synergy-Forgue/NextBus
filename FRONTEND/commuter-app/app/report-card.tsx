import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/src/styles/brand';
import { savedRoutesService } from '@/src/services/savedRoutesService';

export default function ReportCard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const weeklyStats = await savedRoutesService.getWeeklyStats();
      setStats(weeklyStats);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!stats) return;
    try {
      await Share.share({
        message: `🚌 My NextBus Weekly Report\n\n🚀 Trips: ${stats.tripCount}\n⏱️ Time Saved: ${Math.floor(stats.timeSavedMinutes / 60)}h ${stats.timeSavedMinutes % 60}m\n✅ On-Time Rate: ${stats.onTimePercent}%\n🌱 CO₂ Saved: ${stats.co2SavedKg} kg\n📍 Most Reliable: Route ${stats.mostReliableRoute}\n\nTraveling smart with NextBus! 🌍`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Weekly Report</Text>
        <TouchableOpacity onPress={handleShare} disabled={!stats}>
          <Text style={styles.share}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* REAL Stats from savedRoutesService */}
      {stats && (
        <>
          <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mainCard}>
            <Text style={styles.weekLabel}>THIS WEEK</Text>
            <Text style={styles.mainTitle}>Your Transit Week</Text>

            <View style={styles.mainStatsRow}>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatEmoji}>🚀</Text>
                <Text style={styles.mainStatValue}>{stats.tripCount}</Text>
                <Text style={styles.mainStatLabel}>Trips</Text>
              </View>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatEmoji}>⏱️</Text>
                <Text style={styles.mainStatValue}>{Math.floor(stats.timeSavedMinutes / 60)}h {stats.timeSavedMinutes % 60}m</Text>
                <Text style={styles.mainStatLabel}>Time Saved</Text>
              </View>
              <View style={styles.mainStat}>
                <Text style={styles.mainStatEmoji}>🌱</Text>
                <Text style={styles.mainStatValue}>{stats.co2SavedKg} kg</Text>
                <Text style={styles.mainStatLabel}>CO₂ Saved</Text>
              </View>
            </View>
          </LinearGradient>
        </>
      )}

      {/* REAL METRICS from service */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PERFORMANCE METRICS</Text>

          <View style={styles.metricCard}>
            <View style={styles.metricLeft}>
              <Text style={styles.metricEmoji}>✅</Text>
              <View>
                <Text style={styles.metricName}>On-Time Rate</Text>
                <Text style={styles.metricDesc}>How often buses arrived on schedule</Text>
              </View>
            </View>
            <Text style={styles.metricValue}>{stats.onTimePercent}%</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricLeft}>
              <Text style={styles.metricEmoji}>⭐</Text>
              <View>
                <Text style={styles.metricName}>Most Reliable Route</Text>
                <Text style={styles.metricDesc}>Your best performing route</Text>
              </View>
            </View>
            <View style={styles.metricRight}>
              <Text style={styles.metricBadge}>{stats.mostReliableRoute}</Text>
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricLeft}>
              <Text style={styles.metricEmoji}>🚌</Text>
              <View>
                <Text style={styles.metricName}>Trips This Week</Text>
                <Text style={styles.metricDesc}>Total journeys completed</Text>
              </View>
            </View>
            <Text style={styles.metricValue}>{stats.tripCount}</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricLeft}>
              <Text style={styles.metricEmoji}>🌍</Text>
              <View>
                <Text style={styles.metricName}>Environmental Impact</Text>
                <Text style={styles.metricDesc}>CO₂ saved this week</Text>
              </View>
            </View>
            <Text style={styles.metricValue}>{stats.co2SavedKg} kg</Text>
          </View>
        </View>
      )}

      {/* Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INSIGHTS</Text>

        <View style={styles.insightCard}>
          <Text style={styles.insightEmoji}>💡</Text>
          <Text style={styles.insightText}>
            Route 10K has the highest on-time performance. Consider using it more often!
          </Text>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightEmoji}>💡</Text>
          <Text style={styles.insightText}>
            Peak hours (8-9 AM) are busier. Travel 15 min earlier for a more comfortable ride.
          </Text>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightEmoji}>🎉</Text>
          <Text style={styles.insightText}>
            You've reduced your carbon footprint by 42 kg this week — great for the planet!
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={{ marginHorizontal: 16 }}>
        <LinearGradient colors={[BRAND.border, BRAND.surfaceMuted]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Done</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  back: { fontSize: 24, color: BRAND.textSecondary, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.text },
  share: { fontSize: 20 },
  mainCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: BRAND.radius.xl, padding: 20, alignItems: 'center' },
  weekLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  mainTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 20 },
  mainStatsRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-around' },
  mainStat: { alignItems: 'center', flex: 1 },
  mainStatEmoji: { fontSize: 32, marginBottom: 8 },
  mainStatValue: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  mainStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: BRAND.textSecondary, marginBottom: 12 },
  metricCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, ...BRAND.shadow },
  metricLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  metricEmoji: { fontSize: 24 },
  metricName: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginBottom: 2 },
  metricDesc: { fontSize: 12, color: BRAND.textSecondary },
  metricRight: { marginLeft: 12 },
  metricValue: { fontSize: 16, fontWeight: '900', color: BRAND.primary },
  metricBadge: { backgroundColor: BRAND.primary, color: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BRAND.radius.md, fontSize: 12, fontWeight: '800' },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: BRAND.surfaceMuted, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, gap: 12, borderLeftWidth: 4, borderLeftColor: BRAND.primary },
  insightEmoji: { fontSize: 20, marginTop: 2 },
  insightText: { flex: 1, fontSize: 13, color: BRAND.text, fontWeight: '600', lineHeight: 19 },
  closeBtn: { height: 48, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: BRAND.text, fontSize: 15, fontWeight: '800' },
});
