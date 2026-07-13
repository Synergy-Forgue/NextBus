import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { Stop } from '../types';

const router = Router();

/**
 * GET /api/stops
 * Returns all stops.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<Stop>(
      `SELECT id, name, latitude, longitude FROM stops ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stops/nearby?lat=&lng=&radius=
 * Returns all stops within a given radius (in km) of a coordinate.
 * IMPORTANT: This route must be registered BEFORE /:id to prevent Express
 * from treating "nearby" as an :id parameter.
 *
 * Uses a subquery with the Haversine formula — no PostGIS required.
 */
router.get('/nearby', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat    = parseFloat(req.query.lat as string);
    const lng    = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 1.0; // default 1 km

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'BadRequest', message: '`lat` and `lng` query params are required.' });
      return;
    }

    // Wrap in a subquery so we can filter on the computed distance column
    const result = await pool.query(
      `SELECT id, name, latitude, longitude, distance_km
       FROM (
         SELECT
           id, name, latitude, longitude,
           (6371 * acos(
             cos(radians($1)) * cos(radians(latitude))
             * cos(radians(longitude) - radians($2))
             + sin(radians($1)) * sin(radians(latitude))
           )) AS distance_km
         FROM stops
       ) AS computed
       WHERE distance_km < $3
       ORDER BY distance_km`,
      [lat, lng, radius]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stops/:id
 * Returns a single stop by ID.
 * NOTE: This must come AFTER /nearby.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<Stop>(
      `SELECT id, name, latitude, longitude FROM stops WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Stop ${id} not found.` });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
