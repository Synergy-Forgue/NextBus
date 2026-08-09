import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommuterStore } from '@/src/store/commuterStore';
import { BRAND } from '@/src/styles/brand';

export default function TripSharing() {
  const router = useRouter();
  const { trustedContacts, tripSharingActive, setTripSharingActive, addTrustedContact, removeTrustedContact } = useCommuterStore();
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const handleAddContact = () => {
    if (!newContactName || !newContactPhone) {
      Alert.alert('Missing info', 'Enter name and phone number');
      return;
    }
    if (trustedContacts.length >= 5) {
      Alert.alert('Max contacts', 'You can only add up to 5 trusted contacts');
      return;
    }
    addTrustedContact({ name: newContactName, phone: newContactPhone });
    setNewContactName('');
    setNewContactPhone('');
    Alert.alert('Added', `${newContactName} has been added to your trusted contacts`);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Trip Sharing</Text>
        <View style={{ width: 24 }} />
      </View>

      <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusCard}>
        <Text style={styles.statusEmoji}>📍</Text>
        <Text style={styles.statusTitle}>Share Your Trip</Text>
        <Text style={styles.statusDesc}>Live location & journey details with selected contacts</Text>
        <View style={styles.toggle}>
          <Switch value={tripSharingActive} onValueChange={setTripSharingActive} trackColor={{ false: 'rgba(255,255,255,0.3)', true: 'rgba(255,255,255,0.6)' }} thumbColor="#FFFFFF" />
          <Text style={styles.toggleLabel}>{tripSharingActive ? 'Sharing Active' : 'Tap to enable'}</Text>
        </View>
      </LinearGradient>

      {tripSharingActive && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live location sharing with {trustedContacts.length} contact{trustedContacts.length !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>TRUSTED CONTACTS ({trustedContacts.length}/5)</Text>
          <Text style={styles.sectionDesc}>Who can see your trip</Text>
        </View>

        {trustedContacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>No trusted contacts yet</Text>
            <Text style={styles.emptyDesc}>Add emergency contacts to share your trips</Text>
          </View>
        ) : (
          trustedContacts.map((contact, i) => (
            <View key={i} style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactInitial}>{contact.name.substring(0, 1)}</Text>
              </View>
              <View style={styles.contactDetails}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeTrustedContact(contact.phone)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {trustedContacts.length < 5 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADD CONTACT</Text>
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={BRAND.textTertiary}
            value={newContactName}
            onChangeText={setNewContactName}
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Phone number"
            placeholderTextColor={BRAND.textTertiary}
            value={newContactPhone}
            onChangeText={setNewContactPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity onPress={handleAddContact} activeOpacity={0.8}>
            <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
              <Text style={styles.addBtnText}>Add Contact</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHAT THEY SEE</Text>
        {['🚌 Your current bus route', '📍 Real-time location', '⏱️ ETA to destination', '👥 Occupancy level', '📞 Option to call you'].map((item, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{item.split(' ')[0]}</Text>
            <Text style={styles.featureText}>{item.substring(2)}</Text>
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
  statusCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: BRAND.radius.xl, padding: 20, alignItems: 'center' },
  statusEmoji: { fontSize: 40, marginBottom: 12 },
  statusTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginBottom: 4 },
  statusDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginBottom: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, backgroundColor: BRAND.successSoft, borderRadius: BRAND.radius.lg, paddingHorizontal: 12, paddingVertical: 10 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.success, marginRight: 8 },
  liveText: { fontSize: 13, fontWeight: '700', color: '#15803D' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: BRAND.textSecondary, marginBottom: 2 },
  sectionDesc: { fontSize: 12, color: BRAND.textTertiary },
  emptyState: { backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, paddingVertical: 32, alignItems: 'center', ...BRAND.shadow },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '700', color: BRAND.text, marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: BRAND.textSecondary },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 14, marginBottom: 10, ...BRAND.shadow },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: BRAND.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  contactInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  contactDetails: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '700', color: BRAND.text },
  contactPhone: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  removeBtn: { fontSize: 20, color: BRAND.textTertiary, fontWeight: '800', padding: 4 },
  input: { backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, borderWidth: 1.5, borderColor: BRAND.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: BRAND.text, fontWeight: '600', ...BRAND.shadow },
  addBtn: { marginTop: 14, height: 48, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  featureRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.surface, borderRadius: BRAND.radius.lg, padding: 12, marginBottom: 8, ...BRAND.shadow },
  featureIcon: { fontSize: 18, marginRight: 12, minWidth: 24 },
  featureText: { fontSize: 13, color: BRAND.text, fontWeight: '600' },
  closeBtn: { height: 48, borderRadius: BRAND.radius.pill, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: BRAND.text, fontSize: 15, fontWeight: '800' },
});
