import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SectionList,
} from 'react-native'
import { Text, Card, Button, Divider, Icon, FAB } from 'react-native-paper'
import useCommuterStore from '../store/useCommuterStore'
import { CONSTANTS } from '../utils/constants'

interface SavedRoute {
  id: string
  routeNo: string
  source: string
  destination: string
  savedAt: number
  isFavorite: boolean
  frequency: string
  lastUsed?: number
}

export default function SavedRoutesScreen({ navigation }: any) {
  const { savedRoutes } = useCommuterStore()
  const [editMode, setEditMode] = useState(false)

  const mockSavedRoutes: SavedRoute[] = [
    {
      id: '1',
      routeNo: '5A',
      source: 'Central Station',
      destination: 'Airport',
      savedAt: Date.now() - 86400000 * 30,
      isFavorite: true,
      frequency: 'Daily',
      lastUsed: Date.now() - 3600000,
    },
    {
      id: '2',
      routeNo: '10B',
      source: 'Central Station',
      destination: 'Tech Park',
      savedAt: Date.now() - 86400000 * 20,
      isFavorite: true,
      frequency: 'Weekdays',
      lastUsed: Date.now() - 7200000,
    },
    {
      id: '3',
      routeNo: '7C',
      source: 'Bus Stand',
      destination: 'Hospital',
      savedAt: Date.now() - 86400000 * 10,
      isFavorite: false,
      frequency: 'Occasional',
      lastUsed: Date.now() - 86400000 * 5,
    },
    {
      id: '4',
      routeNo: '15D',
      source: 'Central Station',
      destination: 'Mall',
      savedAt: Date.now() - 86400000 * 5,
      isFavorite: false,
      frequency: 'Weekend',
      lastUsed: Date.now() - 86400000 * 7,
    },
  ]

  const favoriteRoutes = mockSavedRoutes.filter(r => r.isFavorite)
  const otherRoutes = mockSavedRoutes.filter(r => !r.isFavorite)

  const handleDeleteRoute = (routeId: string, routeNo: string) => {
    Alert.alert(
      'Delete Route',
      `Remove Route ${routeNo} from saved routes?`,
      [
        { text: 'Keep', onPress: () => {} },
        {
          text: 'Delete',
          onPress: () => {
            Alert.alert('Deleted', `Route ${routeNo} removed from saved routes`)
          },
          style: 'destructive',
        },
      ],
    )
  }

  const handleTrackRoute = (route: SavedRoute) => {
    navigation.navigate('Home')
  }

  const formatLastUsed = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    const mins = Math.round((Date.now() - timestamp) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.round(days / 7)}w ago`
  }

  const RouteCard = ({ route, isFavorite }: { route: SavedRoute; isFavorite: boolean }) => (
    <Card style={[styles.routeCard, isFavorite && styles.favoriteCard]}>
      <Card.Content>
        <View style={styles.cardTop}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeNumber}>{route.routeNo}</Text>
            <View>
              <Text style={styles.routePath}>
                {route.source} → {route.destination}
              </Text>
              <View style={styles.routeMeta}>
                <Text style={styles.metaText}>
                  {route.frequency} • {formatLastUsed(route.lastUsed)}
                </Text>
              </View>
            </View>
          </View>
          {isFavorite && (
            <Icon source="heart" size={20} color={CONSTANTS.Colors.danger} />
          )}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.cardActions}>
          <Button
            mode="contained"
            buttonColor={CONSTANTS.Colors.primary}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            onPress={() => handleTrackRoute(route)}
          >
            Track Now
          </Button>
          <Button
            mode="outlined"
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            onPress={() => handleDeleteRoute(route.id, route.routeNo)}
          >
            Remove
          </Button>
        </View>
      </Card.Content>
    </Card>
  )

  return (
    <View style={styles.container}>
      {mockSavedRoutes.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon source="bookmark-outline" size={48} color="#CCC" />
          <Text style={styles.emptyTitle}>No Saved Routes</Text>
          <Text style={styles.emptyDesc}>Save your frequently used routes for quick access</Text>
          <Button
            mode="contained"
            buttonColor={CONSTANTS.Colors.primary}
            style={styles.searchBtn}
            onPress={() => navigation.navigate('Search')}
          >
            Search & Save Routes
          </Button>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Saved Routes</Text>
              <Text style={styles.headerSubtitle}>
                {mockSavedRoutes.length} routes saved
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setEditMode(!editMode)}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Favorites Section */}
          {favoriteRoutes.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Favorites</Text>
              </View>
              <View style={styles.routesList}>
                {favoriteRoutes.map(route => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isFavorite={true}
                  />
                ))}
              </View>
            </>
          )}

          {/* Other Routes Section */}
          {otherRoutes.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Other Routes</Text>
              </View>
              <View style={styles.routesList}>
                {otherRoutes.map(route => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isFavorite={false}
                  />
                ))}
              </View>
            </>
          )}

          {/* Quick Stats */}
          <Card style={styles.statsCard}>
            <Card.Content>
              <Text style={styles.statsTitle}>Your Travel Insights</Text>
              <Divider style={styles.divider} />
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>
                    {mockSavedRoutes.length}
                  </Text>
                  <Text style={styles.statLabel}>Saved Routes</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>
                    {favoriteRoutes.length}
                  </Text>
                  <Text style={styles.statLabel}>Favorites</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>
                    {mockSavedRoutes.filter(r => r.lastUsed).length}
                  </Text>
                  <Text style={styles.statLabel}>Used</Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {/* Tips Card */}
          <Card style={styles.tipsCard}>
            <Card.Title title="💡 Pro Tips" titleStyle={styles.cardTitle} />
            <Divider />
            <Card.Content>
              <Text style={styles.tipsText}>
                • Mark routes as favorites for quick access{'\n'}
                • Your most used routes appear at the top{'\n'}
                • Set alerts for each saved route{'\n'}
                • Remove routes you no longer use
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.spacer} />
        </ScrollView>
      )}

      {/* FAB */}
      <FAB
        icon="plus"
        label="Save Route"
        style={styles.fab}
        onPress={() => navigation.navigate('Search')}
      />
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
  },
  searchBtn: {
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: CONSTANTS.Colors.primary,
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
  routesList: {
    gap: 8,
  },
  routeCard: {
    backgroundColor: '#fff',
  },
  favoriteCard: {
    borderLeftWidth: 4,
    borderLeftColor: CONSTANTS.Colors.danger,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  routeNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: CONSTANTS.Colors.primary,
  },
  routePath: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: '#999',
  },
  divider: {
    marginVertical: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  buttonLabel: {
    fontSize: 12,
  },
  statsCard: {
    backgroundColor: '#fff',
    marginTop: 8,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: CONSTANTS.Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
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
  tipsText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: CONSTANTS.Colors.primary,
  },
  spacer: {
    height: 80,
  },
})
