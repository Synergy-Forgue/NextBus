import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import useCommuterStore from '../store/useCommuterStore'
import { BRAND } from '../styles/brand'

// Auth / intro flow
import SplashScreen from '../screens/SplashScreen'
import OnboardingScreen from '../screens/OnboardingScreen'
import LoginScreen from '../screens/LoginScreen'
import OTPScreen from '../screens/OTPScreen'

// Main tabs (Figma bottom nav: Home · Map · Search · Alerts · Profile)
import HomeDashboardScreen from '../screens/HomeDashboardScreen'
import HomeMapScreen from '../screens/HomeMapScreen'
import SearchRoutesScreen from '../screens/SearchRoutesScreen'
import ActiveAlertsScreen from '../screens/ActiveAlertsScreen'
import ProfileScreen from '../screens/ProfileScreen'

// Modals / detail screens
import SOSScreen from '../screens/SOSScreen'
import BusDetailsScreen from '../screens/BusDetailsScreen'
import SetAlertScreen from '../screens/SetAlertScreen'
import SavedRoutesScreen from '../screens/SavedRoutesScreen'
import TrustedContactsScreen from '../screens/TrustedContactsScreen'
import BusReportCardScreen from '../screens/BusReportCardScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.primary,
        tabBarInactiveTintColor: BRAND.textTertiary,
        tabBarStyle: {
          backgroundColor: BRAND.surface,
          borderTopWidth: 1,
          borderTopColor: BRAND.surfaceMuted,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeDashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={HomeMapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchRoutesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={ActiveAlertsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="notifications-none" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

export default function RootNavigator() {
  const { userProfile } = useCommuterStore()
  const isLoggedIn = !!(userProfile && userProfile.id)

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OTP" component={OTPScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="App" component={AppTabs} />
          <Stack.Group
            screenOptions={{
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          >
            <Stack.Screen name="SOS" component={SOSScreen} />
          </Stack.Group>
          <Stack.Group screenOptions={{ presentation: 'modal', headerShown: true }}>
            <Stack.Screen
              name="BusDetails"
              component={BusDetailsScreen}
              options={{ title: 'Bus Details' }}
            />
            <Stack.Screen
              name="SetAlert"
              component={SetAlertScreen}
              options={{ title: 'Set Alert' }}
            />
            <Stack.Screen
              name="SavedRoutes"
              component={SavedRoutesScreen}
              options={{ title: 'Saved Routes' }}
            />
            <Stack.Screen
              name="TrustedContacts"
              component={TrustedContactsScreen}
              options={{ title: 'Emergency Contacts' }}
            />
            <Stack.Screen
              name="BusReportCard"
              component={BusReportCardScreen}
              options={{ title: 'Weekly Report' }}
            />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  )
}
