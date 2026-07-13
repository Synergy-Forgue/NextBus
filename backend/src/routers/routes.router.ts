import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { Route, RouteStop } from '../types';

const router = Router();

/**
 * GET /api/routes
 * Returns all routes.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<Route>(
      `SELECT id, route_number, route_name, start_stop, end_stop, created_at
       FROM routes
       ORDER BY route_number`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/routes/:id
 * Returns a single route by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<Route>(
      `SELECT id, route_number, route_name, start_stop, end_stop, created_at
       FROM routes WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Route ${id} not found.` });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/routes/:id/stops
 * Returns all stops for a given route in sequence order.
 */
router.get('/:id/stops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<RouteStop>(
      `SELECT s.id AS stop_id, s.name AS stop_name, s.latitude, s.longitude, rs.stop_order
       FROM route_stops rs
       JOIN stops s ON s.id = rs.stop_id
       WHERE rs.route_id = $1
       ORDER BY rs.stop_order`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
