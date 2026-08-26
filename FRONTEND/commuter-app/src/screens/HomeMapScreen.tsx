import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapComponents';
import * as Location from 'expo-location';
import useCommuterStore from '../store/useCommuterStore';
import useRealTimeBus from '../hooks/useRealTimeBus';
import { routeService } from '../services/routeService';
import { BRAND } from '../styles/brand';
import AnimatedBusMarker from '../components/AnimatedBusMarker';
import { CITIES, cityIdForCoords, getCity } from '../utils/cities';
import { getBusService, formatBusPlate } from '../utils/busMeta';

// Vector projection of a point onto a line segment [A, B]
function projectPointOnSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): { lat: number; lng: number; distSq: number; t: number } {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const dLat = pLat - aLat;
    const dLng = pLng - aLng;
    return { lat: aLat, lng: aLng, distSq: dLat * dLat + dLng * dLng, t: 0 };
  }

  let t = ((pLng - aLng) * dx + (pLat - aLat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;
  const dLat = pLat - projLat;
  const dLng = pLng - projLng;

  return { lat: projLat, lng: projLng, distSq: dLat * dLat + dLng * dLng, t };
}

export default function HomeMapScreen({ navigation }: any) {
  const [userLocation, setUserLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCityId, setActiveCityId] = useState<string>('vizag');
  const [routeStops, setRouteStops] = useState<any[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<{ latitude: number; longitude: number }[] | null>(null);
  const mapRef = useRef<MapView>(null);

  const {
    userLocation: storeUserLoc,
    setUserLocation: storeUserLocation,
    selectedRoute,
    selectedBus,
    setSelectedBus,
    setSelectedRoute,
  } = useCommuterStore();

  const { busPositions, isConnected } = useRealTimeBus();

  const liveBuses = useMemo(() => Object.values(busPositions), [busPositions]);

  useEffect(() => {
    initializeLocation();
  }, []);

  // Sync active city with selected bus / route if set
  useEffect(() => {
    if (selectedBus?.lat && selectedBus?.lng) {
      const cId = cityIdForCoords(selectedBus.lat, selectedBus.lng);
      if (cId) {
        setActiveCityId(cId);
      }
    }
  }, [selectedBus?.busId]);

  // Load route stops whenever selectedRoute or selectedBus changes
  useEffect(() => {
    const routeId = selectedRoute?.id || selectedBus?.route_id;
    if (routeId) {
      loadStopsForRoute(Number(routeId));
    } else {
      setRouteStops([]);
    }
  }, [selectedRoute?.id, selectedBus?.route_id]);

  // Road-following geometry for the selected route
  useEffect(() => {
    const routeId = selectedRoute?.id || selectedBus?.route_id;
    if (!routeId) {
      setRouteGeometry(null);
      return;
    }
    let cancelled = false;
    routeService
      .getRouteGeometry(Number(routeId))
      .then((geom) => {
        if (!cancelled && geom && geom.length > 1) {
          setRouteGeometry(geom);
        }
      })
      .catch(() => {
        if (!cancelled) setRouteGeometry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoute?.id, selectedBus?.route_id]);

  // Frame camera on initial route load or bus switch
  useEffect(() => {
    if (routeStops.length > 0 && mapRef.current) {
      const coords = routeStops.map((s) => ({
        latitude: parseFloat(s.latitude),
        longitude: parseFloat(s.longitude),
      }));

      if (selectedBus?.lat && selectedBus?.lng) {
        coords.push({
          latitude: selectedBus.lat,
          longitude: selectedBus.lng,
        });
      }

      const timer = setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 160, right: 60, bottom: 280, left: 60 },
          animated: true,
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [routeStops, selectedBus?.busId]);

  const initializeLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setUserLocation(coords);
        storeUserLocation(coords.lat, coords.lng);
      }
    } catch {
      /* stay on default region */
    } finally {
      setLoading(false);
    }
  };

  const loadStopsForRoute = async (routeId: number) => {
    try {
      const stops = await routeService.getRouteStops(routeId);
      setRouteStops(stops);
    } catch {
      setRouteStops([]);
    }
  };

  const handleSwitchCity = useCallback(
    (cityId: string) => {
      setActiveCityId(cityId);
      if (selectedRoute || selectedBus) {
        setSelectedRoute(null);
        setSelectedBus(null);
        setRouteStops([]);
      }

      const cityDef = getCity(cityId);
      const targetCenter = cityDef?.center
        ? { latitude: cityDef.center.latitude, longitude: cityDef.center.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }
        : { latitude: 17.7261, longitude: 83.3085, latitudeDelta: 0.12, longitudeDelta: 0.12 };

      mapRef.current?.animateToRegion(targetCenter, 700);
    },
    [selectedRoute, selectedBus, setSelectedRoute, setSelectedBus]
  );

  const recenter = useCallback(() => {
    const cityDef = getCity(activeCityId);
    const defaultCenter = cityDef?.center
      ? { latitude: cityDef.center.latitude, longitude: cityDef.center.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
      : { latitude: 17.7261, longitude: 83.3085, latitudeDelta: 0.08, longitudeDelta: 0.08 };

    mapRef.current?.animateToRegion(
      userLocation?.lat
        ? {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }
        : defaultCenter,
      600
    );
  }, [userLocation, activeCityId]);

  const handleBusPress = useCallback(
    (bus: any) => {
      setSelectedBus(bus);
    },
    [setSelectedBus]
  );

  const clearSelectedJourney = useCallback(() => {
    setSelectedRoute(null);
    setSelectedBus(null);
    setRouteStops([]);
  }, [setSelectedRoute, setSelectedBus]);

  const polylineCoords = useMemo(
    () =>
      routeStops.map((s) => ({
        latitude: parseFloat(s.latitude),
        longitude: parseFloat(s.longitude),
      })),
    [routeStops]
  );

  const nextStopIndex = Math.min(
    Math.max(Number(selectedBus?.nextStopIndex ?? 0), 0),
    Math.max(routeStops.length - 1, 0)
  );

  // Direction-aware base line path
  const isBusReverse = selectedBus?.direction === 'reverse' || selectedRoute?.direction === 'reverse';
  const rawLinePath = routeGeometry && routeGeometry.length > 1 ? routeGeometry : polylineCoords;
  const linePath = useMemo(() => {
    if (!rawLinePath || rawLinePath.length < 2) return rawLinePath;
    if (isBusReverse) {
      return [...rawLinePath].reverse();
    }
    return rawLinePath;
  }, [rawLinePath, isBusReverse]);

  // Seamless, gapless polyline splitting at bus coordinate with projection
  const { travelledCoords, upcomingCoords } = useMemo(() => {
    if (!linePath || linePath.length < 2) {
      return { travelledCoords: [], upcomingCoords: [] };
    }

    if (!selectedBus?.lat || !selectedBus?.lng) {
      return { travelledCoords: [], upcomingCoords: linePath };
    }

    const bLat = selectedBus.lat;
    const bLng = selectedBus.lng;

    let bestSegment = 0;
    let minDistanceSq = Infinity;
    let bestProj = { lat: linePath[0].latitude, lng: linePath[0].longitude };

    for (let i = 0; i < linePath.length - 1; i++) {
      const a = linePath[i];
      const b = linePath[i + 1];
      const proj = projectPointOnSegment(bLat, bLng, a.latitude, a.longitude, b.latitude, b.longitude);

      if (proj.distSq < minDistanceSq) {
        minDistanceSq = proj.distSq;
        bestSegment = i;
        bestProj = { lat: proj.lat, lng: proj.lng };
      }
    }

    const busMarkerCoord = { latitude: bLat, longitude: bLng };
    const projectedRoadCoord = { latitude: bestProj.lat, longitude: bestProj.lng };

    // Covered path: origin -> segment -> projected road point -> bus coordinate
    const travelled: { latitude: number; longitude: number }[] = [
      ...linePath.slice(0, bestSegment + 1),
      projectedRoadCoord,
      busMarkerCoord,
    ];

    // Upcoming path: bus coordinate -> projected road point -> next segments -> terminus
    const upcoming: { latitude: number; longitude: number }[] = [
      busMarkerCoord,
      projectedRoadCoord,
      ...linePath.slice(bestSegment + 1),
    ];

    return { travelledCoords: travelled, upcomingCoords: upcoming };
  }, [linePath, selectedBus?.lat, selectedBus?.lng]);

  // Active city telemetry buses count
  const cityBuses = useMemo(
    () =>
      liveBuses.filter((b: any) => {
        const cId = cityIdForCoords(b.lat, b.lng);
        return cId ? cId === activeCityId : activeCityId === 'vizag' ? b.lat > 15 : b.lat < 15;
      }),
    [liveBuses, activeCityId]
  );

  // Transit Service Metadata for selected bus (Ama Bus Inspiration)
  const currentRouteNo =
    selectedBus?.routeNo || selectedBus?.route_number || selectedRoute?.route_number || '10K';
  const serviceMeta = useMemo(() => getBusService(currentRouteNo), [currentRouteNo]);
  const formattedPlate = useMemo(
    () => formatBusPlate(selectedBus?.licensePlate, currentRouteNo),
    [selectedBus?.licensePlate, currentRouteNo]
  );

  // Dynamic Bidirectional (To & Fro) Next Stop Progression
  const { upcomingStops, activeHeadsign } = useMemo(() => {
    if (!selectedBus) {
      return {
        upcomingStops: [],
        activeHeadsign: destinationStopFromStops(routeStops, selectedRoute),
      };
    }

    // 1. If the bus telemetry provides live stop_etas (which knows the forward/reverse travel state)
    if (Array.isArray(selectedBus.stop_etas) && selectedBus.stop_etas.length > 0) {
      const activeList = selectedBus.stop_etas
        .filter((s: any) => s.eta_seconds !== null && s.eta_seconds !== undefined)
        .sort((a: any, b: any) => (a.eta_seconds ?? 0) - (b.eta_seconds ?? 0));

      if (activeList.length > 0) {
        const lastStop = activeList[activeList.length - 1];
        const stops = activeList.slice(0, 5).map((s: any, idx: number) => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name,
          etaMin: Math.max(1, Math.round((s.eta_seconds ?? 60) / 60)),
          isNext: idx === 0,
        }));
        return {
          upcomingStops: stops,
          activeHeadsign: lastStop?.stop_name || destinationStopFromStops(routeStops, selectedRoute),
        };
      }
    }

    // 2. Fallback to routeStops sequence
    const startIndex = Math.max(0, nextStopIndex);
    const stops = routeStops.slice(startIndex, startIndex + 4).map((s, idx) => ({
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      etaMin: Math.max(1, (idx + 1) * 3),
      isNext: idx === 0,
    }));

    return {
      upcomingStops: stops,
      activeHeadsign: destinationStopFromStops(routeStops, selectedRoute),
    };
  }, [selectedBus, routeStops, nextStopIndex, selectedRoute]);

  const crowdLevel = selectedBus?.occupancy_count ?? 18;
  const crowdPercent = Math.min(100, Math.round((crowdLevel / 50) * 100));
  const availableSeats = Math.max(0, 50 - crowdLevel);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={BRAND.primary} />
        <Text style={styles.loadingText}>Initializing Live Transit Radar…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: activeCityId === 'vizag' ? 17.7261 : 12.3052,
          longitude: activeCityId === 'vizag' ? 83.3085 : 76.6552,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        }}
        showsUserLocation
      >
        {/* Google Maps Navigation Style Layered Polylines */}
        {linePath && linePath.length > 1 && (
          <>
            {/* Base road outline casing */}
            <Polyline
              coordinates={linePath}
              strokeColor="rgba(15, 23, 42, 0.5)"
              strokeWidth={11}
              zIndex={1}
            />

            {/* COVERED / TRAVELLED ROUTE (Muted Google Maps Gray behind vehicle) */}
            {travelledCoords.length > 1 && (
              <>
                <Polyline
                  coordinates={travelledCoords}
                  strokeColor="#64748B"
                  strokeWidth={6}
                  zIndex={2}
                />
                <Polyline
                  coordinates={travelledCoords}
                  strokeColor="#94A3B8"
                  strokeWidth={3}
                  zIndex={3}
                />
              </>
            )}

            {/* UPCOMING / ACTIVE NAVIGATION ROUTE (Google Maps Electric Blue ahead of vehicle) */}
            {upcomingCoords.length > 1 && (
              <>
                <Polyline
                  coordinates={upcomingCoords}
                  strokeColor="#2563EB"
                  strokeWidth={7.5}
                  zIndex={4}
                />
                <Polyline
                  coordinates={upcomingCoords}
                  strokeColor="#60A5FA"
                  strokeWidth={3.5}
                  zIndex={5}
                />
              </>
            )}
          </>
        )}

        {/* Stop Markers */}
        {routeStops.map((s: any, idx: number) => {
          const isPassed = idx < nextStopIndex;
          const isNext = idx === nextStopIndex && !!selectedBus;
          const isOrigin = idx === 0;
          const isDestination = idx === routeStops.length - 1;

          return (
            <Marker
              key={`stop_${s.stop_id || idx}`}
              coordinate={{
                latitude: parseFloat(s.latitude),
                longitude: parseFloat(s.longitude),
              }}
              title={s.stop_name || `Stop ${idx + 1}`}
              description={
                isOrigin
                  ? '🟢 Boarding Origin'
                  : isDestination
                  ? '🏁 Final Destination'
                  : isNext
                  ? '🟢 Approaching Next'
                  : isPassed
                  ? '✓ Departed'
                  : `Stop ${idx + 1}`
              }
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={isNext ? 10 : isOrigin || isDestination ? 8 : 4}
            >
              {isOrigin ? (
                <View style={styles.originStopMarker}>
                  <Text style={styles.stopEmoji}>🟢</Text>
                  <View style={styles.stopPillSmall}>
                    <Text style={styles.stopPillSmallText}>Start</Text>
                  </View>
                </View>
              ) : isDestination ? (
                <View style={styles.destStopMarker}>
                  <Text style={styles.stopEmoji}>🏁</Text>
                  <View style={[styles.stopPillSmall, { backgroundColor: BRAND.danger }]}>
                    <Text style={styles.stopPillSmallText}>End</Text>
                  </View>
                </View>
              ) : isNext ? (
                <View style={styles.nextStopWrapper}>
                  <View style={styles.nextStopHalo} />
                  <View style={styles.nextStopDot}>
                    <Text style={styles.nextStopNum}>{idx + 1}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.stopDot, isPassed && styles.stopDotPassed]}>
                  <Text style={[styles.stopNum, isPassed && styles.stopNumPassed]}>
                    {isPassed ? '✓' : idx + 1}
                  </Text>
                </View>
              )}
            </Marker>
          );
        })}

        {/* Bus Icons — filtered to selected route when a route is active */}
        {(selectedRoute
          ? liveBuses.filter((b: any) => {
              const rn = (b.routeNo || b.route_number || '').toString().trim().toUpperCase();
              const srn = (selectedRoute.route_number || '').toString().trim().toUpperCase();
              return rn === srn;
            })
          : liveBuses
        ).map((bus: any) => (
          <AnimatedBusMarker
            key={bus.busId}
            bus={bus}
            isSelected={selectedBus?.busId === bus.busId}
            onPress={() => handleBusPress(bus)}
          />
        ))}
      </MapView>

      {/* Top Floating Control Bar */}
      <View style={styles.topBarContainer}>
        {/* Status Pill & Live indicator */}
        <View style={styles.statusRow}>
          <View style={styles.livePill}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isConnected ? '#10B981' : '#F59E0B' },
              ]}
            />
            <Text style={styles.livePillText}>
              {isConnected
                ? `${cityBuses.length} ${activeCityId === 'vizag' ? 'APSRTC' : 'KSRTC'} buses streaming`
                : 'Connecting…'}
            </Text>
          </View>

          {(selectedRoute || selectedBus) && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearSelectedJourney}>
              <Text style={styles.clearBtnText}>✕ Clear Filter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Dynamic Multi-City Selector Switch Buttons (Vizag, Mysuru, Kalaburagi) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.citySwitcherBar}
        >
          {CITIES.map((c) => {
            const isActive = activeCityId === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.cityTabBtn,
                  isActive && styles.cityTabBtnActive,
                ]}
                onPress={() => handleSwitchCity(c.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.cityTabEmoji}>{c.emoji}</Text>
                <View>
                  <Text
                    style={[
                      styles.cityTabTitle,
                      isActive && styles.cityTabTitleActive,
                    ]}
                  >
                    {c.name}
                  </Text>
                  <Text
                    style={[
                      styles.cityTabSub,
                      isActive && styles.cityTabSubActive,
                    ]}
                  >
                    {c.region.split('·')[1]?.trim() || c.region}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Ama Bus Style Live Telemetry Cockpit Drawer */}
      {selectedBus && (
        <View style={styles.selectedBusCard}>
          {/* Drawer Top Header: Line Pill + Service Name + Headsign */}
          <View style={styles.selectedBusHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.badge, { backgroundColor: serviceMeta.badgeColor }]}>
                <Text style={styles.badgeText}>Line {currentRouteNo}</Text>
              </View>
              <View style={styles.serviceMetaWrap}>
                <Text style={styles.serviceTitleText}>{serviceMeta.serviceName}</Text>
                <Text style={styles.headsignText} numberOfLines={1}>
                  Towards {activeHeadsign} ➔
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedBus(null)} style={styles.closeCardBtn}>
              <Text style={styles.closeCardIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Vehicle Metadata Strip */}
          <View style={styles.vehicleStrip}>
            <View style={styles.stripPill}>
              <Text style={styles.stripPillText}>🚌 {formattedPlate}</Text>
            </View>
            <View style={[styles.stripPill, styles.stripPillHighlight]}>
              <Text style={[styles.stripPillText, { color: BRAND.primary }]}>
                {serviceMeta.serviceType}
              </Text>
            </View>
            <View style={styles.stripPill}>
              <Text style={styles.stripPillText}>
                ⚡ {selectedBus.speed != null ? `${selectedBus.speed} km/h` : '32 km/h'}
              </Text>
            </View>
          </View>

          {/* Live Approaching Next Stop Hero Banner */}
          {upcomingStops.length > 0 && (
            <View style={styles.nextStopHero}>
              <View style={styles.nextStopHeroLeft}>
                <View style={styles.pulseDotWrap}>
                  <View style={styles.pulseDotRing} />
                  <View style={styles.pulseDotCenter} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextStopHeroLbl}>APPROACHING NEXT STOP</Text>
                  <Text style={styles.nextStopHeroTitle} numberOfLines={1}>
                    {upcomingStops[0].stop_name}
                  </Text>
                </View>
              </View>
              <View style={styles.nextStopHeroEta}>
                <Text style={styles.nextStopHeroEtaVal}>
                  {upcomingStops[0].etaMin}m
                </Text>
                <Text style={styles.nextStopHeroEtaSub}>arrival</Text>
              </View>
            </View>
          )}

          {/* Next Upcoming Stops Progression Mini Timeline (Mo Bus style) */}
          {upcomingStops.length > 1 && (
            <View style={styles.timelineSection}>
              <Text style={styles.timelineSectionTitle}>UPCOMING STOPS PROGRESSION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stopsScroll}>
                {upcomingStops.slice(1).map((s: any, i: number) => (
                  <View key={s.stop_id || i} style={styles.timelineStopCard}>
                    <Text style={styles.timelineStopIndex}>#{nextStopIndex + i + 2}</Text>
                    <Text style={styles.timelineStopName} numberOfLines={1}>
                      {s.stop_name}
                    </Text>
                    <Text style={styles.timelineStopEta}>⏱ {s.etaMin} mins</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Occupancy Progress Bar */}
          <View style={styles.occupancyRow}>
            <Text style={styles.occupancyLbl}>
              Seat Availability: <Text style={{ fontWeight: '900', color: BRAND.text }}>{availableSeats} seats left</Text> ({crowdPercent}% full)
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${crowdPercent}%`,
                    backgroundColor: crowdPercent > 75 ? BRAND.danger : BRAND.success,
                  },
                ]}
              />
            </View>
          </View>

          {/* Drawer Actions */}
          <View style={styles.actionBtnRow}>
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => navigation.navigate('BusDetails', { bus: selectedBus })}
              activeOpacity={0.85}
            >
              <Text style={styles.detailsBtnText}>View Full Stop Timeline & Radar  →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alarmBtn}
              onPress={() => navigation.navigate('SetAlert', { bus: selectedBus })}
              activeOpacity={0.85}
            >
              <Text style={styles.alarmBtnText}>🔔</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Action Buttons */}
      <TouchableOpacity style={styles.locateBtn} onPress={recenter} activeOpacity={0.85}>
        <Text style={styles.locateIcon}>🎯</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.sosBtn}
        onPress={() => navigation.navigate('SOS')}
        activeOpacity={0.85}
      >
        <Text style={styles.sosBtnText}>SOS</Text>
      </TouchableOpacity>

      {/* Bottom Search Bar (if no bus card is open) */}
      {!selectedBus && (
        <TouchableOpacity
          style={styles.bottomSearch}
          activeOpacity={0.9}
          onPress={() => {
            const parent = navigation.getParent?.();
            if (parent) {
              parent.navigate('App', { screen: 'Search' });
            } else {
              navigation.navigate('Search');
            }
          }}
        >
          <Text style={styles.bottomSearchText}>
            🔍  Where are you going in {activeCityId === 'vizag' ? 'Visakhapatnam' : 'Mysuru'}?
          </Text>
          <View style={styles.goBtn}>
            <Text style={styles.goBtnText}>➤</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

function destinationStopFromStops(stops: any[], selectedRoute: any): string {
  if (stops && stops.length > 0) {
    return stops[stops.length - 1]?.stop_name || 'Destination';
  }
  return selectedRoute?.end_stop || 'Destination';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    marginTop: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  topBarContainer: {
    position: 'absolute',
    top: 52,
    left: 14,
    right: 14,
    gap: 8,
    zIndex: 25,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...BRAND.shadow,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  livePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    ...BRAND.shadow,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.danger,
  },
  citySwitcherBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  cityTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: BRAND.radius.lg,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    minWidth: 125,
    ...BRAND.shadow,
  },
  cityTabBtnActive: {
    backgroundColor: BRAND.primary,
    borderColor: '#FFFFFF',
  },
  cityTabEmoji: {
    fontSize: 18,
  },
  cityTabTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#CBD5E1',
  },
  cityTabTitleActive: {
    color: '#FFFFFF',
  },
  cityTabSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cityTabSubActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  originStopMarker: {
    alignItems: 'center',
  },
  destStopMarker: {
    alignItems: 'center',
  },
  stopEmoji: {
    fontSize: 18,
  },
  stopPillSmall: {
    backgroundColor: BRAND.success,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: -2,
  },
  stopPillSmallText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
  nextStopWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
  },
  nextStopHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  nextStopDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BRAND.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nextStopNum: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  stopDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  stopNum: {
    color: '#0F172A',
    fontSize: 8.5,
    fontWeight: '900',
  },
  stopDotPassed: {
    backgroundColor: '#64748B',
    borderColor: '#94A3B8',
    opacity: 0.8,
  },
  stopNumPassed: {
    color: '#FFFFFF',
  },
  selectedBusCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 16,
    ...BRAND.shadowLg,
    zIndex: 30,
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  selectedBusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  badge: {
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  serviceMetaWrap: {
    flex: 1,
  },
  serviceTitleText: {
    fontSize: 14,
    fontWeight: '900',
    color: BRAND.text,
  },
  headsignText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.primary,
    marginTop: 1,
  },
  closeCardBtn: {
    padding: 6,
  },
  closeCardIcon: {
    fontSize: 16,
    color: BRAND.textSecondary,
  },
  vehicleStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  stripPill: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stripPillHighlight: {
    backgroundColor: '#EEF2FF',
  },
  stripPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.textSecondary,
  },
  nextStopHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: BRAND.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  nextStopHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pulseDotWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDotRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  pulseDotCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  nextStopHeroLbl: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.8,
  },
  nextStopHeroTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#064E3B',
  },
  nextStopHeroEta: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BRAND.radius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nextStopHeroEtaVal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#059669',
  },
  nextStopHeroEtaSub: {
    fontSize: 8,
    fontWeight: '700',
    color: '#059669',
  },
  timelineSection: {
    marginBottom: 8,
  },
  timelineSectionTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: BRAND.textTertiary,
    marginBottom: 6,
  },
  stopsScroll: {
    flexDirection: 'row',
  },
  timelineStopCard: {
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    width: 120,
  },
  timelineStopIndex: {
    fontSize: 8,
    fontWeight: '800',
    color: BRAND.textTertiary,
  },
  timelineStopName: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.text,
    marginVertical: 1,
  },
  timelineStopEta: {
    fontSize: 9.5,
    fontWeight: '800',
    color: BRAND.primary,
  },
  occupancyRow: {
    marginBottom: 10,
  },
  occupancyLbl: {
    fontSize: 10,
    color: BRAND.textSecondary,
    marginBottom: 4,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailsBtn: {
    flex: 1,
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  detailsBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  alarmBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND.border,
  },
  alarmBtnText: {
    fontSize: 16,
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: 160,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: BRAND.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...BRAND.shadow,
    zIndex: 20,
  },
  locateIcon: {
    fontSize: 20,
  },
  sosBtn: {
    position: 'absolute',
    right: 16,
    bottom: 215,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: BRAND.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 20,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bottomSearch: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.pill,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    ...BRAND.shadowLg,
    zIndex: 20,
  },
  bottomSearchText: {
    flex: 1,
    color: BRAND.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  goBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
