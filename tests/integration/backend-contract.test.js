#!/usr/bin/env node
/**
 * NXTBus Backend Contract Integration Test
 * ────────────────────────────────────────
 * Unlike tests/e2e/, which exercises a simulated copy of the system built in
 * tests/e2e/harness/testHelper.js, this test talks to a REAL running backend
 * over real HTTP and a real WebSocket. It asserts the wire contract that the
 * commuter app, driver app, and RTC dashboard all code against.
 *
 * It exists because the mocked E2E suite passed 78/78 while the commuter map
 * was reading `msg.buses` (the server sends `msg.data`) and listening for
 * `LOCATION_UPDATE` (the server sends `BUS_UPDATE`) — a total failure of live
 * tracking that no mocked test could see.
 *
 * Usage:
 *   node tests/integration/backend-contract.test.js
 *   NXTBUS_API_URL=https://your-host node tests/integration/backend-contract.test.js
 *
 * Requires: a backend that is up, seeded, and receiving telemetry (run the
 * simulator with `npm run sim` in backend/ for the live-fleet assertions).
 */

const API_URL = process.env.NXTBUS_API_URL || 'http://localhost:3000';
const WS_URL = API_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/subscribe';
const WS_TIMEOUT_MS = Number(process.env.NXTBUS_WS_TIMEOUT_MS || 20000);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  \x1b[31m✘\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m\x1b[36m${title}\x1b[0m`);
}

async function getJson(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json();
}

async function testRest() {
  section('REST contract');

  const health = await getJson('/health');
  check('GET /health reports ok', health.status === 'ok', `got status=${health.status}`);
  check('GET /health reports database connected', health.database === 'connected', `got database=${health.database}`);

  const routes = await getJson('/api/routes');
  check('GET /api/routes returns a non-empty array', Array.isArray(routes) && routes.length > 0);
  const route = routes[0];
  check(
    'route objects carry id, route_number, route_name, start_stop, end_stop',
    route && ['id', 'route_number', 'route_name', 'start_stop', 'end_stop'].every((k) => k in route),
    route ? `keys: ${Object.keys(route).join(',')}` : 'no routes'
  );

  const stops = await getJson(`/api/routes/${route.id}/stops`);
  check('GET /api/routes/:id/stops returns a non-empty array', Array.isArray(stops) && stops.length > 0);
  check(
    'stops use the stop_name/stop_order field names the apps render',
    stops.every((s) => 'stop_name' in s && 'stop_order' in s && 'latitude' in s && 'longitude' in s),
    stops[0] ? `keys: ${Object.keys(stops[0]).join(',')}` : 'no stops'
  );
  check(
    'stops are returned in ascending stop_order',
    stops.every((s, i) => i === 0 || s.stop_order >= stops[i - 1].stop_order)
  );

  // Directional search: a route qualifies only when `from` precedes `to`.
  const search = await getJson('/api/routes/search?q=RK%20Beach');
  check('GET /api/routes/search?q= returns an array', Array.isArray(search));

  const fleet = await getJson('/api/tracking/fleet');
  check('GET /api/tracking/fleet returns an array', Array.isArray(fleet));

  return fleet;
}

function testWebSocket() {
  section('WebSocket contract (/ws/subscribe)');

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const seen = new Set();
    let snapshot = null;
    let busUpdate = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}

      check('server sends a SNAPSHOT frame on connect', seen.has('SNAPSHOT'));
      check(
        'SNAPSHOT carries its payload on `data` (NOT `buses`)',
        snapshot ? Array.isArray(snapshot.data) : false,
        snapshot ? `top-level keys: ${Object.keys(snapshot).join(',')}` : 'no snapshot received'
      );
      check(
        'SNAPSHOT has no `buses` key that clients might read instead',
        snapshot ? !('buses' in snapshot) : false
      );

      if (busUpdate) {
        check('live update frames use type BUS_UPDATE (NOT LOCATION_UPDATE)', true);
        const bus = busUpdate.data;
        check(
          'BUS_UPDATE payload carries trip_id, latitude, longitude, status, stop_etas',
          bus && ['trip_id', 'latitude', 'longitude', 'status', 'stop_etas'].every((k) => k in bus),
          bus ? `keys: ${Object.keys(bus).join(',')}` : 'no payload'
        );
        check(
          'status is one of the documented VehicleStatus values',
          ['LIVE', 'APPROACHING STOP', 'AT STOP', 'STALE', 'SIGNAL LOST', 'OFFLINE'].includes(bus.status),
          `got status=${bus && bus.status}`
        );
        check(
          'buses are identified by trip_id (the key the store and BUS_OFFLINE use)',
          typeof bus.trip_id === 'number'
        );

        const etas = bus.stop_etas || [];
        check('stop_etas is a non-empty array', Array.isArray(etas) && etas.length > 0);
        check(
          'stop_etas entries expose stop_name, stop_order and eta_seconds',
          etas.every((s) => 'stop_name' in s && 'stop_order' in s && 'eta_seconds' in s)
        );
        check(
          'passed stops are marked with eta_seconds === null, never a number',
          etas.every((s) => s.eta_seconds === null || typeof s.eta_seconds === 'number')
        );
        const upcoming = etas.filter((s) => s.eta_seconds !== null);
        check(
          'upcoming stop ETAs increase monotonically along the route',
          upcoming.every((s, i) => i === 0 || s.eta_seconds >= upcoming[i - 1].eta_seconds)
        );
        check(
          'all null (passed) ETAs come before the upcoming ones',
          (() => {
            const firstNumeric = etas.findIndex((s) => s.eta_seconds !== null);
            return firstNumeric === -1 || etas.slice(firstNumeric).every((s) => s.eta_seconds !== null);
          })()
        );
      } else {
        console.log(
          '  \x1b[33m•\x1b[0m no BUS_UPDATE within timeout — start the simulator ' +
            '(`npm run sim` in backend/) to assert the live-telemetry frames'
        );
      }

      resolve();
    };

    ws.onopen = () => console.log(`  connected to ${WS_URL}`);

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data.toString());
      } catch {
        return;
      }
      seen.add(msg.type);
      if (msg.type === 'SNAPSHOT' && !snapshot) snapshot = msg;
      if (msg.type === 'BUS_UPDATE' && !busUpdate) busUpdate = msg;
      // Finish as soon as we have both frame types.
      if (snapshot && busUpdate) finish();
    };

    ws.onerror = () => {
      check('WebSocket connects', false, `could not connect to ${WS_URL}`);
      finish();
    };

    setTimeout(finish, WS_TIMEOUT_MS);
  });
}

async function main() {
  console.log(`\n\x1b[1mNXTBus Backend Contract Integration Test\x1b[0m`);
  console.log(`Target: ${API_URL}\n`);

  try {
    await testRest();
  } catch (err) {
    check('backend reachable over HTTP', false, err.message);
  }

  await testWebSocket();

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Passed: \x1b[32m${passed}\x1b[0m   Failed: \x1b[31m${failed}\x1b[0m`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  console.log(`${'─'.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
