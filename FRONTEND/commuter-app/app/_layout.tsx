import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCommuterStore } from '@/src/store/commuterStore';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'splash',
};

export default function RootLayout() {
  const colorScheme = 'light'; // FORCE light theme
  const isLoggedIn = useCommuterStore((state) => state.isLoggedIn);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="splash" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="login" />
            <Stack.Screen name="otp" />
          </>
        ) : (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="trip-sharing" options={{ presentation: 'modal' }} />
            <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
            <Stack.Screen name="alerts-settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="report-card" options={{ presentation: 'modal' }} />
          </>
        )}
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
