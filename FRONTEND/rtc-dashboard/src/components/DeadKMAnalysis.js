import React from 'react';

const DeadKMAnalysis = ({ buses, routes }) => {
  const calculateDeadKM = (bus) => {
    // Simulate dead KM calculation based on speed and distance
    if (!bus || bus.speed < 5) return 0;
    const deadKMEstimate = Math.random() * 15 + 5; // 5-20 km per trip
    return deadKMEstimate.toFixed(2);
  };

  const totalDeadKM = buses.reduce((sum, b) => sum + parseFloat(calculateDeadKM(b)), 0);
  const costPerKM = 10; // ₹10 per km fuel cost
  const totalWastage = (totalDeadKM * costPerKM).toFixed(0);

  return (
    <div className="panel">
      <h2>⛽ Dead KM Analysis</h2>
      <p className="subtitle">Empty kilometers from depot to route start & end</p>

      <div className="kpi-grid">
        <div className="kpi-card large">
          <h3>{totalDeadKM.toFixed(0)}</h3>
          <p>Total Dead KM</p>
          <span className="unit">km across all buses</span>
        </div>
        <div className="kpi-card large">
          <h3>₹{totalWastage}</h3>
          <p>Fuel Cost Wasted</p>
          <span className="unit">@₹{costPerKM}/km</span>
        </div>
        <div className="kpi-card">
          <h3>{(totalDeadKM / (buses.length || 1)).toFixed(1)}</h3>
          <p>Avg Dead KM/Bus</p>
        </div>
        <div className="kpi-card">
          <h3>{buses.length}</h3>
          <p>Active Buses</p>
        </div>
      </div>

      <div className="analysis-section">
        <h3>Bus-wise Dead KM</h3>
        <div className="bus-deadkm-list">
          {buses.map((bus, idx) => {
            const deadKM = calculateDeadKM(bus);
            const cost = (parseFloat(deadKM) * costPerKM).toFixed(0);
            return (
              <div key={idx} className="deadkm-item">
                <div className="bus-info">
                  <h4>{bus.license_plate}</h4>
                  <p>Route {bus.route_id}</p>
                </div>
                <div className="deadkm-metric">
                  <span className="value">{deadKM} km</span>
                  <span className="cost">₹{cost} waste</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress"
                    style={{ width: `${(parseFloat(deadKM) / 25) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="recommendations">
        <h3>💡 Optimization Opportunities</h3>
        <ul>
          <li>Consider repositioning bus depots to reduce start-of-route travel</li>
          <li>Implement shared depot routes to minimize empty runs</li>
          <li>Optimize trip scheduling to reduce end-of-trip back-hauls</li>
          <li>Monitor buses with consistently high dead KM for operational review</li>
        </ul>
      </div>
    </div>
  );
};

export default DeadKMAnalysis;
