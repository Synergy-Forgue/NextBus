/**
 * busMeta.ts — Transit Service Directory & Vehicle Metadata
 * Inspired by Odisha's CRUT Ama Bus / Mo Bus design system.
 */

export interface BusServiceMeta {
  routeNumber: string;
  serviceName: string;
  serviceType: 'AC Electric' | 'AC Deluxe' | 'City Express' | 'Feeder Shuttle' | 'Heritage Special';
  badgeColor: string;
  agency: 'APSRTC' | 'KSRTC';
  depot: string;
  defaultPlate: string;
  fareStarting: number;
  frequencyMins: number;
  features: string[];
}

export const BUS_SERVICES: Record<string, BusServiceMeta> = {
  // ─── Visakhapatnam Network (APSRTC) ─────────────────────────────
  '10K': {
    routeNumber: '10K',
    serviceName: 'Metro Express',
    serviceType: 'City Express',
    badgeColor: '#4338CA',
    agency: 'APSRTC',
    depot: 'Maddilapalem Central Depot',
    defaultPlate: 'AP 31 Z 1011',
    fareStarting: 15,
    frequencyMins: 8,
    features: ['Live GPS', 'CCTV Surveillance', 'Digital Ticketing', 'Women Section'],
  },
  '900K': {
    routeNumber: '900K',
    serviceName: 'Coastal Rider Deluxe',
    serviceType: 'AC Deluxe',
    badgeColor: '#0284C7',
    agency: 'APSRTC',
    depot: 'Waltair Beach Depot',
    defaultPlate: 'AP 31 Z 9002',
    fareStarting: 25,
    frequencyMins: 15,
    features: ['❄️ AC Climate Control', '🌊 Sea View Seating', 'USB Charging', '10Hz GPS'],
  },
  '28K': {
    routeNumber: '28K',
    serviceName: 'Steel City Express',
    serviceType: 'City Express',
    badgeColor: '#059669',
    agency: 'APSRTC',
    depot: 'Gajuwaka Industrial Depot',
    defaultPlate: 'AP 31 Z 2803',
    fareStarting: 20,
    frequencyMins: 10,
    features: ['High Frequency', 'Luggage Space', 'Smart Card Tap', 'CCTV'],
  },
  '55T': {
    routeNumber: '55T',
    serviceName: 'Industrial Corridor Flyer',
    serviceType: 'City Express',
    badgeColor: '#D97706',
    agency: 'APSRTC',
    depot: 'Kurmannapalem Depot',
    defaultPlate: 'AP 31 Z 5504',
    fareStarting: 20,
    frequencyMins: 12,
    features: ['Direct Highway Route', 'Low Floor Entry', 'GPS Fleet Tracking'],
  },
  '300N': {
    routeNumber: '300N',
    serviceName: 'Hilltop City Connector',
    serviceType: 'Feeder Shuttle',
    badgeColor: '#7C3AED',
    agency: 'APSRTC',
    depot: 'Simhachalam Transit Hub',
    defaultPlate: 'AP 31 Z 3005',
    fareStarting: 15,
    frequencyMins: 15,
    features: ['Hill Station Suspension', 'Panoramic Glass', 'Digital Pass'],
  },

  // ─── Mysuru Network (KSRTC) ─────────────────────────────────────
  '201M': {
    routeNumber: '201M',
    serviceName: 'Chamundi Heritage Line',
    serviceType: 'AC Electric',
    badgeColor: '#6366F1',
    agency: 'KSRTC',
    depot: 'Mysuru City Depot 1 (CBS)',
    defaultPlate: 'KA 09 F 2011',
    fareStarting: 20,
    frequencyMins: 10,
    features: ['⚡ 100% Electric EV', '❄️ Pure AC', 'Regenerative Braking', 'Silent Drive'],
  },
  '150M': {
    routeNumber: '150M',
    serviceName: 'City Metro Feeder',
    serviceType: 'Feeder Shuttle',
    badgeColor: '#0EA5E9',
    agency: 'KSRTC',
    depot: 'Kuvempunagar Sub-Depot',
    defaultPlate: 'KA 09 F 1501',
    fareStarting: 15,
    frequencyMins: 8,
    features: ['Frequent Stops', 'Low Floor', 'Senior Citizen Seating', 'Live ETA'],
  },
  '303M': {
    routeNumber: '303M',
    serviceName: 'Palace Circular Express',
    serviceType: 'Heritage Special',
    badgeColor: '#8B5CF6',
    agency: 'KSRTC',
    depot: 'Bannimantap Depot',
    defaultPlate: 'KA 09 F 3031',
    fareStarting: 15,
    frequencyMins: 12,
    features: ['Heritage Corridor', 'Tourist Audio Guide', 'Clean Air Verified'],
  },
  '412M': {
    routeNumber: '412M',
    serviceName: 'IT Corridor Shuttle',
    serviceType: 'City Express',
    badgeColor: '#10B981',
    agency: 'KSRTC',
    depot: 'Hootagalli Tech Terminal',
    defaultPlate: 'KA 09 F 4121',
    fareStarting: 20,
    frequencyMins: 10,
    features: ['⚡ Express Tech Transit', 'Wi-Fi Hotspot', 'Fast Boarding Doors'],
  },
  '307M': {
    routeNumber: '307M',
    serviceName: 'Royal Intercity Liner',
    serviceType: 'AC Deluxe',
    badgeColor: '#E11D48',
    agency: 'KSRTC',
    depot: 'Sub Urban Terminal',
    defaultPlate: 'KA 09 F 3071',
    fareStarting: 25,
    frequencyMins: 15,
    features: ['❄️ AC Deluxe', 'Reclining Seats', 'Intercity Fast Track'],
  },
};

export function getBusService(routeNumber?: string): BusServiceMeta {
  const clean = (routeNumber || '').toUpperCase().trim();
  return (
    BUS_SERVICES[clean] || {
      routeNumber: clean || '10K',
      serviceName: `${clean || 'Line'} Transit Line`,
      serviceType: 'City Express',
      badgeColor: '#4338CA',
      agency: 'APSRTC',
      depot: 'Central Transit Depot',
      defaultPlate: 'AP 31 Z 9999',
      fareStarting: 15,
      frequencyMins: 10,
      features: ['Live GPS', 'Digital Ticketing'],
    }
  );
}

export function formatBusPlate(plate?: string, routeNumber?: string): string {
  if (!plate || plate.startsWith('BUS00')) {
    const meta = getBusService(routeNumber);
    return meta.defaultPlate;
  }
  return plate.replace(/-/g, ' ').toUpperCase();
}
