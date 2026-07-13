import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { Driver } from '../types';

const router = Router();

/**
 * GET /api/drivers
 * Returns all drivers.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query<Driver>(
      `SELECT id, name, phone FROM drivers ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/drivers/:id
 * Returns a single driver by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<Driver>(
      `SELECT id, name, phone FROM drivers WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Driver ${id} not found.` });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
