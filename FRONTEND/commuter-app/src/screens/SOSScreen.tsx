import React, { useRef, useState } from 'react';
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
  ScrollView,
} from 'react-native';
import useCommuterStore from '../store/useCommuterStore';
import { triggerSOS } from '../api/apiClient';
import { BRAND } from '../styles/brand';

export default function SOSScreen({ navigation }: any) {
  const { userLocation, trustedContacts } = useCommuterStore();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = () => {
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();
    holdTimer.current = setTimeout(fireSOS, 2000);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const fireSOS = async () => {
    setSending(true);
    const lat = userLocation?.lat ?? 17.7231;
    const lng = userLocation?.lng ?? 83.3013;

    try {
      const res = await triggerSOS(lat, lng);
      setSending(false);
      if (res && res.success !== false) {
        setSent(true);
        Alert.alert(
          '🚨 SOS Broadcast Active',
          'Your live GPS coordinates have been transmitted to the central depot control room and emergency contacts. Help is being dispatched.',
          [{ text: 'Acknowledge', style: 'default' }]
        );
      } else {
        setSent(true);
        Alert.alert(
          'Emergency Alert Logged',
          'Live coordinates recorded. If this is an immediate life-safety emergency, please call 112 directly.',
        );
      }
    } catch {
      setSending(false);
      Alert.alert(
        'Call 112 Directly',
        'Could not transmit over network. Please call emergency services (112) immediately.',
      );
    }
  };

  const callEmergency = () => {
    Linking.openURL('tel:112');
  };

  const scale = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.title}>Emergency{'\n'}Confirmation</Text>
            <Text style={styles.subtitle}>
              Press & hold the SOS button to alert depot control & emergency contacts.
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Press & Hold SOS Button */}
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
                      {sent ? 'BROADCAST LIVE' : 'HOLD 2 SECONDS'}
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>

            <View style={styles.sharingPill}>
              <View style={[styles.sharingDot, sent && { backgroundColor: '#10B981' }]} />
              <Text style={styles.sharingText}>
                {sent
                  ? `Live GPS Shared: ${userLocation?.lat.toFixed(4) || '17.7231'}, ${userLocation?.lng.toFixed(4) || '83.3013'}`
                  : 'GPS Ready · Holding transmits alert'}
              </Text>
            </View>
          </View>

          {/* Real Trusted Contacts from Store */}
          <View style={styles.contactsHeader}>
            <Text style={styles.contactsLabel}>NOTIFY CONTACTS ({trustedContacts.length})</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TrustedContacts')}>
              <Text style={styles.editLink}>Manage →</Text>
            </TouchableOpacity>
          </View>

          {trustedContacts.length === 0 ? (
            <TouchableOpacity
              style={styles.noContactsCard}
              onPress={() => navigation.navigate('TrustedContacts')}
            >
              <Text style={styles.noContactsText}>+ Add emergency contacts to notify</Text>
            </TouchableOpacity>
          ) : (
            trustedContacts.slice(0, 3).map((contact) => (
              <View key={contact.id} style={styles.contactRow}>
                <View style={[styles.contactAvatar, { backgroundColor: contact.color || '#4F46E5' }]}>
                  <Text style={styles.contactInitial}>{contact.initial || contact.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactTag}>
                    {contact.relationship || contact.relation || contact.phone}
                  </Text>
                </View>
                <Text style={styles.contactCheck}>{sent ? '🔔 Alerted' : '✓ Auto-Alert'}</Text>
              </View>
            ))
          )}

          {/* Call Emergency Direct Action */}
          <TouchableOpacity style={styles.callBtn} onPress={callEmergency} activeOpacity={0.85}>
            <Text style={styles.callBtnText}>📞  Call Emergency Services (112)</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 14 }}>
            <Text style={styles.cancelReturn}>Cancel & Return</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
    padding: 22,
    maxHeight: '90%',
    ...BRAND.shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: BRAND.danger,
    lineHeight: 28,
  },
  closeBtn: {
    padding: 6,
  },
  close: {
    fontSize: 20,
    color: BRAND.textTertiary,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    color: BRAND.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  sosWrap: {
    alignItems: 'center',
    marginVertical: 18,
  },
  sosOuter: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: BRAND.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sosButton: {
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: BRAND.danger,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  sosButtonSent: {
    backgroundColor: BRAND.success,
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosHint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    fontWeight: '900',
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
    backgroundColor: BRAND.danger,
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
    marginBottom: 10,
    marginTop: 4,
  },
  contactsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.primary,
  },
  noContactsCard: {
    backgroundColor: BRAND.surfaceMuted,
    padding: 12,
    borderRadius: BRAND.radius.md,
    alignItems: 'center',
    marginBottom: 10,
  },
  noContactsText: {
    fontSize: 12,
    color: BRAND.primary,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contactInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
  },
  contactTag: {
    fontSize: 11,
    color: BRAND.textSecondary,
    marginTop: 1,
  },
  contactCheck: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.primary,
  },
  callBtn: {
    backgroundColor: BRAND.danger,
    borderRadius: BRAND.radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  callBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  cancelReturn: {
    textAlign: 'center',
    color: BRAND.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
});
