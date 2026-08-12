import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';

export default function ProfileScreen() {
  const router = useRouter();
  const { commuter, logoutCommuter, language, setLanguage, pushEnabled, setPushEnabled, trustedContacts } = useCommuterStore();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'te', name: 'Telugu', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', flag: '🇮🇳' },
  ];

  const handleLanguageChange = (lang: 'en' | 'te' | 'kn') => {
    setLanguage(lang);
    setShowLanguageModal(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Logout',
        onPress: () => {
          logoutCommuter();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View>
            <Text style={styles.headerEmoji}>👤</Text>
            <Text style={styles.headerName}>{commuter?.name || 'Commuter'}</Text>
            <Text style={styles.headerPhone}>{commuter?.phone}</Text>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsSection}>
          {[
            { label: 'Trips', value: '24' },
            { label: 'Hours', value: '18h' },
            { label: 'CO₂ Saved', value: '42 kg' },
          ].map((stat, i) => (
            <View key={i} style={styles.statBox}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTIFICATIONS & ALERTS</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDesc}>Get real-time transit updates</Text>
            </View>
            <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ false: BRAND.border, true: '#C7D2FE' }} thumbColor={pushEnabled ? BRAND.primary : '#FFF'} />
          </View>

          <TouchableOpacity onPress={() => router.push('/alerts-settings')} activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Smart Alerts</Text>
                <Text style={styles.settingDesc}>AI-powered leave reminders</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Safety */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SAFETY & EMERGENCY</Text>

          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Trusted Contacts</Text>
                <Text style={styles.settingDesc}>{trustedContacts.length} contacts saved</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Late Night Mode</Text>
                <Text style={styles.settingDesc}>Auto-enable after 9 PM</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Safety Tips</Text>
                <Text style={styles.settingDesc}>Tips for traveling safely</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PREFERENCES</Text>

          <TouchableOpacity activeOpacity={0.7} onPress={() => setShowLanguageModal(true)}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.settingDesc}>{language === 'en' ? 'English' : language === 'te' ? 'Telugu' : 'Kannada'}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingDesc}>Always on</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>

          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Help & FAQ</Text>
                <Text style={styles.settingDesc}>Common questions answered</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Report an Issue</Text>
                <Text style={styles.settingDesc}>Help us improve</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.8} style={{ marginHorizontal: 16 }}>
          <LinearGradient colors={[BRAND.danger, '#DC2626']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.logoutBtn}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal visible={showLanguageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code as any)}
                activeOpacity={0.7}
                style={[
                  styles.languageOption,
                  language === lang.code && { backgroundColor: BRAND.primary, borderColor: BRAND.primary },
                ]}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.languageName,
                      language === lang.code && { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                  >
                    {lang.name}
                  </Text>
                </View>
                {language === lang.code && (
                  <Text style={{ fontSize: 18, color: '#FFFFFF' }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={{ marginTop: 20 }}>
              <Text style={styles.modalDone}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { marginHorizontal: 16, marginTop: 16, marginBottom: 20, borderRadius: BRAND.radius.xl, padding: 24, ...BRAND.shadow },
  headerEmoji: { fontSize: 56, marginBottom: 12 },
  headerName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  headerPhone: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  statsSection: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 16, alignItems: 'center', ...BRAND.shadow },
  statValue: { fontSize: 18, fontWeight: '900', color: BRAND.primary, marginBottom: 6 },
  statLabel: { fontSize: 12, color: BRAND.textSecondary, fontWeight: '600' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: BRAND.textSecondary, marginBottom: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 16, marginBottom: 10, ...BRAND.shadow },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '700', color: BRAND.text, marginBottom: 2 },
  settingDesc: { fontSize: 12, color: BRAND.textSecondary },
  arrow: { fontSize: 18, color: BRAND.textTertiary, marginLeft: 12 },
  logoutBtn: { height: 52, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  logoutBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: BRAND.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: BRAND.text },
  modalClose: { fontSize: 24, color: BRAND.textTertiary },
  languageOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.bg, borderRadius: BRAND.radius.lg, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: BRAND.border },
  languageFlag: { fontSize: 28, marginRight: 12 },
  languageName: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  modalDone: { textAlign: 'center', fontSize: 16, fontWeight: '800', color: BRAND.primary, paddingVertical: 12 },
});
