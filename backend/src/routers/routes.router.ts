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
 * GET /api/routes/search?q=...&from=...&to=...
 * Semantic route & stop search engine.
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string || '').trim();
    const from = (req.query.from as string || '').trim();
    const to = (req.query.to as string || '').trim();

    if (q) {
      const result = await pool.query<Route>(
        `SELECT DISTINCT r.id, r.route_number, r.route_name, r.start_stop, r.end_stop, r.created_at
         FROM routes r
         LEFT JOIN route_stops rs ON rs.route_id = r.id
         LEFT JOIN stops s ON s.id = rs.stop_id
         WHERE r.route_number ILIKE $1
            OR r.route_name ILIKE $1
            OR r.start_stop ILIKE $1
            OR r.end_stop ILIKE $1
            OR s.name ILIKE $1
         ORDER BY r.route_number`,
        [`%${q}%`]
      );
      res.json(result.rows);
      return;
    }

    if (from || to) {
      const fromTerm = `%${from}%`;
      const toTerm = `%${to}%`;

      if (from && to) {
        const result = await pool.query<Route>(
          `SELECT DISTINCT r.id, r.route_number, r.route_name, r.start_stop, r.end_stop, r.created_at
           FROM routes r
           JOIN route_stops rs_from ON rs_from.route_id = r.id
           JOIN stops s_from ON s_from.id = rs_from.stop_id
           JOIN route_stops rs_to ON rs_to.route_id = r.id
           JOIN stops s_to ON s_to.id = rs_to.stop_id
           WHERE (s_from.name ILIKE $1 OR r.start_stop ILIKE $1)
             AND (s_to.name ILIKE $2 OR r.end_stop ILIKE $2)
             AND rs_from.stop_order < rs_to.stop_order
           ORDER BY r.route_number`,
          [fromTerm, toTerm]
        );
        res.json(result.rows);
        return;
      }

      const term = from ? fromTerm : toTerm;
      const result = await pool.query<Route>(
        `SELECT DISTINCT r.id, r.route_number, r.route_name, r.start_stop, r.end_stop, r.created_at
         FROM routes r
         JOIN route_stops rs ON rs.route_id = r.id
         JOIN stops s ON s.id = rs.stop_id
         WHERE s.name ILIKE $1 OR r.start_stop ILIKE $1 OR r.end_stop ILIKE $1
         ORDER BY r.route_number`,
        [term]
      );
      res.json(result.rows);
      return;
    }

    const defaultResult = await pool.query<Route>(
      `SELECT id, route_number, route_name, start_stop, end_stop, created_at
       FROM routes ORDER BY route_number`
    );
    res.json(defaultResult.rows);
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
