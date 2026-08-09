import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';

export default function AlertsSettings() {
  const router = useRouter();
  const { smartAlertsEnabled, setSmartAlertsEnabled } = useCommuterStore();
  const [threshold, setThreshold] = useState('10');

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Smart Alerts</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Mode 1: AI Proactive */}
      <LinearGradient colors={['#4F46E5', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
        <View style={styles.modeHeader}>
          <Text style={styles.modeEmoji}>🤖</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeName}>AI-Proactive Alerts</Text>
            <Text style={styles.modeDesc}>Automatic leave reminders when you're on the app</Text>
          </View>
          <Switch value={smartAlertsEnabled} onValueChange={setSmartAlertsEnabled} trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.6)' }} thumbColor="#FFFFFF" />
        </View>
        {smartAlertsEnabled && (
          <View style={styles.modeDetails}>
            <Text style={styles.modeDetailsTitle}>How it works:</Text>
            <Text style={styles.modeDetailItem}>📍 Detects your location</Text>
            <Text style={styles.modeDetailItem}>🧮 Calculates walk time to nearest stop</Text>
            <Text style={styles.modeDetailItem}>📊 Compares with bus ETA</Text>
            <Text style={styles.modeDetailItem}>🔔 Notifies you: "Leave in 5 minutes to catch Bus 28"</Text>
          </View>
        )}
      </LinearGradient>

      {/* Mode 2: Custom Alarm */}
      <LinearGradient colors={['#7C3AED', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.modeCard}>
        <View style={styles.modeHeader}>
          <Text style={styles.modeEmoji}>⏰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeName}>Custom Alarm</Text>
            <Text style={styles.modeDesc}>Set a specific distance/time for notifications</Text>
          </View>
        </View>
        <View style={styles.modeDetails}>
          <Text style={styles.modeDetailsTitle}>Notify me when bus is:</Text>
          <View style={styles.customAlarmRow}>
            <TextInput
              style={styles.customAlarmInput}
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.customAlarmUnit}>minutes away</Text>
          </View>
          <Text style={styles.customAlarmDesc}>You'll get an alert as soon as the bus is {threshold} minutes from your stop.</Text>
        </View>
      </LinearGradient>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTIFICATION SETTINGS</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Sound</Text>
            <Text style={styles.settingDesc}>Alert sound when notification arrives</Text>
          </View>
          <Switch value={true} trackColor={{ false: BRAND.border, true: '#C7D2FE' }} thumbColor={BRAND.primary} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Vibration</Text>
            <Text style={styles.settingDesc}>Alert vibration on your phone</Text>
          </View>
          <Switch value={true} trackColor={{ false: BRAND.border, true: '#C7D2FE' }} thumbColor={BRAND.primary} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Quiet Hours</Text>
            <Text style={styles.settingDesc}>10:00 PM - 7:00 AM</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </View>
      </View>

      {/* Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TIPS FOR BEST RESULTS</Text>

        {[
          '🔋 Keep the app open for AI-Proactive alerts to work (uses less battery than background location)',
          '📍 Enable location permission for accurate calculations',
          '📲 Ensure notification permission is enabled in settings',
          '🔊 Test your sound and vibration settings',
        ].map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={{ marginHorizontal: 16 }}>
        <LinearGradient colors={[BRAND.border, BRAND.surfaceMuted]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Done</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  back: { fontSize: 24, color: BRAND.textSecondary, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.text },
  modeCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: BRAND.radius.xl, padding: 16 },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeEmoji: { fontSize: 32 },
  modeName: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  modeDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  modeDetails: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: BRAND.radius.lg, padding: 12 },
  modeDetailsTitle: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  modeDetailItem: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginBottom: 4, lineHeight: 18 },
  customAlarmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 10 },
  customAlarmInput: { width: 60, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BRAND.radius.md, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: '#FFFFFF', fontWeight: '800', textAlign: 'center' },
  customAlarmUnit: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  customAlarmDesc: { fontSize: 12, color: 'rgba(255,255,255,0.9)', lineHeight: 18 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: BRAND.textSecondary, marginBottom: 12 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, ...BRAND.shadow },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '700', color: BRAND.text, marginBottom: 2 },
  settingDesc: { fontSize: 12, color: BRAND.textSecondary },
  arrow: { fontSize: 18, color: BRAND.textTertiary, marginLeft: 12 },
  tipRow: { backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: BRAND.info, ...BRAND.shadow },
  tipText: { fontSize: 13, color: BRAND.text, fontWeight: '600', lineHeight: 20 },
  closeBtn: { height: 48, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: BRAND.text, fontSize: 15, fontWeight: '800' },
});
