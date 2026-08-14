-- ─────────────────────────────────────────────────────────────────────────────
-- 001_add_mysuru_network.sql
--
-- Adds a Mysuru (Karnataka) city network alongside the existing Visakhapatnam
-- routes, so the commuter app's city selector has a second network to offer.
-- The selector only lists cities that actually have stops in the database.
--
-- SAFE TO RUN AGAINST PRODUCTION:
--   * INSERT only. No DROP, no TRUNCATE, no DELETE, no ALTER.
--   * Every statement is ON CONFLICT DO NOTHING, so re-running is a no-op.
--   * Existing Vizag routes, trips and telemetry_logs are untouched.
--
-- NOTE ON COORDINATES: these are hand-placed approximations for the well-known
-- Mysuru landmarks each stop is named after, accurate to roughly a few hundred
-- metres. They are good enough to render routes and compute relative ETAs, but
-- they are NOT surveyed stop positions — verify against OSM or the operator's
-- own data before any real pilot.
--
--   npm run migrate -- src/db/migrations/001_add_mysuru_network.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Routes ────────────────────────────────────────────────────────────────
INSERT INTO routes (route_number, route_name, start_stop, end_stop) VALUES
('201M', 'City Bus Stand ↔ Chamundi Hills',      'Mysuru City Bus Stand', 'Chamundi Hills'),
('150M', 'Railway Station ↔ Kuvempunagar',       'Mysuru Railway Station','Kuvempunagar'),
('303M', 'Bannimantap ↔ Bogadi',                 'Bannimantap',           'Bogadi'),
('412M', 'City Bus Stand ↔ Hootagalli',          'Mysuru City Bus Stand', 'Hootagalli'),
('307M', 'City Bus Stand ↔ Srirangapatna',       'Mysuru City Bus Stand', 'Srirangapatna')
ON CONFLICT (route_number) DO NOTHING;

SELECT setval('routes_id_seq', (SELECT MAX(id) FROM routes));

-- ── 2. Stops (explicit ids 31-58; 1-30 belong to Visakhapatnam) ──────────────
INSERT INTO stops (id, name, latitude, longitude) VALUES
-- Core interchanges
(31, 'Mysuru City Bus Stand',  12.3095, 76.6540),
(32, 'Sub Urban Bus Stand',    12.3140, 76.6440),
(33, 'Mysuru Railway Station', 12.3172, 76.6427),
(34, 'K R Circle',             12.3072, 76.6524),
-- 201M — Chamundi Hills corridor
(35, 'Mysuru Palace',        12.3052, 76.6552),
(36, 'Mysuru Zoo',           12.3022, 76.6640),
(37, 'Lalitha Mahal Road',   12.2960, 76.6720),
(38, 'Nandi Statue',         12.2790, 76.6720),
(39, 'Chamundi Hills',       12.2724, 76.6706),
-- 150M — Kuvempunagar corridor
(40, 'Devaraja Market',   12.3085, 76.6512),
(41, 'K R Hospital',      12.3060, 76.6480),
(42, 'Ramaswamy Circle',  12.3110, 76.6390),
(43, 'Saraswathipuram',   12.3055, 76.6300),
(44, 'JSS Hospital',      12.2958, 76.6300),
(45, 'Kuvempunagar',      12.2861, 76.6191),
-- 303M — Bannimantap to Bogadi
(46, 'Bannimantap',   12.3300, 76.6600),
(47, 'Yadavagiri',    12.3270, 76.6470),
(48, 'Gokulam',       12.3210, 76.6330),
(49, 'Vijayanagar',   12.3260, 76.6120),
(50, 'Bogadi',        12.3120, 76.5950),
-- 412M — industrial / IT corridor
(51, 'Paduvarahalli',          12.3230, 76.6280),
(52, 'Metagalli',              12.3400, 76.6220),
(53, 'Hebbal Industrial Area', 12.3480, 76.6100),
(54, 'Hootagalli',             12.3450, 76.5980),
-- 307M — Srirangapatna corridor
(55, 'Hinkal',         12.3390, 76.6180),
(56, 'Belagola',       12.3800, 76.6500),
(57, 'Ranganathittu',  12.4090, 76.6650),
(58, 'Srirangapatna',  12.4181, 76.6947)
ON CONFLICT (id) DO NOTHING;

