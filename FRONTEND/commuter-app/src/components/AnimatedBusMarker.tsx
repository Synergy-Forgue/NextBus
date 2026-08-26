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

  // Disable tracksViewChanges after first render for performance
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
        duration: Math.min(400, animMs.current),
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
  const routeNumber = bus.routeNo || bus.route_number || '?';
  const service = getBusService(routeNumber);
  const color = service.badgeColor;

  return (
    <MarkerAnimated
      coordinate={coordinate as any}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={isSelected ? 20 : 10}
      tracksViewChanges={tracksChanges}
    >
      <View style={s.wrap}>
        {/* Pulsing selection ring */}
        {isSelected && <View style={[s.selectionRing, { borderColor: color }]} />}

        {/* Direction chevron — only when moving */}
        {isMoving && (
          <Animated.View style={[s.chevronOrbit, { transform: [{ rotate }] }]}>
            <View style={[s.chevron, { borderBottomColor: color }]} />
          </Animated.View>
        )}

        {/* Main marker: colored circle (dot) with route label below */}
        <View style={[s.dot, { backgroundColor: color }, isSelected && s.dotSelected]}>
          {/* White stripe — mimics a windshield / bus front detail */}
          <View style={s.stripe} />
        </View>

        {/* Route label pill underneath the dot */}
        <View style={[s.label, { backgroundColor: color }]}>
          <Text style={s.labelText} numberOfLines={1}>
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

const DOT = 22; // main circle diameter

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 52,
    overflow: 'visible',
  },

  // Outer selection ring (like Google Maps selected pin glow)
  selectionRing: {
    position: 'absolute',
    top: 0,
    width: DOT + 12,
    height: DOT + 12,
    borderRadius: (DOT + 12) / 2,
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Directional chevron orbit
  chevronOrbit: {
    position: 'absolute',
    top: 0,
    width: DOT + 12,
    height: DOT + 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'visible',
  },
  chevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -5,
  },

  // Main circle dot — Uber/Rapido style
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  dotSelected: {
    width: DOT + 4,
    height: DOT + 4,
    borderRadius: (DOT + 4) / 2,
    borderWidth: 3,
    borderColor: '#FDE047',
  },

  // Small decorative stripe inside the circle
  stripe: {
    width: DOT * 0.55,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  // Compact route number pill below the dot
  label: {
    marginTop: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
