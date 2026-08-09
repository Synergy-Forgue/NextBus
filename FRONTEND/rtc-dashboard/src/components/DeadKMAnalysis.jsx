import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export default function DeadKMAnalysis() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    fetchDeadKM();
  }, []);

  const fetchDeadKM = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/analytics/dead-km`);
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Dead KM fetch error:', err);
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


