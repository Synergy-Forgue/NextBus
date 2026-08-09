import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { BRAND } from '../styles/brand'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

/**
 * Alerts & Notifications (Figma): push toggle, active route
 * subscriptions with pause/resume, and Recent Updates fed LIVE
 * from the backend alerts pipeline (/api/alerts).
 */
export default function ActiveAlertsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true)
  const [subs, setSubs] = useState([
    { id: '10K', label: 'Route 10K', detail: 'Daily · 8:00 AM', paused: false },
    { id: '900K', label: 'Route 900K', detail: 'Weekdays', paused: true },
  ])
  const [updates, setUpdates] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadUpdates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts`)
      if (res.ok) setUpdates(await res.json())
    } catch {
      /* offline */
    }
  }

  useEffect(() => {
    loadUpdates()
    const t = setInterval(loadUpdates, 30000)
    return () => clearInterval(t)
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadUpdates()
    setRefreshing(false)
  }

  const togglePause = (id: string) => {
    setSubs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, paused: !s.paused } : s))
    )
  }

  const updateStyle = (a: any) => {
    if (a.status === 'resolved')
      return { icon: '✅', title: 'Resolved', bg: BRAND.successSoft, fg: '#047857' }
    if (a.type === 'sos')
      return { icon: '🚨', title: 'Emergency', bg: BRAND.dangerSoft, fg: '#991B1B' }
    return { icon: '🔧', title: 'Breakdown', bg: BRAND.warningSoft, fg: '#92400E' }
  }

  const timeAgo = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.round(mins / 60)
    return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Text style={styles.title}>Transit Alerts</Text>
      </View>

      {/* Push toggle */}
      <View style={styles.pushCard}>
        <View style={styles.pushIcon}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </View>
        <View style={styles.pushInfo}>
          <Text style={styles.pushTitle}>Push Notifications</Text>
          <Text style={styles.pushSub}>Manage all your transit updates</Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={setPushEnabled}
          trackColor={{ false: BRAND.border, true: '#C7D2FE' }}
          thumbColor={pushEnabled ? BRAND.primary : '#FFF'}
        />
      </View>

      {/* Route subscriptions */}
      <Text style={styles.sectionLabel}>ACTIVE ROUTE SUBSCRIPTIONS</Text>
      {subs.map((s) => (
        <View key={s.id} style={styles.subCard}>
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>{s.id}</Text>
          </View>
          <View style={styles.subInfo}>
            <Text style={styles.subTitle}>{s.label}</Text>
            <Text style={styles.subDetail}>
              {s.paused ? 'Paused' : s.detail}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.subBtn, s.paused && styles.subBtnResume]}
            onPress={() => togglePause(s.id)}
          >
            <Text
              style={[styles.subBtnText, s.paused && styles.subBtnResumeText]}
            >
              {s.paused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Recent updates — live backend alerts */}
      <Text style={styles.sectionLabel}>RECENT UPDATES</Text>
      {updates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No recent service updates 🎉</Text>
        </View>
      ) : (
        updates.slice(0, 8).map((a) => {
          const s = updateStyle(a)
          return (
            <View key={a.id} style={[styles.updateCard, { backgroundColor: s.bg }]}>
              <Text style={styles.updateIcon}>{s.icon}</Text>
              <View style={styles.updateInfo}>
                <View style={styles.updateHeader}>
                  <Text style={[styles.updateTitle, { color: s.fg }]}>
                    {s.title}: Route {a.route_number || '?'} · Bus{' '}
                    {a.license_plate || '?'}
                  </Text>
                  <Text style={styles.updateTime}>{timeAgo(a.created_at)}</Text>
                </View>
                <Text style={[styles.updateBody, { color: s.fg }]}>
                  {a.description ||
                    (a.type === 'sos'
                      ? 'Emergency reported on this bus.'
                      : 'Bus reported a mechanical issue. Expect delays.')}
                </Text>
              </View>
            </View>
          )
        })
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: BRAND.surface,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND.text,
  },
  pushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    ...BRAND.shadow,
  },
  pushIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pushInfo: {
    flex: 1,
  },
  pushTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  pushSub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    ...BRAND.shadow,
  },
  subBadge: {
    backgroundColor: BRAND.primary,
    borderRadius: BRAND.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
  },
  subBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  subInfo: {
    flex: 1,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.text,
  },
  subDetail: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  subBtn: {
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BRAND.surfaceMuted,
  },
  subBtnResume: {
    backgroundColor: BRAND.primary,
  },
  subBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.textSecondary,
  },
  subBtnResumeText: {
    color: '#FFF',
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: BRAND.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  updateCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: BRAND.radius.lg,
    padding: 14,
  },
  updateIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  updateInfo: {
    flex: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  updateTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  updateTime: {
    fontSize: 11,
    color: BRAND.textTertiary,
    fontWeight: '600',
  },
  updateBody: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.9,
  },
})
