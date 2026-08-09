import { useEffect, useState, useRef } from 'react';
import * as Location from 'expo-location';
import { useDriverStore } from '../store/driverStore';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export const useRealTimeLocation = (enabled: boolean = false) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const { currentLocation } = useDriverStore();

  // Request location permissions
  const requestPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return false;
      }
      return true;
    } catch (err) {
      setError('Failed to request location permissions');
      return false;
    }
  };

  // Get current location once
  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return null;

      const currentLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
        accuracy: currentLoc.coords.accuracy || 0,
        altitude: currentLoc.coords.altitude || 0,
        heading: currentLoc.coords.heading || 0,
        speed: currentLoc.coords.speed || 0,
        timestamp: currentLoc.timestamp,
      };

      setLocation(locationData);
      setError(null);
      return locationData;
    } catch (err) {
      setError('Failed to get current location');
      console.error(err);
      return null;
    }
  };

  // Start continuous location tracking
  const startTracking = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      // Subscribe to location updates every 10 seconds
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 10, // 10 meters minimum
        },
        (locUpdate) => {
          const locationData: LocationData = {
            latitude: locUpdate.coords.latitude,
            longitude: locUpdate.coords.longitude,
            accuracy: locUpdate.coords.accuracy || 0,
            altitude: locUpdate.coords.altitude || 0,
            heading: locUpdate.coords.heading || 0,
            speed: locUpdate.coords.speed || 0,
            timestamp: locUpdate.timestamp,
          };

          setLocation(locationData);
          setError(null);

          // Emit Socket.IO event for real-time tracking
          // This will be handled by a separate effect in the driver dashboard
        }
      );

      setIsTracking(true);
    } catch (err) {
      setError('Failed to start location tracking');
      console.error(err);
      setIsTracking(false);
    }
  };

  // Stop continuous location tracking
  const stopTracking = async () => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
  };

  // Setup/cleanup effect
  useEffect(() => {
    if (enabled && !isTracking) {
      startTracking();
    } else if (!enabled && isTracking) {
      stopTracking();
    }

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
      }
    };
  }, [enabled]);

  return {
    location,
    error,
    isTracking,
    getCurrentLocation,
    startTracking,
    stopTracking,
  };
};
