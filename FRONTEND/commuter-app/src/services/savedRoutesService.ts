import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TripHistory {
  id: string;
  routeId: number;
  routeName: string;
  fromStop: string;
  toStop: string;
  departureTime: number; // timestamp
  arrivalTime: number;
  dayOfWeek: number; // 0=Sun, 6=Sat
  duration: number; // minutes
}

export interface SavedRoute {
  id: string;
  routeId: number;
  routeName: string;
  fromStop: string;
  toStop: string;
  frequency: number; // how many times taken
  lastUsed: number; // timestamp
  predictedDepartureTime?: string; // "08:00 AM" - learned pattern
  confidence: number; // 0-100% how confident the prediction is
}

const STORAGE_KEY = '@nextbus_saved_routes';
const HISTORY_KEY = '@nextbus_trip_history';

export default class SavedRoutesService {
  /**
   * Log a trip: when commuter starts a journey
   * Used to learn patterns over time
   */
  async logTrip(tripData: Omit<TripHistory, 'id'>) {
    try {
      const history = await this.getTripHistory();
      const trip: TripHistory = {
        ...tripData,
        id: `${Date.now()}`,
      };
      history.push(trip);

      // Keep only last 60 days of history
      const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const filtered = history.filter((t) => t.departureTime > sixtyDaysAgo);

      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));

      // Auto-save this route as "Saved Route" if used frequently
      this.autoSaveFrequentRoute(trip);

      return trip;
    } catch (err) {
      console.error('Error logging trip:', err);
      return null;
    }
  }

  /**
   * Get trip history for analytics & report card
   */
  async getTripHistory(): Promise<TripHistory[]> {
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * PRIVATE: Auto-save a route if commuter has taken it 3+ times
   */
  private async autoSaveFrequentRoute(trip: TripHistory) {
    const history = await this.getTripHistory();
    const similar = history.filter(
      (t) => t.routeId === trip.routeId && t.fromStop === trip.fromStop && t.toStop === trip.toStop
    );

    // Save after 3 uses
    if (similar.length >= 3) {
      const prediction = this.learnDeparturePattern(similar);
      await this.saveRoute({
        id: `route_${trip.routeId}_${trip.fromStop}`,
        routeId: trip.routeId,
        routeName: trip.routeName,
        fromStop: trip.fromStop,
        toStop: trip.toStop,
        frequency: similar.length,
        lastUsed: trip.departureTime,
        predictedDepartureTime: prediction.time,
        confidence: prediction.confidence,
      });
    }
  }

  /**
   * LEARN DEPARTURE PATTERNS from trip history
   * Analyzes what time commuter usually departs on this route
   * Returns most common time + confidence score
   */
  private learnDeparturePattern(trips: TripHistory[]): { time: string; confidence: number } {
    if (trips.length === 0) {
      return { time: '08:00 AM', confidence: 0 };
    }

    // Group by hour
    const hourCounts: { [key: number]: number } = {};
    trips.forEach((trip) => {
      const hour = new Date(trip.departureTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find most common hour
    const mostCommonHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0][0];
    const count = hourCounts[parseInt(mostCommonHour)];
    const confidence = Math.round((count / trips.length) * 100);

    // Format as "08:00 AM"
    const date = new Date();
    date.setHours(parseInt(mostCommonHour), 0, 0);
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return { time, confidence };
  }

  /**
   * Save a route manually
   */
  async saveRoute(route: SavedRoute) {
    try {
      const routes = await this.getSavedRoutes();
      const existing = routes.findIndex((r) => r.id === route.id);

      if (existing >= 0) {
        routes[existing] = route;
      } else {
        routes.push(route);
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
      return route;
    } catch (err) {
      console.error('Error saving route:', err);
      return null;
    }
  }

  /**
   * Get all saved routes
   */
  async getSavedRoutes(): Promise<SavedRoute[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get routes to suggest based on time of day
   * If it's 8 AM and commuter usually takes bus at 8:05, suggest it
   */
  async getSuggestedRoutesByTime(): Promise<SavedRoute[]> {
    try {
      const routes = await this.getSavedRoutes();
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Suggest routes where predicted departure time is within next 30 minutes
      return routes.filter((route) => {
        if (!route.predictedDepartureTime) return false;

        const [time] = route.predictedDepartureTime.split(' ');
        const [h, m] = time.split(':').map(Number);
        const predictedMinutes = h * 60 + m;
        const nowMinutes = currentHour * 60 + currentMinute;

        return predictedMinutes > nowMinutes && predictedMinutes <= nowMinutes + 30;
      });
    } catch {
      return [];
    }
  }

  /**
   * Remove a saved route
   */
  async removeRoute(routeId: string) {
    try {
      const routes = await this.getSavedRoutes();
      const filtered = routes.filter((r) => r.id !== routeId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get trip stats for Report Card
   */
  async getWeeklyStats() {
    try {
      const history = await this.getTripHistory();
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekTrips = history.filter((t) => t.departureTime > weekAgo);

      if (weekTrips.length === 0) {
        return {
          tripCount: 0,
          timeSavedMinutes: 0,
          onTimePercent: 0,
          mostReliableRoute: 'N/A',
          co2SavedKg: 0,
        };
      }

      // Calculate metrics
      const totalMinutes = weekTrips.reduce((sum, t) => sum + t.duration, 0);
      const timeSavedMinutes = Math.round((totalMinutes * 0.3) / 60); // Assume 30% time saved vs car
      const co2SavedKg = Math.round(weekTrips.length * 2.5); // ~2.5 kg CO2 per trip by bus

      // Most common route
      const routeCounts: { [key: string]: number } = {};
      weekTrips.forEach((t) => {
        routeCounts[t.routeName] = (routeCounts[t.routeName] || 0) + 1;
      });
      const mostReliableRoute = Object.entries(routeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

      // On-time rate (mock: 90% + random variance)
      const onTimePercent = Math.round(85 + Math.random() * 15);

      return {
        tripCount: weekTrips.length,
        timeSavedMinutes,
        onTimePercent,
        mostReliableRoute,
        co2SavedKg,
      };
    } catch {
      return {
        tripCount: 0,
        timeSavedMinutes: 0,
        onTimePercent: 0,
        mostReliableRoute: 'N/A',
        co2SavedKg: 0,
      };
    }
  }
}

export const savedRoutesService = new SavedRoutesService();
