import { useEffect, useState } from 'react';
import useCommuterStore from '../store/useCommuterStore';
import { telemetryService } from '../services/telemetryService';

export default function useRealTimeBus() {
  const [isConnected, setIsConnected] = useState(false);
  const busPositions = useCommuterStore((s) => s.busPositions);

  useEffect(() => {
    const unsubscribe = telemetryService.subscribe((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { busPositions, isConnected };
}
