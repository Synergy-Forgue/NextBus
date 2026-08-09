import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { Text, Card, Button, Divider, Chip, Icon } from 'react-native-paper'
import useCommuterStore from '../store/useCommuterStore'
import { CONSTANTS } from '../utils/constants'

export default function BusDetailsScreen({ route, navigation }: any) {
  const { params } = route
  const bus = params?.bus || {}
  const [isFavorite, setIsFavorite] = useState(false)
  const [tripSharing, setTripSharing] = useState(false)

  const handleSetAlert = () => {
    navigation.navigate('SetAlert', { bus })
  }

  const handleTripSharing = () => {
    setTripSharing(!tripSharing)
    Alert.alert(
      'Trip Sharing',
      tripSharing
        ? 'Trip sharing stopped'
        : 'Share this trip with your trusted contacts?',
    )
  }

  const mockStops = [
    { id: 1, name: 'Central Station', time: '09:15', distance: 0 },
    { id: 2, name: 'City Center', time: '09:28', distance: 3.2 },
    { id: 3, name: 'Tech Park Gate', time: '09:45', distance: 8.5 },
    { id: 4, name: 'Airport Road', time: '10:05', distance: 15.2 },
    { id: 5, name: 'Terminal', time: '10:20', distance: 18.6 },
  ]

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerTop}>
              <Text style={styles.routeNumber}>{bus.routeNo || '5A'}</Text>
              <TouchableOpacity onPress={() => setIsFavorite(!isFavorite)}>
                <Icon
                  source={isFavorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isFavorite ? CONSTANTS.Colors.danger : '#999'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.routePath}>
              <Text style={styles.endpoint}>{bus.source || 'Central Station'}</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.endpoint}>{bus.destination || 'Airport'}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{bus.eta || 8}m</Text>
                <Text style={styles.statLabel}>ETA</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{bus.crowdLevel || 6}/10</Text>
                <Text style={styles.statLabel}>Crowd</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>₹45</Text>
                <Text style={styles.statLabel}>Fare</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {bus.speed || 25}
                  {'\n'}
                  km/h
                </Text>
                <Text style={styles.statLabel}>Speed</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Bus Info Card */}
        <Card style={styles.infoCard}>
          <Card.Title title="Bus Information" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bus Number</Text>
              <Text style={styles.infoValue}>KA-12-AB-1234</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bus Type</Text>
              <Text style={styles.infoValue}>Non-AC</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Capacity</Text>
              <Text style={styles.infoValue}>52 Seats</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Available Seats</Text>
              <Text style={styles.infoValue} style={{ color: CONSTANTS.Colors.success }}>
                22
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amenities</Text>
              <View style={styles.amenityChips}>
                <Chip style={styles.amenityChip}>♀️ Women</Chip>
                <Chip style={styles.amenityChip}>🚽 Toilet</Chip>
                <Chip style={styles.amenityChip}>📡 WiFi</Chip>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Stops Card */}
        <Card style={styles.stopsCard}>
          <Card.Title title="Route Stops" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            {mockStops.map((stop, idx) => (
              <View key={stop.id}>
                <View style={styles.stopItem}>
                  <View style={styles.stopDot} />
                  <View style={styles.stopInfo}>
                    <Text style={styles.stopName}>{stop.name}</Text>
                    <Text style={styles.stopDistance}>{stop.distance} km</Text>
                  </View>
                  <Text style={styles.stopTime}>{stop.time}</Text>
                </View>
                {idx < mockStops.length - 1 && (
                  <View style={styles.stopLine} />
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Features Card */}
        <Card style={styles.featuresCard}>
          <Card.Title title="Safety Features" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Live Tracking</Text>
              <Icon source="check-circle" size={20} color={CONSTANTS.Colors.success} />
            </View>
            <Divider style={styles.divider} />
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Women Safety Features</Text>
              <Icon source="check-circle" size={20} color={CONSTANTS.Colors.success} />
            </View>
            <Divider style={styles.divider} />
            <View style={styles.featureRow}>
              <Text style={styles.featureLabel}>Driver Verified</Text>
              <Icon source="check-circle" size={20} color={CONSTANTS.Colors.success} />
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            buttonColor={CONSTANTS.Colors.primary}
            style={styles.primaryButton}
            onPress={handleSetAlert}
          >
            Set Alert
          </Button>
          <Button
            mode="outlined"
            style={styles.secondaryButton}
            onPress={handleTripSharing}
          >
            {tripSharing ? 'Stop Sharing' : 'Share Trip'}
          </Button>
        </View>

        {/* Rating Card */}
        <Card style={styles.ratingCard}>
          <Card.Title title="Rating & Reviews" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.ratingSection}>
              <Text style={styles.ratingValue}>4.5</Text>
              <Text style={styles.ratingStars}>★★★★★</Text>
              <Text style={styles.ratingCount}>(324 ratings)</Text>
            </View>
            <TouchableOpacity style={styles.reviewButton}>
              <Text style={styles.reviewButtonText}>Write a Review</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>
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
  },
  headerCard: {
    backgroundColor: CONSTANTS.Colors.primary,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  routeNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: CONSTANTS.Colors.primary,
  },
  routePath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  endpoint: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  arrow: {
    fontSize: 16,
    color: CONSTANTS.Colors.primary,
    fontWeight: '700',
  },
  divider: {
    marginVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: CONSTANTS.Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
  },
  infoCard: {
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  amenityChips: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  amenityChip: {
    marginVertical: 4,
  },
  stopsCard: {
    backgroundColor: '#fff',
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: CONSTANTS.Colors.primary,
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  stopDistance: {
    fontSize: 12,
    color: '#999',
  },
  stopTime: {
    fontSize: 12,
    fontWeight: '600',
    color: CONSTANTS.Colors.primary,
  },
  stopLine: {
    position: 'absolute',
    left: 5.5,
    top: 24,
    width: 1,
    height: 36,
    backgroundColor: '#DDD',
  },
  featuresCard: {
    backgroundColor: '#fff',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
    borderColor: CONSTANTS.Colors.primary,
  },
  ratingCard: {
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: '700',
    color: CONSTANTS.Colors.primary,
    marginBottom: 4,
  },
  ratingStars: {
    fontSize: 18,
    color: '#FFB800',
    marginBottom: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#999',
  },
  reviewButton: {
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: CONSTANTS.Colors.primary,
  },
})
