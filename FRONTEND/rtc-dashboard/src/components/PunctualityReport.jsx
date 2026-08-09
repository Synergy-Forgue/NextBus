import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:3000';

export default function PunctualityReport() {
  const [routes, setRoutes] = useState([]);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    fetchPunctuality();
  }, []);

  const fetchPunctuality = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/analytics/punctuality`);
      setRoutes(res.data.routes || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Punctuality fetch error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <p className="text-slate-600 text-sm font-medium">Average On-Time Rate</p>
        <p className="text-4xl font-bold text-slate-900 mt-1">{summary.avg_on_time_percent}%</p>
        <p className="text-sm text-slate-600 mt-2">Across all routes this week</p>
      </div>

      {/* Routes Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-lg">⏰ Punctuality by Route</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Route</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">On-Time</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Late</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">On-Time %</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Avg Delay</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route, i) => (
                <tr key={i} className="border-b border-slate-200 hover:bg-slate-100/50">
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">{route.route_name}</td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className="text-green-400 font-bold">{route.on_time_trips}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className="text-red-700 font-bold">{route.late_trips}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${route.on_time_percent}%` }}
                        ></div>
                      </div>
                      <span className="text-slate-900 font-bold w-12 text-right">{route.on_time_percent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-slate-700">{route.avg_delay_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


