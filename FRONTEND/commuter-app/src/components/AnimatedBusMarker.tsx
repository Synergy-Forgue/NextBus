import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { MarkerAnimated, AnimatedRegion } from 'react-native-maps'
import { BRAND } from '../styles/brand'
import type { BusPosition } from '../store/useCommuterStore'

/**
 * A bus marker that glides between telemetry updates and faces its direction
 * of travel.
 *
 * Three things make this read as movement rather than teleporting:
 *
 * 1. Position is interpolated with AnimatedRegion. A plain <Marker coordinate>
 *    re-mounts at each new coordinate, so buses jumped once per update.
 * 2. The animation duration tracks the *observed* gap between updates. The
 *    simulator ticks every 2s but a real driver phone reports every ~10s; a
 *    fixed duration would finish early and leave the bus parked until the next
 *    frame, which is exactly the stutter a fixed 2s value produced.
 * 3. A heading arrow rotates to the bearing between consecutive positions, so
 *    the marker points where the bus is going. Only the arrow rotates — turning
 *    the whole badge would stand the route number on its head.
 *
 * `tracksViewChanges` is disabled once the marker settles: with a custom view,
 * leaving it on makes Android re-rasterise every render, which flickers and
 * costs framerate with several buses on screen.
 */

/** Clamps for the adaptive duration, so one late frame cannot freeze a bus. */
const MIN_ANIM_MS = 900
const MAX_ANIM_MS = 12000
const DEFAULT_ANIM_MS = 2000

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

/** Initial bearing from one coordinate to another, in degrees clockwise from north. */
function bearingBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180) / Math.PI
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

  const prevPos = useRef({ lat: bus.lat, lng: bus.lng })
  const lastUpdateAt = useRef<number>(Date.now())
  const animMs = useRef<number>(DEFAULT_ANIM_MS)

  // Heading is animated too, so turns sweep rather than snap.
  const heading = useRef(new Animated.Value(0)).current
  const headingDeg = useRef(0)

  const [tracksChanges, setTracksChanges] = useState(true)
  const [isMoving, setIsMoving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTracksChanges(false), 1200)
    return () => clearTimeout(t)
  }, [])

  // Re-enable rasterising briefly when the visual state changes, then freeze.
  useEffect(() => {
    setTracksChanges(true)
    const t = setTimeout(() => setTracksChanges(false), 600)
    return () => clearTimeout(t)
  }, [isSelected, bus.status])

  useEffect(() => {
    if (!Number.isFinite(bus.lat) || !Number.isFinite(bus.lng)) return

    const now = Date.now()
    const observedGap = now - lastUpdateAt.current
    lastUpdateAt.current = now

    // Ignore the first frame and absurd gaps (app backgrounded, socket resumed).
    if (observedGap > 200 && observedGap < MAX_ANIM_MS * 2) {
      animMs.current = Math.min(MAX_ANIM_MS, Math.max(MIN_ANIM_MS, observedGap))
    }

    const from = prevPos.current
    const moved = from.lat !== bus.lat || from.lng !== bus.lng

    if (moved) {
      // Prefer a heading the backend supplies; otherwise derive it from motion.
      const raw =
        typeof (bus as any).heading === 'number'
          ? (bus as any).heading
          : bearingBetween(from.lat, from.lng, bus.lat, bus.lng)

      // Unwrap so a 350°→10° turn sweeps 20° forward, not 340° backward.
      let delta = raw - (headingDeg.current % 360)
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      headingDeg.current += delta

      Animated.timing(heading, {
        toValue: headingDeg.current,
        duration: Math.min(600, animMs.current),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start()
    }

    setIsMoving(moved && (bus.speed ?? 0) > 1)
    prevPos.current = { lat: bus.lat, lng: bus.lng }

    coordinate
      .timing({
        latitude: bus.lat,
        longitude: bus.lng,
        duration: animMs.current,
        useNativeDriver: false,
      } as any)
      .start()
  }, [bus.lat, bus.lng, bus.speed, coordinate, heading])

  const color = statusColor(bus.status)
  const rotate = heading.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  })

  return (
    <MarkerAnimated
      coordinate={coordinate as any}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={isSelected ? 10 : 2}
      tracksViewChanges={tracksChanges}
    >
      <View style={styles.wrap}>
        {/* Direction arrow orbits the badge, pointing along the bearing. */}
        {isMoving && (
          <Animated.View style={[styles.headingRing, { transform: [{ rotate }] }]}>
            <View style={[styles.headingArrow, { borderBottomColor: color }]} />
          </Animated.View>
        )}

        {isSelected && <View style={[styles.halo, { borderColor: color }]} />}

        <View style={[styles.pill, { borderColor: color }, isSelected && styles.pillSelected]}>
          <Text style={styles.emoji}>🚌</Text>
          <Text style={[styles.label, isSelected && styles.labelSelected]}>{bus.routeNo}</Text>
        </View>

        <View style={[styles.statusDot, { backgroundColor: color }]} />
      </View>
    </MarkerAnimated>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 84, height: 60 },
  headingRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
  },
  headingArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  halo: {
    position: 'absolute',
    width: 62,
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
    bottom: 10,
    right: 14,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
})
