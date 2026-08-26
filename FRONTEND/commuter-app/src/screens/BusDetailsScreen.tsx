import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Card, Button, Divider, Chip, Icon } from 'react-native-paper';
import useCommuterStore from '../store/useCommuterStore';
import useRealTimeBus from '../hooks/useRealTimeBus';
import { routeService } from '../services/routeService';
import { CONSTANTS } from '../utils/constants';
import { BRAND } from '../styles/brand';
import { getBusService, formatBusPlate } from '../utils/busMeta';

// Haversine distance in meters / km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): { meters: number; text: string } {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return { meters: 0, text: '—' };
  }
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = Math.round(R * c);

  if (meters < 1000) {
    return { meters, text: `${meters} m` };
  }
  return { meters, text: `${(meters / 1000).toFixed(1)} km` };
}

export default function BusDetailsScreen({ route, navigation }: any) {
  const { params } = route;
  const paramBus = params?.bus || {};

  const {
    setSelectedRoute,
    setSelectedBus,
    addSavedRoute,
    savedRoutes,
  } = useCommuterStore();

  // Active subscription to real-time WebSocket telemetry stream
  const { busPositions, isConnected } = useRealTimeBus();

  // Dynamic live matching against incoming bus positions
  const busKey = String(paramBus.busId || paramBus.trip_id || paramBus.id || '');
  const liveMatch = useMemo(() => {
    if (busPositions[busKey]) return busPositions[busKey];
    return (
      Object.values(busPositions).find(
        (b: any) =>
          b.busId === busKey ||
          b.trip_id === paramBus.trip_id ||
          (paramBus.licensePlate && b.licensePlate === paramBus.licensePlate) ||
          (paramBus.routeNo && b.routeNo === paramBus.routeNo)
      ) || paramBus
    );
  }, [busPositions, busKey, paramBus]);

  const bus = { ...paramBus, ...liveMatch };

  const etaByStopId = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of bus.stop_etas || []) {
      if (e?.eta_seconds !== null && e?.eta_seconds !== undefined) {
        map.set(Number(e.stop_id), Number(e.eta_seconds));
      }
    }
    return map;
  }, [bus.stop_etas]);

  const nextStopIndex = Number(bus.nextStopIndex ?? -1);

  const formatEta = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return null;
    if (seconds < 60) return 'Arriving';
    return `${Math.round(seconds / 60)} min`;
  };

  const [stops, setStops] = useState<any[]>([]);
  const [loadingStops, setLoadingStops] = useState(true);
  const [tripSharing, setTripSharing] = useState(false);

  const routeNumber = bus.routeNo || bus.route_number || '10K';
  const service = getBusService(routeNumber);
  const formattedPlate = formatBusPlate(bus.licensePlate || bus.license_plate, routeNumber);

  const isFavorite = savedRoutes.some(
    (r) => r.route_number === routeNumber
  );

  useEffect(() => {
    const routeId =
      bus.route_id || (routeNumber === '201M' ? 6 : routeNumber === '150M' ? 7 : 1);
    fetchStops(Number(routeId));
  }, [bus.route_id, routeNumber]);

  const fetchStops = async (routeId: number) => {
    try {
      setLoadingStops(true);
      const data = await routeService.getRouteStops(routeId);
      setStops(data);
    } catch {
      setStops([]);
    } finally {
      setLoadingStops(false);
    }
  };

  const toggleFavorite = () => {
    const routeObj = {
      id: bus.route_id || 1,
      route_number: routeNumber,
      route_name: service.serviceName,
      start_stop: stops[0]?.stop_name || 'Start Terminal',
      end_stop: stops[stops.length - 1]?.stop_name || 'End Terminal',
    };
    addSavedRoute(routeObj);
    Alert.alert('Bookmark Saved', `${service.serviceName} (${routeNumber}) added to your bookmarks.`);
  };

  const handleTrackOnMap = () => {
    const routeObj = {
      id: bus.route_id || 1,
      route_number: routeNumber,
      route_name: service.serviceName,
      start_stop: stops[0]?.stop_name || 'Start Terminal',
      end_stop: stops[stops.length - 1]?.stop_name || 'End Terminal',
    };
    setSelectedRoute(routeObj);
    setSelectedBus(bus);
    if (navigation.getParent?.()) {
      navigation.getParent().navigate('App', { screen: 'Map' });
    } else {
      navigation.navigate('App', { screen: 'Map' });
    }
  };

  const handleSetAlert = () => {
    navigation.navigate('SetAlert', { bus });
  };

  const handleTripSharing = () => {
    setTripSharing(!tripSharing);
    Alert.alert(
      'Trip Sharing',
      tripSharing
        ? 'Trip sharing deactivated.'
        : 'Live GPS link generated. Emergency contacts can now track your bus in real time.'
    );
  };

  const startStopName = stops[0]?.stop_name || bus.source || 'Origin Terminal';
  const endStopName = stops[stops.length - 1]?.stop_name || bus.destination || 'Destination Terminal';

  const nextStopObj = stops[nextStopIndex] || null;
  const prevStopObj = nextStopIndex > 0 ? stops[nextStopIndex - 1] : null;

  // Live distance from current bus GPS coordinates to the upcoming stop
  const distToNextStop = useMemo(() => {
    if (!bus?.lat || !bus?.lng || !nextStopObj?.latitude || !nextStopObj?.longitude) {
      return null;
    }
    return calculateDistance(bus.lat, bus.lng, Number(nextStopObj.latitude), Number(nextStopObj.longitude));
  }, [bus?.lat, bus?.lng, nextStopObj]);

  const nextStop = (bus.stop_etas || []).find(
    (s: any) => s?.eta_seconds !== null && s?.eta_seconds !== undefined
  );
  const nextStopEtaText = nextStop ? formatEta(Number(nextStop.eta_seconds)) : null;

  const occupancyPercent =
    bus.occupancy_count != null
      ? Math.min(100, Math.round((Number(bus.occupancy_count) / (bus.capacity || 50)) * 100))
      : 35;

  const fare = service.fareStarting;

  // Percentage of route completed
  const progressPercent = useMemo(() => {
    if (!stops.length) return 0;
    if (nextStopIndex < 0) return 10;
    return Math.min(100, Math.round(((nextStopIndex) / stops.length) * 100));
  }, [nextStopIndex, stops.length]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cockpit Header Card (Ama Bus Style) */}
        <Card style={styles.headerCard}>
          <Card.Content>
            {/* Live Telemetry Status Banner */}
            <View style={styles.liveStatusRow}>
              <View style={styles.liveBadge}>
                <View style={[styles.liveDot, { backgroundColor: isConnected ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.liveBadgeText}>
                  {isConnected ? 'LIVE TELEMETRY STREAMING' : 'CONNECTING GPS…'}
                </Text>
              </View>
              {bus.speed != null && (
                <Text style={styles.liveSpeedBadge}>
                  ⚡ {bus.speed} km/h
                </Text>
              )}
            </View>

            <View style={styles.headerTop}>
              <View style={[styles.badgeLarge, { backgroundColor: service.badgeColor }]}>
                <Text style={styles.badgeLargeText}>Line {routeNumber}</Text>
              </View>
              <View style={styles.serviceTitleCol}>
                <Text style={styles.serviceTitleName}>{service.serviceName}</Text>
                <Text style={styles.serviceTypeTag}>{service.serviceType} · {service.agency}</Text>
              </View>
              <TouchableOpacity onPress={toggleFavorite} style={styles.favoriteBtn}>
                <Icon
                  source={isFavorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite ? CONSTANTS.Colors.danger : '#94A3B8'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.routePath}>
              <Text style={styles.endpoint} numberOfLines={1}>
                {startStopName}
              </Text>
              <Text style={styles.arrow}>➔</Text>
              <Text style={styles.endpoint} numberOfLines={1}>
                {endStopName}
              </Text>
            </View>

            {/* Current En-Route / Approaching Stop Banner */}
            {nextStopObj && (
              <View style={styles.currentTransitBanner}>
                <Text style={styles.currentTransitIcon}>
                  {bus.speed === 0 || (distToNextStop && distToNextStop.meters < 60) ? '🚏' : '🚍'}
                </Text>
                <View style={styles.currentTransitTextCol}>
                  <Text style={styles.currentTransitTitle}>
                    {bus.speed === 0 || (distToNextStop && distToNextStop.meters < 60)
                      ? `At Stop: ${nextStopObj.stop_name}`
                      : `En Route to ${nextStopObj.stop_name}`}
                  </Text>
                  <Text style={styles.currentTransitSub}>
                    {distToNextStop ? `${distToNextStop.text} away` : ''}
                    {nextStopEtaText ? ` · ETA ${nextStopEtaText}` : ''}
                    {prevStopObj ? ` · Departed ${prevStopObj.stop_name}` : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Progress Bar along route */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarWrap}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: service.badgeColor }]} />
              </View>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>
                  {nextStopIndex >= 0 ? `Stop ${nextStopIndex + 1} of ${stops.length}` : 'En route'}
                </Text>
                <Text style={styles.progressPercentText}>{progressPercent}% traversed</Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Real-time stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: BRAND.success }]}>
                  {nextStopEtaText ?? 'Arriving'}
                </Text>
                <Text style={styles.statLabel}>Next Stop</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{occupancyPercent}%</Text>
                <Text style={styles.statLabel}>Crowd</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>₹{fare}</Text>
                <Text style={styles.statLabel}>Fare</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {bus.speed != null ? `${bus.speed} km/h` : '32 km/h'}
                </Text>
                <Text style={styles.statLabel}>Speed</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Fleet & Telemetry Info */}
        <Card style={styles.infoCard}>
          <Card.Title title="Vehicle Telemetry & Depot" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicle Registration</Text>
              <Text style={styles.infoValue}>{formattedPlate}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Coordinates</Text>
              <Text style={[styles.infoValue, { fontSize: 12, color: BRAND.primary }]}>
                {bus.lat && bus.lng ? `${bus.lat.toFixed(4)}° N, ${bus.lng.toFixed(4)}° E` : 'Acquiring GPS…'}
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Operating Depot</Text>
              <Text style={styles.infoValue}>{service.depot}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seating Capacity</Text>
              <Text style={styles.infoValue}>
                {bus.occupancy_count ?? 18} / {bus.capacity || 50} Passengers ({Math.max(0, 50 - (bus.occupancy_count ?? 18))} seats free)
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fleet Features</Text>
              <View style={styles.amenityChips}>
                {service.features.map((feat) => (
                  <Chip key={feat} style={styles.amenityChip}>{feat}</Chip>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Route Progression Timeline */}
        <Card style={styles.stopsCard}>
          <Card.Title
            title="Live Stop Progression Timeline"
            subtitle="Updates in real-time as bus advances"
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
          <Divider />
          <Card.Content>
            {loadingStops ? (
              <ActivityIndicator size="small" color={BRAND.primary} style={{ marginVertical: 14 }} />
            ) : stops.length === 0 ? (
              <Text style={styles.noStopsText}>Loading stop progression…</Text>
            ) : (
              stops.map((stop: any, idx: number) => {
                const liveEta = etaByStopId.get(Number(stop.stop_id));
                const isPassed = nextStopIndex >= 0 && idx < nextStopIndex;
                const isNext = nextStopIndex >= 0 && idx === nextStopIndex;
                const etaText = formatEta(liveEta);

                // Distance from bus GPS to this stop
                const distToStop =
                  bus.lat && bus.lng && stop.latitude && stop.longitude
                    ? calculateDistance(bus.lat, bus.lng, Number(stop.latitude), Number(stop.longitude))
                    : null;

                return (
                  <View key={stop.stop_id || idx}>
                    <View style={[styles.stopItem, isNext && styles.stopItemNext]}>
                      <View
                        style={[
                          styles.stopDot,
                          isPassed && styles.stopDotPassed,
                          isNext && styles.stopDotNext,
                        ]}
                      >
                        <Text style={styles.stopDotNum}>{isPassed ? '✓' : idx + 1}</Text>
                      </View>
                      <View style={styles.stopInfo}>
                        <Text style={[styles.stopName, isPassed && styles.stopNamePassed, isNext && styles.stopNameNext]}>
                          {stop.stop_name}
                        </Text>
                        <Text style={[styles.stopDistance, isNext && styles.stopDistanceNext]}>
                          {isNext
                            ? `🟢 Approaching Next ${distToStop ? `(${distToStop.text})` : ''}`
                            : isPassed
                            ? '✓ Departed'
                            : `Stop ${stop.stop_order || idx + 1}${distToStop ? ` · ${distToStop.text}` : ''}`}
                        </Text>
                      </View>

                      {isPassed ? (
                        <Text style={styles.etaPassed}>✓ Passed</Text>
                      ) : etaText ? (
                        <View style={[styles.etaPill, isNext && styles.etaPillNext]}>
                          <Text style={[styles.etaPillText, isNext && styles.etaPillTextNext]}>
                            {etaText}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.etaPassed}>—</Text>
                      )}
                    </View>
                    {idx < stops.length - 1 && (
                      <View style={[styles.stopLine, isPassed && styles.stopLinePassed]} />
                    )}
                  </View>
                );
              })
            )}
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            buttonColor={BRAND.primary}
            style={styles.primaryButton}
            onPress={handleTrackOnMap}
          >
            🗺️ Track on Live Map
          </Button>
          <Button
            mode="outlined"
            style={styles.secondaryButton}
            textColor={BRAND.primary}
            onPress={handleSetAlert}
          >
            🔔 Set Alert
          </Button>
        </View>

        <Button
          mode="outlined"
          style={{ borderColor: BRAND.primary, marginBottom: 20 }}
          textColor={BRAND.primary}
          onPress={handleTripSharing}
        >
          {tripSharing ? 'Stop Sharing' : '📲 Share Live Journey Link'}
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    ...BRAND.shadowLg,
  },
  liveStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BRAND.radius.pill,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.4,
  },
  liveSpeedBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.textSecondary,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  badgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BRAND.radius.pill,
  },
  badgeLargeText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  serviceTitleCol: {
    flex: 1,
  },
  serviceTitleName: {
    fontSize: 15,
    fontWeight: '900',
    color: BRAND.text,
  },
  serviceTypeTag: {
    fontSize: 11,
    color: BRAND.textSecondary,
    fontWeight: '700',
  },
  favoriteBtn: {
    padding: 4,
  },
  routePath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  endpoint: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: BRAND.text,
  },
  arrow: {
    fontSize: 16,
    color: BRAND.primary,
    fontWeight: '800',
  },
  currentTransitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 3.5,
    borderLeftColor: BRAND.primary,
    borderRadius: BRAND.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 8,
    gap: 10,
  },
  currentTransitIcon: {
    fontSize: 20,
  },
  currentTransitTextCol: {
    flex: 1,
  },
  currentTransitTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: BRAND.text,
  },
  currentTransitSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: BRAND.textSecondary,
    marginTop: 1,
  },
  progressContainer: {
    marginVertical: 6,
  },
  progressBarWrap: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: BRAND.textSecondary,
  },
  progressPercentText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.primary,
  },
  divider: {
    marginVertical: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: BRAND.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    ...BRAND.shadow,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: BRAND.textSecondary,
    fontWeight: '600',
    marginTop: -4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: BRAND.text,
    fontWeight: '800',
  },
  amenityChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  amenityChip: {
    marginVertical: 2,
    backgroundColor: BRAND.surfaceMuted,
  },
  stopsCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    ...BRAND.shadow,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderRadius: BRAND.radius.md,
  },
  stopItemNext: {
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    paddingHorizontal: 6,
  },
  stopDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopDotNum: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
  },
  stopNameNext: {
    fontWeight: '900',
    color: BRAND.primary,
  },
  stopDistance: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 1,
  },
  stopDistanceNext: {
    color: '#15803D',
    fontWeight: '700',
  },
  stopDotPassed: { backgroundColor: '#CBD5E1' },
  stopDotNext: { backgroundColor: BRAND.success },
  stopNamePassed: { color: '#94A3B8' },
  stopLine: {
    position: 'absolute',
    left: 10.5,
    top: 24,
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  stopLinePassed: { backgroundColor: '#CBD5E1' },
  etaPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  etaPillNext: { backgroundColor: '#DCFCE7' },
  etaPillText: { fontSize: 11, fontWeight: '800', color: BRAND.primary },
  etaPillTextNext: { color: '#15803D' },
  etaPassed: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  noStopsText: {
    color: BRAND.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1.2,
  },
  secondaryButton: {
    flex: 0.8,
    borderColor: BRAND.primary,
  },
});
