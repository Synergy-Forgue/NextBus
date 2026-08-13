import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';
import { smartAlertsService } from '@/src/services/smartAlertsService';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { routeService } from '@/src/services/routeService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nextbus-production.up.railway.app';
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws/subscribe';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295;
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p)/2 + 
          c(lat1 * p) * c(lat2 * p) * 
          (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)); 
}

export default function MapScreen() {
  const router = useRouter();
  const { selectedRoute, setLateNightMode } = useCommuterStore();
  const [buses, setBuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [aiAlert, setAiAlert] = useState<any>(null);
  const [isLateNight, setIsLateNight] = useState(false);
  const [crowdWarning, setCrowdWarning] = useState<string | null>(null);
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [region, setRegion] = useState({
    latitude: 17.7261,
    longitude: 83.3085,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  
  const mapRef = useRef<MapView>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    initLocation();
    checkLateNightMode();
    const interval = setInterval(checkLateNightMode, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedRoute?.id) {
      loadRouteStops(selectedRoute.id);
    } else {
      setRouteStops([]);
    }
  }, [selectedRoute]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

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

  const loadRouteStops = async (routeId: number | string) => {
    try {
      const id = typeof routeId === 'string' ? parseInt(routeId, 10) : routeId;
      const stops = await routeService.getRouteStops(id);
      setRouteStops(stops || []);
      if (stops && stops.length > 0) {
        const firstStop = stops[0];
        const newRegion = {
          latitude: firstStop.latitude,
          longitude: firstStop.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
      }
    } catch (error) {
      console.error('Failed to load stops:', error);
    }
  };

  const connectWebSocket = () => {
    setLoading(true);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setLoading(false);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SNAPSHOT') {
          setBuses(data.buses || []);
          checkAlerts(data.buses || []);
        } else if (data.type === 'LOCATION_UPDATE') {
          setBuses((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex((b) => b.bus_id === data.bus.bus_id);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...data.bus };
            } else {
              updated.push(data.bus);
            }
            return updated;
          });
        } else if (data.type === 'BUS_OFFLINE') {
          setBuses((prev) => prev.filter((b) => b.bus_id !== data.bus_id));
        }
      } catch (e) {
        console.error('WS Message error:', e);
      }
    };

    ws.onerror = () => {
      setLoading(false);
    };

    ws.onclose = () => {
      setLoading(false);
    };
  };

  const checkAlerts = async (currentBuses: any[]) => {
    if (userLocation && currentBuses.length > 0) {
      const targetBus = selectedRoute 
        ? currentBuses.find(b => b.route_id === selectedRoute.id || b.route_number === selectedRoute.number)
        : currentBuses[0];

      if (targetBus) {
        const alert = await smartAlertsService.checkAIProactiveAlert(
          userLocation.latitude,
          userLocation.longitude,
          12,
          selectedRoute?.number || '10K',
          { latitude: targetBus.latitude, longitude: targetBus.longitude }
        );
        setAiAlert(alert.trigger ? alert : null);

        const crowdCheck = smartAlertsService.checkCrowdSafety(
          targetBus.occupancy || 60,
          isLateNight
        );
        setCrowdWarning(crowdCheck.safe ? null : crowdCheck.message || null);
      }
    }
  };

  const selectedBus = selectedRoute 
    ? buses.find(b => b.route_id === selectedRoute.id || b.route_number === selectedRoute.number)
    : buses[0];

  let etaText = 'No live data';
  let distanceText = '';
  let timeValue = '--m';
  let isLive = false;

  if (selectedBus && userLocation) {
    isLive = true;
    const dist = getDistance(
      userLocation.latitude,
      userLocation.longitude,
      selectedBus.latitude,
      selectedBus.longitude
    );
    const speed = selectedBus.speed || 30; // km/h
    const timeHours = dist / speed;
    const timeMins = Math.round(timeHours * 60);

    distanceText = `${dist.toFixed(1)} km away`;
    timeValue = `${timeMins}m`;
    etaText = `📍 ${distanceText} • ${timeValue}`;
  } else if (selectedBus) {
    isLive = true;
    etaText = 'Live location available';
    timeValue = '--m';
  }

  const nearbyBuses = buses.filter(b => b.bus_id !== selectedBus?.bus_id).slice(0, 3);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {routeStops.length > 0 && (
          <Polyline
            coordinates={routeStops.map(s => ({ latitude: s.latitude, longitude: s.longitude }))}
            strokeColor={BRAND.primary}
            strokeWidth={4}
          />
        )}

        {routeStops.map((stop, i) => (
          <Marker
            key={`stop-${i}`}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name || `Stop ${i+1}`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderColor: BRAND.primary, borderWidth: 3 }} />
          </Marker>
        ))}

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

        {nearbyBuses.map((bus, i) => (
          <Marker
            key={`bus-${i}`}
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

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Visakhapatnam • {isLive ? 'Live' : 'Connecting...'}</Text>
        <TouchableOpacity onPress={connectWebSocket}>
          <Text style={styles.refresh}>{loading ? '⟳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {selectedRoute && (
        <View style={{ position: 'absolute', top: 80, left: 16, right: 16, backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 10, ...BRAND.shadow }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND.textSecondary }}>🚌 Selected: Route {selectedRoute.route_number || selectedRoute.number}</Text>
          <Text style={{ fontSize: 10, color: BRAND.textTertiary, marginTop: 2 }}>📍 Showing 3-4 nearby buses</Text>
        </View>
      )}

      {aiAlert && (
        <View style={{ position: 'absolute', top: 80, left: 16, right: 16, backgroundColor: BRAND.primary, borderRadius: BRAND.radius.lg, padding: 14, ...BRAND.shadow }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{aiAlert.message}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 }}>Walk time: {aiAlert.walkTime} min • Distance: {aiAlert.distance} km</Text>
        </View>
      )}

      {crowdWarning && (
        <View style={{ position: 'absolute', top: isLateNight ? 160 : 80, left: 16, right: 16, backgroundColor: BRAND.danger, borderRadius: BRAND.radius.lg, padding: 12, ...BRAND.shadow }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{crowdWarning}</Text>
        </View>
      )}

      {isLateNight && (
        <View style={{ position: 'absolute', top: 80, right: 16, backgroundColor: BRAND.warning, borderRadius: BRAND.radius.pill, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>🌙 Late Night Mode</Text>
        </View>
      )}

      {selectedBus && (
        <View style={styles.busInfo}>
          <View style={styles.busRoute}>
            <Text style={styles.busNumber}>{selectedBus.route_number}</Text>
            <View style={styles.busDetails}>
              <Text style={styles.busName}>{selectedBus.bus_number}</Text>
              <Text style={styles.busDistance}>{etaText}</Text>
            </View>
          </View>

          <View style={styles.busStats}>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={styles.statValue}>{selectedBus.occupancy || 62}%</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>⏱️</Text>
              <Text style={styles.statValue}>{timeValue}</Text>
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


