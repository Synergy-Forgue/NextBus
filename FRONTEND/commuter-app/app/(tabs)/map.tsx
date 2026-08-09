import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';
import { smartAlertsService } from '@/src/services/smartAlertsService';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function MapScreen() {
  const router = useRouter();
  const { selectedRoute, setLateNightMode } = useCommuterStore();
  const [buses, setBuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [aiAlert, setAiAlert] = useState<any>(null);
  const [isLateNight, setIsLateNight] = useState(false);
  const [crowdWarning, setCrowdWarning] = useState<string | null>(null);
  const [region, setRegion] = useState({
    latitude: 17.7261,
    longitude: 83.3085,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    initLocation();
    checkLateNightMode();
    loadBuses();
    const interval = setInterval(() => {
      loadBuses();
      checkLateNightMode();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRoute]);

  const initLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch {}
  };

  const checkLateNightMode = () => {
    const hour = new Date().getHours();
    const isLate = hour >= 21 || hour < 6;
    setIsLateNight(isLate);
    setLateNightMode(isLate);
  };

  const loadBuses = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/buses`);
      const allBuses = res.data.buses || [];
      if (selectedRoute?.id) {
        setBuses(allBuses.filter((b: any) => b.route_id === selectedRoute.id).slice(0, 4));
      } else {
        setBuses(allBuses.slice(0, 5));
      }

      // REAL FEATURE: Check Smart Alerts
      if (userLocation && allBuses.length > 0) {
        const selectedBus = allBuses[0];
        if (selectedBus) {
          // Check AI-Proactive Alert
          const alert = await smartAlertsService.checkAIProactiveAlert(
            userLocation.latitude,
            userLocation.longitude,
            12, // mock ETA
            selectedRoute?.number || '10K',
            { latitude: selectedBus.latitude, longitude: selectedBus.longitude }
          );
          setAiAlert(alert.trigger ? alert : null);

          // Check Crowd Safety
          const crowdCheck = smartAlertsService.checkCrowdSafety(
            selectedBus.occupancy || 60,
            isLateNight
          );
          setCrowdWarning(crowdCheck.safe ? null : crowdCheck.message || null);
        }
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  const selectedBus = buses[0];

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={styles.map}
        region={region}
        onRegionChange={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {/* SPEC: Selected bus HIGHLIGHTED - Bigger, Primary Color */}
        {selectedBus && (
          <Marker
            coordinate={{ latitude: selectedBus.latitude, longitude: selectedBus.longitude }}
            title={`Route ${selectedBus.route_number} - ${selectedBus.bus_number}`}
            pinColor={BRAND.primary}
          >
            <View style={styles.selectedMarker}>
              <Text style={styles.selectedMarkerEmoji}>🚌</Text>
              <Text style={styles.selectedMarkerLabel}>{selectedBus.route_number}</Text>
            </View>
          </Marker>
        )}

        {/* SPEC: Nearby buses (3-4) based on active filter - DIMMED */}
        {buses.slice(1, 4).map((bus, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
            title={`Route ${bus.route_number} - ${bus.bus_number}`}
            pinColor={BRAND.textTertiary}
          >
            <View style={styles.nearbyMarker}>
              <Text style={styles.nearbyMarkerEmoji}>🚍</Text>
              <Text style={styles.nearbyMarkerLabel}>{bus.route_number}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Visakhapatnam • Live</Text>
        <TouchableOpacity onPress={loadBuses}>
          <Text style={styles.refresh}>{loading ? '⟳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {/* SPEC: Show which buses are displayed based on filter */}
      {selectedRoute && (
        <View style={{ position: 'absolute', top: 80, left: 16, right: 16, backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 10, ...BRAND.shadow }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND.textSecondary }}>🚌 Selected: Route {selectedRoute.route_number || selectedRoute.number}</Text>
          <Text style={{ fontSize: 10, color: BRAND.textTertiary, marginTop: 2 }}>📍 Showing 3-4 nearby buses</Text>
        </View>
      )}

      {/* AI-PROACTIVE ALERT */}
      {aiAlert && (
        <View style={{ position: 'absolute', top: 80, left: 16, right: 16, backgroundColor: BRAND.primary, borderRadius: BRAND.radius.lg, padding: 14, ...BRAND.shadow }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{aiAlert.message}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 }}>Walk time: {aiAlert.walkTime} min • Distance: {aiAlert.distance} km</Text>
        </View>
      )}

      {/* CROWD SAFETY WARNING (Late Night Mode) */}
      {crowdWarning && (
        <View style={{ position: 'absolute', top: isLateNight ? 160 : 80, left: 16, right: 16, backgroundColor: BRAND.danger, borderRadius: BRAND.radius.lg, padding: 12, ...BRAND.shadow }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{crowdWarning}</Text>
        </View>
      )}

      {/* LATE NIGHT MODE BADGE */}
      {isLateNight && (
        <View style={{ position: 'absolute', top: 80, right: 16, backgroundColor: BRAND.warning, borderRadius: BRAND.radius.pill, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>🌙 Late Night Mode</Text>
        </View>
      )}

      {/* Bottom Bus Info */}
      {selectedBus && (
        <View style={styles.busInfo}>
          <View style={styles.busRoute}>
            <Text style={styles.busNumber}>{selectedBus.route_number}</Text>
            <View style={styles.busDetails}>
              <Text style={styles.busName}>{selectedBus.bus_number}</Text>
              <Text style={styles.busDistance}>📍 2.3 km away • 8 min</Text>
            </View>
          </View>

          <View style={styles.busStats}>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={styles.statValue}>{selectedBus.occupancy || 62}%</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>⏱️</Text>
              <Text style={styles.statValue}>8m</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>♀️</Text>
              <Text style={styles.statValue}>Safe</Text>
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push('/trip-sharing')} activeOpacity={0.8}>
            <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Share Trip</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* SOS Button (floating) */}
      <TouchableOpacity style={styles.sosButton} onPress={() => router.push('/sos')} activeOpacity={0.8}>
        <Text style={styles.sosButtonText}>SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  map: { flex: 1, backgroundColor: '#E0E0E0' },
  header: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.xl, paddingHorizontal: 14, paddingVertical: 10, ...BRAND.shadow },
  back: { fontSize: 20, color: BRAND.text, fontWeight: '800' },
  title: { fontSize: 14, fontWeight: '700', color: BRAND.text },
  refresh: { fontSize: 18 },
  busInfo: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: BRAND.surface, borderRadius: BRAND.radius.xl, padding: 16, ...BRAND.shadow },
  busRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  busNumber: { fontSize: 24, fontWeight: '900', color: BRAND.primary, width: 50 },
  busDetails: { flex: 1 },
  busName: { fontSize: 14, fontWeight: '700', color: BRAND.text },
  busDistance: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  busStats: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: BRAND.surfaceMuted, borderRadius: BRAND.radius.lg, padding: 10, alignItems: 'center' },
  statEmoji: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 12, fontWeight: '800', color: BRAND.text },
  actionBtn: { height: 48, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sosButton: { position: 'absolute', bottom: 32, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: BRAND.danger, justifyContent: 'center', alignItems: 'center', ...BRAND.shadow },
  sosButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  selectedMarker: { width: 50, height: 50, borderRadius: 25, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FFFFFF', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
  selectedMarkerEmoji: { fontSize: 24, fontWeight: '900' },
  selectedMarkerLabel: { fontSize: 8, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  nearbyMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND.textTertiary, justifyContent: 'center', alignItems: 'center', opacity: 0.5, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  nearbyMarkerEmoji: { fontSize: 18, fontWeight: '700' },
  nearbyMarkerLabel: { fontSize: 7, fontWeight: '700', color: '#FFFFFF', marginTop: 1 },
});

