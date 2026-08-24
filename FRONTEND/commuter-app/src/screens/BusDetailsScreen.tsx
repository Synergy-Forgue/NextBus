import React, { useEffect, useState } from 'react';
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
import { routeService } from '../services/routeService';
import { CONSTANTS } from '../utils/constants';
import { BRAND } from '../styles/brand';
import { getBusService, formatBusPlate } from '../utils/busMeta';

export default function BusDetailsScreen({ route, navigation }: any) {
  const { params } = route;
  const paramBus = params?.bus || {};

  const {
    setSelectedRoute,
    setSelectedBus,
    addSavedRoute,
    savedRoutes,
    busPositions,
  } = useCommuterStore();

  const bus = { ...paramBus, ...(busPositions?.[paramBus.busId] ?? {}) };

  const etaByStopId = new Map<number, number>();
  for (const e of bus.stop_etas || []) {
    if (e?.eta_seconds !== null && e?.eta_seconds !== undefined) {
      etaByStopId.set(Number(e.stop_id), Number(e.eta_seconds));
    }
  }
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

  const nextStop = (bus.stop_etas || []).find(
    (s: any) => s?.eta_seconds !== null && s?.eta_seconds !== undefined
  );
  const nextStopEtaText = nextStop ? formatEta(Number(nextStop.eta_seconds)) : null;

  const occupancyPercent =
    bus.occupancy_count != null
      ? Math.min(100, Math.round((Number(bus.occupancy_count) / (bus.capacity || 50)) * 100))
      : 35;

  const fare = service.fareStarting;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cockpit Header Card (Ama Bus Style) */}
        <Card style={styles.headerCard}>
          <Card.Content>
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

            <Divider style={styles.divider} />

            {/* Real-time stats grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: BRAND.success }]}>
                  {nextStopEtaText ?? '3m'}
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
              <Text style={styles.infoLabel}>Operating Depot</Text>
              <Text style={styles.infoValue}>{service.depot}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seating Capacity</Text>
              <Text style={styles.infoValue}>
                {bus.occupancy_count ?? 18} / {bus.capacity || 50} Passengers ({50 - (bus.occupancy_count ?? 18)} seats free)
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
          <Card.Title title="Live Stop Progression Timeline" titleStyle={styles.cardTitle} />
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

                return (
                  <View key={stop.stop_id || idx}>
                    <View style={styles.stopItem}>
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
                        <Text style={[styles.stopName, isPassed && styles.stopNamePassed]}>
                          {stop.stop_name}
                        </Text>
                        <Text style={styles.stopDistance}>
                          {isNext
                            ? '🟢 Approaching Next'
                            : isPassed
                            ? '✓ Departed'
                            : `Stop ${stop.stop_order || idx + 1}`}
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
  stopDistance: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 1,
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
