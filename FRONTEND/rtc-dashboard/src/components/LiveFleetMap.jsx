import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export default function LiveFleetMap({ role }) {
  const [fleet, setFleet] = useState([]);
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchFleet = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/fleet/live?role=${role}`);
      setFleet(res.data.fleet || []);
    } catch (err) {
      console.error('Fleet fetch error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Map Placeholder */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" style={{ height: '500px' }}>
        <div className="w-full h-full flex items-center justify-center text-slate-600">
          <div className="text-center">
            <p className="text-lg font-bold mb-2">🗺️ Live Fleet Map</p>
            <p className="text-sm">Integration with Leaflet/Mapbox required for production</p>
            <p className="text-xs mt-2 text-slate-500">Currently showing {fleet.length} buses</p>

            {/* Simple marker list */}
            <div className="mt-4 text-left max-h-48 overflow-y-auto">
              {fleet.slice(0, 5).map((bus, i) => (
                <div key={i} className="text-xs text-slate-700 py-1">
                  📍 Bus {bus.bus_id}: {bus.latitude.toFixed(4)}, {bus.longitude.toFixed(4)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fleet List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-lg">📍 Fleet Status ({fleet.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Bus ID</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Location</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Speed</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((bus, i) => (
                <tr key={i} className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">{bus.bus_id}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {bus.latitude?.toFixed(3)}, {bus.longitude?.toFixed(3)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{bus.speed || 0} km/h</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-green-100 border border-green-300 text-green-700 rounded-full text-xs font-bold">
                      🟢 Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


