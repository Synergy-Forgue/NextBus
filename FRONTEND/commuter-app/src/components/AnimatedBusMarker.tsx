import React, { useEffect, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { MarkerAnimated, AnimatedRegion } from './MapComponents';
import type { BusPosition } from '../store/useCommuterStore';
import { getBusService } from '../utils/busMeta';

interface Props {
  bus: BusPosition;
  isSelected?: boolean;
  onPress?: () => void;
}

const MIN_ANIM_MS = 600;
const MAX_ANIM_MS = 5000;
const DEFAULT_ANIM_MS = 1600;

function bearingBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function AnimatedBusMarkerComponent({ bus, isSelected = false, onPress }: Props) {
  const coordinate = useRef(
    new AnimatedRegion({
      latitude: bus.lat,
      longitude: bus.lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  const prevPos = useRef({ lat: bus.lat, lng: bus.lng });
  const lastUpdateAt = useRef<number>(Date.now());
  const animMs = useRef<number>(DEFAULT_ANIM_MS);

  const heading = useRef(new Animated.Value(0)).current;
  const headingDeg = useRef(0);
  const [tracksChanges, setTracksChanges] = useState(true);

  // Disable rasterization after initial frame for buttery 60fps performance
  useEffect(() => {
    const t = setTimeout(() => setTracksChanges(false), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(bus.lat) || !Number.isFinite(bus.lng)) return;

    const now = Date.now();
    const observedGap = now - lastUpdateAt.current;
    lastUpdateAt.current = now;

    if (observedGap > 200 && observedGap < MAX_ANIM_MS * 2) {
      animMs.current = Math.min(MAX_ANIM_MS, Math.max(MIN_ANIM_MS, observedGap));
    }

    const from = prevPos.current;
    const moved = from.lat !== bus.lat || from.lng !== bus.lng;

    if (moved) {
      const raw =
        typeof (bus as any).heading === 'number'
          ? (bus as any).heading
          : bearingBetween(from.lat, from.lng, bus.lat, bus.lng);

      let delta = raw - (headingDeg.current % 360);
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      headingDeg.current += delta;

      Animated.timing(heading, {
        toValue: headingDeg.current,
        duration: Math.min(450, animMs.current),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }

    prevPos.current = { lat: bus.lat, lng: bus.lng };

    coordinate
      .timing({
        latitude: bus.lat,
        longitude: bus.lng,
        duration: animMs.current,
        useNativeDriver: false,
      } as any)
      .start();
  }, [bus.lat, bus.lng, bus.speed]);

  const rotate = heading.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const isMoving = (bus.speed ?? 0) > 1;
  const routeNumber = bus.routeNo || bus.route_number || '10K';
  const service = getBusService(routeNumber);

  return (
    <MarkerAnimated
      coordinate={coordinate as any}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={isSelected ? 20 : 10}
      tracksViewChanges={tracksChanges}
    >
      <View style={styles.markerContainer}>
        {/* Selected Halo Pulse */}
        {isSelected && (
          <View style={[styles.haloRing, { borderColor: service.badgeColor }]} />
        )}

        {/* Orbiting Directional Arrow */}
        {isMoving && (
          <Animated.View style={[styles.arrowOrbit, { transform: [{ rotate }] }]}>
            <View style={[styles.arrowHead, { borderBottomColor: service.badgeColor }]} />
          </Animated.View>
        )}

        {/* Crisp Transit Pill Badge */}
        <View
          style={[
            styles.busBadge,
            { backgroundColor: service.badgeColor },
            isSelected && styles.busBadgeSelected,
          ]}
        >
          <Text style={styles.busEmoji}>🚌</Text>
          <Text style={styles.routeText} numberOfLines={1}>
            {routeNumber}
          </Text>
        </View>
      </View>
    </MarkerAnimated>
  );
}

export const AnimatedBusMarker = memo(AnimatedBusMarkerComponent, (prev, next) => {
  return (
    prev.bus.busId === next.bus.busId &&
    prev.bus.lat === next.bus.lat &&
    prev.bus.lng === next.bus.lng &&
    prev.bus.speed === next.bus.speed &&
    prev.bus.status === next.bus.status &&
    prev.isSelected === next.isSelected
  );
});

export default AnimatedBusMarker;

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 56,
    overflow: 'visible',
  },
  arrowOrbit: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 4,
  },
  haloRing: {
    position: 'absolute',
    width: 58,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
    backgroundColor: 'rgba(67, 56, 202, 0.2)',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 5,
  },
  busBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  busBadgeSelected: {
    transform: [{ scale: 1.12 }],
    borderColor: '#FDE047',
    borderWidth: 2.5,
  },
  busEmoji: {
    fontSize: 13,
  },
  routeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
