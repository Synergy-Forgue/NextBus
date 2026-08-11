import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { pool } from './db/pool';
import { errorHandler, notFound } from './middleware/errorHandler';
import { attachWebSocketServer, getFleetWithEtas } from './tracking/tracking.ws';

// ─── Routers ────────────────────────────────────────────────────────────────
import routesRouter  from './routers/routes.router';
import stopsRouter   from './routers/stops.router';
import busesRouter   from './routers/buses.router';
import driversRouter from './routers/drivers.router';
import tripsRouter   from './routers/trips.router';
import alertsRouter  from './routers/alerts.router';

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000');

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

// ─── Live Fleet Snapshot with ETAs (REST fallback for React Native clients) ──
app.get('/api/tracking/fleet', async (_req, res, next) => {
  try {
    const fleet = await getFleetWithEtas();
    res.json(fleet);
  } catch (err) {
    next(err);
  }
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/routes',  routesRouter);
app.use('/api/stops',   stopsRouter);
app.use('/api/buses',   busesRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/trips',   tripsRouter);
app.use('/api/alerts',  alertsRouter);

// ─── Error Handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Attach WebSocket Server ─────────────────────────────────────────────────
attachWebSocketServer(server);

// ─── Start ───────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚌 NXTBus Backend running on port ${PORT}`);
  console.log(`   Health:   GET  http://localhost:${PORT}/health`);
  console.log(`   Fleet:    GET  http://localhost:${PORT}/api/tracking/fleet`);
  console.log(`   Routes:   GET  http://localhost:${PORT}/api/routes`);
  console.log(`   Stops:    GET  http://localhost:${PORT}/api/stops`);
  console.log(`   Drivers:  GET  http://localhost:${PORT}/api/drivers`);
  console.log(`   Trips:    GET  http://localhost:${PORT}/api/trips`);
  console.log(`   Alerts:   GET  http://localhost:${PORT}/api/alerts`);
  console.log(`   Publish:  WS   ws://localhost:${PORT}/ws/publish`);
  console.log(`   Subscribe:WS   ws://localhost:${PORT}/ws/subscribe?route_id=<id>\n`);
});

export { server };
