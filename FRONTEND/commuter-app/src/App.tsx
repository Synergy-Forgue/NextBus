import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View, Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import RootNavigator from './navigation/RootNavigator';
import useCommuterStore from './store/useCommuterStore';

const queryClient = new QueryClient();

export default function App() {
  const { loadInitialStorage } = useCommuterStore();

  useEffect(() => {
    loadInitialStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <View style={styles.webWrapper}>
          <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <QueryClientProvider client={queryClient}>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </QueryClientProvider>
          </SafeAreaView>
        </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 30,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: '#1E293B',
        }
      : {}),
  },
});
