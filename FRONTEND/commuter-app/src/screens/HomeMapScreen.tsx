import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import useCommuterStore from '../store/useCommuterStore'
import useRealTimeBus from '../hooks/useRealTimeBus'
import { BRAND } from '../styles/brand'

/**
 * Map View (Figma): full-bleed live map with a "Visakhapatnam • Live" pill,
 * route-number pills on each bus, a locate button, and a bottom search bar.
 * Buses stream in over the backend WebSocket (SNAPSHOT / BUS_UPDATE).
 */
export default function HomeMapScreen({ navigation }: any) {
  const [userLocation, setUserLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<MapView>(null)

  const { setUserLocation: storeUserLocation, setSelectedBus } = useCommuterStore()
  const { busPositions, isConnected } = useRealTimeBus()
  const liveBuses = Object.values(busPositions)

  useEffect(() => {
    initializeLocation()
  }, [])

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

  const recenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation?.lat || 17.7231,
        longitude: userLocation?.lng || 83.3013,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      },
      600
    )
  }

  const handleBusPress = (bus: any) => {
    setSelectedBus(bus)
    navigation.navigate('BusDetails', { bus })
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: userLocation?.lat || 17.7231,
          longitude: userLocation?.lng || 83.3013,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
        showsUserLocation
      >
        {liveBuses.map((bus: any) => (
          <Marker
            key={bus.busId}
            coordinate={{ latitude: bus.lat, longitude: bus.lng }}
            onPress={() => handleBusPress(bus)}
          >
            <View style={styles.busPill}>
              <Text style={styles.busPillText}>{bus.routeNo}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Live status pill */}
      <View style={styles.topOverlay}>
        <View style={styles.livePill}>
          <View
            style={[
              styles.liveDot,
              { backgroundColor: isConnected ? BRAND.success : BRAND.warning },
            ]}
          />
          <Text style={styles.livePillText}>
            Visakhapatnam · {isConnected ? 'Live' : 'Connecting…'}
          </Text>
        </View>
        <View style={styles.weatherChip}>
          <Text style={styles.weatherText}>☁️ 28°C</Text>
        </View>
      </View>

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
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...BRAND.shadow,
  },
  busPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
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
  weatherChip: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...BRAND.shadow,
  },
  weatherText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.text,
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
