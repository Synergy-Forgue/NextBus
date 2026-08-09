import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  Linking,
  Animated,
  ActivityIndicator,
} from 'react-native'
import useCommuterStore from '../store/useCommuterStore'
import { triggerSOS } from '../api/apiClient'
import { BRAND } from '../styles/brand'

/**
 * SOS Emergency (Figma modal): press & HOLD the red circle for 2s to
 * send a real SOS to the depot control room (/api/alerts pipeline →
 * appears on the RTC dashboard instantly). Includes trusted contacts
 * and a Call Emergency Services (112) action.
 */
export default function SOSScreen({ navigation }: any) {
  const { userLocation } = useCommuterStore()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const holdProgress = useRef(new Animated.Value(0)).current
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startHold = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start()
    holdTimer.current = setTimeout(fireSOS, 2000)
  }

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start()
  }

  const fireSOS = async () => {
    setSending(true)
    const lat = userLocation?.lat ?? 17.7231
    const lng = userLocation?.lng ?? 83.3013
    const res = await triggerSOS(lat, lng)
    setSending(false)
    if (res.success) {
      setSent(true)
      Alert.alert(
        'SOS Sent',
        'Your live location has been shared with the depot control room. Help is on the way.'
      )
    } else {
      Alert.alert('Failed', 'Could not reach the server. Call 112 directly if this is an emergency.')
    }
  }

  const callEmergency = () => {
    Linking.openURL('tel:112')
  }

  const scale = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  })

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Emergency{'\n'}confirmation</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Confirm to notify emergency services and contacts.
        </Text>

        {/* Press & hold SOS */}
        <View style={styles.sosWrap}>
          <Animated.View style={[styles.sosOuter, { transform: [{ scale }] }]}>
            <Pressable
              onPressIn={startHold}
              onPressOut={cancelHold}
              style={[styles.sosButton, sent && styles.sosButtonSent]}
              disabled={sending || sent}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" size="large" />
              ) : (
                <>
                  <Text style={styles.sosText}>{sent ? '✓' : 'SOS'}</Text>
                  <Text style={styles.sosHint}>
                    {sent ? 'ALERT SENT' : 'PRESS & HOLD'}
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
          <View style={styles.sharingPill}>
            <View style={styles.sharingDot} />
            <Text style={styles.sharingText}>
              {sent ? 'Live location shared' : 'Sharing live location…'}
            </Text>
          </View>
        </View>

        {/* Notify contacts */}
        <View style={styles.contactsHeader}>
          <Text style={styles.contactsLabel}>NOTIFY CONTACTS</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TrustedContacts')}>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>

        {[
          { initial: 'M', name: 'Mom', tag: 'Primary Contact', color: '#7C3AED' },
          { initial: 'D', name: 'David Wilson', tag: '+91 98xx xx3456', color: '#4F46E5' },
        ].map((c) => (
          <View key={c.name} style={styles.contactRow}>
            <View style={[styles.contactAvatar, { backgroundColor: c.color }]}>
              <Text style={styles.contactInitial}>{c.initial}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactTag}>{c.tag}</Text>
            </View>
            <Text style={styles.contactCheck}>✔️</Text>
          </View>
        ))}

        {/* Call emergency */}
        <TouchableOpacity style={styles.callBtn} onPress={callEmergency}>
          <Text style={styles.callBtnText}>📞  Call Emergency Services (112)</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelReturn}>Cancel & Return</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND.danger,
    lineHeight: 28,
  },
  close: {
    fontSize: 20,
    color: BRAND.textTertiary,
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: BRAND.textSecondary,
    marginTop: 8,
    marginBottom: 20,
  },
  sosWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sosOuter: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: BRAND.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sosButton: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: BRAND.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  sosButtonSent: {
    backgroundColor: BRAND.success,
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  sharingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sharingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.success,
    marginRight: 8,
  },
  sharingText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.textSecondary,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
  },
  editLink: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.primary,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    padding: 12,
    marginBottom: 10,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInitial: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  contactTag: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 1,
  },
  contactCheck: {
    fontSize: 14,
  },
  callBtn: {
    backgroundColor: BRAND.danger,
    borderRadius: BRAND.radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelReturn: {
    textAlign: 'center',
    color: BRAND.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
  },
})
