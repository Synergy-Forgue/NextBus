import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Button, Divider, RadioButton, Switch } from 'react-native-paper';
import useCommuterStore, { AlertItem } from '../store/useCommuterStore';
import { CONSTANTS } from '../utils/constants';
import { BRAND } from '../styles/brand';

export default function SetAlertScreen({ route, navigation }: any) {
  const { params } = route;
  const bus = params?.bus || {};
  const { addAlert } = useCommuterStore();

  const [alertMode, setAlertMode] = useState<'ai' | 'custom'>('ai');
  const [customMinutes, setCustomMinutes] = useState(10);
  const [notifyBoard, setNotifyBoard] = useState(true);
  const [notifyAlight, setNotifyAlight] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const routeNo = bus.routeNo || bus.route_number || '10K';
  const routeName = bus.route_name || `Route ${routeNo}`;
  const origin = bus.source || bus.start_stop || 'Start Stop';
  const destination = bus.destination || bus.end_stop || 'Destination';

  const handleSetAlert = () => {
    const alertData: AlertItem = {
      id: `alert_${Date.now()}`,
      busId: String(bus.busId || bus.id || '1'),
      route_number: String(routeNo),
      route_name: routeName,
      stop_name: destination,
      thresholdMinutes: customMinutes,
      mode: alertMode,
      paused: false,
      description:
        alertMode === 'ai'
          ? `AI-Proactive walk-time reminder for Route ${routeNo}`
          : `Notify when bus is ${customMinutes} mins away from ${destination}`,
      created_at: new Date().toISOString(),
    };

    addAlert(alertData);

    Alert.alert(
      '🔔 Alert Scheduled',
      `${alertMode === 'ai' ? 'AI-Proactive' : 'Custom'} alert configured for Route ${routeNo}.`,
      [
        {
          text: 'View Active Alerts',
          onPress: () => navigation.navigate('Alerts'),
        },
        {
          text: 'Done',
          onPress: () => navigation.goBack(),
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Route Info Card */}
        <Card style={styles.routeCard}>
          <Card.Content>
            <Text style={styles.cardHeaderSmall}>SETTING TRANSIT ALERT FOR</Text>
            <View style={styles.routeHeader}>
              <View style={styles.routeBadge}>
                <Text style={styles.routeBadgeText}>Route {routeNo}</Text>
              </View>
              <Text style={styles.routeDetails}>
                {origin} ➔ {destination}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Alert Mode Selection */}
        <Card style={styles.modeCard}>
          <Card.Title title="Select Alert Mode" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content style={{ paddingTop: 8 }}>
            {/* AI-Proactive Mode */}
            <TouchableOpacity
              style={[styles.modeOption, alertMode === 'ai' && styles.modeOptionActive]}
              onPress={() => setAlertMode('ai')}
              activeOpacity={0.85}
            >
              <RadioButton
                value="ai"
                status={alertMode === 'ai' ? 'checked' : 'unchecked'}
                onPress={() => setAlertMode('ai')}
                color={BRAND.primary}
              />
              <View style={styles.modeContent}>
                <Text style={styles.modeName}>AI-Proactive (Recommended)</Text>
                <Text style={styles.modeDesc}>
                  Calculates your live walking time to the nearest stop against the bus's real-time ETA and tells you exactly when to leave.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Custom Alarm Mode */}
            <TouchableOpacity
              style={[styles.modeOption, alertMode === 'custom' && styles.modeOptionActive]}
              onPress={() => setAlertMode('custom')}
              activeOpacity={0.85}
            >
              <RadioButton
                value="custom"
                status={alertMode === 'custom' ? 'checked' : 'unchecked'}
                onPress={() => setAlertMode('custom')}
                color={BRAND.primary}
              />
              <View style={styles.modeContent}>
                <Text style={styles.modeName}>Custom Threshold Alarm</Text>
                <Text style={styles.modeDesc}>
                  Trigger an audible/vibrating alert when the bus is within X minutes of your boarding stop.
                </Text>
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Custom Settings (if custom mode chosen) */}
        {alertMode === 'custom' && (
          <Card style={styles.settingsCard}>
            <Card.Title title="Arrival Threshold" titleStyle={styles.cardTitle} />
            <Divider />
            <Card.Content>
              <Text style={styles.sliderLabel}>
                Notify me when bus is <Text style={{ color: BRAND.primary, fontWeight: '800' }}>{customMinutes} minutes</Text> away
              </Text>
              <View style={styles.minuteChipsRow}>
                {[5, 10, 15, 20, 30].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => setCustomMinutes(mins)}
                    style={[
                      styles.minuteChip,
                      customMinutes === mins && styles.minuteChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.minuteChipText,
                        customMinutes === mins && styles.minuteChipTextActive,
                      ]}
                    >
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Stop Notifications */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Journey Notifications" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Notify on Boarding</Text>
                <Text style={styles.settingDesc}>Confirm when you board the bus</Text>
              </View>
              <Switch
                value={notifyBoard}
                onValueChange={setNotifyBoard}
                color={BRAND.primary}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Notify on Alighting</Text>
                <Text style={styles.settingDesc}>Alert 1 stop before your destination</Text>
              </View>
              <Switch
                value={notifyAlight}
                onValueChange={setNotifyAlight}
                color={BRAND.primary}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Notification Style */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Notification Channels" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Sound</Text>
                <Text style={styles.settingDesc}>Play alert tone</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                color={BRAND.primary}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Vibration</Text>
                <Text style={styles.settingDesc}>Haptic vibration on arrival</Text>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={setVibrationEnabled}
                color={BRAND.primary}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            buttonColor={BRAND.primary}
            style={styles.setButton}
            onPress={handleSetAlert}
          >
            Schedule Alert
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  content: {
    padding: 14,
    gap: 12,
    paddingBottom: 40,
  },
  routeCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    ...BRAND.shadow,
  },
  cardHeaderSmall: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginBottom: 8,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeBadge: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BRAND.radius.pill,
  },
  routeBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
  },
  routeDetails: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
  },
  modeCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    ...BRAND.shadow,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 8,
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.md,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modeOptionActive: {
    borderColor: BRAND.primary,
    backgroundColor: '#EEF2FF',
  },
  modeContent: {
    flex: 1,
  },
  modeName: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
    marginBottom: 2,
  },
  modeDesc: {
    fontSize: 12,
    color: BRAND.textSecondary,
    lineHeight: 17,
  },
  settingsCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    ...BRAND.shadow,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.text,
    marginBottom: 10,
  },
  minuteChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  minuteChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BRAND.radius.md,
    backgroundColor: BRAND.surfaceMuted,
  },
  minuteChipActive: {
    backgroundColor: BRAND.primary,
  },
  minuteChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.text,
  },
  minuteChipTextActive: {
    color: '#FFFFFF',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingLabel: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.text,
  },
  settingDesc: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  divider: {
    marginVertical: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    borderColor: BRAND.border,
  },
  setButton: {
    flex: 1.5,
  },
});
