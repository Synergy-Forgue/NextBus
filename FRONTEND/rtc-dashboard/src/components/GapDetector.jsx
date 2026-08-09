import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

export default function GapDetector() {
  const [gaps, setGaps] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchGaps();
    if (autoRefresh) {
      const interval = setInterval(fetchGaps, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchGaps = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts/gap-detection/check`);
      setGaps(res.data.gaps || []);
    } catch (err) {
      console.error('Gap detection fetch error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="font-bold text-slate-900 text-lg">🚨 Route Gap Detector</h3>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 rounded-lg font-bold transition ${
            autoRefresh
              ? 'bg-green-600 text-slate-900'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-600'
          }`}
        >
          {autoRefresh ? '🔴 Live' : '⚫ Off'}
        </button>
      </div>

      {/* Summary */}
      {gaps.length > 0 && (
        <div className="bg-red-900/20 border border-red-300 rounded-lg p-4">
          <p className="text-red-700 font-bold">⚠️ {gaps.length} Issues Detected</p>
          <p className="text-sm text-red-200 mt-1">
            Immediate action required. Bus bunching or service gaps detected.
          </p>
        </div>
      )}

      {/* Gaps List */}
      <div className="space-y-4">
        {gaps.length > 0 ? (
          gaps.map((gap, i) => (
            <GapCard key={i} gap={gap} />
          ))
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-green-400 text-lg font-bold">✓ No Issues Detected</p>
            <p className="text-slate-600 text-sm mt-2">All routes operating normally</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-300 rounded-lg p-4">
        <h4 className="font-bold text-blue-700 mb-2">ℹ️ How It Works</h4>
        <ul className="text-sm text-slate-700 space-y-1">
          <li>🚌 <strong>Bus Bunching:</strong> Multiple buses on same route clustered together</li>
          <li>📍 <strong>Service Gap:</strong> Abnormally long interval between buses</li>
          <li>⚡ <strong>Real-Time Detection:</strong> Automatic alerts when issues occur</li>
          <li>🎯 <strong>Immediate Action:</strong> Depot can dispatch additional buses or adjust schedules</li>
        </ul>
      </div>
    </div>
  );
}

function GapCard({ gap }) {
  const severity = gap.severity || 'medium';
  const severityClass =
    severity === 'high'
      ? 'bg-red-100 border-red-300'
      : severity === 'critical'
      ? 'bg-red-900/40 border-red-600'
      : 'bg-yellow-100 border-yellow-300';

  const icon = gap.gap_type === 'bunching' ? '🚌🚌' : '⏱️';
  const title =
    gap.gap_type === 'bunching'
      ? `Bus Bunching on Route ${gap.route_id}`
      : `Service Gap on Route ${gap.route_id}`;

  return (
    <div className={`${severityClass} border rounded-lg p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            {title}
          </p>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {gap.gap_type === 'bunching' && (
              <>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-600">Buses Bunched:</span> {gap.buses_bunched?.join(', ')}
                </p>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-600">Location:</span> {gap.location?.lat?.toFixed(3)},
                  {gap.location?.lng?.toFixed(3)}
                </p>
              </>
            )}

            {gap.gap_type === 'service_gap' && (
              <>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-600">Gap Duration:</span> {gap.gap_duration_minutes} minutes
                </p>
                <p className="text-sm text-slate-700">
                  <span className="text-slate-600">Expected Interval:</span> {gap.expected_interval} minutes
                </p>
              </>
            )}
          </div>
        </div>

        <button className="ml-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 rounded-lg font-bold text-sm">
          Take Action
        </button>
      </div>
    </div>
  );
}


