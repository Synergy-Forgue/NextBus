/**
 * fetch-clean-geometry.ts
 * 
 * Fetches clean OSRM route geometry for all 10 bus routes.
 * Uses a SINGLE OSRM route request per route (not leg-by-leg) to avoid
 * backtracking artifacts and F1-circuit-style loops.
 * 
 * Run: npx tsx scripts/fetch-clean-geometry.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ─── Route stop definitions ────────────────────────────────────────────────
// Coordinates verified against Google Maps / OpenStreetMap for each route.
// Stops are in travel order (outbound direction).

const ROUTES: Array<{
  id: number;
  name: string;
  stops: Array<{ name: string; lat: number; lng: number }>;
}> = [
  {
    id: 1,
    name: '10K: RTC Complex → Kailasagiri',
    stops: [
      { name: 'RTC Complex',        lat: 17.7261, lng: 83.3085 },
      { name: 'Dwaraka Bus Station', lat: 17.7270, lng: 83.3075 },
      { name: 'Jagadamba Junction',  lat: 17.7126, lng: 83.3023 },
      { name: 'Collector Office',    lat: 17.7150, lng: 83.3050 },
      { name: 'RK Beach',            lat: 17.7134, lng: 83.3323 },
      { name: 'VMRDA Park',          lat: 17.7230, lng: 83.3360 },
      { name: 'Lawsons Bay',         lat: 17.7320, lng: 83.3420 },
      { name: 'Tenneti Park',        lat: 17.7450, lng: 83.3450 },
      { name: 'Kailasagiri',         lat: 17.7490, lng: 83.3421 },
    ],
  },
  {
    id: 2,
    name: '900K: Bheemili → Railway Station',
    stops: [
      { name: 'Bheemili',         lat: 17.8860, lng: 83.4475 },
      { name: 'INS Kalinga',      lat: 17.8500, lng: 83.4000 },
      { name: 'Rushikonda Beach', lat: 17.7820, lng: 83.3850 },
      { name: 'Gitam University', lat: 17.7810, lng: 83.3760 },
      { name: 'Sagar Nagar',      lat: 17.7600, lng: 83.3550 },
      { name: 'Hanumanthuwaka',   lat: 17.7500, lng: 83.3250 },
      { name: 'MVP Complex',      lat: 17.7397, lng: 83.3330 },
      { name: 'Maddilapalem',     lat: 17.7385, lng: 83.3223 },
      { name: 'RTC Complex',      lat: 17.7261, lng: 83.3085 },
      { name: 'Railway Station',  lat: 17.7275, lng: 83.2982 },
    ],
  },
  {
    id: 3,
    name: '28K: Kothavalasa → RK Beach',
    stops: [
      { name: 'Kothavalasa',        lat: 17.8865, lng: 83.1558 },
      { name: 'Pendurthi',          lat: 17.8250, lng: 83.2000 },
      { name: 'NAD Junction',       lat: 17.7402, lng: 83.2386 },
      { name: 'Kancharapalem',      lat: 17.7371, lng: 83.2796 },
      { name: 'RTC Complex',        lat: 17.7261, lng: 83.3085 },
      { name: 'Jagadamba Junction', lat: 17.7126, lng: 83.3023 },
      { name: 'RK Beach',           lat: 17.7134, lng: 83.3323 },
    ],
  },
  {
    id: 4,
    name: '55T: Old Gajuwaka → Tagarapuvalasa',
    stops: [
      { name: 'Old Gajuwaka',    lat: 17.6896, lng: 83.2081 },
      { name: 'Kurmannapalem',   lat: 17.6750, lng: 83.1700 },
      { name: 'NAD Junction',    lat: 17.7402, lng: 83.2386 },
      { name: 'Pendurthi',       lat: 17.8250, lng: 83.2000 },
      { name: 'Sontyam',         lat: 17.8800, lng: 83.2500 },
      { name: 'Anandapuram',     lat: 17.8920, lng: 83.2850 },
      { name: 'Tagarapuvalasa',  lat: 17.9300, lng: 83.4200 },
    ],
  },
  {
    id: 5,
    name: '300N: Sabbavaram → RK Beach',
    stops: [
      { name: 'Sabbavaram',         lat: 17.8000, lng: 83.1200 },
      { name: 'Narava',             lat: 17.7500, lng: 83.1700 },
      { name: 'Old Gopalapatnam',   lat: 17.7550, lng: 83.2100 },
      { name: 'NAD Junction',       lat: 17.7402, lng: 83.2386 },
      { name: 'Kancharapalem',      lat: 17.7371, lng: 83.2796 },
      { name: 'RTC Complex',        lat: 17.7261, lng: 83.3085 },
      { name: 'Jagadamba Junction', lat: 17.7126, lng: 83.3023 },
      { name: 'RK Beach',           lat: 17.7134, lng: 83.3323 },
    ],
  },
  {
    id: 6,
    name: '201M: City Bus Stand → Chamundi Hills',
    stops: [
      { name: 'Mysuru City Bus Stand', lat: 12.3095, lng: 76.6540 },
      { name: 'K R Circle',            lat: 12.3072, lng: 76.6524 },
      { name: 'Mysuru Palace',         lat: 12.3052, lng: 76.6552 },
      { name: 'Mysuru Zoo',            lat: 12.3022, lng: 76.6640 },
      { name: 'Lalitha Mahal Road',    lat: 12.2960, lng: 76.6720 },
      { name: 'Nandi Statue',          lat: 12.2790, lng: 76.6720 },
      { name: 'Chamundi Hills',        lat: 12.2724, lng: 76.6706 },
    ],
  },
  {
    id: 7,
    name: '150M: Railway Station → Kuvempunagar',
    stops: [
      { name: 'Mysuru Railway Station', lat: 12.3172, lng: 76.6427 },
      { name: 'Sub Urban Bus Stand',    lat: 12.3140, lng: 76.6440 },
      { name: 'Devaraja Market',        lat: 12.3085, lng: 76.6512 },
      { name: 'K R Hospital',           lat: 12.3060, lng: 76.6480 },
      { name: 'Ramaswamy Circle',       lat: 12.3110, lng: 76.6390 },
      { name: 'Saraswathipuram',        lat: 12.3055, lng: 76.6300 },
      { name: 'JSS Hospital',           lat: 12.2958, lng: 76.6300 },
      { name: 'Kuvempunagar',           lat: 12.2861, lng: 76.6191 },
    ],
  },
  {
    id: 8,
    name: '303M: Bannimantap → Bogadi',
    stops: [
      { name: 'Bannimantap',      lat: 12.3300, lng: 76.6600 },
      { name: 'Yadavagiri',       lat: 12.3270, lng: 76.6470 },
      { name: 'Gokulam',          lat: 12.3210, lng: 76.6330 },
      { name: 'Ramaswamy Circle', lat: 12.3110, lng: 76.6390 },
      { name: 'Vijayanagar',      lat: 12.3260, lng: 76.6120 },
      { name: 'Bogadi',           lat: 12.3120, lng: 76.5950 },
    ],
  },
  {
    id: 9,
    name: '412M: City Bus Stand → Hootagalli',
    stops: [
      { name: 'Mysuru City Bus Stand',  lat: 12.3095, lng: 76.6540 },
      { name: 'Paduvarahalli',          lat: 12.3230, lng: 76.6280 },
      { name: 'Metagalli',              lat: 12.3400, lng: 76.6220 },
      { name: 'Hebbal Industrial Area', lat: 12.3480, lng: 76.6100 },
      { name: 'Hootagalli',             lat: 12.3450, lng: 76.5980 },
    ],
  },
  {
    id: 10,
    name: '307M: City Bus Stand → Srirangapatna',
    stops: [
      { name: 'Mysuru City Bus Stand', lat: 12.3095, lng: 76.6540 },
      { name: 'Sub Urban Bus Stand',   lat: 12.3140, lng: 76.6440 },
      { name: 'Hinkal',               lat: 12.3390, lng: 76.6180 },
      { name: 'Belagola',             lat: 12.3800, lng: 76.6500 },
      { name: 'Ranganathittu',        lat: 12.4090, lng: 76.6650 },
      { name: 'Srirangapatna',        lat: 12.4181, lng: 76.6947 },
    ],
  },
];

// ─── OSRM fetch ────────────────────────────────────────────────────────────
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOSRM(
  stops: Array<{ lat: number; lng: number }>,
  routeName: string
): Promise<Array<{ latitude: number; longitude: number }> | null> {
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  try {
    console.log(`  Fetching OSRM: ${routeName}`);
    const raw = await httpsGet(url);
    const data = JSON.parse(raw);

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      console.error(`  ✗ OSRM error for ${routeName}:`, data.code, data.message);
      return null;
    }

    const geojson = data.routes[0].geometry;
    if (geojson.type !== 'LineString' || !Array.isArray(geojson.coordinates)) {
      console.error(`  ✗ Unexpected geometry type:`, geojson.type);
      return null;
    }

    const coords2 = geojson.coordinates.map(([lng, lat]: [number, number]) => ({
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lng * 1e6) / 1e6,
    }));

    console.log(`  ✓ ${coords2.length} points`);
    return coords2;
  } catch (err) {
    console.error(`  ✗ Fetch failed for ${routeName}:`, err);
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🗺️  Fetching clean OSRM geometries for all 10 routes...\n');

  const geometries: Record<number, Array<{ latitude: number; longitude: number }>> = {};
  const fallbacks: Record<number, Array<{ latitude: number; longitude: number }>> = {};

  for (const route of ROUTES) {
    // Straight-line fallback using just the stops
    fallbacks[route.id] = route.stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));

    const result = await fetchOSRM(route.stops, route.name);
    if (result && result.length >= 2) {
      geometries[route.id] = result;
    } else {
      console.warn(`  ⚠ Using stop-interpolated fallback for route ${route.id}`);
      geometries[route.id] = fallbacks[route.id];
    }

    // Polite delay between OSRM requests (public demo server rate limit)
    await sleep(800);
  }

  // Write output TypeScript file
  const outLines = [
    '// AUTO-GENERATED — do not edit by hand.',
    '// Run: npx tsx scripts/fetch-clean-geometry.ts',
    '// Generated: ' + new Date().toISOString(),
    '',
    'export const PRECOMPUTED_GEOMETRIES: Record<number, { latitude: number; longitude: number }[]> = {',
  ];

  for (const [id, pts] of Object.entries(geometries)) {
    outLines.push(`  ${id}: [`);
    for (const p of pts as any[]) {
      outLines.push(`    { latitude: ${p.latitude}, longitude: ${p.longitude} },`);
    }
    outLines.push('  ],');
  }

  outLines.push('};');
  outLines.push('');

  const outPath = path.resolve(__dirname, '../src/utils/routeGeometries.ts');
  fs.writeFileSync(outPath, outLines.join('\n'), 'utf8');
  console.log(`\n✅ Written to ${outPath}`);

  // Stats
  for (const [id, pts] of Object.entries(geometries)) {
    const route = ROUTES.find((r) => r.id === Number(id))!;
    console.log(`  Route ${id} (${route.name.split(':')[0]}): ${(pts as any[]).length} pts`);
  }
}

main().catch(console.error);
