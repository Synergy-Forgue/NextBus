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

export default function BusDetailsScreen({ route, navigation }: any) {
  const { params } = route
  const bus = params?.bus || {}

  const {
    setSelectedRoute,
    setSelectedBus,
    addSavedRoute,
    savedRoutes,
  } = useCommuterStore()

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

  const startStopName = stops[0]?.stop_name || bus.source || 'RTC Complex'
  const endStopName = stops[stops.length - 1]?.stop_name || bus.destination || 'Kailasagiri'

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

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{bus.eta || 8}m</Text>
                <Text style={styles.statLabel}>ETA</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{bus.crowdLevel || bus.occupancy || 25}%</Text>
                <Text style={styles.statLabel}>Crowd</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>₹15</Text>
                <Text style={styles.statLabel}>Fare</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {bus.speed || 25}
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
                {bus.licensePlate || bus.license_plate || 'AP 31 TV 1001'}
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicle Type</Text>
              <Text style={styles.infoValue}>APSRTC City Metro (EV/Diesel)</Text>
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
              stops.map((stop: any, idx: number) => (
                <View key={stop.stop_id || idx}>
                  <View style={styles.stopItem}>
                    <View style={styles.stopDot}>
                      <Text style={styles.stopDotNum}>{idx + 1}</Text>
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={styles.stopName}>{stop.stop_name}</Text>
                      <Text style={styles.stopDistance}>
                        Sequence #{stop.stop_order}
                      </Text>
                    </View>
                  </View>
                  {idx < stops.length - 1 && (
                    <View style={styles.stopLine} />
                  )}
                </View>
              ))
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
