import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MOCK_PUNCTUALITY = [
  { route_name: '10K (RTC Complex ↔ Kailasagiri)', on_time_trips: 42, late_trips: 3, on_time_percent: 93, avg_delay_minutes: 2.1 },
  { route_name: '900K (Bheemili ↔ Railway Station)', on_time_trips: 38, late_trips: 5, on_time_percent: 88, avg_delay_minutes: 3.8 },
  { route_name: '28K (Kothavalasa ↔ RK Beach)', on_time_trips: 40, late_trips: 2, on_time_percent: 95, avg_delay_minutes: 1.5 },
  { route_name: '55T (Old Gajuwaka ↔ Tagarapuvalasa)', on_time_trips: 31, late_trips: 6, on_time_percent: 84, avg_delay_minutes: 4.5 },
  { route_name: '300N (Sabbavaram ↔ RK Beach)', on_time_trips: 35, late_trips: 3, on_time_percent: 92, avg_delay_minutes: 2.4 },
];

export default function PunctualityReport() {
  const [routes, setRoutes] = useState(MOCK_PUNCTUALITY);
  const [summary, setSummary] = useState({
    avg_on_time_percent: 90.4,
  });

  useEffect(() => {
    fetchPunctuality();
  }, []);

  const fetchPunctuality = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/analytics/punctuality`);
      if (res.data?.routes) {
        setRoutes(res.data.routes);
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      // Use preloaded mock analytics if backend endpoint is unmounted
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


