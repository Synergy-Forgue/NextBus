import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Menu, X, BarChart3, Map, TrendingUp, AlertTriangle, Users, Clock, Home } from 'lucide-react';
import LiveFleetMap from '../components/LiveFleetMap.jsx';
import RouteProfitability from '../components/RouteProfitability.jsx';
import DeadKMAnalysis from '../components/DeadKMAnalysis.jsx';
import PunctualityReport from '../components/PunctualityReport.jsx';
import DriverProfiles from '../components/DriverProfiles.jsx';
import GapDetector from '../components/RouteGapDetector.jsx';

const API_URL = 'http://localhost:3000';

export default function Dashboard() {
  const [role, setRole] = useState('depot');
  const [activeTab, setActiveTab] = useState('fleet');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    activeBuses: 0,
    activeAlerts: 0,
    profitableRoutes: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const alertsRes = await axios.get(`${API_URL}/api/alerts/active`);
      setAlerts(alertsRes.data.alerts || []);

      const profitRes = await axios.get(`${API_URL}/api/routes/profitability`);
      const profitable = profitRes.data.routes?.filter(r => r.status === 'profitable').length || 0;

      const fleetRes = await axios.get(`${API_URL}/api/fleet/live`);
      const activeBuses = fleetRes.data.fleet?.length || 0;

      setStats({
        activeBuses,
        activeAlerts: alertsRes.data.total || 0,
        profitableRoutes: profitable,
        totalRevenue: profitRes.data.routes?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0,
      });

      setLoading(false);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const menuItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'fleet', label: 'Live Fleet', icon: Map },
    { id: 'profitability', label: 'Profitability', icon: TrendingUp },
    { id: 'deadkm', label: 'Dead KM', icon: AlertTriangle },
    { id: 'punctuality', label: 'Punctuality', icon: Clock },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'gaps', label: 'Alerts', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} z-40`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-lg">🚌</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">NextBus</h1>
                <p className="text-xs text-slate-400">Operations</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'home' && activeTab === 'fleet');
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id === 'home' ? 'fleet' : item.id);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Role Selector */}
          <div className="p-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Access Level</p>
            <div className="space-y-2">
              {['depot', 'regional', 'hq'].map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    role === r
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {r === 'depot' ? '🏢 Depot' : r === 'regional' ? '🗺️ Regional' : '🏛️ HQ'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex-1 ml-4">
              <h2 className="text-2xl font-bold text-white">NextBus Operations</h2>
              <p className="text-sm text-slate-400">Enterprise Fleet Management</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-slate-400">Live</span>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="p-6 bg-gradient-to-b from-slate-800/50 to-transparent border-b border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard icon="🚌" label="Active Buses" value={stats.activeBuses} color="blue" />
            <StatCard icon="💰" label="Daily Revenue" value={`₹${(stats.totalRevenue / 1000).toFixed(1)}k`} color="green" />
            <StatCard icon="⚠️" label="Active Alerts" value={stats.activeAlerts} color="red" />
            <StatCard icon="✨" label="Profitable Routes" value={stats.profitableRoutes} color="purple" />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Content */}
              {activeTab === 'fleet' && <LiveFleetMap role={role} />}
              {activeTab === 'profitability' && <RouteProfitability />}
              {activeTab === 'deadkm' && <DeadKMAnalysis />}
              {activeTab === 'punctuality' && <PunctualityReport />}
              {activeTab === 'drivers' && <DriverProfiles />}
              {activeTab === 'gaps' && <GapDetector />}

              {/* Alerts Panel */}
              {alerts.length > 0 && (
                <div className="bg-gradient-to-br from-red-900/20 to-red-800/10 border border-red-700/30 rounded-xl p-6 backdrop-blur-sm">
                  <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Active Alerts ({alerts.length})
                  </h3>
                  <div className="space-y-3">
                    {alerts.slice(0, 5).map(alert => (
                      <div key={alert.alert_id} className="bg-slate-800/50 rounded-lg p-4 border border-red-700/20 hover:border-red-600/40 transition-all">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">
                              {alert.alert_type === 'breakdown' ? '⚠️ Breakdown' : '🚨 SOS'} - Bus {alert.bus_id}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                          </div>
                          <button className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded font-semibold transition-all">
                            Resolve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color = 'blue' }) {
  const gradients = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
  };

  const textColors = {
    blue: 'text-blue-400',
    red: 'text-red-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`bg-gradient-to-br ${gradients[color]} border rounded-lg p-5 backdrop-blur-sm hover:border-opacity-100 transition-all duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-slate-400 text-sm font-medium mb-2">{label}</p>
      <p className={`text-3xl font-bold ${textColors[color]}`}>{value}</p>
    </div>
  );
}
