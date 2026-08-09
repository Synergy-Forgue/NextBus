import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const LiveFleetMap = ({ buses }) => {
  const [center] = useState([17.73, 83.30]); // Visakhapatnam center

  const getBusIcon = (status) => {
    const color = status === 'active' ? '#F59E0B' : '#999';
    return L.divIcon({
      className: 'bus-marker',
      html: `<div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px;">🚌</div>`,
      iconSize: [32, 32],
    });
  };

  return (
    <div className="panel">
      <h2>📍 Live Fleet Map</h2>
      <p className="subtitle">Real-time tracking of all active buses</p>

      <div className="stats-row">
        <div className="stat-card">
          <h4>{buses.filter(b => b).length}</h4>
          <p>Active Buses</p>
        </div>
        <div className="stat-card">
          <h4>{buses.reduce((sum, b) => sum + (b?.occupancy_count || 0), 0)}</h4>
          <p>Total Passengers</p>
        </div>
        <div className="stat-card">
          <h4>{(buses.reduce((sum, b) => sum + (b?.speed || 0), 0) / (buses.length || 1)).toFixed(1)} km/h</h4>
          <p>Avg Speed</p>
        </div>
      </div>

      <div className="map-container" style={{ height: '600px', width: '100%' }}>
        <MapContainer center={center} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {buses.length > 0 ? (
            buses.map((bus, idx) => (
              bus && (
                <Marker
                  key={idx}
                  position={[bus.latitude, bus.longitude]}
                  icon={getBusIcon(bus.status)}
                >
                  <Popup>
                    <div>
                      <h4>{bus.license_plate}</h4>
                      <p><strong>Route:</strong> {bus.route_id}</p>
                      <p><strong>Speed:</strong> {bus.speed.toFixed(1)} km/h</p>
                      <p><strong>Occupancy:</strong> {bus.occupancy_count} passengers</p>
                      <p><strong>ETA Confidence:</strong> {(bus.vision_confidence_score * 100).toFixed(0)}%</p>
                      <p><strong>Updated:</strong> {new Date(bus.last_updated).toLocaleTimeString()}</p>
                    </div>
                  </Popup>
                </Marker>
              )
            ))
          ) : (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
              <p style={{ margin: 0, color: '#999', textAlign: 'center' }}>No buses connected yet</p>
              <p style={{ margin: '10px 0 0 0', color: '#bbb', fontSize: '0.9em', textAlign: 'center' }}>Start the backend and driver app to see live tracking</p>
            </div>
          )}
        </MapContainer>
      </div>

      <div className="bus-list">
        <h3>Bus Details</h3>
        <table>
          <thead>
            <tr>
              <th>License Plate</th>
              <th>Route</th>
              <th>Location</th>
              <th>Speed</th>
              <th>Occupancy</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus, idx) => (
              bus && (
                <tr key={idx}>
                  <td>{bus.license_plate}</td>
                  <td>Route {bus.route_id}</td>
                  <td>{bus.latitude.toFixed(4)}, {bus.longitude.toFixed(4)}</td>
                  <td>{bus.speed.toFixed(1)} km/h</td>
                  <td>{bus.occupancy_count}/50</td>
                  <td>{new Date(bus.last_updated).toLocaleTimeString()}</td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveFleetMap;
