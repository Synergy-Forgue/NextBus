import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="login" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="pairing" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="breakdown" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="driver-sos"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
        <Stack.Screen name="ticket-scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="scan-driver-qr" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
