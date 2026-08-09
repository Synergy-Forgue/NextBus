import * as Location from 'expo-location';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Haversine distance: calculate km between two GPS points
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Average walking speed: 1.4 m/s = 5 km/h
const WALK_SPEED = 1.4; // m/s

export default class SmartAlertsService {
  /**
   * MODE 1: AI-PROACTIVE ALERT
   * Detects user location → calculates walk time to nearest stop →
   * compares with bus ETA → nudges "Leave in X minutes"
   *
   * Returns: null if no alert needed, or { message: "Leave in 5 minutes to catch Bus 28" }
   */
  async checkAIProactiveAlert(
    userLat: number,
    userLon: number,
    busETA: number, // minutes
    selectedBusRoute: string,
    nearestStop: { latitude: number; longitude: number }
  ) {
    try {
      // STEP 1: Calculate walk distance to nearest stop
      const walkDistanceKm = haversine(userLat, userLon, nearestStop.latitude, nearestStop.longitude);
      const walkDistanceMeters = walkDistanceKm * 1000;

      // STEP 2: Calculate walk time (+ 30 sec buffer for crossing streets, etc.)
      const walkTimeSeconds = walkDistanceMeters / WALK_SPEED + 30;
      const walkTimeMinutes = Math.ceil(walkTimeSeconds / 60);

      // STEP 3: Calculate leave time = BusETA - WalkTime (in minutes)
      const leaveInMinutes = busETA - walkTimeMinutes;

      // STEP 4: Decide if alert should trigger
      // Only alert if they need to leave within next 15 minutes AND bus arrives within 20 min
      if (leaveInMinutes > 0 && leaveInMinutes <= 15 && busETA <= 20) {
        return {
          trigger: true,
          message: `Leave in ${leaveInMinutes} minute${leaveInMinutes === 1 ? '' : 's'} to catch Bus ${selectedBusRoute}`,
          walkTime: walkTimeMinutes,
          eta: busETA,
          distance: walkDistanceKm.toFixed(2),
        };
      }

      return { trigger: false };
    } catch (err) {
      console.error('SmartAlert error:', err);
      return { trigger: false };
    }
  }

  /**
   * MODE 2: CUSTOM ALARM
   * User sets threshold: "Notify when bus is X minutes away"
   * Returns: true if bus ETA <= threshold
   */
  checkCustomAlarm(busETA: number, thresholdMinutes: number): boolean {
    return busETA <= thresholdMinutes;
  }

  /**
   * SAFE ZONE ALERTS
   * Auto-notify when commuter boards/alights
   * In real app, uses geofencing; here we simulate with distance check
   */
  checkSafeZoneAlert(
    userLat: number,
    userLon: number,
    nearestStopLat: number,
    nearestStopLon: number,
    previousDistanceKm: number
  ) {
    const currentDistanceKm = haversine(userLat, userLon, nearestStopLat, nearestStopLon);
    const threshold = 0.05; // 50 meters = at the stop

    // User just boarded (was far, now at stop)
    if (previousDistanceKm > threshold && currentDistanceKm <= threshold) {
      return { type: 'boarded', message: '✓ You boarded the bus. Trip sharing activated.' };
    }

    // User just alighted (was at stop, now far)
    if (previousDistanceKm <= threshold && currentDistanceKm > threshold) {
      return { type: 'alighted', message: '✓ You alighted. Trip sharing ended.' };
    }

    return null;
  }

  /**
   * LATE NIGHT MODE
   * Auto-enable after 9 PM, auto-disable before 6 AM
   */
  checkLateNightMode(): boolean {
    const hour = new Date().getHours();
    return hour >= 21 || hour < 6; // 9 PM to 6 AM
  }

  /**
   * CROWD SAFETY INDICATOR
   * Flag buses with low occupancy (< 30%) late at night
   * Recommends waiting for busier bus
   */
  checkCrowdSafety(occupancyPercent: number, isLateNight: boolean): { safe: boolean; message?: string } {
    if (isLateNight && occupancyPercent < 30) {
      return {
        safe: false,
        message: `⚠️  This bus is only ${occupancyPercent}% full. Wait for a busier bus for safety.`,
      };
    }
    return { safe: true };
  }
}

export const smartAlertsService = new SmartAlertsService();

