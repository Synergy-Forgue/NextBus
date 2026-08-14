-- ─────────────────────────────────────────────────────────────────────────────
-- 001_add_bengaluru_network.sql
--
-- Adds the Bengaluru (BMTC) pilot network alongside the existing Visakhapatnam
-- routes. Required for the commuter app's city selector to offer more than one
-- city — it only lists cities that actually have stops in the database.
--
-- SAFE TO RUN AGAINST PRODUCTION:
--   * INSERT only. No DROP, no TRUNCATE, no DELETE, no ALTER.
--   * Every statement is ON CONFLICT DO NOTHING, so re-running is a no-op.
--   * Existing Vizag routes, trips and telemetry_logs are untouched.
--
-- This is deliberately NOT part of seed.sql, because seed.sql is preceded by
-- schema.sql's DROP TABLE statements and would destroy telemetry history.
--
--   psql "$DATABASE_URL" -f src/db/migrations/001_add_bengaluru_network.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Routes ────────────────────────────────────────────────────────────────
INSERT INTO routes (route_number, route_name, start_stop, end_stop) VALUES
('500D', 'Central Silk Board ↔ Hebbal',                    'Central Silk Board',     'Hebbal'),
('335E', 'Kempegowda Bus Station ↔ ITPL',                  'Kempegowda Bus Station', 'ITPL'),
('201G', 'Banashankari ↔ Domlur',                          'Banashankari TTMC',      'Domlur TTMC'),
('401K', 'Yeshwanthpur ↔ Yelahanka',                       'Yeshwanthpur TTMC',      'Yelahanka Old Town'),
('365',  'Kempegowda Bus Station ↔ Bannerghatta Nat. Park','Kempegowda Bus Station', 'Bannerghatta National Park')
ON CONFLICT (route_number) DO NOTHING;

SELECT setval('routes_id_seq', (SELECT MAX(id) FROM routes));

-- ── 2. Stops (explicit ids 31-75; 1-30 belong to Visakhapatnam) ──────────────
INSERT INTO stops (id, name, latitude, longitude) VALUES
-- Shared / core junctions
(31, 'Kempegowda Bus Station', 12.9772, 77.5713),
(32, 'Dairy Circle',           12.9385, 77.6015),
(33, 'Domlur TTMC',            12.9609, 77.6387),
(34, 'Marathahalli Bridge',    12.9560, 77.7011),
-- 500D corridor
(35, 'Central Silk Board',       12.9172, 77.6227),
(36, 'HSR Layout',               12.9116, 77.6389),
(37, 'Agara',                    12.9250, 77.6480),
(38, 'Iblur Junction',           12.9248, 77.6710),
(39, 'Bellandur',                12.9304, 77.6784),
(40, 'Kadubeesanahalli',         12.9372, 77.6912),
(41, 'Mahadevapura',             12.9904, 77.6872),
(42, 'KR Puram Railway Station', 13.0012, 77.6765),
(43, 'Kalyan Nagar',             13.0199, 77.6430),
(44, 'Nagavara (Manyata)',       13.0451, 77.6204),
(45, 'Hebbal',                   13.0358, 77.5970),
-- 335E corridor
(46, 'Corporation',         12.9698, 77.5898),
(47, 'Richmond Circle',     12.9675, 77.5985),
(48, 'Mayo Hall (MG Road)', 12.9740, 77.6094),
(49, 'Manipal Hospital',    12.9592, 77.6508),
(50, 'HAL Main Gate',       12.9562, 77.6651),
(51, 'Kundalahalli Gate',   12.9658, 77.7170),
(52, 'Graphite India',      12.9812, 77.7290),
(53, 'Hope Farm',           12.9840, 77.7510),
(54, 'ITPL',                12.9863, 77.7380),
-- 201G corridor
(55, 'Banashankari TTMC',              12.9177, 77.5736),
(56, 'Jayanagar 4th Block',            12.9298, 77.5833),
(57, 'South End Circle',               12.9378, 77.5802),
(58, 'St. Johns Hospital',             12.9315, 77.6200),
(59, 'Koramangala Sony World',         12.9360, 77.6290),
(60, 'Intermediate Ring Road (EGL)',   12.9500, 77.6400),
-- 401K corridor
(61, 'Yeshwanthpur TTMC',                13.0238, 77.5501),
(62, 'Mathikere',                        13.0334, 77.5583),
(63, 'BEL Circle',                       13.0489, 77.5543),
(64, 'Vidyaranyapura',                   13.0805, 77.5586),
(65, 'Major Sandeep Unnikrishnan Rd',    13.1005, 77.5850),
(66, 'Yelahanka Satellite Town',         13.1110, 77.5925),
(67, 'Yelahanka NES',                    13.1008, 77.5963),
(68, 'Yelahanka Old Town',               13.1060, 77.6005),
-- 365 corridor
(69, 'Town Hall',                  12.9642, 77.5862),
(70, 'Lalbagh Main Gate',          12.9507, 77.5848),
(71, 'Jayadeva Hospital',          12.9177, 77.5960),
(72, 'Bilekahalli (IIMB)',         12.8965, 77.6010),
(73, 'Hulimavu Gate',              12.8805, 77.5995),
(74, 'Gottigere',                  12.8590, 77.5880),
(75, 'Bannerghatta National Park', 12.8009, 77.5777)
ON CONFLICT (id) DO NOTHING;

