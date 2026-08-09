import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Card, Button, Divider, RadioButton, Slider, Switch } from 'react-native-paper'
import useCommuterStore from '../store/useCommuterStore'
import { CONSTANTS } from '../utils/constants'

export default function SetAlertScreen({ route, navigation }: any) {
  const { params } = route
  const bus = params?.bus || {}
  const { addAlert } = useCommuterStore()

  const [alertMode, setAlertMode] = useState<'ai' | 'custom'>('ai')
  const [customMinutes, setCustomMinutes] = useState(10)
  const [notifyBoard, setNotifyBoard] = useState(true)
  const [notifyAlight, setNotifyAlight] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [vibrationEnabled, setVibrationEnabled] = useState(true)

  const handleSetAlert = () => {
    const alertData = {
      id: `alert_${Date.now()}`,
      type: alertMode === 'ai' ? 'AI_PROACTIVE' : 'CUSTOM',
      busRoute: bus.routeNo || '5A',
      minutesThreshold: customMinutes,
      notifyBoard,
      notifyAlight,
      soundEnabled,
      vibrationEnabled,
      timestamp: Date.now(),
      status: 'active',
    }

    addAlert(alertData)

    Alert.alert(
      'Alert Set',
      `${alertMode === 'ai' ? 'AI-Proactive' : 'Custom'} alert set for Route ${bus.routeNo || '5A'}`,
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
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Route Info */}
        <Card style={styles.routeCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Setting Alert For</Text>
            <View style={styles.routeInfo}>
              <Text style={styles.routeNumber}>{bus.routeNo || '5A'}</Text>
              <Text style={styles.routeDetails}>
                {bus.source || 'Central Station'} → {bus.destination || 'Airport'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Alert Mode Selection */}
        <Card style={styles.modeCard}>
          <Card.Title title="Alert Mode" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            {/* AI-Proactive Mode */}
            <TouchableOpacity
              style={styles.modeOption}
              onPress={() => setAlertMode('ai')}
            >
              <RadioButton
                value="ai"
                status={alertMode === 'ai' ? 'checked' : 'unchecked'}
                onPress={() => setAlertMode('ai')}
                color={CONSTANTS.Colors.primary}
              />
              <View style={styles.modeContent}>
                <Text style={styles.modeName}>AI-Proactive (Recommended)</Text>
                <Text style={styles.modeDesc}>
                  We'll notify you exactly when to leave based on your location and bus ETA. Best
                  for not missing your bus.
                </Text>
              </View>
            </TouchableOpacity>

            <Divider style={styles.divider} />

            {/* Custom Alarm Mode */}
            <TouchableOpacity
              style={styles.modeOption}
              onPress={() => setAlertMode('custom')}
            >
              <RadioButton
                value="custom"
                status={alertMode === 'custom' ? 'checked' : 'unchecked'}
                onPress={() => setAlertMode('custom')}
                color={CONSTANTS.Colors.primary}
              />
              <View style={styles.modeContent}>
                <Text style={styles.modeName}>Custom Alarm</Text>
                <Text style={styles.modeDesc}>
                  Get notified when the bus is X minutes away from your stop.
                </Text>
              </View>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Custom Settings */}
        {alertMode === 'custom' && (
          <Card style={styles.settingsCard}>
            <Card.Title title="Custom Settings" titleStyle={styles.cardTitle} />
            <Divider />
            <Card.Content>
              <Text style={styles.sliderLabel}>
                Notify when bus is {Math.round(customMinutes)} minutes away
              </Text>
              <Slider
                style={styles.slider}
                min={1}
                max={30}
                value={customMinutes}
                onValueChange={setCustomMinutes}
                step={1}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.minLabel}>1 min</Text>
                <Text style={styles.maxLabel}>30 mins</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Stop Notifications */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Stop Notifications" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Notify on Boarding</Text>
                <Text style={styles.settingDesc}>Alert when you board the bus</Text>
              </View>
              <Switch
                value={notifyBoard}
                onValueChange={setNotifyBoard}
                color={CONSTANTS.Colors.primary}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Notify on Alighting</Text>
                <Text style={styles.settingDesc}>Alert when near your destination</Text>
              </View>
              <Switch
                value={notifyAlight}
                onValueChange={setNotifyAlight}
                color={CONSTANTS.Colors.primary}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Notification Style */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Notification Style" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Sound</Text>
                <Text style={styles.settingDesc}>Play notification sound</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                color={CONSTANTS.Colors.primary}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Text style={styles.settingTitle}>Vibration</Text>
                <Text style={styles.settingDesc}>Vibrate on notification</Text>
              </View>
              <Switch
                value={vibrationEnabled}
                onValueChange={setVibrationEnabled}
                color={CONSTANTS.Colors.primary}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Info Box */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.infoTitle}>💡 Tips</Text>
            <Text style={styles.infoText}>
              • AI-Proactive mode works best when the app is open{'\n'}
              • Custom Alarm can work in background with location permission{'\n'}
              • Both modes stop once you board the bus
            </Text>
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
            buttonColor={CONSTANTS.Colors.primary}
            style={styles.setButton}
            onPress={handleSetAlert}
          >
            Set Alert
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    paddingBottom: 20,
  },
  routeCard: {
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  routeInfo: {
    marginTop: 8,
  },
  routeNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: CONSTANTS.Colors.primary,
    marginBottom: 4,
  },
  routeDetails: {
    fontSize: 13,
    color: '#666',
  },
  modeCard: {
    backgroundColor: '#fff',
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginBottom: 8,
  },
  modeContent: {
    flex: 1,
  },
  modeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    fontWeight: '500',
  },
  divider: {
    marginVertical: 8,
  },
  settingsCard: {
    backgroundColor: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: '#999',
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  minLabel: {
    fontSize: 11,
    color: '#999',
  },
  maxLabel: {
    fontSize: 11,
    color: '#999',
  },
  infoCard: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  cancelButton: {
    flex: 1,
    borderColor: CONSTANTS.Colors.primary,
  },
  setButton: {
    flex: 1,
  },
})
