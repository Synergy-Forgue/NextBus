import React from 'react';

const RouteProfitability = ({ routes, buses }) => {
  const calculateProfitability = (route) => {
    const busesOnRoute = buses.filter(b => b?.route_id === route.id) || [];
    const avgOccupancy = busesOnRoute.length > 0
      ? busesOnRoute.reduce((sum, b) => sum + (b.occupancy_count || 0), 0) / busesOnRoute.length
      : 0;

    // Simplified revenue calculation: ~₹20 per passenger
    const revenue = avgOccupancy * 20;
    // Simplified cost: ₹500 per trip + fuel
    const cost = 500 + (busesOnRoute.length * 15);
    const profit = revenue - cost;

    return {
      revenue: Math.round(revenue),
      cost: Math.round(cost),
      profit: Math.round(profit),
      status: profit > 0 ? 'profitable' : 'loss',
      avgOccupancy: avgOccupancy.toFixed(0)
    };
  };

  return (
    <div className="panel">
      <h2>💰 Route Profitability Analysis</h2>
      <p className="subtitle">P&L indicator per route based on occupancy and trip logs</p>

      <div className="profitability-cards">
        {routes.map((route) => {
          const prof = calculateProfitability(route);
          return (
            <div key={route.id} className={`profitability-card ${prof.status}`}>
              <div className="route-header">
                <h3>{route.route_number}</h3>
                <span className={`status-badge ${prof.status}`}>
                  {prof.status === 'profitable' ? '📈 Profitable' : '📉 Loss'}
                </span>
              </div>
              <p className="route-name">{route.route_name}</p>

              <div className="metrics">
                <div className="metric">
                  <span className="label">Revenue</span>
                  <span className="value revenue">₹{prof.revenue}</span>
                </div>
                <div className="metric">
                  <span className="label">Cost</span>
                  <span className="value cost">₹{prof.cost}</span>
                </div>
                <div className="metric">
                  <span className="label">Net Profit/Loss</span>
                  <span className={`value ${prof.status}`}>₹{prof.profit}</span>
                </div>
                <div className="metric">
                  <span className="label">Avg Occupancy</span>
                  <span className="value">{prof.avgOccupancy}%</span>
                </div>
              </div>

              <div className="profit-bar">
                <div
                  className={`bar ${prof.status}`}
                  style={{ width: `${Math.min(Math.abs(prof.profit) / 500 * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="summary-section">
        <h3>Summary</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Revenue</th>
              <th>Cost</th>
              <th>Profit/Loss</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => {
              const prof = calculateProfitability(route);
              return (
                <tr key={route.id}>
                  <td>{route.route_number}</td>
                  <td>₹{prof.revenue}</td>
                  <td>₹{prof.cost}</td>
                  <td className={prof.status}>₹{prof.profit}</td>
                  <td><span className={`badge ${prof.status}`}>{prof.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RouteProfitability;
