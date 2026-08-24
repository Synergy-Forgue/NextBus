import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Dialog, Portal, RadioButton, Button, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import useCommuterStore, { SmartPickPreference } from '../store/useCommuterStore';
import { savedRoutesService } from '../services/savedRoutesService';
import { Language, getTranslation } from '../services/languageService';
import { BRAND } from '../styles/brand';

export default function ProfileScreen({ navigation }: any) {
  const {
    userProfile,
    clearUserProfile,
    darkMode,
    setDarkMode,
    language,
    setLanguage,
    smartPickPreference,
    setSmartPickPreference,
  } = useCommuterStore();

  const [stats, setStats] = useState({
    tripCount: 12,
    timeSavedHours: 4,
    co2SavedKg: 28,
  });

  const [langDialogVisible, setLangDialogVisible] = useState(false);
  const [prefDialogVisible, setPrefDialogVisible] = useState(false);
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [helpDialogVisible, setHelpDialogVisible] = useState(false);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const s = await savedRoutesService.getWeeklyStats();
      if (s.tripCount > 0) {
        setStats({
          tripCount: s.tripCount,
          timeSavedHours: Math.max(1, Math.round(s.timeSavedMinutes / 60)),
          co2SavedKg: s.co2SavedKg,
        });
      }
    } catch {}
  };

  const languageLabels: Record<Language, string> = {
    en: 'English (IN)',
    te: 'తెలుగు (Telugu)',
    kn: 'ಕನ್ನಡ (Kannada)',
  };

  const prefLabels: Record<SmartPickPreference, string> = {
    fastest: '⚡ Fastest ETA (Default)',
    'least-crowded': '👥 Least Crowded',
    cheapest: '💰 Lowest Fare',
  };

  const rows = [
    {
      icon: '🎫',
      label: 'Digital Transit Pass',
      value: 'ACTIVE',
      action: () => setPassModalVisible(true),
    },
    {
      icon: '🔖',
      label: getTranslation('savedRoutes', language),
      action: () => navigation.navigate('SavedRoutes'),
    },
    {
      icon: '🔔',
      label: getTranslation('activeAlerts', language),
      action: () => navigation.navigate('Alerts'),
    },
    {
      icon: '✨',
      label: getTranslation('smartPickPreferences', language),
      value: prefLabels[smartPickPreference] || 'Fastest',
      action: () => setPrefDialogVisible(true),
    },
    {
      icon: '🌐',
      label: getTranslation('language', language),
      value: languageLabels[language] || 'English',
      action: () => setLangDialogVisible(true),
    },
    {
      icon: '🚨',
      label: getTranslation('safetySettings', language),
      action: () => navigation.navigate('TrustedContacts'),
    },
    {
      icon: '📊',
      label: getTranslation('weeklyReportCard', language),
      action: () => navigation.navigate('BusReportCard'),
    },
    {
      icon: '❓',
      label: getTranslation('helpCenter', language),
      action: () => setHelpDialogVisible(true),
    },
  ];

  const logout = () => {
    Alert.alert('Sign out', 'Sign out of your NextBus profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          clearUserProfile();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Gradient Header with Avatar & Metrics */}
      <LinearGradient
        colors={BRAND.heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        <View style={styles.verifiedTag}>
          <Text style={styles.verifiedTagText}>✓ VERIFIED COMMUTER</Text>
        </View>
        <Text style={styles.name}>{userProfile?.name || 'Kalyan Varma'}</Text>
        <Text style={styles.phone}>
          +91 {userProfile?.phone || '8688105910'}
        </Text>

        {/* Dynamic User Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{stats.tripCount}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{stats.timeSavedHours}h</Text>
            <Text style={styles.statLabel}>Time Saved</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>{stats.co2SavedKg}kg</Text>
            <Text style={styles.statLabel}>CO₂ Saved</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Settings Navigation List */}
      <View style={styles.list}>
        {rows.map((row) => (
          <TouchableOpacity key={row.label} style={styles.row} onPress={row.action} activeOpacity={0.7}>
            <Text style={styles.rowIcon}>{row.icon}</Text>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.value && (
              <View style={[styles.badgePill, row.value === 'ACTIVE' && styles.badgePillActive]}>
                <Text
                  style={[
                    styles.rowValue,
                    row.value === 'ACTIVE' && { color: '#059669', fontWeight: '900' },
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            )}
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Dark Mode Toggle */}
        <View style={styles.row}>
          <Text style={styles.rowIcon}>🌙</Text>
          <Text style={styles.rowLabel}>{getTranslation('darkMode', language)}</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: BRAND.border, true: '#C7D2FE' }}
            thumbColor={darkMode ? BRAND.primary : '#FFF'}
          />
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logout} onPress={logout} activeOpacity={0.85}>
        <Text style={styles.logoutText}>{getTranslation('logout', language)}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>NextBus v1.0.0 (Executive Pilot Demo)</Text>
      <Text style={styles.legal}>Visakhapatnam (APSRTC) & Mysuru (KSRTC) Networks</Text>

      {/* Digital Pass Modal */}
      <Portal>
        <Dialog
          visible={passModalVisible}
          onDismiss={() => setPassModalVisible(false)}
          style={styles.passDialog}
        >
          <LinearGradient
            colors={['#1E1B4B', '#4338CA']}
            style={styles.passHeader}
          >
            <Text style={styles.passBrand}>NXTBus Digital Pass</Text>
            <Text style={styles.passType}>UNLIMITED MONTHLY COMMUTER</Text>
          </LinearGradient>
          <Dialog.Content style={styles.passContent}>
            <View style={styles.qrBox}>
              <Text style={{ fontSize: 72 }}>📱</Text>
              <Text style={styles.qrCodeText}>PASS-8688105910-PILOT</Text>
            </View>
            <View style={styles.passMetaRow}>
              <View>
                <Text style={styles.passMetaLbl}>HOLDER</Text>
                <Text style={styles.passMetaVal}>{userProfile?.name || 'Kalyan Varma'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.passMetaLbl}>VALIDITY</Text>
                <Text style={[styles.passMetaVal, { color: '#059669' }]}>ACTIVE (30 Days)</Text>
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPassModalVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Language Selector Dialog */}
      <Portal>
        <Dialog
          visible={langDialogVisible}
          onDismiss={() => setLangDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>🌐 Select Regional Language</Dialog.Title>
          <Dialog.Content>
            {(['en', 'te', 'kn'] as Language[]).map((langKey) => (
              <TouchableOpacity
                key={langKey}
                style={styles.dialogOption}
                onPress={() => {
                  setLanguage(langKey);
                  setLangDialogVisible(false);
                }}
              >
                <RadioButton
                  value={langKey}
                  status={language === langKey ? 'checked' : 'unchecked'}
                  onPress={() => {
                    setLanguage(langKey);
                    setLangDialogVisible(false);
                  }}
                  color={BRAND.primary}
                />
                <Text style={styles.dialogOptionText}>{languageLabels[langKey]}</Text>
              </TouchableOpacity>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLangDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Smart Pick Preferences Dialog */}
      <Portal>
        <Dialog
          visible={prefDialogVisible}
          onDismiss={() => setPrefDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>✨ Smart Pick Routing Priority</Dialog.Title>
          <Dialog.Content>
            {(['fastest', 'least-crowded', 'cheapest'] as SmartPickPreference[]).map((prefKey) => (
              <TouchableOpacity
                key={prefKey}
                style={styles.dialogOption}
                onPress={() => {
                  setSmartPickPreference(prefKey);
                  setPrefDialogVisible(false);
                }}
              >
                <RadioButton
                  value={prefKey}
                  status={smartPickPreference === prefKey ? 'checked' : 'unchecked'}
                  onPress={() => {
                    setSmartPickPreference(prefKey);
                    setPrefDialogVisible(false);
                  }}
                  color={BRAND.primary}
                />
                <Text style={styles.dialogOptionText}>{prefLabels[prefKey]}</Text>
              </TouchableOpacity>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPrefDialogVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Help & Support Dialog */}
      <Portal>
        <Dialog
          visible={helpDialogVisible}
          onDismiss={() => setHelpDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>❓ Help & Technical Info</Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 13, color: BRAND.text, lineHeight: 20 }}>
              • <Text style={{ fontWeight: '800' }}>Real-Time Frequency:</Text> Telemetry streams every 2–10s.{'\n'}
              • <Text style={{ fontWeight: '800' }}>Emergency Dispatch:</Text> SOS broadcasts to depot operations.{'\n'}
              • <Text style={{ fontWeight: '800' }}>Direct Support:</Text> support@nextbus.in
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHelpDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 38,
  },
  verifiedTag: {
    marginTop: -10,
    backgroundColor: '#10B981',
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  verifiedTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 10,
  },
  phone: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BRAND.radius.lg,
    alignItems: 'center',
    paddingVertical: 10,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
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
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.surfaceMuted,
  },
  rowIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  badgePill: {
    backgroundColor: BRAND.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BRAND.radius.pill,
    marginRight: 6,
  },
  badgePillActive: {
    backgroundColor: '#D1FAE5',
  },
  rowValue: {
    fontSize: 11,
    color: BRAND.textSecondary,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 18,
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
    marginTop: 16,
  },
  legal: {
    textAlign: 'center',
    color: BRAND.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  passDialog: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xxl,
    overflow: 'hidden',
  },
  passHeader: {
    padding: 20,
    alignItems: 'center',
  },
  passBrand: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  passType: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  passContent: {
    padding: 20,
    alignItems: 'center',
  },
  qrBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    width: '100%',
    marginBottom: 16,
  },
  qrCodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.textSecondary,
    marginTop: 8,
    letterSpacing: 1,
  },
  passMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  passMetaLbl: {
    fontSize: 10,
    fontWeight: '800',
    color: BRAND.textTertiary,
    letterSpacing: 1,
  },
  passMetaVal: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.text,
    marginTop: 2,
  },
  dialog: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND.text,
  },
  dialogOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  dialogOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
});
