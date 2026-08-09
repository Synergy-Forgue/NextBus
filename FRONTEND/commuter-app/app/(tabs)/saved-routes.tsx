import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '@/src/styles/brand';
import { savedRoutesService, SavedRoute } from '@/src/services/savedRoutesService';
import { useCommuterStore } from '@/src/store/commuterStore';

export default function SavedRoutesScreen() {
  const router = useRouter();
  const { addSavedRoute } = useCommuterStore();
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [suggested, setSuggested] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const savedRoutes = await savedRoutesService.getSavedRoutes();
      const suggestedRoutes = await savedRoutesService.getSuggestedRoutesByTime();
      setSaved(savedRoutes);
      setSuggested(suggestedRoutes);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = (route: SavedRoute) => {
    useCommuterStore.getState().setSelectedRoute({
      route_number: route.routeId.toString(),
      route_name: route.routeName,
      from_stop: route.fromStop,
      to_stop: route.toStop,
      frequency: route.frequency,
    });
    addSavedRoute({
      route_number: route.routeId.toString(),
      route_name: route.routeName,
    });
    router.push('/(tabs)/map');
  };

  const handleRemove = async (routeId: string) => {
    await savedRoutesService.removeRoute(routeId);
    loadRoutes();
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Routes</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* SUGGESTED NOW - AI Learned */}
      {suggested.length > 0 && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 }}>
            <Text style={styles.sectionTitle}>🤖 Suggested Right Now</Text>
            <View style={{ backgroundColor: BRAND.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>AI LEARNED</Text>
            </View>
          </View>
          {suggested.map((route) => (
            <TouchableOpacity
              key={route.id}
              onPress={() => handleStartTrip(route)}
              activeOpacity={0.8}
            >
              <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ ...styles.routeCard, marginHorizontal: 16, marginBottom: 10 }}>
                <View style={styles.routeLeft}>
                  <Text style={{ ...styles.routeNum, color: '#FFFFFF' }}>Route {route.routeId}</Text>
                  <Text style={{ ...styles.routeName, color: 'rgba(255,255,255,0.9)' }}>{route.routeName}</Text>
                  <Text style={{ ...styles.routeDistance, color: 'rgba(255,255,255,0.8)' }}>
                    {route.fromStop} → {route.toStop}
                  </Text>
                  {route.predictedDepartureTime && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
                      ⏱️ Usually at {route.predictedDepartureTime} ({route.confidence}% confident)
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>🚀 START</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>Used {route.frequency}x</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ALL SAVED ROUTES */}
      {saved.length > 0 && (
        <View style={styles.section}>
          <Text style={{ ...styles.sectionTitle, paddingHorizontal: 16, marginBottom: 12 }}>📍 All Saved Routes</Text>
          {saved.map((route) => (
            <View key={route.id} style={{ ...styles.routeCard, marginHorizontal: 16, marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => handleStartTrip(route)}
                style={{ flex: 1 }}
                activeOpacity={0.8}
              >
                <View style={styles.routeLeft}>
                  <Text style={styles.routeNum}>Route {route.routeId}</Text>
                  <Text style={styles.routeName}>{route.routeName}</Text>
                  <Text style={styles.routeDistance}>
                    {route.fromStop} → {route.toStop}
                  </Text>
                  <Text style={{ fontSize: 11, color: BRAND.textSecondary, marginTop: 4 }}>
                    Used {route.frequency}x • Last: {new Date(route.lastUsed).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemove(route.id)}
                style={{ paddingLeft: 12 }}
              >
                <Text style={{ fontSize: 20, color: BRAND.danger }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* EMPTY STATE */}
      {saved.length === 0 && suggested.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🚌</Text>
          <Text style={{ fontSize: 16, fontWeight: '900', color: BRAND.text, marginBottom: 8, textAlign: 'center' }}>
            No saved routes yet
          </Text>
          <Text style={{ fontSize: 13, color: BRAND.textSecondary, textAlign: 'center', marginBottom: 24 }}>
            Start a few trips and we'll learn your favorite routes automatically
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)')}
            style={{
              backgroundColor: BRAND.primary,
              borderRadius: BRAND.radius.pill,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>🔍 Search a Route</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  back: { fontSize: 24, color: BRAND.text, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', color: BRAND.text },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: BRAND.text },
  routeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, ...BRAND.shadow },
  routeLeft: { flex: 1 },
  routeNum: { fontSize: 16, fontWeight: '900', color: BRAND.primary, marginBottom: 4 },
  routeName: { fontSize: 13, fontWeight: '700', color: BRAND.text, marginBottom: 2 },
  routeDistance: { fontSize: 11, color: BRAND.textSecondary },
});
