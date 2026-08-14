import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { useCommuterStore } from '@/src/store/commuterStore';
import type { BusPosition, VehicleStatus } from '@/src/store/useCommuterStore';
import { BRAND } from '@/src/styles/brand';
import { smartAlertsService } from '@/src/services/smartAlertsService';
import { routeService, RouteStop } from '@/src/services/routeService';
import useRealTimeBus from '@/src/hooks/useRealTimeBus';

const VIZAG_FALLBACK_REGION = {
  latitude: 17.7261,
  longitude: 83.3085,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/** Great-circle distance in km. */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Frame the camera around a set of coordinates with a little breathing room. */
function regionForCoords(coords: { latitude: number; longitude: number }[]) {
  if (!coords.length) return VIZAG_FALLBACK_REGION;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
  };
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

/** How the backend's VehicleStatus is presented to a commuter. */
function statusPresentation(status: VehicleStatus | undefined, lastUpdated?: string) {
  const ageSec = lastUpdated
    ? Math.max(0, Math.round((Date.now() - new Date(lastUpdated).getTime()) / 1000))
    : null;

  switch (status) {
    case 'APPROACHING STOP':
      return { label: 'Approaching stop', color: '#4F46E5', isLive: true };
    case 'AT STOP':
      return { label: 'At stop', color: '#7C3AED', isLive: true };
    case 'STALE':
      return { label: ageSec ? `No signal ${formatAge(ageSec)}` : 'Stale', color: '#F59E0B', isLive: false };
    case 'SIGNAL LOST':
      return { label: 'Signal lost', color: '#F59E0B', isLive: false };
    case 'OFFLINE':
      return { label: 'Offline', color: '#64748B', isLive: false };
    default:
      return { label: 'Live', color: '#16A34A', isLive: true };
  }
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return '<1m';
  return `${Math.round(seconds / 60)}m`;
}

export default function MapScreen() {
  const router = useRouter();
  const { selectedRoute, setLateNightMode } = useCommuterStore();

  // Single live-telemetry subscription for the screen, filtered to the selected
  // route when there is one. This replaces a hand-rolled socket that read
  // `data.buses` and listened for `LOCATION_UPDATE` — neither of which the
  // backend ever sends, so no live position ever reached this screen.
  const routeId = selectedRoute?.id ? Number(selectedRoute.id) : undefined;
  const { busPositions, isConnected, error } = useRealTimeBus(routeId);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [aiAlert, setAiAlert] = useState<any>(null);
  const [isLateNight, setIsLateNight] = useState(false);
  const [crowdWarning, setCrowdWarning] = useState<string | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [hasFramed, setHasFramed] = useState(false);

  const mapRef = useRef<MapView>(null);

  const buses: BusPosition[] = useMemo(() => Object.values(busPositions || {}), [busPositions]);

  useEffect(() => {
    initLocation();
    checkLateNightMode();
    const interval = setInterval(checkLateNightMode, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load the ordered stop list whenever the commuter picks a different route
  useEffect(() => {
    setHasFramed(false);
    if (!routeId) {
      setRouteStops([]);
      return;
    }
    let cancelled = false;
    routeService
      .getRouteStops(routeId)
      .then((stops) => {
        if (!cancelled) setRouteStops(stops || []);
      })
      .catch(() => {
        if (!cancelled) setRouteStops([]);
      });
    return () => {
      cancelled = true;
    };
  }, [routeId]);

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
    const isLate = smartAlertsService.checkLateNightMode();
    setIsLateNight(isLate);
    setLateNightMode(isLate);
  };

  // The bus the commuter is actually tracking
  const selectedBus: BusPosition | undefined = useMemo(() => {
    if (!buses.length) return undefined;
    if (routeId) {
      const onRoute = buses.find((b) => b.route_id === routeId);
      if (onRoute) return onRoute;
    }
    if (userLocation) {
      return [...buses].sort(
        (a, b) =>
          distanceKm(userLocation.latitude, userLocation.longitude, a.lat, a.lng) -
          distanceKm(userLocation.latitude, userLocation.longitude, b.lat, b.lng)
      )[0];
    }
    return buses[0];
  }, [buses, routeId, userLocation]);

  // Auto-frame the camera once per route: fit the whole route, or bus + user.
  useEffect(() => {
    if (hasFramed || !mapRef.current) return;

    const coords: { latitude: number; longitude: number }[] = [];
    if (routeStops.length) {
      coords.push(...routeStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })));
    } else if (selectedBus) {
      coords.push({ latitude: selectedBus.lat, longitude: selectedBus.lng });
      if (userLocation) coords.push(userLocation);
    }

    if (coords.length) {
      mapRef.current.animateToRegion(regionForCoords(coords), 800);
      setHasFramed(true);
    }
  }, [routeStops, selectedBus, userLocation, hasFramed]);

  // Proactive nudges, driven by real telemetry rather than a hardcoded ETA
  useEffect(() => {
    if (!selectedBus || !userLocation) {
      setAiAlert(null);
      setCrowdWarning(null);
      return;
    }

    const run = async () => {
      const etaMinutes = selectedBus.eta;
      if (etaMinutes != null) {
        const nextStop = routeStops[selectedBus.nextStopIndex ?? 0];
        const target = nextStop
          ? { latitude: nextStop.latitude, longitude: nextStop.longitude }
          : { latitude: selectedBus.lat, longitude: selectedBus.lng };
        const alert = await smartAlertsService.checkAIProactiveAlert(
          userLocation.latitude,
          userLocation.longitude,
          etaMinutes,
          selectedBus.routeNo,
          target
        );
        setAiAlert(alert.trigger ? alert : null);
      } else {
        setAiAlert(null);
      }

      const occupancyPercent = Math.round(((selectedBus.occupancy_count ?? 0) / 50) * 100);
      const crowdCheck = smartAlertsService.checkCrowdSafety(occupancyPercent, isLateNight);
      setCrowdWarning(crowdCheck.safe ? null : crowdCheck.message || null);
    };

    run();
  }, [selectedBus, userLocation, isLateNight, routeStops]);

  const presentation = selectedBus
    ? statusPresentation(selectedBus.status, selectedBus.last_updated)
    : null;
  const nearbyBuses = buses.filter((b) => b.busId !== selectedBus?.busId).slice(0, 4);

  let distanceText = '';
  if (selectedBus && userLocation) {
    const dist = distanceKm(userLocation.latitude, userLocation.longitude, selectedBus.lat, selectedBus.lng);
    distanceText = `${dist.toFixed(1)} km away`;
  }

  const etaLabel = selectedBus?.eta != null ? `${selectedBus.eta}m` : '--';
  const upcomingStops = (selectedBus?.stop_etas || []).filter((s) => s.eta_seconds !== null);
  const passedCount = (selectedBus?.stop_etas || []).length - upcomingStops.length;

  const connectionLabel = isConnected
    ? buses.length > 0
      ? `Live • ${buses.length} bus${buses.length === 1 ? '' : 'es'}`
      : 'Live • no buses in service'
    : error
    ? 'Reconnecting…'
    : 'Connecting…';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={VIZAG_FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton
      >
        {routeStops.length > 1 && (
          <Polyline
            coordinates={routeStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))}
            strokeColor={BRAND.primary}
            strokeWidth={4}
          />
        )}

        {routeStops.map((stop, i) => {
          const isPassed = selectedBus?.nextStopIndex != null && i < selectedBus.nextStopIndex;
          const isNext = selectedBus?.nextStopIndex === i;
          return (
            <Marker
              key={`stop-${stop.stop_id}-${i}`}
              coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
              title={stop.stop_name}
              description={`Stop ${stop.stop_order}${isNext ? ' • next' : isPassed ? ' • passed' : ''}`}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View
                style={[styles.stopDot, isNext && styles.stopDotNext, isPassed && styles.stopDotPassed]}
              />
            </Marker>
          );
        })}

        {selectedBus && (
          <Marker
            coordinate={{ latitude: selectedBus.lat, longitude: selectedBus.lng }}
            title={`Route ${selectedBus.routeNo}`}
            description={`${selectedBus.licensePlate || ''} • ${presentation?.label || ''}`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.selectedMarker, { borderColor: presentation?.color || BRAND.primary }]}>
              <Text style={styles.selectedMarkerEmoji}>🚌</Text>
              <Text style={styles.selectedMarkerLabel}>{selectedBus.routeNo}</Text>
            </View>
          </Marker>
        )}

        {nearbyBuses.map((bus) => (
          <Marker
            key={`bus-${bus.busId}`}
            coordinate={{ latitude: bus.lat, longitude: bus.lng }}
            title={`Route ${bus.routeNo}`}
            description={bus.licensePlate}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.nearbyMarker}>
              <Text style={styles.nearbyMarkerEmoji}>🚍</Text>
              <Text style={styles.nearbyMarkerLabel}>{bus.routeNo}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>
            {selectedRoute ? `Route ${selectedRoute.route_number}` : 'All Routes'}
          </Text>
          <Text style={[styles.subtitle, { color: isConnected ? BRAND.success : BRAND.warning }]}>
            {connectionLabel}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setHasFramed(false)}>
          <Text style={styles.refresh}>🎯</Text>
        </TouchableOpacity>
      </View>

      {aiAlert && (
        <View style={[styles.banner, { backgroundColor: BRAND.primary, top: 92 }]}>
          <Text style={styles.bannerTitle}>{aiAlert.message}</Text>
          <Text style={styles.bannerSub}>
            Walk time: {aiAlert.walkTime} min • Distance: {aiAlert.distance} km
          </Text>
        </View>
      )}

      {crowdWarning && (
        <View style={[styles.banner, { backgroundColor: BRAND.danger, top: aiAlert ? 156 : 92 }]}>
          <Text style={styles.bannerTitle}>{crowdWarning}</Text>
        </View>
      )}

      {isLateNight && !aiAlert && !crowdWarning && (
        <View style={styles.lateNightBadge}>
          <Text style={styles.lateNightText}>🌙 Late Night Mode</Text>
        </View>
      )}

      {/* Bus info sheet — or an honest empty state */}
      {selectedBus ? (
        <View style={styles.busInfo}>
          <View style={styles.busRoute}>
            <Text style={styles.busNumber}>{selectedBus.routeNo}</Text>
            <View style={styles.busDetails}>
              <Text style={styles.busName}>{selectedBus.licensePlate || 'Bus'}</Text>
              <Text style={styles.busDistance}>
                {distanceText || 'Position unavailable'}
                {selectedBus.last_updated
                  ? ` • updated ${formatAge(
                      Math.round((Date.now() - new Date(selectedBus.last_updated).getTime()) / 1000)
                    )} ago`
                  : ''}
              </Text>
            </View>
            {presentation && (
              <View style={[styles.statusPill, { backgroundColor: presentation.color }]}>
                <Text style={styles.statusPillText}>{presentation.label}</Text>
              </View>
            )}
          </View>

          <View style={styles.busStats}>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>👥</Text>
              <Text style={styles.statValue}>{selectedBus.occupancy_count ?? 0}/50</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>⏱️</Text>
              <Text style={styles.statValue}>{etaLabel}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statEmoji}>🚀</Text>
              <Text style={styles.statValue}>{selectedBus.speed ?? 0} km/h</Text>
            </View>
          </View>

          {/* Ordered upcoming stops with live ETAs */}
          {upcomingStops.length > 0 && (
            <View style={styles.stopsBlock}>
              <Text style={styles.stopsHeading}>
                NEXT STOPS {passedCount > 0 ? `• ${passedCount} passed` : ''}
              </Text>
              <ScrollView style={{ maxHeight: 108 }} showsVerticalScrollIndicator={false}>
                {upcomingStops.slice(0, 6).map((stop, i) => (
                  <View key={`eta-${stop.stop_id}-${i}`} style={styles.stopRow}>
                    <Text style={styles.stopOrder}>{stop.stop_order}</Text>
                    <Text style={styles.stopName} numberOfLines={1}>
                      {stop.stop_name}
                    </Text>
                    <View
                      style={[
                        styles.etaBadge,
                        { backgroundColor: presentation?.isLive ? BRAND.successSoft : BRAND.surfaceMuted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.etaBadgeText,
                          { color: presentation?.isLive ? BRAND.success : BRAND.textSecondary },
                        ]}
                      >
                        {formatEta(stop.eta_seconds)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity onPress={() => router.push('/trip-sharing')} activeOpacity={0.8}>
            <LinearGradient
              colors={BRAND.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Share Trip</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.busInfo}>
          <Text style={styles.emptyTitle}>
            {isConnected ? 'No buses currently in service' : 'Connecting to live tracking…'}
          </Text>
          <Text style={styles.emptySub}>
            {isConnected
              ? selectedRoute
                ? `No active bus on Route ${selectedRoute.route_number} right now. The route and its stops are shown above.`
                : 'No vehicles are publishing telemetry at the moment.'
              : 'Waiting for the tracking server. Retrying automatically.'}
          </Text>
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
  header: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...BRAND.shadow,
  },
  back: { fontSize: 20, color: BRAND.text, fontWeight: '800' },
  title: { fontSize: 14, fontWeight: '800', color: BRAND.text },
  subtitle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  refresh: { fontSize: 18 },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    ...BRAND.shadow,
  },
  bannerTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  lateNightBadge: {
    position: 'absolute',
    top: 92,
    right: 16,
    backgroundColor: BRAND.warning,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lateNightText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  busInfo: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadow,
  },
  busRoute: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  busNumber: { fontSize: 22, fontWeight: '900', color: BRAND.primary },
  busDetails: { flex: 1 },
  busName: { fontSize: 14, fontWeight: '700', color: BRAND.text },
  busDistance: { fontSize: 11, color: BRAND.textSecondary, marginTop: 2 },
  statusPill: { borderRadius: BRAND.radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  busStats: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    padding: 10,
    alignItems: 'center',
  },
  statEmoji: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 12, fontWeight: '800', color: BRAND.text },
  stopsBlock: { marginBottom: 12 },
  stopsHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: BRAND.textSecondary,
    marginBottom: 6,
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  stopOrder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BRAND.surfaceMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.textSecondary,
    overflow: 'hidden',
  },
  stopName: { flex: 1, fontSize: 12, fontWeight: '600', color: BRAND.text },
  etaBadge: { borderRadius: BRAND.radius.md, paddingHorizontal: 8, paddingVertical: 3 },
  etaBadgeText: { fontSize: 11, fontWeight: '800' },
  actionBtn: {
    height: 48,
    borderRadius: BRAND.radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: BRAND.text, marginBottom: 4 },
  emptySub: { fontSize: 12, color: BRAND.textSecondary, lineHeight: 18 },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderColor: BRAND.primary,
    borderWidth: 3,
  },
  stopDotNext: { width: 16, height: 16, borderRadius: 8, borderColor: BRAND.success },
  stopDotPassed: { borderColor: BRAND.textTertiary, opacity: 0.5 },
  selectedMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: BRAND.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    ...BRAND.shadow,
  },
  selectedMarkerEmoji: { fontSize: 22 },
  selectedMarkerLabel: { fontSize: 8, fontWeight: '800', color: '#FFFFFF', marginTop: 1 },
  nearbyMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  nearbyMarkerEmoji: { fontSize: 16 },
  nearbyMarkerLabel: { fontSize: 7, fontWeight: '700', color: '#FFFFFF' },
  sosButton: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND.danger,
    justifyContent: 'center',
    alignItems: 'center',
    ...BRAND.shadow,
  },
  sosButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
});
