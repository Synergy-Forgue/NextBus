import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockDrivers = [
  { driver_id: 'D001', name: 'Rajesh Kumar', punctuality: 94, trip_completion: 100, breakdowns: 1, sos_events: 0 },
  { driver_id: 'D002', name: 'Vikram Singh', punctuality: 87, trip_completion: 98, breakdowns: 2, sos_events: 0 },
  { driver_id: 'D003', name: 'Suresh Patel', punctuality: 92, trip_completion: 99, breakdowns: 0, sos_events: 1 },
];

export default function DriverProfiles() {
  const [drivers, setDrivers] = useState(mockDrivers);
  const [selectedDriver, setSelectedDriver] = useState(null);

  return (
    <div className="space-y-6">
      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((driver) => (
          <div
            key={driver.driver_id}
            onClick={() => setSelectedDriver(driver)}
            className="bg-white border border-slate-200 rounded-lg p-6 cursor-pointer hover:border-indigo-600 transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xl font-bold text-slate-900">{driver.name}</p>
                <p className="text-sm text-slate-600">{driver.driver_id}</p>
              </div>
              <span className="text-3xl">👤</span>
            </div>

            {/* Performance Bars */}
            <div className="space-y-3">
              <PerformanceBar label="Punctuality" value={driver.punctuality} />
              <PerformanceBar label="Trip Completion" value={driver.trip_completion} />
            </div>

            {/* Incidents */}
            <div className="mt-4 pt-4 border-t border-slate-200 text-sm">
              <p className="text-slate-600">
                Breakdowns: <span className="text-red-700 font-bold">{driver.breakdowns}</span>
              </p>
              <p className="text-slate-600">
                SOS Events: <span className="text-red-700 font-bold">{driver.sos_events}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed View */}
      {selectedDriver && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">{selectedDriver.name}</h3>
              <p className="text-slate-600">{selectedDriver.driver_id}</p>
            </div>
            <button
              onClick={() => setSelectedDriver(null)}
              className="text-2xl text-slate-600 hover:text-slate-900"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Performance Metrics</h4>
              <div className="space-y-4">
                <MetricCard label="Punctuality Rate" value={`${selectedDriver.punctuality}%`} color="green" />
                <MetricCard label="Trip Completion" value={`${selectedDriver.trip_completion}%`} color="blue" />
                <MetricCard label="Breakdown Incidents" value={selectedDriver.breakdowns} color="red" />
                <MetricCard label="SOS Events" value={selectedDriver.sos_events} color="red" />
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Summary</h4>
              <div className="space-y-2 text-slate-700">
                <p>✓ Total Trips This Month: <span className="font-bold">180</span></p>
                <p>✓ Average Speed: <span className="font-bold">32 km/h</span></p>
                <p>✓ Customer Rating: <span className="font-bold text-yellow-400">4.7/5</span></p>
                <p>✓ Status: <span className="font-bold text-green-400">Active</span></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceBar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="font-bold text-slate-900">{value}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full"
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  const colorClass =
    color === 'red'
      ? 'text-red-700'
      : color === 'green'
      ? 'text-green-400'
      : 'text-blue-400';

  return (
    <div className="bg-slate-200/50 rounded-lg p-3">
      <p className="text-slate-600 text-sm">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
    </div>
  );
}


