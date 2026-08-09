export type Language = 'en' | 'te' | 'kn';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Tabs
    home: 'Home',
    map: 'Map',
    alerts: 'Alerts',
    profile: 'Profile',

    // Home
    whereToday: 'Where to today?',
    findRoutes: 'Find Routes →',
    from: 'From...',
    to: 'To...',
    smartPicks: 'Smart Picks',
    savedRoutes: 'Your Saved Routes',
    transitUpdates: 'Transit Updates',
    activeBuses: 'Active Buses',
    avgWait: 'Avg Wait',
    occupancy: 'Occupancy',

    // Route Results
    eta: 'ETA',
    crowd: 'Crowd',
    fare: 'Fare',
    femaleOnly: 'Female Only',
    frequent: 'Frequent',
    lastUsed: 'Last used',

    // Map
    liveLocation: 'Live',
    shareTrip: 'Share Trip',
    distance: 'away',

    // Safety
    sos: 'SOS',
    tripSharing: 'Trip Sharing',
    shareYourTrip: 'Share Your Trip',
    sharingActive: 'Sharing Active',
    trustedContacts: 'Trusted Contacts',
    addContact: 'Add Contact',
    leaveIn: 'Leave in',
    minutes: 'minutes',

    // Alerts
    pushNotifications: 'Push Notifications',
    recentUpdates: 'Recent Updates',
    noUpdates: 'No service updates right now 🎉',
    breakdown: 'Breakdown',
    emergency: 'Emergency',
    resolved: 'Resolved',

    // Profile
    trips: 'Trips',
    hours: 'Hours',
    co2Saved: 'CO₂ Saved',
    settings: 'Settings',
    language: 'Language',
    darkMode: 'Dark Mode',
    logout: 'Logout',
    safetyTips: 'Safety Tips',

    // Report Card
    weeklyReport: 'Weekly Report',
    yourTransitWeek: 'Your Transit Week',
    timeSaved: 'Time Saved',
    onTimeRate: 'On-Time Rate',
    mostReliableRoute: 'Most Reliable Route',

    // Smart Alerts
    smartAlerts: 'Smart Alerts',
    aiProactiveAlerts: 'AI-Proactive Alerts',
    customAlarm: 'Custom Alarm',

    // Buttons
    verify: 'Verify & Continue',
    sendOtp: 'Send OTP',
    getStarted: 'Get Started →',
    done: 'Done',
    cancel: 'Cancel & Return',
    yes: 'Yes',
    no: 'No',

    // Messages
    establishing: 'Establishing connection...',
    contactsMessage: 'Who can see your trip',
    leaveMessage: 'to catch Bus',
  },

  te: {
    // Tabs
    home: 'హోమ్',
    map: 'మ్యాప్',
    alerts: 'హెచ్చరికలు',
    profile: 'ప్రొఫైల్',

    // Home
    whereToday: 'ఈ రోజు ఎక్కడికి?',
    findRoutes: 'మార్గాలు కనుగొనండి →',
    from: 'నుండి...',
    to: 'వరకు...',
    smartPicks: 'స్మార్ట్ ఎంపికలు',
    savedRoutes: 'మీ సংরక్షిత మార్గాలు',
    transitUpdates: 'ట్రాన్సిట్ నవీకరణలు',
    activeBuses: 'సक్రియ బస్సులు',
    avgWait: 'సగటు సమయం',
    occupancy: 'ఆక్యుపెన్సీ',

    // Route Results
    eta: 'విస్తృతమైన సమయం',
    crowd: 'ఆలోచన',
    fare: 'ఛార్జ్',
    femaleOnly: 'మహిళలకు మాత్రమే',
    frequent: 'తరచుగా',
    lastUsed: 'చివరిసారి ఉపయోగించినది',

    // Map
    liveLocation: 'లైవ్',
    shareTrip: 'ట్రిప్ భాగస్వామ్యం చేయండి',
    distance: 'దూరం',

    // Safety
    sos: 'ఎస్‌ఓ‌ఎస్',
    tripSharing: 'ట్రిప్ భాగస్వామ్యం',
    shareYourTrip: 'మీ ట్రిప్ భాగస్వామ్యం చేయండి',
    sharingActive: 'భాగస్వామ్యం చేస్తోంది',
    trustedContacts: 'విశ్వస్త సంప్రదాయాలు',
    addContact: 'సంప్రదాయం చేర్చండి',
    leaveIn: 'లో వెళ్ళండి',
    minutes: 'నిమిషాలు',

    // Alerts
    pushNotifications: 'పుష్ సూచనలు',
    recentUpdates: 'ఇటీవల నవీకరణలు',
    noUpdates: 'ప్రస్తుతం సేవ నవీకరణలు లేవు 🎉',
    breakdown: 'విచ్ఛిన్నమైనది',
    emergency: 'అత్యవసర',
    resolved: 'పరిష్కరించినది',

    // Profile
    trips: 'ట్రిప్‌లు',
    hours: 'గంటలు',
    co2Saved: 'CO₂ ఆదా చేయబడింది',
    settings: 'సెట్టింగ్‌లు',
    language: 'భాష',
    darkMode: 'ఫ్లాష్',
    logout: 'లాగ్ అవుట్',
    safetyTips: 'సురక్షత చిట్కాలు',

    // Report Card
    weeklyReport: 'వారపత్రిక నివేదిక',
    yourTransitWeek: 'మీ ట్రాన్సిట్ వారం',
    timeSaved: 'సమయం ఆదా చేయబడింది',
    onTimeRate: 'సమయానికి రేటు',
    mostReliableRoute: 'చాలా నమ్మదగిన మార్గం',

    // Smart Alerts
    smartAlerts: 'స్మార్ట్ హెచ్చరికలు',
    aiProactiveAlerts: 'AI-ప్రోయాక్టివ్ హెచ్చరికలు',
    customAlarm: 'కస్టమ్ అలారం',

    // Buttons
    verify: 'ధృవీకరించండి & కొనసాగండి',
    sendOtp: 'OTP పంపండి',
    getStarted: 'ప్రారంభించండి →',
    done: 'సరి',
    cancel: 'రద్దు చేయండి',
    yes: 'అవును',
    no: 'లేదు',

    // Messages
    establishing: 'సংযోగం ఏర్పరుస్తోంది...',
    contactsMessage: 'మీ ట్రిప్ చూడగలిగినవారు',
    leaveMessage: 'బస్సు పట్టుకోవడానికి',
  },

  kn: {
    // Tabs
    home: 'ಮುಖ್ಯ ಪುಟ',
    map: 'ನಕ್ಷೆ',
    alerts: 'ಸೂಚನೆಗಳು',
    profile: 'ಪ್ರೊಫೈಲ್',

    // Home
    whereToday: 'ಈ ಹೊತ್ತು ಎಲ್ಲಿಗೆ?',
    findRoutes: 'ಮಾರ್ಗಗಳನ್ನು ಹುಡುಕಿ →',
    from: 'ಇಂದ...',
    to: 'ವರೆಗೆ...',
    smartPicks: 'ಸ್ಮಾರ್ಟ್ ಆಯ್ಕೆಗಳು',
    savedRoutes: 'ನಿಮ್ಮ ಉಳಿಸಿಕೊಂಡ ಮಾರ್ಗಗಳು',
    transitUpdates: 'ಸಾರಿಗೆ ನವೀಕರಣಗಳು',
    activeBuses: 'ಸಕ್ರಿಯ ಬಸ್‌ಗಳು',
    avgWait: 'ಸರಾಸರಿ ಸಮಯ',
    occupancy: 'ವಾಸ್ತವ್ಯ',

    // Route Results
    eta: 'ನಿರೀಕ್ಷಿತ ಸಮಯ',
    crowd: 'ಜನಸಂದಣಿ',
    fare: 'ಪ್ರವಾಸ ಶುಲ್ಕ',
    femaleOnly: 'ಕೇವಲ ಮಹಿಳೆಗಳಿಂದ',
    frequent: 'ನಿರಂತರ',
    lastUsed: 'ಕೊನೆಯ ಬಾರಿ ಬಳಸಿಕೊಂಡಿದೆ',

    // Map
    liveLocation: 'ಲೈವ್',
    shareTrip: 'ಯಾತ್ರೆ ಹಂಚಿಕೊಳ್ಳಿ',
    distance: 'ದೂರ',

    // Safety
    sos: 'SOS',
    tripSharing: 'ಯಾತ್ರೆ ಹಂಚಿಕೊಳ್ಳುವಿಕೆ',
    shareYourTrip: 'ನಿಮ್ಮ ಯಾತ್ರೆ ಹಂಚಿಕೊಳ್ಳಿ',
    sharingActive: 'ಸಕ್ರಿಯವಾಗಿ ಹಂಚಿಕೊಳ್ಳುತ್ತಿರುವೆ',
    trustedContacts: 'ವಿಶ್ವಾಸಾರ್ಹ ಸಂಪರ್ಕಗಳು',
    addContact: 'ಸಂಪರ್ಕ ಸೇರಿಸಿ',
    leaveIn: 'ಹೊರಹೋಗಿ',
    minutes: 'ನಿಮಿಷಗಳು',

    // Alerts
    pushNotifications: 'ಪುಶ್ ಸೂಚನೆಗಳು',
    recentUpdates: 'ಇತ್ತೀಚಿನ ನವೀಕರಣಗಳು',
    noUpdates: 'ಸದ್ಯ ಸೇವೆ ನವೀಕರಣಗಳಿಲ್ಲ 🎉',
    breakdown: 'ವಿಭಜನೆ',
    emergency: 'ತುರ್ತು',
    resolved: 'ಪರಿಹರಿಸಲಾದ',

    // Profile
    trips: 'ಯಾತ್ರೆಗಳು',
    hours: 'ಘಂಟೆಗಳು',
    co2Saved: 'CO₂ ಸಾಷ್ಟ ಆಯೋಜನೆ',
    settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    language: 'ಭಾಷೆ',
    darkMode: 'ಕತ್ತಲೆ',
    logout: 'ಲಾಗ್ ಔಟ್',
    safetyTips: 'ಸುರಕ್ಷತೆ ಸುಳುವುಗಳು',

    // Report Card
    weeklyReport: 'ಸಾಪ್ತಾಹಿಕ ವರದಿ',
    yourTransitWeek: 'ನಿಮ್ಮ ಸಾರಿಗೆ ಸಾಪ್ತಾಹ',
    timeSaved: 'ಸಮಯ ಸಿದ್ಧವಾಗಿರುವೆ',
    onTimeRate: 'ಸಮಯಮತ್ತ ಪ್ರಮಾಣ',
    mostReliableRoute: 'ಅತ್ಯಂತ ವಿಶ್ವಾಸಾರ್ಹ ಮಾರ್ಗ',

    // Smart Alerts
    smartAlerts: 'ಸ್ಮಾರ್ಟ್ ಸೂಚನೆಗಳು',
    aiProactiveAlerts: 'AI-ಪ್ರೊಯಾಕ್ಟಿವ್ ಸೂಚನೆಗಳು',
    customAlarm: 'ಕಸ್ಟಮ್ ಅಲಾರಂ',

    // Buttons
    verify: 'ಪರಿಶೀಲಿಸಿ & ಮುಂದುವರಿಯಿರಿ',
    sendOtp: 'OTP ಕಳುಹಿಸಿ',
    getStarted: 'ಪ್ರಾರಂಭಿಸಿ →',
    done: 'ಮುಗ್ಗರಿಸಲಾಗಿದೆ',
    cancel: 'ರದ್ದುಗೊಳಿಸಿ',
    yes: 'ಹೌದು',
    no: 'ಇಲ್ಲ',

    // Messages
    establishing: 'ಸಂಪರ್ಕ ಸ್ಥಾಪಿಸುತ್ತಿರುವೆ...',
    contactsMessage: 'ನಿಮ್ಮ ಯಾತ್ರೆ ಜೀವಂತ ದೃಷ್ಟಿಕೋನ',
    leaveMessage: 'ಬಸ್ ಹಿಡಿಯಲು',
  },
};

export const getTranslation = (key: string, language: Language): string => {
  return translations[language]?.[key] || translations['en']?.[key] || key;
};
