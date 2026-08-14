import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { MarkerAnimated, AnimatedRegion } from 'react-native-maps'
import { BRAND } from '../styles/brand'
import type { BusPosition } from '../store/useCommuterStore'

/**
 * A bus marker that glides between telemetry updates.
 *
 * Plain <Marker coordinate={...}> re-mounts at the new coordinate on every
 * WebSocket frame, so buses teleported roughly once per two seconds. This
 * interpolates position with AnimatedRegion over the expected gap between
 * frames, which reads as continuous movement.
 *
 * `tracksViewChanges` is switched off shortly after mount: with a custom marker
 * view, leaving it on makes Android re-rasterise the marker on every render,
 * which both flickers and drags framerate down with several buses on screen.
 */

/** Matches the simulator's tick and the driver app's publish interval. */
const ANIMATION_MS = 2000

interface Props {
  bus: BusPosition
  isSelected?: boolean
  onPress?: () => void
}

/** Colour encodes the backend's VehicleStatus so stale buses are obvious. */
function statusColor(status?: string): string {
  switch (status) {
    case 'APPROACHING STOP':
      return '#4F46E5'
    case 'AT STOP':
      return '#7C3AED'
    case 'STALE':
    case 'SIGNAL LOST':
      return '#F59E0B'
    case 'OFFLINE':
      return '#64748B'
    default:
      return '#16A34A'
  }
}

export default function AnimatedBusMarker({ bus, isSelected = false, onPress }: Props) {
  const coordinate = useRef(
    new AnimatedRegion({
      latitude: bus.lat,
      longitude: bus.lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current

  // Redraw the marker bitmap only while it is settling, then freeze it.
  const [tracksChanges, setTracksChanges] = React.useState(true)
  useEffect(() => {
    const t = setTimeout(() => setTracksChanges(false), 1200)
    return () => clearTimeout(t)
  }, [])

  // Re-enable briefly when the visual state actually changes, so the new
  // colour/scale is rasterised, then freeze again.
  useEffect(() => {
    setTracksChanges(true)
    const t = setTimeout(() => setTracksChanges(false), 600)
    return () => clearTimeout(t)
  }, [isSelected, bus.status])

  useEffect(() => {
    if (!Number.isFinite(bus.lat) || !Number.isFinite(bus.lng)) return

    const next = { latitude: bus.lat, longitude: bus.lng }

    if (Platform.OS === 'android') {
      // On Android the marker itself is animated natively.
      coordinate.timing({ ...next, duration: ANIMATION_MS, useNativeDriver: false } as any).start()
    } else {
      coordinate.timing({ ...next, duration: ANIMATION_MS, useNativeDriver: false } as any).start()
    }
  }, [bus.lat, bus.lng, coordinate])

  const color = statusColor(bus.status)

  return (
    <MarkerAnimated
      coordinate={coordinate as any}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={isSelected ? 10 : 2}
      tracksViewChanges={tracksChanges}
    >
      <View style={styles.wrap}>
        {isSelected && <View style={[styles.halo, { borderColor: color }]} />}
        <View
          style={[
            styles.pill,
            { borderColor: color },
            isSelected && styles.pillSelected,
          ]}
        >
          <Text style={styles.emoji}>🚌</Text>
          <Text style={[styles.label, isSelected && styles.labelSelected]}>{bus.routeNo}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
      </View>
    </MarkerAnimated>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 78, height: 48 },
  halo: {
    position: 'absolute',
    width: 60,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.45,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  pillSelected: { backgroundColor: BRAND.primary, borderColor: '#FFFFFF' },
  emoji: { fontSize: 13 },
  label: { fontSize: 11, fontWeight: '800', color: BRAND.text },
  labelSelected: { color: '#FFFFFF' },
  statusDot: {
    position: 'absolute',
    bottom: 6,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
})
