import React, { useEffect, useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Text, Card, Button, Divider, Chip, Icon } from 'react-native-paper'
import useCommuterStore from '../store/useCommuterStore'
import { routeService } from '../services/routeService'
import { CONSTANTS } from '../utils/constants'
import { cityIdForCoords, getCity } from '../utils/cities'

export default function BusDetailsScreen({ route, navigation }: any) {
  const { params } = route
  const paramBus = params?.bus || {}

  const {
    setSelectedRoute,
    setSelectedBus,
    addSavedRoute,
    savedRoutes,
    busPositions,
  } = useCommuterStore()

  // The bus handed over in navigation params is a snapshot. Re-read it from the
  // live store each render so ETAs count down and status changes show up while
  // this screen is open, instead of freezing at whatever was true on tap.
  const bus = { ...paramBus, ...(busPositions?.[paramBus.busId] ?? {}) }

  /** Stops the bus has yet to reach; passed stops carry eta_seconds: null. */
  const etaByStopId = new Map<number, number>()
  for (const e of bus.stop_etas || []) {
    if (e?.eta_seconds !== null && e?.eta_seconds !== undefined) {
      etaByStopId.set(Number(e.stop_id), Number(e.eta_seconds))
    }
  }
  const nextStopIndex = Number(bus.nextStopIndex ?? -1)

  const formatEta = (seconds?: number) => {
    if (seconds === undefined) return null
    if (seconds < 60) return 'Arriving'
    return `${Math.round(seconds / 60)} min`
  }

  const [stops, setStops] = useState<any[]>([])
  const [loadingStops, setLoadingStops] = useState(true)
  const [tripSharing, setTripSharing] = useState(false)

  const isFavorite = savedRoutes.some(
    (r) => r.route_number === (bus.routeNo || bus.route_number)
  )

  useEffect(() => {
    const routeId = bus.route_id || 1
    fetchStops(routeId)
  }, [bus])

  const fetchStops = async (routeId: number) => {
    try {
      setLoadingStops(true)
      const data = await routeService.getRouteStops(routeId)
      setStops(data)
    } catch {
      setStops([])
    } finally {
      setLoadingStops(false)
    }
  }

  const toggleFavorite = () => {
    const routeObj = {
      id: bus.route_id || 1,
      route_number: bus.routeNo || bus.route_number || '10K',
      route_name: `Route ${bus.routeNo || bus.route_number || '10K'}`,
      start_stop: stops[0]?.stop_name || 'RTC Complex',
      end_stop: stops[stops.length - 1]?.stop_name || 'Kailasagiri',
    }
    addSavedRoute(routeObj)
    Alert.alert('Saved', `Route ${routeObj.route_number} added to your saved routes!`)
  }

  const handleTrackOnMap = () => {
    const routeObj = {
      id: bus.route_id || 1,
      route_number: bus.routeNo || bus.route_number || '10K',
      route_name: `Route ${bus.routeNo || bus.route_number || '10K'}`,
      start_stop: stops[0]?.stop_name || 'RTC Complex',
      end_stop: stops[stops.length - 1]?.stop_name || 'Kailasagiri',
    }
    setSelectedRoute(routeObj)
    setSelectedBus(bus)
    navigation.navigate('Map')
  }

  const handleSetAlert = () => {
    navigation.navigate('SetAlert', { bus })
  }

  const handleTripSharing = () => {
    setTripSharing(!tripSharing)
    Alert.alert(
      'Trip Sharing',
      tripSharing
        ? 'Trip sharing stopped'
        : 'Live trip link copied to share with trusted emergency contacts.'
    )
  }

  const startStopName = stops[0]?.stop_name || bus.source || '—'
  const endStopName = stops[stops.length - 1]?.stop_name || bus.destination || '—'

  // Headline ETA is the next stop the bus will reach, which is what a waiting
  // commuter needs, rather than the end of the line.
  const nextStop = (bus.stop_etas || []).find(
    (s: any) => s?.eta_seconds !== null && s?.eta_seconds !== undefined
  )
  const nextStopEtaText = nextStop ? formatEta(Number(nextStop.eta_seconds)) : null

  const occupancyPercent =
    bus.occupancy_count != null
      ? Math.min(100, Math.round((Number(bus.occupancy_count) / (bus.capacity || 50)) * 100))
      : null

  // Same distance-based rule the search results use, so the two agree.
  const fare = stops.length > 1 ? Math.max(15, 15 + Math.max(0, stops.length - 2) * 2) : null

  // Operator follows the network the bus is actually on — the old label said
  // "APSRTC City Metro" for every vehicle regardless of city.
  const operatorCity =
    bus.lat != null && bus.lng != null
      ? getCity(cityIdForCoords(Number(bus.lat), Number(bus.lng)))
      : stops[0]
      ? getCity(cityIdForCoords(Number(stops[0].latitude), Number(stops[0].longitude)))
      : undefined
  const operatorLabel = operatorCity ? operatorCity.region : 'Operator unknown'

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerTop}>
              <Text style={styles.routeNumber}>
                Route {bus.routeNo || bus.route_number || '10K'}
              </Text>
              <TouchableOpacity onPress={toggleFavorite}>
                <Icon
                  source={isFavorite ? 'heart' : 'heart-outline'}
                  size={26}
                  color={isFavorite ? CONSTANTS.Colors.danger : '#999'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.routePath}>
              <Text style={styles.endpoint}>{startStopName}</Text>
              <Text style={styles.arrow}>➔</Text>
              <Text style={styles.endpoint}>{endStopName}</Text>
            </View>

            <Divider style={styles.divider} />

            {/* Every figure here is live telemetry or an explicit dash. The
                previous defaults (8 min, 25%, ₹15, 25 km/h) rendered whenever
                data was missing and were indistinguishable from real values. */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {nextStopEtaText ?? '—'}
                </Text>
                <Text style={styles.statLabel}>{nextStopEtaText ? 'Next stop' : 'ETA'}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {occupancyPercent != null ? `${occupancyPercent}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Crowd</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{fare != null ? `₹${fare}` : '—'}</Text>
                <Text style={styles.statLabel}>Fare</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {bus.speed != null ? bus.speed : '—'}
                  {'\n'}
                  km/h
                </Text>
                <Text style={styles.statLabel}>Speed</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Bus Info Card */}
        <Card style={styles.infoCard}>
          <Card.Title title="Bus Telemetry & Fleet Info" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>License Plate</Text>
              <Text style={styles.infoValue}>
                {bus.licensePlate || bus.license_plate || '—'}
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Operator</Text>
              <Text style={styles.infoValue}>{operatorLabel}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seating Capacity</Text>
              <Text style={styles.infoValue}>{bus.capacity || 50} Seats</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amenities</Text>
              <View style={styles.amenityChips}>
                <Chip style={styles.amenityChip}>♀️ Women Section</Chip>
                <Chip style={styles.amenityChip}>📡 GPS Tracking</Chip>
                <Chip style={styles.amenityChip}>👁️ AI Vision</Chip>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Real Route Stops Card */}
        <Card style={styles.stopsCard}>
          <Card.Title title="Route Stop Sequence" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            {loadingStops ? (
              <ActivityIndicator size="small" color={CONSTANTS.Colors.primary} style={{ marginVertical: 12 }} />
            ) : stops.length === 0 ? (
              <Text style={styles.noStopsText}>No stop sequence available</Text>
            ) : (
              stops.map((stop: any, idx: number) => {
                const eta = etaByStopId.get(Number(stop.stop_id))
                const isPassed = nextStopIndex >= 0 && idx < nextStopIndex
                const isNext = nextStopIndex >= 0 && idx === nextStopIndex
                const etaText = formatEta(eta)

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
                          {isNext ? 'Next stop' : isPassed ? 'Departed' : `Stop ${stop.stop_order}`}
                        </Text>
                      </View>

                      {/* Live arrival time for every upcoming stop, not just the
                          end of the line. */}
                      {isPassed ? (
                        <Text style={styles.etaPassed}>—</Text>
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
                )
              })
            )}
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            buttonColor={CONSTANTS.Colors.primary}
            style={styles.primaryButton}
            onPress={handleTrackOnMap}
          >
            🗺️ Track on Map
          </Button>
          <Button
            mode="outlined"
            style={styles.secondaryButton}
            onPress={handleSetAlert}
          >
            🔔 Set Alert
          </Button>
        </View>

        <Button
          mode="outlined"
          style={{ borderColor: CONSTANTS.Colors.primary }}
          onPress={handleTripSharing}
        >
          {tripSharing ? 'Stop Sharing' : '📲 Share Live Trip Link'}
        </Button>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: CONSTANTS.Colors.primary,
  },
  routePath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  endpoint: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  arrow: {
    fontSize: 16,
    color: CONSTANTS.Colors.primary,
    fontWeight: '700',
  },
  divider: {
    marginVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: CONSTANTS.Colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
  },
  infoCard: {
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  amenityChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  amenityChip: {
    marginVertical: 4,
  },
  stopsCard: {
    backgroundColor: '#fff',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  stopDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: CONSTANTS.Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopDotNum: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  stopDistance: {
    fontSize: 11,
    color: '#999',
  },
  stopDotPassed: { backgroundColor: '#CBD5E1' },
  stopDotNext: { backgroundColor: CONSTANTS.Colors.success ?? '#16A34A' },
  stopNamePassed: { color: '#94A3B8' },
  stopLinePassed: { backgroundColor: '#E2E8F0' },
  etaPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  etaPillNext: { backgroundColor: '#DCFCE7' },
  etaPillText: { fontSize: 12, fontWeight: '800', color: CONSTANTS.Colors.primary },
  etaPillTextNext: { color: '#15803D' },
  etaPassed: { fontSize: 12, color: '#CBD5E1', marginLeft: 8, fontWeight: '700' },
  noStopsText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  stopLine: {
    position: 'absolute',
    left: 10.5,
    top: 24,
    width: 1,
    height: 36,
    backgroundColor: '#DDD',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
    borderColor: CONSTANTS.Colors.primary,
  },
})
