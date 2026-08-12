import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { TripDetail } from '../types';

const router = Router();

// Helper query for enriched trip data
const TRIP_SELECT = `
  SELECT
    t.id, t.route_id, t.bus_id, t.driver_id, t.status,
    t.started_at, t.ended_at, t.created_at,
    r.route_number, r.route_name,
    b.license_plate, b.bus_number,
    d.name AS driver_name
  FROM trips t
  JOIN routes  r ON r.id = t.route_id
  JOIN buses   b ON b.id = t.bus_id
  JOIN drivers d ON d.id = t.driver_id
`;

/**
 * GET /api/trips
 * Returns all trips. Optionally filter by status: ?status=active
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let query = TRIP_SELECT;
    const params: string[] = [];

    if (status) {
      query += ` WHERE t.status = $1`;
      params.push(status as string);
    }
    query += ` ORDER BY t.created_at DESC`;

    const result = await pool.query<TripDetail>(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trips/:id
 * Returns a single enriched trip by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<TripDetail>(
      TRIP_SELECT + ` WHERE t.id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Trip ${id} not found.` });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips/start
 * Driver-friendly trip start. Accepts route_number + driver_phone.
 * The server resolves the IDs internally — no hardcoded DB IDs in the app.
 * Body: { route_number: "10K", driver_phone: "9876543210" }
 * Returns the active trip including the trip_id the Driver App needs to publish GPS.
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { route_number, driver_phone } = req.body;
    if (!route_number || !driver_phone) {
      res.status(400).json({ error: 'BadRequest', message: 'route_number and driver_phone are required.' });
      return;
    }

    // Look up route
    const routeResult = await pool.query(
      `SELECT id FROM routes WHERE route_number = $1`,
      [route_number]
    );
    if (!routeResult.rowCount) {
      res.status(404).json({ error: 'NotFound', message: `Route '${route_number}' not found.` });
      return;
    }
    const route_id = routeResult.rows[0].id;

    // Look up driver
    const driverResult = await pool.query(
      `SELECT id FROM drivers WHERE phone = $1`,
      [driver_phone]
    );
    if (!driverResult.rowCount) {
      res.status(404).json({ error: 'NotFound', message: `Driver with phone '${driver_phone}' not found.` });
      return;
    }
    const driver_id = driverResult.rows[0].id;

    // Find a bus assigned to this route (by bus_number matching route_number)
    const busResult = await pool.query(
      `SELECT id FROM buses WHERE bus_number = $1 LIMIT 1`,
      [route_number]
    );
    if (!busResult.rowCount) {
      res.status(404).json({ error: 'NotFound', message: `No bus found for route '${route_number}'.` });
      return;
    }
    const bus_id = busResult.rows[0].id;

    // Check if driver already has an active trip and end it first
    await pool.query(
      `UPDATE trips SET status = 'completed', ended_at = NOW()
       WHERE driver_id = $1 AND status = 'active'`,
      [driver_id]
    );

    // Create the new active trip
    const insertResult = await pool.query(
      `INSERT INTO trips (route_id, bus_id, driver_id, status, started_at)
       VALUES ($1, $2, $3, 'active', NOW()) RETURNING id`,
      [route_id, bus_id, driver_id]
    );
    const newTripId = insertResult.rows[0].id;

    const full = await pool.query<TripDetail>(TRIP_SELECT + ` WHERE t.id = $1`, [newTripId]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trips
 * Starts a new trip.
 * Body: { route_id, bus_id, driver_id }
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { route_id, bus_id, driver_id } = req.body;
    if (!route_id || !bus_id || !driver_id) {
      res.status(400).json({ error: 'BadRequest', message: 'route_id, bus_id, and driver_id are required.' });
      return;
    }
    const result = await pool.query<TripDetail>(
      `INSERT INTO trips (route_id, bus_id, driver_id, status, started_at)
       VALUES ($1, $2, $3, 'active', NOW())
       RETURNING id`,
      [route_id, bus_id, driver_id]
    );
    const newTripId = result.rows[0].id;
    // Return the full enriched trip
    const full = await pool.query<TripDetail>(TRIP_SELECT + ` WHERE t.id = $1`, [newTripId]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    next(err);
  }
});

import { broadcastBusOffline } from '../tracking/tracking.ws';

/**
 * PATCH /api/trips/:id/end
 * Marks a trip as completed.
 */
router.patch('/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const tripId = parseInt(rawId, 10);
    const result = await pool.query(
      `UPDATE trips SET status = 'completed', ended_at = NOW() WHERE id = $1 RETURNING id`,
      [tripId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Trip ${rawId} not found.` });
      return;
    }

    // Purge trip from live fleet and notify WebSocket clients
    try {
      broadcastBusOffline(tripId);
    } catch {}

    res.json({ message: `Trip ${rawId} marked as completed.` });
  } catch (err) {
    next(err);
  }
});

export default router;
