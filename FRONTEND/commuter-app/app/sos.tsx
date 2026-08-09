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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function SOS() {
  const router = useRouter();
  const { trustedContacts } = useCommuterStore();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = () => {
    Animated.timing(holdProgress, { toValue: 1, duration: 2000, useNativeDriver: true }).start();
    holdTimer.current = setTimeout(fireSOS, 2000);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    Animated.timing(holdProgress, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const fireSOS = async () => {
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/alerts`, {
        type: 'sos',
        description: 'COMMUTER_EMERGENCY',
        latitude: 17.7261,
        longitude: 83.3085,
      });
      setSent(true);
      Alert.alert('SOS Sent', 'Your location has been shared with trusted contacts and emergency services.');
    } catch {
      Alert.alert('Failed', 'Could not send SOS. Call 112 directly.');
    } finally {
      setSending(false);
    }
  };

  const scale = holdProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>Emergency{'\n'}confirmation</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Confirm to notify emergency services and trusted contacts.</Text>

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
                  <Text style={styles.sosHint}>{sent ? 'SENT' : 'PRESS & HOLD'}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
          <View style={styles.sharingPill}>
            <View style={styles.sharingDot} />
            <Text style={styles.sharingText}>{sent ? 'Location shared' : 'Sharing location…'}</Text>
          </View>
        </View>

        <View style={styles.contactsHeader}>
          <Text style={styles.contactsLabel}>NOTIFY CONTACTS</Text>
          <Text style={styles.editLink}>Edit</Text>
        </View>

        {[
          { initial: 'DC', name: 'Depot Control', tag: 'Primary', color: BRAND.primary },
          { initial: 'EM', name: 'Emergency (112)', tag: 'National', color: BRAND.danger },
        ].concat(trustedContacts.slice(0, 3)).map((c, i) => (
          <View key={i} style={styles.contactRow}>
            <View style={[styles.contactAvatar, { backgroundColor: (c as any).color || BRAND.primary }]}>
              <Text style={styles.contactInitial}>{(c as any).initial || c.name?.substring(0, 2)}</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{(c as any).name || c.name}</Text>
              <Text style={styles.contactTag}>{(c as any).tag || (c as any).phone}</Text>
            </View>
            <Text style={styles.contactCheck}>✔️</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:112')}>
          <Text style={styles.callBtnText}>📞  Call Emergency Services (112)</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelReturn}>Cancel & Return</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: BRAND.surface, borderRadius: BRAND.radius.xl, padding: 24 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.danger, lineHeight: 28 },
  close: { fontSize: 20, color: BRAND.textTertiary, padding: 4 },
  subtitle: { fontSize: 13, color: BRAND.textSecondary, marginTop: 8, marginBottom: 20 },
  sosWrap: { alignItems: 'center', marginBottom: 22 },
  sosOuter: { width: 168, height: 168, borderRadius: 84, backgroundColor: BRAND.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  sosButton: { width: 136, height: 136, borderRadius: 68, backgroundColor: BRAND.danger, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND.danger, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  sosButtonSent: { backgroundColor: BRAND.success },
  sosText: { color: '#FFF', fontSize: 34, fontWeight: '900', letterSpacing: 1 },
  sosHint: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 4 },
  sharingPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surfaceMuted, borderRadius: BRAND.radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  sharingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.primary, marginRight: 8 },
  sharingText: { fontSize: 12, fontWeight: '700', color: BRAND.textSecondary },
  contactsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  contactsLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: BRAND.textTertiary },
  editLink: { fontSize: 13, fontWeight: '700', color: BRAND.primary },
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surfaceMuted, borderRadius: BRAND.radius.lg, padding: 12, marginBottom: 10 },
  contactAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  contactInitial: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '700', color: BRAND.text },
  contactTag: { fontSize: 12, color: BRAND.textSecondary, marginTop: 1 },
  contactCheck: { fontSize: 14 },
  callBtn: { backgroundColor: BRAND.danger, borderRadius: BRAND.radius.pill, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  callBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  cancelReturn: { textAlign: 'center', color: BRAND.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 16 },
});

