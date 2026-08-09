import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { Alert } from '../types';
import { broadcastAlert, broadcastAlertResolved } from '../tracking/tracking.ws';

const router = Router();

/**
 * GET /api/alerts
 * Returns alerts. Optional filter: ?status=active
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    let query = `SELECT id, type, description, latitude, longitude, license_plate, route_number, driver_phone, status, created_at, resolved_at FROM alerts`;
    const params: string[] = [];

    if (status) {
      query += ` WHERE status = $1`;
      params.push(status as string);
    }
    query += ` ORDER BY created_at DESC`;

    const result = await pool.query<Alert>(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/alerts
 * Creates a new emergency alert (SOS or Breakdown) from Driver or Commuter apps.
 * Body: { type: 'sos'|'breakdown', description, latitude, longitude, license_plate, route_number, driver_phone }
 * Broadcasts 'ALERT' message via WebSockets to the RTC Operations Dashboard in real time.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, description, latitude, longitude, license_plate, route_number, driver_phone } = req.body;
    if (!type || latitude == null || longitude == null) {
      res.status(400).json({ error: 'BadRequest', message: 'type, latitude, and longitude are required.' });
      return;
    }

    const result = await pool.query<Alert>(
      `INSERT INTO alerts (type, description, latitude, longitude, license_plate, route_number, driver_phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
       RETURNING id, type, description, latitude, longitude, license_plate, route_number, driver_phone, status, created_at, resolved_at`,
      [type, description || null, latitude, longitude, license_plate || null, route_number || null, driver_phone || null]
    );

    const alert = result.rows[0];

    // Broadcast over WebSockets instantly to all subscribers (RTC Dashboard)
    broadcastAlert(alert);

    res.status(201).json(alert);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/alerts/:id/resolve
 * Marks an alert as resolved.
 * Broadcasts 'ALERT_RESOLVED' message via WebSockets.
 */
router.patch('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query<Alert>(
      `UPDATE alerts
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1
       RETURNING id, type, description, latitude, longitude, license_plate, route_number, driver_phone, status, created_at, resolved_at`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'NotFound', message: `Alert ${id} not found.` });
      return;
    }

    const alert = result.rows[0];

    // Broadcast over WebSockets to notify dashboard clients
    broadcastAlertResolved(alert);

    res.json(alert);
  } catch (err) {
    next(err);
  }
});

export default router;
