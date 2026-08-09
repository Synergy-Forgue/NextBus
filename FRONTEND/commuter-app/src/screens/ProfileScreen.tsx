import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import useCommuterStore from '../store/useCommuterStore'
import { BRAND } from '../styles/brand'

/**
 * Profile & Settings (Figma): gradient header with avatar + stats
 * (Trips / Time Saved / CO2 Saved — the "Bus Report Card" data),
 * settings list, dark-mode toggle, logout.
 */
export default function ProfileScreen({ navigation }: any) {
  const { userProfile, clearUserProfile, darkMode, setDarkMode } = useCommuterStore()

  const rows = [
    { icon: '🔖', label: 'Saved routes', action: () => navigation.navigate('SavedRoutes') },
    { icon: '🔔', label: 'Notification preferences', action: () => navigation.navigate('Alerts') },
    { icon: '✨', label: 'Smart Pick preferences', action: () => Alert.alert('Smart Picks', 'Preference controls arrive in Phase 2.') },
    { icon: '🌐', label: 'Language', value: 'English (IN)', action: () => Alert.alert('Language', 'Telugu arrives with the Vizag launch.') },
    { icon: '🚨', label: 'Safety & SOS settings', action: () => navigation.navigate('TrustedContacts') },
    { icon: '📊', label: 'Weekly Bus Report Card', action: () => navigation.navigate('BusReportCard') },
    { icon: '❓', label: 'Help center', action: () => Alert.alert('Help', 'support@nextbus.in') },
  ]

  const logout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: clearUserProfile },
    ])
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Gradient header */}
      <LinearGradient
        colors={BRAND.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        <View style={styles.premiumTag}>
          <Text style={styles.premiumText}>COMMUTER</Text>
        </View>
        <Text style={styles.name}>{userProfile?.name || 'Commuter'}</Text>
        <Text style={styles.phone}>
          +91 {userProfile?.phone || '—'}
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>4h</Text>
            <Text style={styles.statLabel}>Time Saved</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>6kg</Text>
            <Text style={styles.statLabel}>CO₂ Saved</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Settings list */}
      <View style={styles.list}>
        {rows.map((row) => (
          <TouchableOpacity key={row.label} style={styles.row} onPress={row.action}>
            <Text style={styles.rowIcon}>{row.icon}</Text>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.value && <Text style={styles.rowValue}>{row.value}</Text>}
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Dark mode toggle */}
        <View style={styles.row}>
          <Text style={styles.rowIcon}>🌙</Text>
          <Text style={styles.rowLabel}>Dark mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: BRAND.border, true: '#C7D2FE' }}
            thumbColor={darkMode ? BRAND.primary : '#FFF'}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0 (MVP)</Text>
      <Text style={styles.legal}>Privacy Policy  ·  Terms of Service</Text>

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  header: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  premiumTag: {
    marginTop: -12,
    backgroundColor: '#FFFFFF',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.primary,
    letterSpacing: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  phone: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  list: {
    margin: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    paddingHorizontal: 6,
    ...BRAND.shadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.surfaceMuted,
  },
  rowIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.text,
  },
  rowValue: {
    fontSize: 13,
    color: BRAND.textSecondary,
    marginRight: 8,
  },
  chevron: {
    fontSize: 20,
    color: BRAND.textTertiary,
  },
  logout: {
    marginHorizontal: 16,
    backgroundColor: BRAND.dangerSoft,
    borderRadius: BRAND.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: BRAND.danger,
    fontSize: 14,
    fontWeight: '800',
  },
  version: {
    textAlign: 'center',
    color: BRAND.textTertiary,
    fontSize: 12,
    marginTop: 18,
  },
  legal: {
    textAlign: 'center',
    color: BRAND.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
})
