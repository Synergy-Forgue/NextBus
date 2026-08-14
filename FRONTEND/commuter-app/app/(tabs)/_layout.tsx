import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { BRAND } from '@/src/styles/brand';

/**
 * Commuter bottom tabs.
 *
 * Every route file in this directory must be declared here — expo-router adds
 * undeclared files to the bar with a default label and no icon, which is how
 * Explore and Saved previously appeared unfinished. Order follows
 * docs/information-architecture.md.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND.primary,
        tabBarInactiveTintColor: BRAND.textTertiary,
        tabBarStyle: {
          backgroundColor: BRAND.surface,
          borderTopColor: BRAND.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🧭</Text>,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Track',
          tabBarLabel: 'Track',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text>,
        }}
      />
      <Tabs.Screen
        name="saved-routes"
        options={{
          title: 'Saved',
          tabBarLabel: 'Saved',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⭐</Text>,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
