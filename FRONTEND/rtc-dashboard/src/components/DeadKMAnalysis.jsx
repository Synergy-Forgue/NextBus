import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MOCK_DEAD_KM = [
  { route_id: '10K', bus_id: 'BUS001', trips: 14, total_dead_km: 12.4, avg_dead_km_per_trip: 0.88, fuel_cost_loss: 496 },
  { route_id: '900K', bus_id: 'BUS002', trips: 10, total_dead_km: 18.2, avg_dead_km_per_trip: 1.82, fuel_cost_loss: 728 },
  { route_id: '28K', bus_id: 'BUS003', trips: 12, total_dead_km: 9.6, avg_dead_km_per_trip: 0.80, fuel_cost_loss: 384 },
  { route_id: '55T', bus_id: 'BUS004', trips: 8, total_dead_km: 15.0, avg_dead_km_per_trip: 1.87, fuel_cost_loss: 600 },
  { route_id: '300N', bus_id: 'BUS005', trips: 10, total_dead_km: 11.2, avg_dead_km_per_trip: 1.12, fuel_cost_loss: 448 },
];

export default function DeadKMAnalysis() {
  const [data, setData] = useState(MOCK_DEAD_KM);
  const [summary, setSummary] = useState({
    total_dead_km: 66.4,
    potential_savings: '₹2,656',
  });

  useEffect(() => {
    fetchDeadKM();
  }, []);

  const fetchDeadKM = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/analytics/dead-km`);
      if (res.data?.data) {
        setData(res.data.data);
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      // Use preloaded mock analytics if backend endpoint is unmounted
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-slate-600 text-sm font-medium">Total Dead KM (This Week)</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{summary.total_dead_km || 0} km</p>
          <p className="text-xs text-slate-500 mt-2">Empty kilometers wasted</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-slate-600 text-sm font-medium">Potential Fuel Cost Savings</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{summary.potential_savings || '₹0'}</p>
          <p className="text-xs text-slate-500 mt-2">By reducing dead KM</p>
        </div>
      </div>

      {/* Details Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-lg">⛽ Dead KM by Bus</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Route</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Bus ID</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Trips</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Dead KM</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Avg/Trip</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Cost Loss</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i} className="border-b border-slate-200 hover:bg-slate-100/50">
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">{item.route_id}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{item.bus_id}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-700">{item.trips}</td>
                  <td className="px-6 py-4 text-sm text-right text-orange-400 font-bold">{item.total_dead_km} km</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-700">{item.avg_dead_km_per_trip} km</td>
                  <td className="px-6 py-4 text-sm text-right text-red-700">₹{item.fuel_cost_loss}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-900/20 border border-blue-300 rounded-lg p-4">
        <h4 className="font-bold text-blue-700 mb-2">💡 Recommendations</h4>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>✓ Optimize route scheduling to minimize empty runs</li>
          <li>✓ Consider load-sharing between buses to reduce individual dead KM</li>
          <li>✓ Analyze depot-to-route distances for better planning</li>
          <li>✓ Implement return-journey load optimization</li>
        </ul>
      </div>
    </div>
  );
}


