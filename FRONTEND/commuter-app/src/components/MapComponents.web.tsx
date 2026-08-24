import React, {
  createContext,
  useContext,
  useImperativeHandle,
  useState,
  forwardRef,
} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export class AnimatedRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;

  constructor(opts: any = {}) {
    this.latitude = opts.latitude || 17.7261;
    this.longitude = opts.longitude || 83.3085;
    this.latitudeDelta = opts.latitudeDelta || 0.12;
    this.longitudeDelta = opts.longitudeDelta || 0.12;
  }

  setValue(opts: any) {
    if (opts.latitude !== undefined) this.latitude = opts.latitude;
    if (opts.longitude !== undefined) this.longitude = opts.longitude;
  }

  timing(opts: any) {
    return {
      start: (cb?: any) => {
        if (opts.latitude !== undefined) this.latitude = opts.latitude;
        if (opts.longitude !== undefined) this.longitude = opts.longitude;
        cb?.({ finished: true });
      },
    };
  }
}

interface MapContextType {
  project: (lat: number, lng: number) => { xPercent: number; yPercent: number };
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
}

const MapContext = createContext<MapContextType | null>(null);

interface MapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  style?: any;
  showsUserLocation?: boolean;
  children?: React.ReactNode;
  provider?: string;
}

const MapView = forwardRef((props: MapViewProps, ref: any) => {
  const [region, setRegion] = useState({
    latitude: props.initialRegion?.latitude || 17.7261,
    longitude: props.initialRegion?.longitude || 83.3085,
    latitudeDelta: props.initialRegion?.latitudeDelta || 0.12,
    longitudeDelta: props.initialRegion?.longitudeDelta || 0.12,
  });

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coords: { latitude: number; longitude: number }[], options?: any) => {
      if (!coords || coords.length === 0) return;
      let minLat = coords[0].latitude;
      let maxLat = coords[0].latitude;
      let minLng = coords[0].longitude;
      let maxLng = coords[0].longitude;

      coords.forEach((c) => {
        if (c.latitude < minLat) minLat = c.latitude;
        if (c.latitude > maxLat) maxLat = c.latitude;
        if (c.longitude < minLng) minLng = c.longitude;
        if (c.longitude > maxLng) maxLng = c.longitude;
      });

      const latDelta = Math.max((maxLat - minLat) * 1.35, 0.04);
      const lngDelta = Math.max((maxLng - minLng) * 1.35, 0.04);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      setRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      });
    },
    animateToRegion: (newRegion: any, duration?: number) => {
      setRegion({
        latitude: newRegion.latitude,
        longitude: newRegion.longitude,
        latitudeDelta: newRegion.latitudeDelta || 0.08,
        longitudeDelta: newRegion.longitudeDelta || 0.08,
      });
    },
  }));

  const minLat = region.latitude - region.latitudeDelta / 2;
  const maxLat = region.latitude + region.latitudeDelta / 2;
  const minLng = region.longitude - region.longitudeDelta / 2;
  const maxLng = region.longitude + region.longitudeDelta / 2;

  const project = (lat: number, lng: number) => {
    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;
    const xPercent = ((lng - minLng) / lngSpan) * 100;
    const yPercent = ((maxLat - lat) / latSpan) * 100;
    return { xPercent, yPercent };
  };

  const zoomIn = () => {
    setRegion((r) => ({
      ...r,
      latitudeDelta: r.latitudeDelta * 0.7,
      longitudeDelta: r.longitudeDelta * 0.7,
    }));
  };

  const zoomOut = () => {
    setRegion((r) => ({
      ...r,
      latitudeDelta: r.latitudeDelta * 1.4,
      longitudeDelta: r.longitudeDelta * 1.4,
    }));
  };

  return (
    <MapContext.Provider value={{ project, bounds: { minLat, maxLat, minLng, maxLng }, region }}>
      <View style={[styles.container, props.style]}>
        {/* Stylized Dark Grid Map Canvas */}
        <View style={styles.mapCanvas}>
          <View style={styles.gridLinesHorizontal} />
          <View style={styles.gridLinesVertical} />
        </View>

        {/* Children (Polylines, Markers, Buses) */}
        {props.children}

        {/* Zoom Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomIn}>
            <Text style={styles.controlBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomOut}>
            <Text style={styles.controlBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>
    </MapContext.Provider>
  );
});

export function Marker(props: {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  anchor?: { x: number; y: number };
  zIndex?: number;
  onPress?: () => void;
  children?: React.ReactNode;
  tracksViewChanges?: boolean;
}) {
  const map = useContext(MapContext);
  if (!map || !props.coordinate) return null;

  const { xPercent, yPercent } = map.project(props.coordinate.latitude, props.coordinate.longitude);

  if (xPercent < -15 || xPercent > 115 || yPercent < -15 || yPercent > 115) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={props.onPress}
      style={[
        styles.markerWrap,
        {
          left: `${xPercent}%`,
          top: `${yPercent}%`,
          zIndex: props.zIndex || 5,
        },
      ]}
    >
      {props.children || (
        <View style={styles.defaultPin}>
          <Text style={styles.defaultPinText}>📍</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function MarkerAnimated(props: {
  coordinate: any;
  onPress?: () => void;
  anchor?: { x: number; y: number };
  zIndex?: number;
  tracksViewChanges?: boolean;
  children?: React.ReactNode;
}) {
  const map = useContext(MapContext);
  if (!map || !props.coordinate) return null;

  const lat = props.coordinate.latitude ?? props.coordinate._value?.latitude ?? 17.7261;
  const lng = props.coordinate.longitude ?? props.coordinate._value?.longitude ?? 83.3085;

  const { xPercent, yPercent } = map.project(lat, lng);

  if (xPercent < -20 || xPercent > 120 || yPercent < -20 || yPercent > 120) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={props.onPress}
      style={[
        styles.markerWrap,
        {
          left: `${xPercent}%`,
          top: `${yPercent}%`,
          zIndex: props.zIndex || 10,
        },
      ]}
    >
      {props.children}
    </TouchableOpacity>
  );
}

export function Polyline(props: {
  coordinates: { latitude: number; longitude: number }[];
  strokeColor?: string;
  strokeWidth?: number;
  zIndex?: number;
}) {
  const map = useContext(MapContext);
  if (!map || !props.coordinates || props.coordinates.length < 2) return null;

  const points = props.coordinates
    .map((c) => {
      const { xPercent, yPercent } = map.project(c.latitude, c.longitude);
      return `${xPercent},${yPercent}`;
    })
    .join(' ');

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        { zIndex: props.zIndex || 1, overflow: 'hidden' },
      ]}
    >
      <svg
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          points={points}
          fill="none"
          stroke={props.strokeColor || '#4F46E5'}
          strokeWidth={props.strokeWidth ? props.strokeWidth * 0.25 : 0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    position: 'relative',
  },
  mapCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090D16',
  },
  gridLinesHorizontal: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#38BDF8',
  },
  gridLinesVertical: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#38BDF8',
  },
  markerWrap: {
    position: 'absolute',
    transform: [{ translateX: -32 }, { translateY: -28 }],
    overflow: 'visible',
  },
  defaultPin: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultPinText: {
    fontSize: 20,
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 155,
    gap: 8,
    zIndex: 20,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  controlBtnText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
});

export default MapView;
