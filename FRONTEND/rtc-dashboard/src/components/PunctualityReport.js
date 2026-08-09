import React from 'react';

const PunctualityReport = ({ routes }) => {
  const generatePunctualityData = (route) => ({
    routeId: route.id,
    routeNumber: route.route_number,
    routeName: route.route_name,
    onTimePercentage: (70 + Math.random() * 30).toFixed(1),
    avgDelayMinutes: (Math.random() * 15).toFixed(1),
    departureOnTime: (75 + Math.random() * 25).toFixed(1),
    arrivalOnTime: (70 + Math.random() * 25).toFixed(1),
    peakDelayTime: `${Math.floor(Math.random() * 12) + 8}:${Math.floor(Math.random() * 60)
      .toString()
      .padStart(2, '0')} AM`,
    tripsOnTime: Math.floor(Math.random() * 40 + 30),
    tripsLate: Math.floor(Math.random() * 15),
  });

  const punctualityData = routes.map(route => generatePunctualityData(route));

  const getStatusColor = (onTime) => {
    const ot = parseFloat(onTime);
    if (ot >= 85) return 'excellent';
    if (ot >= 70) return 'good';
    if (ot >= 60) return 'fair';
    return 'poor';
  };

  const overallOnTime = (
    punctualityData.reduce((sum, d) => sum + parseFloat(d.onTimePercentage), 0) /
    punctualityData.length
  ).toFixed(1);

  return (
    <div className="panel">
      <h2>⏱️ Punctuality Report</h2>
      <p className="subtitle">Actual vs Scheduled times - Schedule adherence analysis</p>

      <div className="kpi-section">
        <div className="kpi-card large">
          <h3>{overallOnTime}%</h3>
          <p>Overall On-Time Performance</p>
          <span className={`status ${getStatusColor(overallOnTime)}`}>
            {parseFloat(overallOnTime) >= 80 ? '✅ Good' : '⚠️ Needs Attention'}
          </span>
        </div>
      </div>

      <div className="routes-punctuality">
        <h3>Route-wise Punctuality</h3>
        {punctualityData.map((route) => (
          <div key={route.routeId} className="route-punctuality-card">
            <div className="route-header">
              <div>
                <h4>{route.routeNumber}</h4>
                <p>{route.routeName}</p>
              </div>
              <div className="status-badge">
                <span className={`badge ${getStatusColor(route.onTimePercentage)}`}>
                  {route.onTimePercentage}% On-Time
                </span>
              </div>
            </div>

            <div className="punctuality-metrics">
              <div className="metric">
                <span className="label">Departure On-Time</span>
                <span className="value">{route.departureOnTime}%</span>
              </div>
              <div className="metric">
                <span className="label">Arrival On-Time</span>
                <span className="value">{route.arrivalOnTime}%</span>
              </div>
              <div className="metric">
                <span className="label">Avg Delay</span>
                <span className="value">{route.avgDelayMinutes} min</span>
              </div>
              <div className="metric">
                <span className="label">Peak Delay Time</span>
                <span className="value">{route.peakDelayTime}</span>
              </div>
            </div>

            <div className="trip-stats">
              <div className="stat-item">
                <span className="label">On-Time Trips</span>
                <span className="value on-time">{route.tripsOnTime}</span>
              </div>
              <div className="stat-item">
                <span className="label">Late Trips</span>
                <span className="value late">{route.tripsLate}</span>
              </div>
            </div>

            <div className="progress-bar">
              <div
                className={`progress ${getStatusColor(route.onTimePercentage)}`}
                style={{ width: `${route.onTimePercentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="recommendations">
        <h3>📋 Recommendations</h3>
        <ul>
          <li>
            Routes with &lt;70% punctuality need schedule review - adjust timings or frequency
          </li>
          <li>
            Identify peak delay times and consider adding extra buses during those periods
          </li>
          <li>
            Investigate routes with high arrival delays for traffic pattern analysis
          </li>
          <li>
            Reward routes with &gt;90% punctuality performance
          </li>
        </ul>
      </div>

      <div className="summary-table-section">
        <h3>Detailed Summary</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>On-Time %</th>
              <th>Avg Delay</th>
              <th>Departure %</th>
              <th>Arrival %</th>
              <th>On-Time Trips</th>
              <th>Late Trips</th>
            </tr>
          </thead>
          <tbody>
            {punctualityData.map((route) => (
              <tr key={route.routeId}>
                <td>{route.routeNumber}</td>
                <td className={getStatusColor(route.onTimePercentage)}>
                  {route.onTimePercentage}%
                </td>
                <td>{route.avgDelayMinutes} min</td>
                <td>{route.departureOnTime}%</td>
                <td>{route.arrivalOnTime}%</td>
                <td className="on-time">{route.tripsOnTime}</td>
                <td className="late">{route.tripsLate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PunctualityReport;
