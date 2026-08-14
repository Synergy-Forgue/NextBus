import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Gauge, Users, Clock, RefreshCw, AlertTriangle, Layers, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DEFAULT_CENTER = [17.6868, 83.2185]; // Visakhapatnam

// Helper to determine vehicle status
function getVehicleStatus(bus) {
  if (bus.status) return bus.status.toUpperCase();
  if (!bus.last_updated && !bus.updated_at) return 'LIVE';
  const lastTime = new Date(bus.last_updated || bus.updated_at).getTime();
  if (isNaN(lastTime)) return 'LIVE';
  const diffSec = (Date.now() - lastTime) / 1000;
  if (diffSec > 120) return 'OFFLINE';
  if (diffSec > 60) return 'STALE';
  return 'LIVE';
}

// Custom Leaflet DivIcon creator for live buses
function createBusIcon(status, routeNumber, isSelected) {
  let badgeBg = 'bg-emerald-500';
  let ringStyle = 'ring-2 ring-emerald-400/50';

  if (status === 'APPROACHING STOP') {
    badgeBg = 'bg-indigo-500';
    ringStyle = 'ring-2 ring-indigo-400/50';
  } else if (status === 'AT STOP') {
    badgeBg = 'bg-cyan-500';
    ringStyle = 'ring-2 ring-cyan-400/50';
  } else if (status === 'STALE' || status === 'SIGNAL LOST') {
    badgeBg = 'bg-amber-500';
    ringStyle = 'ring-2 ring-amber-400/50';
  } else if (status === 'OFFLINE') {
    badgeBg = 'bg-rose-500';
    ringStyle = 'ring-2 ring-rose-400/50';
  }

  const selectionBorder = isSelected
    ? 'border-amber-400 ring-4 ring-amber-400/80 scale-125 z-50'
    : 'border-white';

  const routeLabel = routeNumber ? routeNumber : '';

  return L.divIcon({
    className: 'custom-bus-marker-wrapper',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-slate-900 border-2 ${selectionBorder} ${ringStyle} shadow-xl transition-all duration-200">
        <span class="text-base select-none">🚌</span>
        ${routeLabel ? `<span class="absolute -top-2 -right-2 px-1.5 py-0.5 ${badgeBg} text-white font-black text-[10px] rounded-full shadow border border-slate-900 select-none">${routeLabel}</span>` : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

// Controller component to smoothly adjust map center/zoom
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
      map.flyTo(center, zoom || 13, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function LiveFleetMap({ role, buses: propBuses }) {
  const [fleet, setFleet] = useState(propBuses || []);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(12);

  const fetchFleet = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tracking/fleet`);
      if (Array.isArray(res.data)) {
        setFleet(res.data);
      }
    } catch (err) {
      console.error('Fleet fetch error:', err);
    }
  };

  useEffect(() => {
    if (Array.isArray(propBuses) && propBuses.length > 0) {
      setFleet(propBuses);
    } else {
      fetchFleet();
    }
  }, [propBuses]);

  useEffect(() => {
    const interval = setInterval(fetchFleet, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter fleet based on status filter button
  const filteredFleet = useMemo(() => {
    if (statusFilter === 'ALL') return fleet;
    return fleet.filter((b) => getVehicleStatus(b) === statusFilter);
  }, [fleet, statusFilter]);

  // Selected bus detail object
  const selectedBus = useMemo(() => {
    return fleet.find((b) => String(b.trip_id) === String(selectedTripId)) || null;
  }, [fleet, selectedTripId]);

  const handleSelectBus = (bus) => {
    setSelectedTripId(bus.trip_id);
    if (bus.latitude && bus.longitude) {
      setMapCenter([Number(bus.latitude), Number(bus.longitude)]);
      setMapZoom(14);
    }
  };

  const handleResetMap = () => {
    setSelectedTripId(null);
    if (fleet.length > 0 && fleet[0].latitude && fleet[0].longitude) {
      setMapCenter([Number(fleet[0].latitude), Number(fleet[0].longitude)]);
      setMapZoom(12);
    } else {
      setMapCenter(DEFAULT_CENTER);
      setMapZoom(12);
    }
  };

  const formatEtaTime = (etaSeconds) => {
    if (etaSeconds === null || etaSeconds === undefined) return 'N/A';
    if (etaSeconds <= 30) return 'At Stop / Arriving';
    if (etaSeconds < 60) return `${etaSeconds} sec`;
    const mins = Math.round(etaSeconds / 60);
    return `${mins} min${mins > 1 ? 's' : ''}`;
  };

  const renderBadge = (status) => {
    const s = (status || 'LIVE').toUpperCase();
    let badgeStyle = 'bg-emerald-950/90 border-emerald-500/40 text-emerald-400';
    let dotStyle = 'bg-emerald-400 animate-pulse';

    if (s === 'APPROACHING STOP') {
      badgeStyle = 'bg-indigo-950/90 border-indigo-500/40 text-indigo-400';
      dotStyle = 'bg-indigo-400 animate-pulse';
    } else if (s === 'AT STOP') {
      badgeStyle = 'bg-cyan-950/90 border-cyan-500/40 text-cyan-400';
      dotStyle = 'bg-cyan-400 animate-pulse';
    } else if (s === 'STALE' || s === 'SIGNAL LOST') {
      badgeStyle = 'bg-amber-950/90 border-amber-500/40 text-amber-400';
      dotStyle = 'bg-amber-400';
    } else if (s === 'OFFLINE') {
      badgeStyle = 'bg-rose-950/90 border-rose-500/40 text-rose-400';
      dotStyle = 'bg-rose-400';
    }

    return (
      <span className={`px-2.5 py-1 border rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${badgeStyle}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`}></span>
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <style>{`
        .leaflet-popup-content-wrapper {
          background-color: #0f172a !important;
          color: #f8fafc !important;
          border: 1px solid #334155 !important;
          border-radius: 0.75rem !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important;
          padding: 4px !important;
        }
        .leaflet-popup-tip {
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
        }
        .leaflet-container {
          font-family: inherit !important;
          background-color: #020617 !important;
        }
      `}</style>

      {/* Header & Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🗺️ Live Fleet Radar — Visakhapatnam</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry & multi-stop ETA progression
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'LIVE', 'APPROACHING STOP', 'AT STOP', 'STALE', 'OFFLINE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                statusFilter === st
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={handleResetMap}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-all cursor-pointer"
            title="Reset Map View"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Fallback Banner when Fleet is Empty */}
      {fleet.length === 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between text-amber-200 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold">No active buses currently in service</p>
              <p className="text-xs text-amber-300/80">
                Run <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 border border-amber-500/30">npm run sim</code> in backend or launch the Driver App to stream live bus telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={fetchFleet}
            className="px-3 py-1.5 bg-amber-900/60 hover:bg-amber-800/60 border border-amber-500/40 rounded-lg text-xs font-bold text-amber-100 transition-all"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Main Map Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
        <div style={{ height: '480px', width: '100%' }}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapController center={mapCenter} zoom={mapZoom} />

            {filteredFleet.map((bus) => {
              if (!bus.latitude || !bus.longitude) return null;
              const status = getVehicleStatus(bus);
              const isSelected = String(bus.trip_id) === String(selectedTripId);
              const icon = createBusIcon(status, bus.route_number, isSelected);

              return (
                <Marker
                  key={bus.trip_id || `${bus.latitude}-${bus.longitude}`}
                  position={[Number(bus.latitude), Number(bus.longitude)]}
                  icon={icon}
                  eventHandlers={{
                    click: () => handleSelectBus(bus),
                  }}
                >
                  <Popup>
                    <div className="w-64 text-slate-100 space-y-3 p-1">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base">
                              {bus.license_plate || `Bus #${bus.bus_id}`}
                            </span>
                            {bus.route_number && (
                              <span className="px-2 py-0.5 bg-indigo-600 text-white font-extrabold text-xs rounded-md">
                                R-{bus.route_number}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block">Trip #{bus.trip_id}</span>
                        </div>
                        {renderBadge(status)}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[10px] uppercase">Speed</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {bus.speed ? `${Math.round(bus.speed)} km/h` : '0 km/h'}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 block text-[10px] uppercase">Occupancy</span>
                          <span className="font-bold text-slate-200 text-sm">
                            {bus.occupancy_count ?? 0} <span className="text-[10px] text-slate-400">/ 50</span>
                          </span>
                        </div>
                      </div>

                      {/* Coordinates */}
                      <div className="text-[11px] text-slate-400 font-mono bg-slate-950/60 p-2 rounded border border-slate-800">
                        📍 {Number(bus.latitude).toFixed(4)}, {Number(bus.longitude).toFixed(4)}
                      </div>

                      {/* Stop ETAs preview */}
                      <div className="border-t border-slate-800 pt-2 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                          Upcoming Stop ETAs
                        </span>
                        {bus.stop_etas && bus.stop_etas.length > 0 ? (
                          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                            {bus.stop_etas.slice(0, 3).map((eta, idx) => (
                              <div
                                key={eta.stop_id || idx}
                                className="flex items-center justify-between text-xs py-1 px-1.5 bg-slate-900/50 rounded border border-slate-800/80"
                              >
                                <span className="text-slate-300 truncate max-w-[120px]">
                                  {eta.stop_name}
                                </span>
                                <span className="font-bold text-indigo-400">
                                  {formatEtaTime(eta.eta_seconds)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic">No ETAs calculated yet</p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Selected Bus Floating Quick Info */}
        {selectedBus && (
          <div className="absolute bottom-4 left-4 right-4 md:right-auto md:max-w-md z-[1000] bg-slate-900/95 border border-indigo-500/40 rounded-xl p-4 backdrop-blur-md shadow-2xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">
                    🚌 {selectedBus.license_plate || `Bus #${selectedBus.bus_id}`}
                  </span>
                  {selectedBus.route_number && (
                    <span className="px-2 py-0.5 bg-indigo-600 text-white font-extrabold text-xs rounded">
                      Route {selectedBus.route_number}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">Active Trip #{selectedBus.trip_id}</span>
              </div>
              <div className="flex items-center gap-2">
                {renderBadge(getVehicleStatus(selectedBus))}
                <button
                  onClick={() => setSelectedTripId(null)}
                  className="text-slate-400 hover:text-white text-xs p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Upcoming Stops List */}
            {selectedBus.stop_etas && selectedBus.stop_etas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-1.5">Stop ETA Sequence:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedBus.stop_etas.slice(0, 4).map((eta, idx) => (
                    <div key={eta.stop_id || idx} className="bg-slate-950/80 p-2 rounded border border-slate-800 flex flex-col">
                      <span className="text-slate-400 truncate text-[11px]">{eta.stop_name}</span>
                      <span className="font-bold text-indigo-400 text-xs">
                        {formatEtaTime(eta.eta_seconds)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fleet Telemetry Status Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-white text-lg">📍 Fleet Telemetry Status</h3>
            <span className="px-2.5 py-0.5 bg-slate-800 text-indigo-300 font-semibold rounded-full text-xs border border-slate-700">
              {filteredFleet.length} vehicle(s)
            </span>
          </div>
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live WebSocket Telemetry Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Bus / Trip</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Route</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Coordinates</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Speed</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Occupancy</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Next Stop ETA</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFleet.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No matching active buses found. Run <code className="bg-slate-800 px-2 py-1 rounded text-indigo-300">npm run sim</code> in backend to simulate live telemetry.
                  </td>
                </tr>
              ) : (
                filteredFleet.map((bus, i) => {
                  const status = getVehicleStatus(bus);
                  const isSelected = String(bus.trip_id) === String(selectedTripId);
                  const nextEta = bus.stop_etas && bus.stop_etas.find((s) => s.eta_seconds !== null);

                  return (
                    <tr
                      key={bus.trip_id || i}
                      className={`transition-colors hover:bg-slate-800/60 ${
                        isSelected ? 'bg-indigo-950/40 border-l-4 border-l-amber-400' : ''
                      }`}
                    >
                      <td className="px-6 py-4 text-sm font-bold text-white">
                        {bus.license_plate || `Bus #${bus.bus_id}`}
                        <span className="block text-xs font-normal text-slate-400">Trip ID #{bus.trip_id}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">
                        {bus.route_number ? (
                          <span className="px-2.5 py-1 bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 rounded font-semibold text-xs">
                            {bus.route_number}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {bus.latitude && bus.longitude
                          ? `${Number(bus.latitude).toFixed(4)}, ${Number(bus.longitude).toFixed(4)}`
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-bold">
                        {bus.speed ? `${Math.round(bus.speed)} km/h` : '0 km/h'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        <span className={`font-bold ${bus.occupancy_count > 35 ? 'text-amber-400' : 'text-slate-200'}`}>
                          {bus.occupancy_count ?? 0}
                        </span>
                        <span className="text-slate-500"> / 50</span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {renderBadge(status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {nextEta ? (
                          <div>
                            <span className="font-semibold text-white">{nextEta.stop_name}</span>
                            <span className="block text-xs text-indigo-400 font-bold">
                              {formatEtaTime(nextEta.eta_seconds)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs italic">No ETA</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => handleSelectBus(bus)}
                          className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold rounded transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Focus
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