SELECT setval('stops_id_seq', (SELECT MAX(id) FROM stops));

-- ── 3. Route stops ───────────────────────────────────────────────────────────
-- Route ids are resolved by route_number rather than assumed, so this works
-- regardless of what the routes sequence allocated.
INSERT INTO route_stops (route_id, stop_id, stop_order)
SELECT r.id, v.stop_id, v.stop_order
FROM (VALUES
  ('201M',31,1),('201M',34,2),('201M',35,3),('201M',36,4),('201M',37,5),('201M',38,6),('201M',39,7),
  ('150M',33,1),('150M',32,2),('150M',40,3),('150M',41,4),('150M',42,5),('150M',43,6),('150M',44,7),('150M',45,8),
  ('303M',46,1),('303M',47,2),('303M',48,3),('303M',42,4),('303M',49,5),('303M',50,6),
  ('412M',31,1),('412M',51,2),('412M',52,3),('412M',53,4),('412M',54,5),
  ('307M',31,1),('307M',32,2),('307M',55,3),('307M',56,4),('307M',57,5),('307M',58,6)
) AS v(route_number, stop_id, stop_order)
JOIN routes r ON r.route_number = v.route_number
ON CONFLICT (route_id, stop_order) DO NOTHING;

SELECT setval('route_stops_id_seq', (SELECT MAX(id) FROM route_stops));

-- ── 4. Buses ─────────────────────────────────────────────────────────────────
INSERT INTO buses (license_plate, bus_number, capacity) VALUES
('KA-09-F-2011', '201M', 50),
('KA-09-F-1501', '150M', 45),
('KA-09-F-3031', '303M', 45),
('KA-09-F-4121', '412M', 50),
('KA-09-F-3071', '307M', 55)
ON CONFLICT (license_plate) DO NOTHING;

SELECT setval('buses_id_seq', (SELECT MAX(id) FROM buses));

-- ── 5. Drivers ───────────────────────────────────────────────────────────────
INSERT INTO drivers (name, phone) VALUES
('Mahadevaswamy', '9880012345'),
('Shivakumar',    '9880012346'),
('Nagaraj',       '9880012347'),
('Puttaswamy',    '9880012348'),
('Chandrashekar', '9880012349')
ON CONFLICT (phone) DO NOTHING;

SELECT setval('drivers_id_seq', (SELECT MAX(id) FROM drivers));

-- ── 6. One active trip per new route ─────────────────────────────────────────
-- Gives the simulator and the live fleet something to attach to. Skipped for a
-- route that already has an active trip, so re-running never duplicates buses.
INSERT INTO trips (route_id, bus_id, driver_id, status, started_at)
SELECT r.id, b.id, d.id, 'active', CURRENT_TIMESTAMP
FROM (VALUES
  ('201M', 'KA-09-F-2011', '9880012345'),
  ('150M', 'KA-09-F-1501', '9880012346'),
  ('303M', 'KA-09-F-3031', '9880012347'),
  ('412M', 'KA-09-F-4121', '9880012348'),
  ('307M', 'KA-09-F-3071', '9880012349')
) AS v(route_number, license_plate, phone)
JOIN routes  r ON r.route_number  = v.route_number
JOIN buses   b ON b.license_plate = v.license_plate
JOIN drivers d ON d.phone         = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM trips t WHERE t.route_id = r.id AND t.status = 'active'
);

SELECT setval('trips_id_seq', (SELECT MAX(id) FROM trips));

COMMIT;

-- Verification
SELECT
  (SELECT COUNT(*) FROM routes)                        AS routes,
  (SELECT COUNT(*) FROM stops)                         AS stops,
  (SELECT COUNT(*) FROM trips WHERE status = 'active') AS active_trips;