SELECT setval('stops_id_seq', (SELECT MAX(id) FROM stops));

-- ── 3. Route stops ───────────────────────────────────────────────────────────
-- Route ids are resolved by route_number rather than assumed, so this works
-- regardless of what the routes sequence happened to allocate.
INSERT INTO route_stops (route_id, stop_id, stop_order)
SELECT r.id, v.stop_id, v.stop_order
FROM (VALUES
  ('500D',35,1),('500D',36,2),('500D',37,3),('500D',38,4),('500D',39,5),('500D',40,6),
  ('500D',34,7),('500D',41,8),('500D',42,9),('500D',43,10),('500D',44,11),('500D',45,12),
  ('335E',31,1),('335E',46,2),('335E',47,3),('335E',48,4),('335E',33,5),('335E',49,6),
  ('335E',50,7),('335E',34,8),('335E',51,9),('335E',52,10),('335E',53,11),('335E',54,12),
  ('201G',55,1),('201G',56,2),('201G',57,3),('201G',32,4),('201G',58,5),('201G',59,6),
  ('201G',60,7),('201G',33,8),
  ('401K',61,1),('401K',62,2),('401K',63,3),('401K',64,4),('401K',65,5),('401K',66,6),
  ('401K',67,7),('401K',68,8),
  ('365',31,1),('365',69,2),('365',70,3),('365',32,4),('365',71,5),('365',72,6),
  ('365',73,7),('365',74,8),('365',75,9)
) AS v(route_number, stop_id, stop_order)
JOIN routes r ON r.route_number = v.route_number
ON CONFLICT (route_id, stop_order) DO NOTHING;

SELECT setval('route_stops_id_seq', (SELECT MAX(id) FROM route_stops));

-- ── 4. Buses ─────────────────────────────────────────────────────────────────
INSERT INTO buses (license_plate, bus_number, capacity) VALUES
('KA-01-F-5001', '500D', 55),
('KA-01-F-3351', '335E', 50),
('KA-05-F-2011', '201G', 45),
('KA-04-F-4011', '401K', 50),
('KA-01-F-3651', '365',  50)
ON CONFLICT (license_plate) DO NOTHING;

SELECT setval('buses_id_seq', (SELECT MAX(id) FROM buses));

-- ── 5. Drivers ───────────────────────────────────────────────────────────────
INSERT INTO drivers (name, phone) VALUES
('Manjunath',   '9845012345'),
('Venkatesh',   '9845012346'),
('Raghavendra', '9845012347'),
('Basavaraj',   '9845012348'),
('Anand Kumar', '9845012349')
ON CONFLICT (phone) DO NOTHING;

SELECT setval('drivers_id_seq', (SELECT MAX(id) FROM drivers));

-- ── 6. One active trip per new route ─────────────────────────────────────────
-- Gives the simulator and the live fleet something to attach to. Skipped for any
-- route that already has an active trip, so re-running never duplicates buses.
INSERT INTO trips (route_id, bus_id, driver_id, status, started_at)
SELECT r.id, b.id, d.id, 'active', CURRENT_TIMESTAMP
FROM (VALUES
  ('500D', 'KA-01-F-5001', '9845012345'),
  ('335E', 'KA-01-F-3351', '9845012346'),
  ('201G', 'KA-05-F-2011', '9845012347'),
  ('401K', 'KA-04-F-4011', '9845012348'),
  ('365',  'KA-01-F-3651', '9845012349')
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
  (SELECT COUNT(*) FROM routes)                          AS routes,
  (SELECT COUNT(*) FROM stops)                           AS stops,
  (SELECT COUNT(*) FROM trips WHERE status = 'active')   AS active_trips;
