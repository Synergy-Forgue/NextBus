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
import AnimatedBusMarker from '../components/AnimatedBusMarker'
import { cityIdForCoords, getCity } from '../utils/cities'

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
  const [routeGeometry, setRouteGeometry] = useState<{ latitude: number; longitude: number }[] | null>(null)
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

  // Road-following geometry for the selected route. Cancellation guard stops a
  // slow response for a previous route overwriting the current one.
  useEffect(() => {
    if (!selectedRoute?.id) {
      setRouteGeometry(null)
      return
    }
    let cancelled = false
    setRouteGeometry(null)
    routeService
      .getRouteGeometry(selectedRoute.id)
      .then((geom) => {
        if (!cancelled) setRouteGeometry(geom)
      })
      .catch(() => {
        if (!cancelled) setRouteGeometry(null)
      })
    return () => {
      cancelled = true
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

  const nextStopIndex = Math.min(
    Math.max(Number(selectedBus?.nextStopIndex ?? 0), 0),
    Math.max(routeStops.length - 1, 0)
  )

  // Prefer road-following geometry from the backend. Joining stop coordinates
  // draws straight lines that cut across water and buildings; that path is now
  // only a fallback for routes whose geometry has not been generated yet.
  const linePath = routeGeometry && routeGeometry.length > 1 ? routeGeometry : polylineCoords

  // Split the line at the bus so covered ground reads as history and the rest
  // reads as the live journey. With dense geometry there is no stop index to
  // split on, so find the vertex nearest the bus instead.
  const splitIndex = (() => {
    if (!selectedBus?.lat || !selectedBus?.lng || linePath.length < 2) return 0
    if (linePath === polylineCoords) return nextStopIndex

    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < linePath.length; i++) {
      const dLat = linePath[i].latitude - selectedBus.lat
      const dLng = linePath[i].longitude - selectedBus.lng
      const d = dLat * dLat + dLng * dLng // squared degrees is fine for ordering
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  })()

  const travelledCoords = linePath.slice(0, splitIndex + 1)
  const upcomingCoords = linePath.slice(splitIndex)

  // Label the network the user is actually looking at rather than assuming one.
  const focusPoint = selectedBus
    ? { lat: selectedBus.lat, lng: selectedBus.lng }
    : polylineCoords[0]
    ? { lat: polylineCoords[0].latitude, lng: polylineCoords[0].longitude }
    : liveBuses[0]
    ? { lat: (liveBuses[0] as any).lat, lng: (liveBuses[0] as any).lng }
    : userLocation
  const cityLabel = focusPoint
    ? getCity(cityIdForCoords(focusPoint.lat, focusPoint.lng))?.name ?? 'Network'
    : 'Network'

  // Real next-stop ETA from backend telemetry — never a placeholder number.
  const nextEta = (selectedBus?.stop_etas || []).find(
    (s: any) => s.eta_seconds !== null && s.eta_seconds !== undefined
  )

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
        {/* Route geometry: a dark casing under a coloured core, so the line
            stays legible over both pale roads and dark satellite imagery. */}
        {linePath.length > 1 && (
          <>
            <Polyline
              coordinates={linePath}
              strokeColor="rgba(15,23,42,0.35)"
              strokeWidth={9}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
            {travelledCoords.length > 1 && (
              <Polyline
                coordinates={travelledCoords}
                strokeColor="rgba(100,116,139,0.85)"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
                zIndex={2}
              />
            )}
            <Polyline
              coordinates={upcomingCoords}
              strokeColor={BRAND.primary}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={3}
            />
          </>
        )}

        {/* Stop markers, styled by progress: passed, next, or upcoming. */}
        {routeStops.map((s: any, idx: number) => {
          const isPassed = idx < nextStopIndex
          const isNext = idx === nextStopIndex && !!selectedBus
          const isTerminus = idx === 0 || idx === routeStops.length - 1
          return (
            <Marker
              key={`stop_${s.stop_id || idx}`}
              coordinate={{
                latitude: parseFloat(s.latitude),
                longitude: parseFloat(s.longitude),
              }}
              title={s.stop_name || `Stop ${idx + 1}`}
              description={isNext ? 'Next stop' : isPassed ? 'Passed' : `Stop ${idx + 1}`}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={isNext ? 6 : 4}
            >
              <View
                style={[
                  styles.stopDot,
                  isTerminus && styles.stopDotTerminus,
                  isPassed && styles.stopDotPassed,
                  isNext && styles.stopDotNext,
                ]}
              >
                <Text style={[styles.stopNum, isPassed && styles.stopNumPassed]}>{idx + 1}</Text>
              </View>
            </Marker>
          )
        })}

        {/* Live buses — interpolated between telemetry frames. */}
        {liveBuses.map((bus: any) => (
          <AnimatedBusMarker
            key={bus.busId}
            bus={bus}
            isSelected={
              selectedBus?.busId === bus.busId || selectedRoute?.route_number === bus.routeNo
            }
            onPress={() => handleBusPress(bus)}
          />
        ))}
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
            {cityLabel} ·{' '}
            {isConnected
              ? `${liveBuses.length} bus${liveBuses.length === 1 ? '' : 'es'} live`
              : 'Connecting…'}
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
              ⚡ {selectedBus.speed} km/h
              {nextEta
                ? ` • ${nextEta.stop_name} in ${Math.max(1, Math.round(nextEta.eta_seconds / 60))} min`
                : ' • ETA unavailable'}
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
  stopNumPassed: { color: '#E2E8F0' },
  stopDotTerminus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  stopDotPassed: {
    backgroundColor: '#94A3B8',
    opacity: 0.75,
  },
  stopDotNext: {
    backgroundColor: BRAND.success,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    width: 26,
    height: 26,
    borderRadius: 13,
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
