import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function LiveFleetMap({ role, buses: propBuses }) {
  const [fleet, setFleet] = useState(propBuses || []);

  useEffect(() => {
    if (propBuses && propBuses.length > 0) {
      setFleet(propBuses);
    } else {
      fetchFleet();
      const interval = setInterval(fetchFleet, 5000);
      return () => clearInterval(interval);
    }
  }, [propBuses]);

  const fetchFleet = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tracking/fleet`);
      setFleet(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Fleet fetch error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Map Placeholder Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6" style={{ height: '420px' }}>
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
          <div className="text-center">
            <p className="text-2xl font-bold mb-2 text-white">🗺️ Live Fleet Radar — Visakhapatnam</p>
            <p className="text-sm text-slate-400">Real-time GPS coordinates stream from active vehicles</p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-950/60 border border-indigo-500/30 rounded-full text-indigo-300 font-semibold text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Currently tracking {fleet.length} active bus(es)
            </div>

            {/* Live GPS feed preview */}
            <div className="mt-6 text-left max-h-40 overflow-y-auto bg-slate-950/80 p-4 rounded-lg border border-slate-800 text-xs font-mono">
              {fleet.length === 0 ? (
                <p className="text-slate-500 italic text-center">Waiting for telemetry pings from simulator / driver app...</p>
              ) : (
                fleet.map((bus, i) => (
                  <div key={bus.trip_id || i} className="py-1 text-slate-300 border-b border-slate-900/60 flex items-center justify-between gap-4">
                    <span className="font-bold text-indigo-400">🚌 {bus.license_plate || `Trip ${bus.trip_id}`}</span>
                    <span className="text-slate-400">Lat: {Number(bus.latitude).toFixed(4)}, Lng: {Number(bus.longitude).toFixed(4)}</span>
                    <span className="text-emerald-400 font-semibold">{bus.speed ? `${Math.round(bus.speed)} km/h` : '0 km/h'}</span>
                    <span className="text-slate-400">👥 {bus.occupancy_count ?? 0}/50</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fleet List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">📍 Fleet Telemetry Status ({fleet.length})</h3>
          <span className="text-xs text-slate-400">Updates live via WebSocket</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Bus / Trip</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Coordinates</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Speed</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Occupancy</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {fleet.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No active buses found. Run <code className="bg-slate-800 px-2 py-1 rounded text-indigo-300">npm run sim</code> in backend to simulate live GPS tracking.
                  </td>
                </tr>
              ) : (
                fleet.map((bus, i) => (
                  <tr key={bus.trip_id || i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-white">
                      {bus.license_plate || `Bus ${bus.bus_id}`}
                      <span className="block text-xs font-normal text-slate-400">Trip ID #{bus.trip_id}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                      {Number(bus.latitude).toFixed(4)}, {Number(bus.longitude).toFixed(4)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300 font-semibold">
                      {bus.speed ? `${Math.round(bus.speed)} km/h` : '0 km/h'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      <span className={`font-bold ${bus.occupancy_count > 35 ? 'text-amber-400' : 'text-slate-200'}`}>
                        {bus.occupancy_count ?? 0}
                      </span>
                      <span className="text-slate-500"> / 50 seats</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
