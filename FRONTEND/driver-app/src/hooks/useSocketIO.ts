import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketOptions {
  url: string;
  driverId: string;
  token?: string;
}

export const useSocketIO = (options: SocketOptions | null) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options) return;

    try {
      // Initialize Socket.IO connection
      socketRef.current = io(options.url, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        extraHeaders: {
          Authorization: `Bearer ${options.token || ''}`,
        },
        query: {
          driverId: options.driverId,
        },
      });

      // Connection event handlers
      socketRef.current.on('connect', () => {
        console.log('[Socket.IO] Connected to server');
        setIsConnected(true);
        setError(null);
      });

      socketRef.current.on('disconnect', () => {
        console.log('[Socket.IO] Disconnected from server');
        setIsConnected(false);
      });

      socketRef.current.on('error', (err) => {
        console.error('[Socket.IO] Error:', err);
        setError(err.message || 'Socket connection error');
      });

      // Server acknowledgments
      socketRef.current.on('location:received', (data) => {
        console.log('[Socket.IO] Location update acknowledged:', data);
      });

      socketRef.current.on('sos:received', (data) => {
        console.log('[Socket.IO] SOS acknowledged:', data);
      });

      socketRef.current.on('breakdown:received', (data) => {
        console.log('[Socket.IO] Breakdown alert acknowledged:', data);
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize Socket.IO';
      setError(errorMsg);
      console.error('[Socket.IO] Initialization error:', errorMsg);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [options]);

  // Emit location update to server
  const emitLocationUpdate = (locationData: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    accuracy: number;
    timestamp: number;
  }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('bus:location-update', {
        ...locationData,
        driverId: options?.driverId,
      });
    }
  };

  // Emit SOS alert
  const emitSOSAlert = (sosData: {
    latitude: number;
    longitude: number;
    busId: string;
    busNumber: string;
    route: string;
    driverId: string;
  }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('sos:emergency', sosData);
    }
  };

  // Emit breakdown alert
  const emitBreakdownAlert = (breakdownData: {
    latitude: number;
    longitude: number;
    busId: string;
    busNumber: string;
    route: string;
    driverId: string;
    description: string;
  }) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('bus:breakdown', breakdownData);
    }
  };

  // Subscribe to a route channel
  const subscribeToRoute = (routeId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('route:subscribe', { routeId });
    }
  };

  // Unsubscribe from a route channel
  const unsubscribeFromRoute = (routeId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('route:unsubscribe', { routeId });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emitLocationUpdate,
    emitSOSAlert,
    emitBreakdownAlert,
    subscribeToRoute,
    unsubscribeFromRoute,
  };
};
