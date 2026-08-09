import React, { useState } from 'react';

const RouteGapDetector = ({ buses, routes }) => {
  const [alerts, setAlerts] = useState(() => {
    // Generate simulated alerts
    return [
      {
        id: 1,
        type: 'bus-bunching',
        route: routes[0]?.route_number || '10K',
        severity: 'high',
        time: new Date(Date.now() - 5 * 60000).toLocaleTimeString(),
        description: 'Multiple buses clustered together on Route 10K',
        buses: ['BUS001', 'BUS002'],
        message: '2 buses bunched within 2km creating service gap',
      },
      {
        id: 2,
        type: 'service-gap',
        route: routes[1]?.route_number || '900K',
        severity: 'medium',
        time: new Date(Date.now() - 15 * 60000).toLocaleTimeString(),
        description: 'Abnormally long interval between buses on Route 900K',
        gap: '22 minutes',
        message: 'Service gap of 22 minutes - normal is 15 minutes',
      },
      {
        id: 3,
        type: 'service-gap',
        route: routes[2]?.route_number || '28K',
        severity: 'low',
        time: new Date(Date.now() - 30 * 60000).toLocaleTimeString(),
        description: 'Slight service gap on Route 28K',
        gap: '18 minutes',
        message: 'Service gap of 18 minutes - approaching threshold',
      },
    ];
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return '#FF6B6B';
      case 'medium':
        return '#FFA500';
      case 'low':
        return '#FFD93D';
      default:
        return '#999';
    }
  };

  const dismissAlert = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const criticalAlerts = alerts.filter(a => a.severity === 'high');
  const warningAlerts = alerts.filter(a => a.severity === 'medium');
  const infoAlerts = alerts.filter(a => a.severity === 'low');

  return (
    <div className="panel">
      <h2>🚨 Route Gap Detector</h2>
      <p className="subtitle">Real-time detection of bus bunching and service gaps</p>

      <div className="alert-summary">
        <div className="summary-card critical">
          <h4>{criticalAlerts.length}</h4>
          <p>Critical Issues</p>
        </div>
        <div className="summary-card warning">
          <h4>{warningAlerts.length}</h4>
          <p>Warnings</p>
        </div>
        <div className="summary-card info">
          <h4>{infoAlerts.length}</h4>
          <p>Info</p>
        </div>
        <div className="summary-card total">
          <h4>{alerts.length}</h4>
          <p>Total Alerts</p>
        </div>
      </div>

      <div className="alerts-section">
        {alerts.length === 0 ? (
          <div className="no-alerts">
            <h3>✅ All Clear!</h3>
            <p>No bus bunching or service gaps detected</p>
          </div>
        ) : (
          <>
            {criticalAlerts.length > 0 && (
              <div className="alert-group critical">
                <h3>🔴 Critical - Immediate Action Required</h3>
                {criticalAlerts.map((alert) => (
                  <div key={alert.id} className="alert-item critical">
                    <div className="alert-content">
                      <h4>{alert.description}</h4>
                      <p className="alert-message">{alert.message}</p>
                      {alert.buses && (
                        <p className="buses-involved">
                          Buses involved: {alert.buses.join(', ')}
                        </p>
                      )}
                      <p className="timestamp">Detected: {alert.time}</p>
                    </div>
                    <button
                      className="dismiss-btn"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {warningAlerts.length > 0 && (
              <div className="alert-group warning">
                <h3>🟠 Warning - Monitor Closely</h3>
                {warningAlerts.map((alert) => (
                  <div key={alert.id} className="alert-item warning">
                    <div className="alert-content">
                      <h4>{alert.description}</h4>
                      <p className="alert-message">{alert.message}</p>
                      <p className="gap-info">Gap: {alert.gap}</p>
                      <p className="timestamp">Detected: {alert.time}</p>
                    </div>
                    <button
                      className="dismiss-btn"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {infoAlerts.length > 0 && (
              <div className="alert-group info">
                <h3>🟡 Info - Approaching Threshold</h3>
                {infoAlerts.map((alert) => (
                  <div key={alert.id} className="alert-item info">
                    <div className="alert-content">
                      <h4>{alert.description}</h4>
                      <p className="alert-message">{alert.message}</p>
                      <p className="gap-info">Gap: {alert.gap}</p>
                      <p className="timestamp">Detected: {alert.time}</p>
                    </div>
                    <button
                      className="dismiss-btn"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="gap-detection-info">
        <h3>📊 How Gap Detection Works</h3>
        <div className="info-cards">
          <div className="info-card">
            <h4>🚌 Bus Bunching</h4>
            <p>
              Detected when multiple buses on the same route cluster within 2km,
              indicating they're moving together and creating service gaps elsewhere.
            </p>
          </div>
          <div className="info-card">
            <h4>⏱️ Service Gaps</h4>
            <p>
              Flagged when interval between consecutive buses exceeds 20 minutes
              (configurable per route). Indicates insufficient frequency or schedule
              adherence issues.
            </p>
          </div>
          <div className="info-card">
            <h4>📍 Real-Time Powered</h4>
            <p>
              Analysis runs continuously on GPS telemetry from the Driver App.
              Alerts generated instantly when thresholds breached, enabling immediate
              corrective action.
            </p>
          </div>
          <div className="info-card">
            <h4>✅ Automated Resolution</h4>
            <p>
              Depot managers receive alerts and can dispatch extra buses or hold buses
              at stops to redistribute service and eliminate detected gaps.
            </p>
          </div>
        </div>
      </div>

      <div className="recommendations">
        <h3>💡 Corrective Actions</h3>
        <ul>
          <li>
            <strong>Bus Bunching:</strong> Hold lead bus at next stop for 5 minutes to
            allow following bus to catch up
          </li>
          <li>
            <strong>Service Gaps:</strong> Dispatch nearest available bus to cover the
            gap route
          </li>
          <li>
            <strong>Recurring Issues:</strong> Review schedule frequency and adjust
            timetables
          </li>
          <li>
            <strong>Peak Hours:</strong> Pre-position extra buses during known high-demand
            periods
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RouteGapDetector;

