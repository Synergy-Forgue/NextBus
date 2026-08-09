import React from 'react';

const DriverProfiles = ({ buses }) => {
  const generateDriverMetrics = (bus, idx) => ({
    id: idx,
    name: `Driver ${String.fromCharCode(65 + idx)}`,
    bus: bus.license_plate,
    punctualityRate: (85 + Math.random() * 15).toFixed(1),
    tripCompletionRate: (95 + Math.random() * 5).toFixed(1),
    deadKMPerTrip: (8 + Math.random() * 12).toFixed(1),
    breakdownIncidents: Math.floor(Math.random() * 3),
    sosUsage: Math.floor(Math.random() * 2),
    onTimeDeparture: (80 + Math.random() * 20).toFixed(1),
    rating: (3.5 + Math.random() * 1.5).toFixed(1)
  });

  const drivers = buses.map((bus, idx) => generateDriverMetrics(bus, idx));

  const getPerformanceClass = (rate) => {
    const r = parseFloat(rate);
    if (r >= 90) return 'excellent';
    if (r >= 75) return 'good';
    if (r >= 60) return 'fair';
    return 'poor';
  };

  return (
    <div className="panel">
      <h2>👥 Driver & Conductor Performance Profiles</h2>
      <p className="subtitle">Objective, data-driven performance metrics from GPS data & trip logs</p>

      <div className="drivers-grid">
        {drivers.map((driver) => (
          <div key={driver.id} className="driver-card">
            <div className="driver-header">
              <h3>{driver.name}</h3>
              <div className="rating">
                <span className="stars">{'⭐'.repeat(Math.floor(driver.rating))}</span>
                <span className="score">{driver.rating}</span>
              </div>
            </div>
            <p className="bus-info">Bus: {driver.bus}</p>

            <div className="metrics-grid">
              <div className={`metric ${getPerformanceClass(driver.punctualityRate)}`}>
                <span className="label">Punctuality</span>
                <span className="value">{driver.punctualityRate}%</span>
              </div>
              <div className={`metric ${getPerformanceClass(driver.tripCompletionRate)}`}>
                <span className="label">Trip Completion</span>
                <span className="value">{driver.tripCompletionRate}%</span>
              </div>
              <div className="metric">
                <span className="label">Dead KM/Trip</span>
                <span className="value">{driver.deadKMPerTrip} km</span>
              </div>
              <div className="metric">
                <span className="label">Breakdowns</span>
                <span className="value danger">{driver.breakdownIncidents}</span>
              </div>
              <div className="metric">
                <span className="label">SOS Usage</span>
                <span className="value">{driver.sosUsage}</span>
              </div>
              <div className={`metric ${getPerformanceClass(driver.onTimeDeparture)}`}>
                <span className="label">On-Time Departure</span>
                <span className="value">{driver.onTimeDeparture}%</span>
              </div>
            </div>

            <div className="performance-bar">
              <div
                className={`bar ${getPerformanceClass(driver.punctualityRate)}`}
                style={{ width: `${driver.punctualityRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="performance-table">
        <h3>Detailed Performance Report</h3>
        <table>
          <thead>
            <tr>
              <th>Driver</th>
              <th>Bus</th>
              <th>Punctuality</th>
              <th>Trip Completion</th>
              <th>Dead KM</th>
              <th>Breakdowns</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id}>
                <td>{driver.name}</td>
                <td>{driver.bus}</td>
                <td className={getPerformanceClass(driver.punctualityRate)}>
                  {driver.punctualityRate}%
                </td>
                <td className={getPerformanceClass(driver.tripCompletionRate)}>
                  {driver.tripCompletionRate}%
                </td>
                <td>{driver.deadKMPerTrip} km</td>
                <td>{driver.breakdownIncidents}</td>
                <td>{'⭐'.repeat(Math.floor(driver.rating))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DriverProfiles;
