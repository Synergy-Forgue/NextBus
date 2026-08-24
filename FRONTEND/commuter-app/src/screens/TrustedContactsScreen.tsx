import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { Text, Card, Button, Divider, Dialog, Portal, TextInput, Icon, FAB } from 'react-native-paper';
import useCommuterStore, { TrustedContact } from '../store/useCommuterStore';
import { CONSTANTS } from '../utils/constants';
import { BRAND } from '../styles/brand';

export default function TrustedContactsScreen({ navigation }: any) {
  const {
    trustedContacts,
    addTrustedContact,
    updateTrustedContact,
    removeTrustedContact,
  } = useCommuterStore();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', relationship: '' });

  const handleAddContact = () => {
    if (trustedContacts.length >= 5) {
      Alert.alert('Limit Reached', 'You can have a maximum of 5 emergency contacts.');
      return;
    }
    setEditingId(null);
    setFormData({ name: '', phone: '', relationship: '' });
    setDialogVisible(true);
  };

  const handleEditContact = (contact: TrustedContact) => {
    setEditingId(contact.id);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship || contact.relation || '',
    });
    setDialogVisible(true);
  };

  const handleSaveContact = () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('Incomplete Details', 'Please provide a name and mobile number.');
      return;
    }

    const cleanPhone = formData.phone.trim();
    const initial = formData.name.trim().charAt(0).toUpperCase() || 'C';

    if (editingId) {
      updateTrustedContact(editingId, {
        name: formData.name.trim(),
        phone: cleanPhone,
        relationship: formData.relationship.trim() || 'Contact',
        relation: formData.relationship.trim() || 'Contact',
        initial,
      });
    } else {
      const newContact: TrustedContact = {
        id: `contact_${Date.now()}`,
        name: formData.name.trim(),
        phone: cleanPhone,
        relationship: formData.relationship.trim() || 'Contact',
        relation: formData.relationship.trim() || 'Contact',
        isEmergency: true,
        initial,
        tag: cleanPhone,
        color: '#4F46E5',
      };
      addTrustedContact(newContact);
    }

    setDialogVisible(false);
    setFormData({ name: '', phone: '', relationship: '' });
  };

  const handleDeleteContact = (contactId: string, contactName: string) => {
    Alert.alert(
      'Delete Contact',
      `Remove ${contactName} from your emergency contacts?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => {
            removeTrustedContact(contactId);
          },
          style: 'destructive',
        },
      ],
    );
  };

  const handleCallContact = (phone: string) => {
    const clean = phone.replace(/\s+/g, '');
    Linking.openURL(`tel:${clean}`).catch(() =>
      Alert.alert('Error', 'Unable to initiate phone call'),
    );
  };

  const emergencyContacts = trustedContacts.filter((c) => c.isEmergency ?? true);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.infoTitle}>🛡️ Your Safety Network</Text>
            <Text style={styles.infoText}>
              Add up to 5 trusted contacts who will receive your live GPS tracking location and SOS alerts instantly.
            </Text>
          </Card.Content>
        </Card>

        {/* Contacts List */}
        {emergencyContacts.length > 0 ? (
          <View style={styles.contactsList}>
            <Text style={styles.sectionTitle}>
              Active Trusted Contacts ({emergencyContacts.length}/5)
            </Text>
            {emergencyContacts.map((contact) => (
              <Card key={contact.id} style={styles.contactCard}>
                <Card.Content>
                  <View style={styles.contactHeader}>
                    <View style={[styles.avatarCircle, { backgroundColor: contact.color || '#4F46E5' }]}>
                      <Text style={styles.avatarText}>{contact.initial || contact.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.relationship}>{contact.relationship || contact.relation || 'Contact'}</Text>
                      <Text style={styles.phone}>{contact.phone}</Text>
                    </View>
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>✓ ACTIVE</Text>
                    </View>
                  </View>

                  <Divider style={styles.divider} />

                  <View style={styles.actionButtons}>
                    <Button
                      mode="text"
                      icon="phone"
                      compact
                      onPress={() => handleCallContact(contact.phone)}
                    >
                      Call
                    </Button>
                    <Button
                      mode="text"
                      icon="pencil"
                      compact
                      onPress={() => handleEditContact(contact)}
                    >
                      Edit
                    </Button>
                    <Button
                      mode="text"
                      icon="trash-can-outline"
                      textColor={CONSTANTS.Colors.danger}
                      compact
                      onPress={() => handleDeleteContact(contact.id, contact.name)}
                    >
                      Delete
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon source="account-multiple-outline" size={54} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
            <Text style={styles.emptyDesc}>
              Add trusted contacts so they can be notified immediately during an emergency or trip sharing.
            </Text>
          </View>
        )}

        {/* Safety Tips Card */}
        <Card style={styles.tipsCard}>
          <Card.Title title="Safety Tips" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Add family members or close friends as emergency contacts.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                They receive live GPS link when you hold the SOS panic button.
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Always keep their phone numbers formatted with valid country code.
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.spacer} />
      </ScrollView>

      {/* FAB to Add Contact */}
      {trustedContacts.length < 5 && (
        <FAB
          icon="plus"
          label="Add Contact"
          style={styles.fab}
          color="#FFF"
          onPress={handleAddContact}
        />
      )}

      {/* Dialog for Add/Edit */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {editingId ? 'Edit Contact' : 'Add Emergency Contact'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Full Name"
              value={formData.name}
              onChangeText={(name) => setFormData({ ...formData, name })}
              mode="outlined"
              style={styles.input}
              placeholder="e.g. Mom, Dad, Rahul"
            />
            <TextInput
              label="Mobile Number"
              value={formData.phone}
              onChangeText={(phone) => setFormData({ ...formData, phone })}
              mode="outlined"
              style={styles.input}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
            />
            <TextInput
              label="Relationship"
              value={formData.relationship}
              onChangeText={(relationship) => setFormData({ ...formData, relationship })}
              mode="outlined"
              style={styles.input}
              placeholder="e.g. Mother, Father, Friend"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleSaveContact}
              buttonColor={CONSTANTS.Colors.primary}
            >
              {editingId ? 'Update' : 'Save'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 80,
  },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 4,
    borderLeftColor: CONSTANTS.Colors.primary,
    borderRadius: BRAND.radius.lg,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: BRAND.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: BRAND.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  contactsList: {
    gap: 10,
  },
  contactCard: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    ...BRAND.shadow,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.text,
  },
  relationship: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 1,
  },
  phone: {
    fontSize: 12,
    color: BRAND.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  verifiedBadge: {
    backgroundColor: BRAND.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BRAND.radius.pill,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  divider: {
    marginVertical: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: BRAND.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: BRAND.radius.lg,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  tipBullet: {
    fontSize: 14,
    color: BRAND.primary,
    fontWeight: '800',
  },
  tipText: {
    fontSize: 12,
    color: BRAND.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.pill,
  },
  dialog: {
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.xl,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND.text,
  },
  input: {
    marginBottom: 10,
    backgroundColor: BRAND.surface,
  },
  spacer: {
    height: 40,
  },
});
