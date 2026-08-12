import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useCommuterStore from '../store/useCommuterStore';
import { BRAND } from '../styles/brand';

export default function SavedRoutesScreen({ navigation }: any) {
  const {
    savedRoutes,
    loadSavedRoutes,
    removeSavedRoute,
    setSelectedRoute,
  } = useCommuterStore();

  useEffect(() => {
    loadSavedRoutes();
  }, []);

  const handleStartTrip = (route: any) => {
    setSelectedRoute(route);
    navigation.navigate('Map');
  };

  const handleRemove = (routeId: string | number) => {
    removeSavedRoute(routeId);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Saved Routes</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ALL SAVED ROUTES */}
      {savedRoutes.length > 0 ? (
        <View style={styles.section}>
          <Text style={{ ...styles.sectionTitle, paddingHorizontal: 16, marginBottom: 12 }}>
            📍 Bookmarked Routes ({savedRoutes.length})
          </Text>
          {savedRoutes.map((route: any, idx: number) => (
            <View key={route.id || idx} style={styles.routeCard}>
              <TouchableOpacity
                onPress={() => handleStartTrip(route)}
                style={{ flex: 1 }}
                activeOpacity={0.8}
              >
                <View style={styles.routeLeft}>
                  <Text style={styles.routeNum}>
                    Route {route.route_number || route.routeId}
                  </Text>
                  <Text style={styles.routeName}>
                    {route.route_name || route.routeName || 'Visakhapatnam Line'}
                  </Text>
                  <Text style={styles.routeDistance}>
                    {route.start_stop || route.fromStop || 'Origin'} ➔ {route.end_stop || route.toStop || 'Destination'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemove(route.id || route.route_number)}
                style={{ paddingLeft: 12, paddingVertical: 8 }}
              >
                <Text style={{ fontSize: 20 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        /* EMPTY STATE - Correct Semantic Behavior */
        <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 54, marginBottom: 16 }}>🚌</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: BRAND.text, marginBottom: 8, textAlign: 'center' }}>
            No saved routes yet
          </Text>
          <Text style={{ fontSize: 13, color: BRAND.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
            Bookmark your daily commute routes to access real-time bus tracking with one tap.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Search')}
            style={{
              backgroundColor: BRAND.primary,
              borderRadius: BRAND.radius.pill,
              paddingHorizontal: 24,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>🔍 Search & Bookmark a Route</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: BRAND.surface,
  },
  back: { fontSize: 24, color: BRAND.text, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.text },
  section: { marginBottom: 20, marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: BRAND.text },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    ...BRAND.shadow,
  },
  routeLeft: { flex: 1 },
  routeNum: { fontSize: 16, fontWeight: '900', color: BRAND.primary, marginBottom: 4 },
  routeName: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginBottom: 2 },
  routeDistance: { fontSize: 12, color: BRAND.textSecondary },
});
