/**
 * pull-backend-geometry.ts
 * 
 * Pulls the clean OSRM geometry stored in the backend database
 * and writes it to the frontend routeGeometries.ts file.
 * 
 * The backend already has high-quality road-following OSRM geometries.
 * This script is the single source of truth.
 * 
 * Run: npx tsx scripts/pull-backend-geometry.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const API_BASE = 'https://nextbus-production.up.railway.app';
const ROUTE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  console.log('📡 Pulling geometry from backend database...\n');

  const geometries: Record<number, Array<{ latitude: number; longitude: number }>> = {};

  for (const id of ROUTE_IDS) {
    try {
      const raw = await httpsGet(`${API_BASE}/api/routes/${id}/geometry`);
      const data = JSON.parse(raw);

      if (!Array.isArray(data?.coordinates) || data.coordinates.length < 2) {
        console.warn(`  ⚠ Route ${id}: no coordinates, skipping`);
        continue;
      }

      // Backend stores [lng, lat] GeoJSON order
      const pts = (data.coordinates as [number, number][]).map(([lng, lat]) => ({
        latitude: Math.round(lat * 1e6) / 1e6,
        longitude: Math.round(lng * 1e6) / 1e6,
      }));

      geometries[id] = pts;
      console.log(`  ✅ Route ${id}: ${pts.length} pts  (${data.source || 'unknown'}, ${((data.distance_m || 0) / 1000).toFixed(1)} km)`);
    } catch (err) {
      console.error(`  ✗ Route ${id}: ${err}`);
    }
  }

  // Build the TypeScript file
  const lines = [
    '// AUTO-GENERATED — do not edit manually.',
    `// Pulled from backend database: ${new Date().toISOString()}`,
    '// Source: OSRM road-following geometry stored server-side.',
    '',
    'export const PRECOMPUTED_GEOMETRIES: Record<number, { latitude: number; longitude: number }[]> = {',
  ];

  for (const id of ROUTE_IDS) {
    const pts = geometries[id];
    if (!pts) continue;
    lines.push(`  ${id}: [`);
    for (const p of pts) {
      lines.push(`    { latitude: ${p.latitude}, longitude: ${p.longitude} },`);
    }
    lines.push('  ],');
  }

  lines.push('};');
  lines.push('');

  const outPath = path.resolve(
    __dirname,
    '../../FRONTEND/commuter-app/src/utils/routeGeometries.ts'
  );

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`\n✅ Written ${Object.keys(geometries).length} routes to:\n   ${outPath}`);

  const totalPts = Object.values(geometries).reduce((s, a) => s + a.length, 0);
  console.log(`   Total: ${totalPts.toLocaleString()} coordinate points`);
}

main().catch(console.error);
