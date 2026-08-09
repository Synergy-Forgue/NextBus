import React, { useState, useEffect } from 'react';
import './App.css';
import LiveFleetMap from './components/LiveFleetMap';
import RouteProfitability from './components/RouteProfitability';
import DeadKMAnalysis from './components/DeadKMAnalysis';
import DriverProfiles from './components/DriverProfiles';
import PunctualityReport from './components/PunctualityReport';
import RouteGapDetector from './components/RouteGapDetector';

function App() {
  const [activeTab, setActiveTab] = useState('fleet');
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial data
    const fetchData = async () => {
      try {
        const [busRes, routeRes, alertRes] = await Promise.all([
          fetch('http://localhost:3000/api/tracking/fleet'),
          fetch('http://localhost:3000/api/routes'),
          fetch('http://localhost:3000/api/alerts?status=active')
        ]);

        if (busRes.ok) setBuses(await busRes.json());
        if (routeRes.ok) setRoutes(await routeRes.json());
        if (alertRes.ok) setAlerts(await alertRes.json());
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up WebSocket for live updates
    const ws = new WebSocket('ws://localhost:3000/ws/subscribe');
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'SNAPSHOT') {
        setBuses(msg.data);
      } else if (msg.type === 'BUS_UPDATE') {
        // Merge the updated bus into the fleet by trip_id
        setBuses(prev => {
          const idx = prev.findIndex(b => b.trip_id === msg.data.trip_id);
          if (idx === -1) return [...prev, msg.data];
          const next = [...prev];
          next[idx] = msg.data;
          return next;
        });
      } else if (msg.type === 'BUS_OFFLINE') {
        setBuses(prev => prev.filter(b => b.trip_id !== msg.trip_id));
      } else if (msg.type === 'ALERT') {
        // Breakdown / SOS from the Driver App — surface immediately
        setAlerts(prev => [msg.data, ...prev]);
      } else if (msg.type === 'ALERT_RESOLVED') {
        setAlerts(prev => prev.filter(a => a.id !== msg.data.id));
      }
    };

    return () => ws.close();
  }, []);

  if (loading) return <div className="loading">Loading Dashboard...</div>;

  return (
    <div className="App">
      <header className="dashboard-header">
        <h1>🚌 NXTBus RTC Operations Dashboard</h1>
        <p>Real-time fleet intelligence for APSRTC - Visakhapatnam</p>
      </header>

      {alerts.length > 0 && (
        <div style={{ background: '#c62828', color: 'white', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700 }}>
                {a.type === 'sos' ? '🚨 DRIVER SOS' : '🔧 BREAKDOWN'} — Bus {a.license_plate || '?'} (Route {a.route_number || '?'})
                {a.description ? ` · ${a.description}` : ''} · 📍 {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}
                {' · '}{new Date(a.created_at).toLocaleTimeString()}
              </span>
              <button
                onClick={async () => {
                  await fetch(`http://localhost:3000/api/alerts/${a.id}/resolve`, { method: 'PATCH' });
                  setAlerts(prev => prev.filter(x => x.id !== a.id));
                }}
                style={{ background: 'white', color: '#c62828', border: 'none', borderRadius: '15px', padding: '5px 14px', fontWeight: 700, cursor: 'pointer' }}
              >
                Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      <nav className="dashboard-nav">
        <button
          className={`nav-btn ${activeTab === 'fleet' ? 'active' : ''}`}
          onClick={() => setActiveTab('fleet')}
        >
          📍 Live Fleet
        </button>
        <button
          className={`nav-btn ${activeTab === 'profitability' ? 'active' : ''}`}
          onClick={() => setActiveTab('profitability')}
        >
          💰 Route Profitability
        </button>
        <button
          className={`nav-btn ${activeTab === 'deadkm' ? 'active' : ''}`}
          onClick={() => setActiveTab('deadkm')}
        >
          ⛽ Dead KM Analysis
        </button>
        <button
          className={`nav-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          👥 Driver Profiles
        </button>
        <button
          className={`nav-btn ${activeTab === 'punctuality' ? 'active' : ''}`}
          onClick={() => setActiveTab('punctuality')}
        >
          ⏱️ Punctuality Report
        </button>
        <button
          className={`nav-btn ${activeTab === 'gaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('gaps')}
        >
          🚨 Route Gaps
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'fleet' && <LiveFleetMap buses={buses} />}
        {activeTab === 'profitability' && <RouteProfitability routes={routes} buses={buses} />}
        {activeTab === 'deadkm' && <DeadKMAnalysis buses={buses} routes={routes} />}
        {activeTab === 'drivers' && <DriverProfiles buses={buses} />}
        {activeTab === 'punctuality' && <PunctualityReport buses={buses} routes={routes} />}
        {activeTab === 'gaps' && <RouteGapDetector buses={buses} routes={routes} />}
      </main>

      <footer className="dashboard-footer">
        <p>Next Bus © 2026 | APSRTC Fleet Management | Real-time Updates</p>
      </footer>
    </div>
  );
}

export default App;
