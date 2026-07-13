/**
 * occupancy.ts
 * Models realistic passenger occupancy for a city bus.
 *
 * Rules:
 *   - Buses start relatively empty from the depot end of the route.
 *   - Occupancy rises toward the middle (city centre / hub stops).
 *   - Occupancy drops toward the far end as passengers alight.
 *   - Peak hours (8-10am, 5-7pm IST) have higher baseline.
 *   - AI camera confidence score is slightly noisy (real cameras aren't perfect).
 */

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function isPeakHour(): boolean {
  const hour = new Date().getHours(); // Local server time
  return (hour >= 7 && hour <= 10) || (hour >= 17 && hour <= 20);
}

/**
 * Returns a simulated occupancy count for a bus at a given stop in its route.
 *
 * @param capacity      - Max seating capacity of the bus
 * @param stopOrder     - Current stop index (1-based)
 * @param totalStops    - Total stops on this route
 * @param prevCount     - Previous occupancy count (for continuity)
 */
export function simulateOccupancy(
  capacity:    number,
  stopOrder:   number,
  totalStops:  number,
  prevCount:   number
): number {
  const peak = isPeakHour();

  // Progress through the route: 0 = start, 1 = end
  const progress = (stopOrder - 1) / Math.max(totalStops - 1, 1);

  // Bell-curve: peaks around the middle of the route
  const bellPeak = Math.sin(progress * Math.PI);

  // Base fill percentage (peak hours fill more)
  const baseFill = peak
    ? rand(0.45, 0.85) * bellPeak
    : rand(0.20, 0.65) * bellPeak;

  const targetCount = Math.round(capacity * baseFill);

  // Smooth transition: blend 70% previous + 30% new target (no sudden jumps)
  const blended = Math.round(prevCount * 0.7 + targetCount * 0.3);

  // Add natural ±3 passenger noise (boarding/alighting variance)
  const noise = Math.round(rand(-3, 3));

  return clamp(blended + noise, 0, capacity);
}

/**
 * Returns a simulated AI vision confidence score.
 * Real edge AI models produce values in the 0.85–0.98 range with slight noise.
 */
export function simulateConfidence(): number {
  const base = rand(0.88, 0.97);
  const noise = rand(-0.03, 0.03);
  return parseFloat(clamp(base + noise, 0.80, 0.99).toFixed(3));
}
