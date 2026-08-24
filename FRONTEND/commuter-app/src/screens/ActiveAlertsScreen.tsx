import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import useCommuterStore from '../store/useCommuterStore';
import { BRAND } from '../styles/brand';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://nextbus-production.up.railway.app';

export default function ActiveAlertsScreen({ navigation }: any) {
  const {
    activeAlerts,
    toggleAlertPause,
    removeAlert,
    pushEnabled,
    setPushEnabled,
  } = useCommuterStore();

  const [updates, setUpdates] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadUpdates = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts?status=active`);
      if (res.ok) {
        const data = await res.json();
        setUpdates(Array.isArray(data) ? data : []);
      }
    } catch {
      /* offline fallback */
    }
  };

  useEffect(() => {
    loadUpdates();
    const t = setInterval(loadUpdates, 20000);
    return () => clearInterval(t);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUpdates();
    setRefreshing(false);
  };

  const handleDelete = (alertId: string, routeName: string) => {
    Alert.alert('Delete Alert', `Remove alert for ${routeName}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        onPress: () => removeAlert(alertId),
        style: 'destructive',
      },
    ]);
  };

  const updateStyle = (a: any) => {
    if (a.status === 'resolved')
      return { icon: '✅', title: 'Resolved', bg: BRAND.successSoft, fg: '#047857' };
    if (a.type === 'sos')
      return { icon: '🚨', title: 'Emergency Broadcast', bg: BRAND.dangerSoft, fg: '#991B1B' };
    return { icon: '🔧', title: 'Service Delay', bg: BRAND.warningSoft, fg: '#92400E' };
  };

  const timeAgo = (iso: string) => {
    if (!iso) return 'recently';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Text style={styles.title}>Transit Alerts & Notifications</Text>
      </View>

      {/* Global Push Notifications Toggle */}
      <View style={styles.pushCard}>
        <View style={styles.pushIcon}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </View>
        <View style={styles.pushInfo}>
          <Text style={styles.pushTitle}>Push Notifications</Text>
          <Text style={styles.pushSub}>Receive real-time arrival & emergency alerts</Text>
        </View>
        <Switch
          value={pushEnabled}
          onValueChange={setPushEnabled}
          trackColor={{ false: BRAND.border, true: '#C7D2FE' }}
          thumbColor={pushEnabled ? BRAND.primary : '#FFF'}
        />
      </View>

      {/* Active Route Subscriptions from Store */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>
          ACTIVE ROUTE SUBSCRIPTIONS ({activeAlerts.length})
        </Text>
      </View>

      {activeAlerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No Active Route Alerts</Text>
          <Text style={styles.emptySub}>
            Tap "Set Alert" on any bus or route to receive smart departure notifications.
          </Text>
        </View>
      ) : (
        activeAlerts.map((s) => (
          <View key={s.id} style={styles.subCard}>
            <View style={[styles.subBadge, s.paused && { backgroundColor: BRAND.surfaceMuted }]}>
              <Text style={[styles.subBadgeText, s.paused && { color: BRAND.textSecondary }]}>
                {s.route_number || 'Route'}
              </Text>
            </View>
            <View style={styles.subInfo}>
              <Text style={styles.subTitle}>
                {s.route_name || `Route ${s.route_number}`}
              </Text>
              <Text style={styles.subDetail}>
                {s.paused ? '⏸ Paused' : s.description || `${s.thresholdMinutes || 10}m arrival alert`}
              </Text>
            </View>
            <View style={styles.subActions}>
              <TouchableOpacity
                style={[styles.subBtn, s.paused && styles.subBtnResume]}
                onPress={() => toggleAlertPause(s.id)}
              >
                <Text style={[styles.subBtnText, s.paused && styles.subBtnResumeText]}>
                  {s.paused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(s.id, s.route_number || 'Route')}
              >
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Recent Transit Updates from Railway Backend */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>LIVE NETWORK DISRUPTIONS & UPDATES</Text>
      </View>

      {updates.length === 0 ? (
        <View style={styles.allClearCard}>
          <Text style={styles.allClearIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.allClearTitle}>All Services Running Normally</Text>
            <Text style={styles.allClearSub}>No active breakdowns or SOS incidents reported across the network.</Text>
          </View>
        </View>
      ) : (
        updates.map((a) => {
          const s = updateStyle(a);
          return (
            <View key={a.id} style={[styles.updateCard, { backgroundColor: s.bg }]}>
              <Text style={styles.updateIcon}>{s.icon}</Text>
              <View style={styles.updateInfo}>
                <View style={styles.updateHeader}>
                  <Text style={[styles.updateTitle, { color: s.fg }]}>
                    {s.title}: Route {a.route_number || '?'} · Bus {a.license_plate || '?'}
                  </Text>
                  <Text style={styles.updateTime}>{timeAgo(a.created_at)}</Text>
                </View>
                <Text style={[styles.updateBody, { color: s.fg }]}>
                  {a.description ||
                    (a.type === 'sos'
                      ? 'Emergency signal broadcast on this vehicle.'
                      : 'Mechanical issue reported. Expect route delays.')}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
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
    fontWeight: '900',
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
    fontWeight: '800',
    color: BRAND.text,
  },
  pushSub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: BRAND.textTertiary,
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 24,
    alignItems: 'center',
    ...BRAND.shadow,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.text,
  },
  emptySub: {
    fontSize: 12,
    color: BRAND.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
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
    fontWeight: '800',
    color: BRAND.text,
  },
  subDetail: {
    fontSize: 12,
    color: BRAND.textSecondary,
    marginTop: 2,
  },
  subActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subBtn: {
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
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
  deleteBtn: {
    padding: 4,
  },
  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: BRAND.successSoft,
    borderRadius: BRAND.radius.lg,
    padding: 16,
    gap: 12,
  },
  allClearIcon: {
    fontSize: 24,
  },
  allClearTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  allClearSub: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 2,
    lineHeight: 16,
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
});
