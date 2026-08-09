export const mockDriver = {
  id: 'DRV001',
  name: 'Ravi Kumar',
  phone: '9876543210', // Seeded driver phone that exists in backend
  licenseNo: 'DL01AB1234567',
  yearsExperience: 5,
  rating: 4.8,
  totalTrips: 1250,
  profileImage: null,
};

export const mockBus = {
  id: 'BUS001',
  regNo: 'AP09AB0001',
  capacity: 45,
  makeModel: 'Tata Starbus AC',
  status: 'ACTIVE',
  lat: 17.3850,
  lng: 78.4867,
};

export const mockRoute = {
  id: '9K',
  name: 'Route 9K - Secunderabad to Airport',
  distance: 25.5,
  estimatedTime: 50,
  totalStops: 6,
  fare: 25,
};

export const mockStops = [
  {
    id: 'STOP001',
    name: 'Secunderabad Station',
    order: 1,
    lat: 17.3850,
    lng: 78.4867,
    isServed: false,
  },
  {
    id: 'STOP002',
    name: 'Ameerpet Junction',
    order: 2,
    lat: 17.3744,
    lng: 78.4530,
    isServed: false,
  },
  {
    id: 'STOP003',
    name: 'Begumpet',
    order: 3,
    lat: 17.3650,
    lng: 78.4450,
    isServed: false,
  },
  {
    id: 'STOP004',
    name: 'Banjara Hills',
    order: 4,
    lat: 17.3500,
    lng: 78.4300,
    isServed: false,
  },
  {
    id: 'STOP005',
    name: 'Jubilee Hills',
    order: 5,
    lat: 17.3600,
    lng: 78.4100,
    isServed: false,
  },
  {
    id: 'STOP006',
    name: 'Rajiv Gandhi International Airport',
    order: 6,
    lat: 17.2408,
    lng: 78.4294,
    isServed: false,
  },
];

export const mockConductor = {
  id: 'CON001',
  name: 'Suresh Reddy',
  phone: '+919876543211',
  email: 'suresh@nextbus.com',
};

export const mockEarnings = {
  today: {
    trips: 2,
    revenue: 1500,
    bonus: 225,
    total: 1725,
  },
  week: {
    trips: 12,
    revenue: 8950,
    bonus: 1200,
    total: 10150,
  },
  month: {
    trips: 48,
    revenue: 35900,
    bonus: 4000,
    total: 39900,
  },
};

export const mockTrips = [
  {
    id: 'TRIP001',
    date: new Date(Date.now() - 3600000).toISOString(),
    startStop: 'Secunderabad Station',
    endStop: 'Rajiv Gandhi International Airport',
    passengers: 32,
    revenue: 800,
    distance: 25.5,
    duration: 50,
  },
  {
    id: 'TRIP002',
    date: new Date(Date.now() - 7200000).toISOString(),
    startStop: 'Secunderabad Station',
    endStop: 'Rajiv Gandhi International Airport',
    passengers: 38,
    revenue: 950,
    distance: 25.5,
    duration: 55,
  },
  {
    id: 'TRIP003',
    date: new Date(Date.now() - 86400000).toISOString(),
    startStop: 'Secunderabad Station',
    endStop: 'Rajiv Gandhi International Airport',
    passengers: 41,
    revenue: 1025,
    distance: 25.5,
    duration: 52,
  },
];

export const mockBreakdownIncidents = [
  {
    id: 'INC001',
    date: new Date(Date.now() - 604800000).toISOString(),
    description: 'Engine overheating - resolved at depot',
    status: 'RESOLVED',
    type: 'ENGINE',
  },
  {
    id: 'INC002',
    date: new Date(Date.now() - 1209600000).toISOString(),
    description: 'Tire puncture on highway',
    status: 'RESOLVED',
    type: 'TIRE',
  },
];

export const mockSOSEvents = [
  {
    id: 'SOS001',
    date: new Date(Date.now() - 432000000).toISOString(),
    type: 'Medical',
    description: 'Passenger medical emergency - passenger transported to hospital',
    status: 'RESOLVED',
    lat: 17.3850,
    lng: 78.4867,
  },
  {
    id: 'SOS002',
    date: new Date(Date.now() - 864000000).toISOString(),
    type: 'Safety',
    description: 'Suspicious behavior - Police informed, situation resolved',
    status: 'RESOLVED',
    lat: 17.3744,
    lng: 78.4530,
  },
];
