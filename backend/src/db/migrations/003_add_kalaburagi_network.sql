-- ─────────────────────────────────────────────────────────────────────────────
-- 003_add_kalaburagi_network.sql
--
-- Adds a Kalaburagi (Karnataka · KKRTC) city network alongside Visakhapatnam
-- and Mysuru routes.
--
-- SAFE TO RUN AGAINST PRODUCTION:
--   * INSERT only. No DROP, no TRUNCATE, no DELETE, no ALTER.
--   * Every statement is ON CONFLICT DO NOTHING, so re-running is a no-op.
--   * Existing Vizag & Mysuru routes, trips and telemetry_logs are untouched.
--
--   npm run migrate -- src/db/migrations/003_add_kalaburagi_network.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Routes ────────────────────────────────────────────────────────────────
INSERT INTO routes (route_number, route_name, start_stop, end_stop) VALUES
('101K', 'Central Bus Stand ↔ Gulbarga University',      'Kalaburagi Central Bus Stand', 'Gulbarga University'),
('102K', 'Railway Station ↔ High Court Bench',            'Kalaburagi Railway Station',   'High Court Karnataka Bench'),
('103K', 'Central Bus Stand ↔ Khwaja Bande Nawaz Dargah', 'Kalaburagi Central Bus Stand', 'Roza KBN Dargah'),
('104K', 'Central Bus Stand ↔ Central University',       'Kalaburagi Central Bus Stand', 'Central University Kadaganchi'),
('105K', 'Humnabad Ring Road ↔ Shahabad Road Terminal',   'Humnabad Ring Road',           'Shahabad Road Terminal')
ON CONFLICT (route_number) DO NOTHING;

SELECT setval('routes_id_seq', (SELECT MAX(id) FROM routes));

-- ── 2. Stops (explicit ids 61-80; 1-30 Vizag, 31-58 Mysuru) ───────────────────
INSERT INTO stops (id, name, latitude, longitude) VALUES
-- Core interchanges & landmarks
(61, 'Kalaburagi Central Bus Stand',  17.3255, 76.8288),
(62, 'Jagat Circle',                  17.3325, 76.8340),
(63, 'SVP Circle',                    17.3350, 76.8385),
(64, 'Super Market',                  17.3380, 76.8320),
(65, 'District Court Complex',        17.3310, 76.8480),
(66, 'Sedam Road Junction',           17.3120, 76.8680),
(67, 'Gulbarga University',           17.2970, 76.8720),
-- 102K High Court corridor
(68, 'Kalaburagi Railway Station',    17.3400, 76.8375),
(69, 'MSK Mill Road',                 17.3270, 76.8430),
(70, 'Ring Road Aland Junction',      17.3520, 76.8300),
(71, 'High Court Karnataka Bench',    17.3620, 76.8520),
-- 103K Fort & Dargah corridor
(72, 'Kalaburagi Fort Gate',          17.3435, 76.8225),
(73, 'Roza KBN Dargah',               17.3510, 76.8260),
(74, 'KBN Teaching Hospital',         17.3480, 76.8350),
-- 104K CUK corridor
(75, 'Ram Mandir Circle',             17.3280, 76.8510),
(76, 'Kusnoor Cross',                 17.2950, 76.8620),
(77, 'Ring Road University Bypass',   17.2800, 76.8500),
(78, 'Central University Kadaganchi', 17.2150, 76.6350),
-- 105K Industrial corridor
(79, 'Humnabad Ring Road',            17.3580, 76.8550),
(80, 'Timmapuri Circle',              17.3420, 76.8460),
(81, 'ESI Medical College',           17.3190, 76.8610),
(82, 'Shahabad Road Terminal',        17.2900, 76.8750)
ON CONFLICT (id) DO NOTHING;

SELECT setval('stops_id_seq', (SELECT MAX(id) FROM stops));

-- ── 3. Route stops ───────────────────────────────────────────────────────────
INSERT INTO route_stops (route_id, stop_id, stop_order)
SELECT r.id, v.stop_id, v.stop_order
FROM (VALUES
  ('101K',61,1),('101K',62,2),('101K',63,3),('101K',64,4),('101K',65,5),('101K',66,6),('101K',67,7),
  ('102K',68,1),('102K',63,2),('102K',69,3),('102K',70,4),('102K',71,5),
  ('103K',61,1),('103K',62,2),('103K',72,3),('103K',73,4),('103K',74,5),
  ('104K',61,1),('104K',75,2),('104K',76,3),('104K',77,4),('104K',78,5),
  ('105K',79,1),('105K',80,2),('105K',64,3),('105K',81,4),('105K',82,5)
) AS v(route_number, stop_id, stop_order)
JOIN routes r ON r.route_number = v.route_number
ON CONFLICT (route_id, stop_order) DO NOTHING;

SELECT setval('route_stops_id_seq', (SELECT MAX(id) FROM route_stops));

-- ── 4. Buses ─────────────────────────────────────────────────────────────────
INSERT INTO buses (license_plate, bus_number, capacity) VALUES
('KA-32-F-1011', '101K', 50),
('KA-32-F-1021', '102K', 45),
('KA-32-F-1031', '103K', 45),
('KA-32-F-1041', '104K', 50),
('KA-32-F-1051', '105K', 50)
ON CONFLICT (license_plate) DO NOTHING;

SELECT setval('buses_id_seq', (SELECT MAX(id) FROM buses));

-- ── 5. Drivers ───────────────────────────────────────────────────────────────
INSERT INTO drivers (name, phone) VALUES
('Basavaraj Biradar',   '9880012351'),
('Mallikarjun Patil',   '9880012352'),
('Sharanappa Gowda',    '9880012353'),
('Syed Khaleel',        '9880012354'),
('Gundappa Rathod',     '9880012355')
ON CONFLICT (phone) DO NOTHING;

SELECT setval('drivers_id_seq', (SELECT MAX(id) FROM drivers));

-- ── 6. One active trip per new route ─────────────────────────────────────────
INSERT INTO trips (route_id, bus_id, driver_id, status, started_at)
SELECT r.id, b.id, d.id, 'active', CURRENT_TIMESTAMP
FROM (VALUES
  ('101K', 'KA-32-F-1011', '9880012351'),
  ('102K', 'KA-32-F-1021', '9880012352'),
  ('103K', 'KA-32-F-1031', '9880012353'),
  ('104K', 'KA-32-F-1041', '9880012354'),
  ('105K', 'KA-32-F-1051', '9880012355')
) AS v(route_number, license_plate, phone)
JOIN routes  r ON r.route_number  = v.route_number
JOIN buses   b ON b.license_plate = v.license_plate
JOIN drivers d ON d.phone         = v.phone
WHERE NOT EXISTS (
  SELECT 1 FROM trips t WHERE t.route_id = r.id AND t.status = 'active'
);

SELECT setval('trips_id_seq', (SELECT MAX(id) FROM trips));

COMMIT;
