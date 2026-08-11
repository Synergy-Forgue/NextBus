import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const MOCK_PROFITABILITY = [
  { route_name: '10K (RTC Complex ↔ Kailasagiri)', route_id: '10K', revenue: 45000, costs: 28000, profit: 17000, margin: '37.7%', status: 'profitable' },
  { route_name: '900K (Bheemili ↔ Railway Station)', route_id: '900K', revenue: 62000, costs: 41000, profit: 21000, margin: '33.8%', status: 'profitable' },
  { route_name: '28K (Kothavalasa ↔ RK Beach)', route_id: '28K', revenue: 38000, costs: 25000, profit: 13000, margin: '34.2%', status: 'profitable' },
  { route_name: '55T (Old Gajuwaka ↔ Tagarapuvalasa)', route_id: '55T', revenue: 51000, costs: 36000, profit: 15000, margin: '29.4%', status: 'profitable' },
  { route_name: '300N (Sabbavaram ↔ RK Beach)', route_id: '300N', revenue: 29000, costs: 22000, profit: 7000, margin: '24.1%', status: 'profitable' },
];

export default function RouteProfitability() {
  const [routes, setRoutes] = useState(MOCK_PROFITABILITY);
  const [summary, setSummary] = useState({
    total_revenue: 225000,
    total_costs: 152000,
    total_profit: 73000,
  });

  useEffect(() => {
    fetchProfitability();
  }, []);

  const fetchProfitability = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/routes/profitability?date_range=week`);
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Revenue"
          value={`₹${summary.total_revenue?.toLocaleString() || 0}`}
          icon="💰"
          color="blue"
        />
        <SummaryCard
          label="Total Costs"
          value={`₹${summary.total_costs?.toLocaleString() || 0}`}
          icon="💸"
          color="red"
        />
        <SummaryCard
          label="Total Profit"
          value={`₹${summary.total_profit?.toLocaleString() || 0}`}
          icon="📈"
          color="green"
        />
      </div>

      {/* Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h3 className="font-bold text-slate-900 text-lg mb-4">📊 Route Profitability Analysis</h3>
        {routes.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={routes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="route_id" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
              <Bar dataKey="costs" fill="#ef4444" name="Costs" />
              <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-slate-600 text-center py-8">No data available</div>
        )}
      </div>

      {/* Routes Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-lg">💰 Routes Sorted by Profit</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-slate-700">Route</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Revenue</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Costs</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Profit</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-slate-700">Margin</th>
                <th className="px-6 py-3 text-center text-sm font-bold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route, i) => (
                <tr key={i} className="border-b border-slate-200 hover:bg-slate-100/50">
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">{route.route_name}</td>
                  <td className="px-6 py-4 text-sm text-right text-green-400">₹{route.revenue?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-red-700">₹{route.costs?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-blue-400 font-bold">₹{route.profit?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-right text-slate-700">{route.margin}</td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        route.status === 'profitable'
                          ? 'bg-green-100 border border-green-300 text-green-700'
                          : 'bg-red-100 border border-red-300 text-red-700'
                      }`}
                    >
                      {route.status === 'profitable' ? '✓ Profit' : '✗ Loss'}
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

function SummaryCard({ label, value, icon, color }) {
  const colorClass =
    color === 'red'
      ? 'bg-red-900/20 border-red-300'
      : color === 'green'
      ? 'bg-green-900/20 border-green-300'
      : 'bg-blue-900/20 border-blue-300';

  return (
    <div className={`border rounded-lg p-4 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-600 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}


