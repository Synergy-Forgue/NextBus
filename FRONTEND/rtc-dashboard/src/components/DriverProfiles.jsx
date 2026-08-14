import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DemoDataNotice from './DemoDataNotice.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Driver roster for operations.
 *
 * The roster itself is real — GET /api/drivers exists and returns the drivers
 * on record. Per-driver performance (punctuality, completion rate, ratings) is
 * NOT instrumented anywhere in the platform: there are no scheduled times to
 * measure lateness against and no rating capture. Those panels previously
 * displayed invented percentages, so they are now shown as uninstrumented
 * rather than fabricated.
 *
 * Incident counts ARE derivable, from the alerts table joined on driver_phone.
 */
export default function DriverProfiles() {
  const [drivers, setDrivers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [driversRes, alertsRes] = await Promise.all([
          axios.get(`${API_URL}/api/drivers`),
          axios.get(`${API_URL}/api/alerts`).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setDrivers(Array.isArray(driversRes.data) ? driversRes.data : []);
        setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      } catch (err) {
        if (!cancelled) setError('Could not load the driver roster from the backend.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Real incident counts for a driver, from the alerts they raised. */
  const incidentsFor = (driver) => {
    const theirs = alerts.filter((a) => a.driver_phone && a.driver_phone === driver.phone);
    return {
      breakdowns: theirs.filter((a) => a.type === 'breakdown').length,
      sos: theirs.filter((a) => a.type === 'sos').length,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        Loading driver roster…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-700/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DemoDataNotice needs="scheduled timetables and a driver rating capture mechanism" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.length === 0 ? (
          <p className="text-slate-500 text-sm">No drivers on record.</p>
        ) : (
          drivers.map((driver) => {
            const incidents = incidentsFor(driver);
            return (
              <div
                key={driver.id}
                onClick={() => setSelectedDriver(driver)}
                className="bg-slate-900 border border-slate-800 rounded-lg p-6 cursor-pointer hover:border-indigo-600 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xl font-bold text-white">{driver.name}</p>
                    <p className="text-sm text-slate-400">{driver.phone}</p>
                  </div>
                  <span className="text-3xl">👤</span>
                </div>

                <div className="space-y-2">
                  <UninstrumentedRow label="Punctuality" />
                  <UninstrumentedRow label="Trip Completion" />
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 text-sm">
                  <p className="text-slate-400">
                    Breakdowns reported:{' '}
                    <span className="text-red-400 font-bold">{incidents.breakdowns}</span>
                  </p>
                  <p className="text-slate-400">
                    SOS events:{' '}
                    <span className="text-red-400 font-bold">{incidents.sos}</span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedDriver && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-white">{selectedDriver.name}</h3>
              <p className="text-slate-400">
                {selectedDriver.phone} · driver #{selectedDriver.id}
              </p>
            </div>
            <button
              onClick={() => setSelectedDriver(null)}
              className="text-2xl text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-white mb-4">Incidents (from alert records)</h4>
              <div className="space-y-4">
                <MetricCard
                  label="Breakdown reports"
                  value={incidentsFor(selectedDriver).breakdowns}
                  color="red"
                />
                <MetricCard
                  label="SOS events"
                  value={incidentsFor(selectedDriver).sos}
                  color="red"
                />
              </div>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">Not yet instrumented</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Punctuality, trip-completion rate, average speed and customer rating are not
                captured by the platform. Punctuality needs published timetables to compare
                arrivals against; ratings need a commuter feedback flow. Neither exists yet, so
                no figure is shown rather than an invented one.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UninstrumentedRow({ label }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-600 italic">not tracked</span>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  const colorClass = color === 'red' ? 'text-red-400' : color === 'green' ? 'text-green-400' : 'text-blue-400';
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}
