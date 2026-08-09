import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native'
import { Text, Card, Button, Divider, Dialog, Portal, TextInput, Icon, FAB } from 'react-native-paper'
import { CONSTANTS } from '../utils/constants'

interface TrustedContact {
  id: string
  name: string
  phone: string
  relationship: string
  isEmergency: boolean
}

export default function TrustedContactsScreen({ navigation }: any) {
  const [contacts, setContacts] = useState<TrustedContact[]>([
    {
      id: '1',
      name: 'Mom',
      phone: '+91 98765 43210',
      relationship: 'Mother',
      isEmergency: true,
    },
    {
      id: '2',
      name: 'Dad',
      phone: '+91 98765 43211',
      relationship: 'Father',
      isEmergency: true,
    },
    {
      id: '3',
      name: 'Sister',
      phone: '+91 98765 43212',
      relationship: 'Sister',
      isEmergency: false,
    },
  ])

  const [dialogVisible, setDialogVisible] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', relationship: '' })

  const handleAddContact = () => {
    setEditingId(null)
    setFormData({ name: '', phone: '', relationship: '' })
    setDialogVisible(true)
  }

  const handleEditContact = (contact: TrustedContact) => {
    setEditingId(contact.id)
    setFormData({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
    })
    setDialogVisible(true)
  }

  const handleSaveContact = () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('Error', 'Please fill all fields')
      return
    }

    if (editingId) {
      setContacts(
        contacts.map(c =>
          c.id === editingId
            ? { ...c, ...formData }
            : c
        )
      )
    } else {
      setContacts([
        ...contacts,
        {
          id: `contact_${Date.now()}`,
          ...formData,
          isEmergency: false,
        },
      ])
    }

    setDialogVisible(false)
    setFormData({ name: '', phone: '', relationship: '' })
  }

  const handleDeleteContact = (contactId: string, contactName: string) => {
    Alert.alert(
      'Delete Contact',
      `Remove ${contactName} from trusted contacts?`,
      [
        { text: 'Keep', onPress: () => {} },
        {
          text: 'Delete',
          onPress: () => {
            setContacts(contacts.filter(c => c.id !== contactId))
            Alert.alert('Success', `${contactName} removed`)
          },
          style: 'destructive',
        },
      ],
    )
  }

  const handleCallContact = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert('Error', 'Unable to make call'),
    )
  }

  const emergencyContacts = contacts.filter(c => c.isEmergency)
  const otherContacts = contacts.filter(c => !c.isEmergency)

  const ContactCard = ({ contact }: { contact: TrustedContact }) => (
    <Card style={[styles.contactCard, contact.isEmergency && styles.emergencyCard]}>
      <Card.Content>
        <View style={styles.contactHeader}>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <Text style={styles.relationship}>{contact.relationship}</Text>
            <Text style={styles.phone}>{contact.phone}</Text>
          </View>
          {contact.isEmergency && (
            <Icon source="alert" size={20} color={CONSTANTS.Colors.danger} />
          )}
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
  )

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.infoTitle}>🛡️ Your Safety Network</Text>
            <Text style={styles.infoText}>
              Add up to 5 emergency contacts who will receive trip sharing updates and SOS alerts
              instantly.
            </Text>
          </Card.Content>
        </Card>

        {/* Emergency Contacts Section */}
        {emergencyContacts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Emergency Contacts ({emergencyContacts.length})</Text>
            </View>
            <View style={styles.contactsList}>
              {emergencyContacts.map(contact => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </View>
          </>
        )}

        {/* Other Contacts Section */}
        {otherContacts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Other Contacts ({otherContacts.length})</Text>
            </View>
            <View style={styles.contactsList}>
              {otherContacts.map(contact => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </View>
          </>
        )}

        {/* Empty State */}
        {contacts.length === 0 && (
          <View style={styles.emptyState}>
            <Icon source="account-multiple-outline" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
            <Text style={styles.emptyDesc}>Add trusted contacts for your safety</Text>
          </View>
        )}

        {/* Tips Card */}
        <Card style={styles.tipsCard}>
          <Card.Title title="Safety Tips" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Add family members and close friends as emergency contacts
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                They'll receive live location during SOS and trip sharing
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                Keep your contact list up to date
              </Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>
                You can have maximum 5 emergency contacts
              </Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.spacer} />
      </ScrollView>

      {/* FAB */}
      {contacts.length < 5 && (
        <FAB
          icon="plus"
          label="Add Contact"
          style={styles.fab}
          onPress={handleAddContact}
        />
      )}

      {/* Dialog */}
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)}>
          <Dialog.Title>
            {editingId ? 'Edit Contact' : 'Add Emergency Contact'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={formData.name}
              onChangeText={name => setFormData({ ...formData, name })}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Mom, Dad, Sister"
            />
            <TextInput
              label="Phone Number"
              value={formData.phone}
              onChangeText={phone => setFormData({ ...formData, phone })}
              mode="outlined"
              style={styles.input}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
            />
            <TextInput
              label="Relationship"
              value={formData.relationship}
              onChangeText={relationship => setFormData({ ...formData, relationship })}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Mother, Sister, Friend"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={handleSaveContact}
              buttonColor={CONSTANTS.Colors.primary}
            >
              {editingId ? 'Update' : 'Add'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 4,
    borderLeftColor: CONSTANTS.Colors.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  contactsList: {
    gap: 8,
  },
  contactCard: {
    backgroundColor: '#fff',
  },
  emergencyCard: {
    borderLeftWidth: 4,
    borderLeftColor: CONSTANTS.Colors.danger,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  relationship: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  phone: {
    fontSize: 12,
    color: CONSTANTS.Colors.primary,
    fontWeight: '500',
  },
  divider: {
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#999',
  },
  tipsCard: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  tipItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: CONSTANTS.Colors.primary,
    fontWeight: '700',
  },
  tipText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    lineHeight: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: CONSTANTS.Colors.primary,
  },
  input: {
    marginBottom: 12,
  },
  spacer: {
    height: 80,
  },
})
