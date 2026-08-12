import React, { useState } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native'
import { Text, Card, Button, Divider, Icon } from 'react-native-paper'
import { CONSTANTS } from '../utils/constants'

interface ReportData {
  week: string
  timeSaved: number
  onTimePercentage: number
  mostReliableRoute: string
  co2Saved: number
  busesUsed: number
  totalTrips: number
  averageWaitTime: number
  favoriteTime: string
  topRoute: string
}

export default function BusReportCardScreen({ navigation }: any) {
  const [selectedWeek, setSelectedWeek] = useState('current')

  const mockReportData: ReportData = {
    week: 'This Week',
    timeSaved: 240,
    onTimePercentage: 92,
    mostReliableRoute: '5A',
    co2Saved: 12.5,
    busesUsed: 3,
    totalTrips: 12,
    averageWaitTime: 6,
    favoriteTime: 'Morning (8-9 AM)',
    topRoute: 'Central Station → Airport',
  }

  const handleShareReport = async () => {
    try {
      const message = `📊 My Weekly Bus Report\n\n` +
        `⏱️ Time Saved: ${mockReportData.timeSaved} mins\n` +
        `✅ On-Time Rate: ${mockReportData.onTimePercentage}%\n` +
        `🚌 Most Reliable: Route ${mockReportData.mostReliableRoute}\n` +
        `🌱 CO2 Saved: ${mockReportData.co2Saved} kg\n\n` +
        `Powered by NextBus 🚌`

      await Share.share({
        message,
        title: 'My Bus Report Card',
      })
    } catch (error) {
      console.error('Share error:', error)
    }
  }

  const StatCard = ({
    icon,
    value,
    label,
    unit,
    color,
  }: {
    icon: string
    value: string | number
    label: string
    unit?: string
    color: string
  }) => (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={styles.statIcon}>
        <Icon source={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color }]}>
          {value}
          {unit && <Text style={styles.statUnit}>{unit}</Text>}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.headerTitle}>Weekly Report Card</Text>
                <Text style={styles.headerWeek}>{mockReportData.week}</Text>
              </View>
              <Icon source="chart-line" size={32} color={CONSTANTS.Colors.primary} />
            </View>
          </Card.Content>
        </Card>

        {/* Main Stats */}
        <View style={styles.mainStats}>
          <StatCard
            icon="timer"
            value={mockReportData.timeSaved}
            label="Minutes Saved"
            unit="m"
            color={CONSTANTS.Colors.primary}
          />
          <StatCard
            icon="check-circle"
            value={mockReportData.onTimePercentage}
            label="On-Time Rate"
            unit="%"
            color={CONSTANTS.Colors.success}
          />
          <StatCard
            icon="leaf"
            value={mockReportData.co2Saved}
            label="CO2 Saved"
            unit="kg"
            color="#4CAF50"
          />
        </View>

        {/* Detailed Stats */}
        <Card style={styles.detailsCard}>
          <Card.Title title="Your Journey" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Total Trips</Text>
              </View>
              <Text style={styles.detailValue}>{mockReportData.totalTrips}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Buses Used</Text>
              </View>
              <Text style={styles.detailValue}>{mockReportData.busesUsed}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Avg. Wait Time</Text>
              </View>
              <Text style={styles.detailValue}>{mockReportData.averageWaitTime}m</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Most Used Route</Text>
              </View>
              <Text style={styles.detailValue}>Route {mockReportData.mostReliableRoute}</Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Text style={styles.detailLabel}>Favorite Time</Text>
              </View>
              <Text style={styles.detailValue}>{mockReportData.favoriteTime}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Insights */}
        <Card style={styles.insightsCard}>
          <Card.Title title="Insights & Achievements" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <View style={styles.insightItem}>
              <Icon source="star" size={20} color={CONSTANTS.Colors.primary} />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Perfect Punctuality!</Text>
                <Text style={styles.insightDesc}>
                  Route {mockReportData.mostReliableRoute} arrived on time in all {mockReportData.totalTrips} trips this week
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.insightItem}>
              <Icon source="leaf" size={20} color="#4CAF50" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Eco Champion</Text>
                <Text style={styles.insightDesc}>
                  By using public transport, you saved {mockReportData.co2Saved}kg of CO2 emissions this week
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.insightItem}>
              <Icon source="lightning-bolt" size={20} color="#FFB800" />
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>Time Master</Text>
                <Text style={styles.insightDesc}>
                  You saved {mockReportData.timeSaved} minutes by using NextBus alerts
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Tips */}
        <Card style={styles.tipsCard}>
          <Card.Title title="Next Week's Tips" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <Text style={styles.tipsText}>
              💡 Try setting AI-Proactive alerts for your morning commute to save even more time{'\n\n'}
              💡 Save your frequent routes for quicker access{'\n\n'}
              💡 Share your report card with friends to encourage sustainable commuting
            </Text>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            buttonColor={CONSTANTS.Colors.primary}
            style={styles.shareButton}
            icon="share-variant"
            onPress={handleShareReport}
          >
            Share on WhatsApp
          </Button>
        </View>

        {/* History */}
        <Card style={styles.historyCard}>
          <Card.Title title="Report History" titleStyle={styles.cardTitle} />
          <Divider />
          <Card.Content>
            <TouchableOpacity style={styles.historyItem}>
              <Text style={styles.historyDate}>Last Week</Text>
              <Icon source="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity style={styles.historyItem}>
              <Text style={styles.historyDate}>2 Weeks Ago</Text>
              <Icon source="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
            <Divider style={styles.divider} />
            <TouchableOpacity style={styles.historyItem}>
              <Text style={styles.historyDate}>3 Weeks Ago</Text>
              <Icon source="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <View style={styles.spacer} />
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
    backgroundColor: '#fff',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  headerWeek: {
    fontSize: 13,
    color: '#999',
  },
  mainStats: {
    gap: 8,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLeft: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '700',
  },
  divider: {
    marginVertical: 8,
  },
  insightsCard: {
    backgroundColor: '#fff',
  },
  insightItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  insightDesc: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  tipsCard: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
  },
  tipsText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  actionButtons: {
    gap: 8,
  },
  shareButton: {
    marginVertical: 8,
  },
  historyCard: {
    backgroundColor: '#fff',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyDate: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  spacer: {
    height: 10,
  },
})
