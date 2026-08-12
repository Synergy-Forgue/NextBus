import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import useCommuterStore from '../store/useCommuterStore'
import useRealTimeBus from '../hooks/useRealTimeBus'
import { routeService } from '../services/routeService'
import { BRAND } from '../styles/brand'

/**
 * Home Map Screen (Live Transit Map):
 * - Renders full-bleed live map with WebSocket stream (`SNAPSHOT`, `BUS_UPDATE`).
 * - When a Journey Context (`selectedRoute` / `selectedBus`) is established (via Smart Pick, Search, or Saved Route):
 *   1. Frames camera automatically around the route & bus.
 *   2. Renders the route polyline connecting ordered stops.
 *   3. Renders stop markers.
 *   4. Highlights the selected bus marker.
 *   5. Displays top contextual journey banner.
 */
export default function HomeMapScreen({ navigation }: any) {
  const [userLocation, setUserLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [routeStops, setRouteStops] = useState<any[]>([])
  const mapRef = useRef<MapView>(null)

  const {
    userLocation: storeUserLoc,
    setUserLocation: storeUserLocation,
    selectedRoute,
    selectedBus,
    setSelectedBus,
    setSelectedRoute,
  } = useCommuterStore()
  const { busPositions, isConnected } = useRealTimeBus()

  const liveBuses = Object.values(busPositions)

  useEffect(() => {
    initializeLocation()
  }, [])

  // Load route stops whenever selectedRoute changes
  useEffect(() => {
    if (selectedRoute?.id) {
      loadStopsForRoute(selectedRoute.id)
    } else {
      setRouteStops([])
    }
  }, [selectedRoute])

  // Frame camera whenever routeStops or selectedBus updates
  useEffect(() => {
    if (routeStops.length > 0 && mapRef.current) {
      const coords = routeStops.map((s) => ({
        latitude: parseFloat(s.latitude),
        longitude: parseFloat(s.longitude),
      }))

      if (selectedBus?.lat && selectedBus?.lng) {
        coords.push({
          latitude: selectedBus.lat,
          longitude: selectedBus.lng,
        })
      }

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
          animated: true,
        })
      }, 300)
    }
  }, [routeStops, selectedBus])

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({})
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        }
        setUserLocation(coords)
        storeUserLocation(coords.lat, coords.lng)
      }
    } catch {
      /* stay on default region */
    } finally {
      setLoading(false)
    }
  }

  const loadStopsForRoute = async (routeId: number) => {
    try {
      const stops = await routeService.getRouteStops(routeId)
      setRouteStops(stops)
    } catch {
      setRouteStops([])
    }
  }

  const recenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation?.lat || storeUserLoc?.lat || 17.7231,
        longitude: userLocation?.lng || storeUserLoc?.lng || 83.3013,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      },
      600
    )
  }

  const handleBusPress = (bus: any) => {
    setSelectedBus(bus)
    navigation.navigate('BusDetails', { bus })
  }

  const clearSelectedJourney = () => {
    setSelectedRoute(null)
    setSelectedBus(null)
    setRouteStops([])
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </View>
    )
  }

  const polylineCoords = routeStops.map((s) => ({
    latitude: parseFloat(s.latitude),
    longitude: parseFloat(s.longitude),
  }))

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: userLocation?.lat || 17.7231,
          longitude: userLocation?.lng || 83.3013,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
      >
        {/* Route Geometry Polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={BRAND.primary}
            strokeWidth={4}
          />
        )}

        {/* Route Stop Markers */}
        {routeStops.map((s: any, idx: number) => (
          <Marker
            key={`stop_${s.stop_id || idx}`}
            coordinate={{
              latitude: parseFloat(s.latitude),
              longitude: parseFloat(s.longitude),
            }}
            title={s.stop_name || `Stop ${idx + 1}`}
          >
            <View style={styles.stopDot}>
              <Text style={styles.stopNum}>{idx + 1}</Text>
            </View>
          </Marker>
        ))}

        {/* Live Bus Markers */}
        {liveBuses.map((bus: any) => {
          const isSelected = selectedBus?.busId === bus.busId || selectedRoute?.route_number === bus.routeNo
          return (
            <Marker
              key={bus.busId}
              coordinate={{ latitude: bus.lat, longitude: bus.lng }}
              onPress={() => handleBusPress(bus)}
              zIndex={isSelected ? 10 : 1}
            >
              <View style={[styles.busPill, isSelected && styles.busPillSelected]}>
                <Text style={styles.busPillEmoji}>🚌</Text>
                <Text style={styles.busPillText}>{bus.routeNo}</Text>
              </View>
            </Marker>
          )
        })}
      </MapView>

      {/* Top Status & Context Bar */}
      <View style={styles.topOverlay}>
        <View style={styles.livePill}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: isConnected ? BRAND.success : BRAND.warning },
            ]}
          />
          <Text style={styles.livePillText}>
            Visakhapatnam · {isConnected ? 'Live WSS' : 'Connecting…'}
          </Text>
        </View>

        {selectedRoute && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearSelectedJourney}>
            <Text style={styles.clearBtnText}>✕ Clear Filter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selected Journey Context Banner */}
      {selectedRoute && (
        <View style={styles.journeyBanner}>
          <View style={styles.bannerHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Route {selectedRoute.route_number || selectedRoute.number}</Text>
            </View>
            <Text style={styles.bannerTitle}>
              {selectedRoute.route_name || 'Active Journey'}
            </Text>
          </View>
          <Text style={styles.bannerStops}>
            📍 {selectedRoute.start_stop || selectedRoute.fromStop || 'Origin'} ➔ {selectedRoute.end_stop || selectedRoute.toStop || 'Destination'}
          </Text>
          {selectedBus?.speed != null && (
            <Text style={styles.bannerSpeed}>
              ⚡ Speed: {selectedBus.speed} km/h • ETA: {selectedBus.eta || 8} min
            </Text>
          )}
        </View>
      )}

      {/* Locate button */}
      <TouchableOpacity style={styles.locateBtn} onPress={recenter}>
        <Text style={styles.locateIcon}>🎯</Text>
      </TouchableOpacity>

      {/* SOS button */}
      <TouchableOpacity
        style={styles.sosBtn}
        onPress={() => navigation.navigate('SOS')}
      >
        <Text style={styles.sosBtnText}>SOS</Text>
      </TouchableOpacity>

      {/* Bottom search bar */}
      <TouchableOpacity
        style={styles.bottomSearch}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.bottomSearchText}>🔍  Where are you going?</Text>
        <View style={styles.goBtn}>
          <Text style={styles.goBtnText}>➤</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.bg,
  },
  loadingText: {
    marginTop: 12,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  busPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: BRAND.primary,
    ...BRAND.shadow,
  },
  busPillSelected: {
    backgroundColor: BRAND.primary,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  busPillEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  busPillText: {
    color: BRAND.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  stopDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stopNum: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  topOverlay: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...BRAND.shadow,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  livePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
  },
  clearBtn: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...BRAND.shadow,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.danger,
  },
  journeyBanner: {
    position: 'absolute',
    top: 108,
    left: 16,
    right: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    ...BRAND.shadow,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.primary,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
  },
  bannerStops: {
    fontSize: 12,
    color: BRAND.textSecondary,
    fontWeight: '600',
  },
  bannerSpeed: {
    fontSize: 11,
    color: BRAND.success,
    fontWeight: '700',
    marginTop: 4,
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...BRAND.shadow,
  },
  locateIcon: {
    fontSize: 20,
  },
  sosBtn: {
    position: 'absolute',
    right: 16,
    bottom: 170,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomSearch: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 6,
    ...BRAND.shadow,
  },
  bottomSearchText: {
    flex: 1,
    color: BRAND.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  goBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
})
