import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { Bus } from '../types';

const router = Router();

/**
 * GET /api/buses
 * Returns all buses.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<Bus>(
      `SELECT id, license_plate, bus_number, capacity FROM buses ORDER BY bus_number`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buses/:id
 * Returns a single bus by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<Bus>(
      `SELECT id, license_plate, bus_number, capacity FROM buses WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Bus ${id} not found.` });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
