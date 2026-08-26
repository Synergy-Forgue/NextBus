/**
 * pull-and-clean-geometry.ts
 * 
 * Pulls OSRM geometry from backend and applies post-processing to:
 * 1. Remove consecutive duplicate points
 * 2. Detect and remove U-turn artifacts (leg-by-leg stitch loops)
 * 3. Apply Douglas-Peucker simplification (epsilon=0.00003) to keep file small
 *    while preserving road shape
 * 
 * Run: npx tsx scripts/pull-and-clean-geometry.ts
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

interface Pt { lat: number; lng: number }

/** Remove consecutive duplicate points */
function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.lat !== p.lat || last.lng !== p.lng) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Remove U-turn artifacts: if the path goes A→B→A (within a tiny tolerance),
 * the B is a stitch-point and should be removed.
 */
function removeLoops(pts: Pt[], tol = 0.0001): Pt[] {
  const out: Pt[] = [...pts];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const prev = out[i - 1];
      const curr = out[i];
      const next = out[i + 1];
      // Check if curr sends us back toward prev
      const dPrevCurr = Math.hypot(curr.lat - prev.lat, curr.lng - prev.lng);
      const dCurrNext = Math.hypot(next.lat - curr.lat, next.lng - curr.lng);
      const dPrevNext = Math.hypot(next.lat - prev.lat, next.lng - prev.lng);
      // If going from prev→curr→next is LONGER than just prev→next by more than
      // 30% of the individual segments, this is a likely U-turn stitch artifact
      if (dPrevCurr > tol && dCurrNext > tol && (dPrevCurr + dCurrNext) > dPrevNext * 1.6) {
        // Check if curr is behind the prev→next vector (U-turn indicator)
        const vx = next.lng - prev.lng;
        const vy = next.lat - prev.lat;
        const wx = curr.lng - prev.lng;
        const wy = curr.lat - prev.lat;
        const cross = vx * wy - vy * wx; // If close to 0 and behind, it's a spike
        const dot = vx * wx + vy * wy;
        if (dot < 0 || Math.abs(cross) < Math.hypot(vx, vy) * dPrevCurr * 0.15) {
          out.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Douglas-Peucker polyline simplification
 * epsilon in degrees (~3m at Indian latitudes)
 */
function perpendicularDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.lat - a.lat, p.lng - a.lng);
  return Math.abs(dx * (a.lat - p.lat) - dy * (a.lng - p.lng)) / len;
}

function douglasPeucker(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(pts.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

async function main() {
  console.log('📡 Pulling + cleaning geometry from backend...\n');

  const geometries: Record<number, Pt[]> = {};

  for (const id of ROUTE_IDS) {
    try {
      const raw = await httpsGet(`${API_BASE}/api/routes/${id}/geometry`);
      const data = JSON.parse(raw);

      if (!Array.isArray(data?.coordinates) || data.coordinates.length < 2) {
        console.warn(`  ⚠ Route ${id}: no coordinates`);
        continue;
      }

      // [lng, lat] → {lat, lng}
      let pts: Pt[] = (data.coordinates as [number, number][]).map(([lng, lat]) => ({
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
      }));

      const rawCount = pts.length;

      // 1. Remove consecutive duplicates
      pts = dedupe(pts);

      // 2. Remove U-turn loop artifacts  
      pts = removeLoops(pts, 0.00008);

      // 3. Simplify with Douglas-Peucker (epsilon ~3m)
      pts = douglasPeucker(pts, 0.000027);

      // Ensure minimum 2 points
      if (pts.length < 2) {
        console.warn(`  ⚠ Route ${id}: too few pts after cleaning, skipping simplify`);
        pts = dedupe((data.coordinates as [number, number][]).map(([lng, lat]) => ({
          lat: Math.round(lat * 1e6) / 1e6,
          lng: Math.round(lng * 1e6) / 1e6,
        })));
      }

      geometries[id] = pts;
      console.log(
        `  ✅ Route ${id}: ${rawCount} → ${pts.length} pts ` +
        `(${(data.distance_m / 1000).toFixed(1)} km, source: ${data.source})`
      );
    } catch (err) {
      console.error(`  ✗ Route ${id}: ${err}`);
    }
  }

  // Build the TypeScript output
  const lines = [
    '// AUTO-GENERATED — do not edit manually.',
    `// Generated: ${new Date().toISOString()}`,
    '// Source: backend OSRM database → deduplicated → loop-removed → Douglas-Peucker simplified.',
    '',
    'export const PRECOMPUTED_GEOMETRIES: Record<number, { latitude: number; longitude: number }[]> = {',
  ];

  for (const id of ROUTE_IDS) {
    const pts = geometries[id];
    if (!pts) continue;
    lines.push(`  ${id}: [`);
    for (const p of pts) {
      lines.push(`    { latitude: ${p.lat}, longitude: ${p.lng} },`);
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

  const totalPts = Object.values(geometries).reduce((s, a) => s + a.length, 0);
  console.log(`\n✅ Written to:\n   ${outPath}`);
  console.log(`   Total: ${totalPts.toLocaleString()} cleaned points\n`);
}

main().catch(console.error);
