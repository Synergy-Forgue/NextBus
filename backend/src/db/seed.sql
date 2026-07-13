-- Seed Data for Vizag MVP Pilot (Based on OpenStreetMap Data)

-- 1. Routes
INSERT INTO routes (route_number, route_name, start_stop, end_stop) VALUES
('10K', 'RTC Complex ↔ Kailasagiri', 'RTC Complex', 'Kailasagiri'),
('900K', 'Bheemili ↔ Railway Station', 'Bheemili', 'Railway Station'),
('28K', 'Kothavalasa ↔ RK Beach', 'Kothavalasa', 'RK Beach'),
('55T', 'Old Gajuwaka ↔ Tagarapuvalasa', 'Old Gajuwaka', 'Tagarapuvalasa'),
('300N', 'Sabbavaram ↔ RK Beach', 'Sabbavaram', 'RK Beach');

-- 2. Stops (Unique physical locations)
INSERT INTO stops (id, name, latitude, longitude) VALUES
(1, 'RTC Complex', 17.7261, 83.3085),
(2, 'Dwaraka Bus Station', 17.7270, 83.3075),
(3, 'Jagadamba Junction', 17.7126, 83.3023),
(4, 'Collector Office', 17.7150, 83.3050),
(5, 'RK Beach', 17.7134, 83.3323),
(6, 'VMRDA Park', 17.7230, 83.3360),
(7, 'Lawsons Bay', 17.7320, 83.3420),
(8, 'Tenneti Park', 17.7450, 83.3450),
(9, 'Kailasagiri', 17.7490, 83.3421),
(10, 'Bheemili', 17.8860, 83.4475),
(11, 'INS Kalinga', 17.8500, 83.4000),
(12, 'Rushikonda Beach', 17.7820, 83.3850),
(13, 'Gitam University', 17.7810, 83.3760),
(14, 'Sagar Nagar', 17.7600, 83.3550),
(15, 'Hanumanthuwaka', 17.7500, 83.3250),
(16, 'MVP Complex', 17.7397, 83.3330),
(17, 'Maddilapalem', 17.7385, 83.3223),
(18, 'Railway Station', 17.7275, 83.2982),
(19, 'Kothavalasa', 17.8865, 83.1558),
(20, 'Pendurthi', 17.8250, 83.2000),
(21, 'NAD Junction', 17.7402, 83.2386),
(22, 'Kancharapalem', 17.7371, 83.2796),
(23, 'Old Gajuwaka', 17.6896, 83.2081),
(24, 'Kurmannapalem', 17.6750, 83.1700),
(25, 'Sontyam', 17.8800, 83.2500),
(26, 'Anandapuram', 17.8920, 83.2850),
(27, 'Tagarapuvalasa', 17.9300, 83.4200),
(28, 'Sabbavaram', 17.8000, 83.1200),
(29, 'Narava', 17.7500, 83.1700),
(30, 'Old Gopalapatnam', 17.7550, 83.2100);

-- Reset sequence for stops since we inserted explicit IDs
SELECT setval('stops_id_seq', (SELECT MAX(id) FROM stops));

-- 3. RouteStops (Mapping stops to routes with sequence)
-- Route 1: 10K (id=1)
INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES
(1, 1, 1), (1, 2, 2), (1, 3, 3), (1, 4, 4), (1, 5, 5), (1, 6, 6), (1, 7, 7), (1, 8, 8), (1, 9, 9);

-- Route 2: 900K (id=2)
INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES
(2, 10, 1), (2, 11, 2), (2, 12, 3), (2, 13, 4), (2, 14, 5), (2, 15, 6), (2, 16, 7), (2, 17, 8), (2, 1, 9), (2, 18, 10);

-- Route 3: 28K (id=3)
INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES
(3, 19, 1), (3, 20, 2), (3, 21, 3), (3, 22, 4), (3, 1, 5), (3, 3, 6), (3, 5, 7);

-- Route 4: 55T (id=4)
INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES
(4, 23, 1), (4, 24, 2), (4, 21, 3), (4, 20, 4), (4, 25, 5), (4, 26, 6), (4, 27, 7);

-- Route 5: 300N (id=5)
INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES
(5, 28, 1), (5, 29, 2), (5, 30, 3), (5, 21, 4), (5, 22, 5), (5, 1, 6), (5, 3, 7), (5, 5, 8);


-- 4. Buses
INSERT INTO buses (license_plate, bus_number, capacity) VALUES
('BUS001', '10K',  50),
('BUS002', '900K', 50),
('BUS003', '28K',  45),
('BUS004', '55T',  50),
('BUS005', '300N', 45);

-- 5. Drivers
INSERT INTO drivers (name, phone) VALUES
('Ravi Kumar', '9876543210'),
('Suresh',     '9876543211'),
('Prasad',     '9876543212'),
('Mahesh',     '9876543213'),
('Naidu',      '9876543214');

-- 6. Active Trips (To give the simulator something to attach to immediately)
INSERT INTO trips (route_id, bus_id, driver_id, status, started_at) VALUES
(1, 1, 1, 'active', CURRENT_TIMESTAMP),
(2, 2, 2, 'active', CURRENT_TIMESTAMP),
(3, 3, 3, 'active', CURRENT_TIMESTAMP),
(4, 4, 4, 'active', CURRENT_TIMESTAMP),
(5, 5, 5, 'active', CURRENT_TIMESTAMP);
