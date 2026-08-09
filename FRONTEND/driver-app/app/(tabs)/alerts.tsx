import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../../src/styles/brand';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Transit Alerts (Figma): push toggle, Recent Updates fed live from the
 * backend alerts pipeline (/api/alerts), Depot Broadcast card.
 */
export default function Alerts() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [updates, setUpdates] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/alerts`);
      if (res.ok) {
        const data = await res.json();
        // Handle both array and object responses
        setUpdates(Array.isArray(data) ? data : data.alerts || []);
      }
    } catch (err) {
      console.error('Alerts fetch error:', err);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const styleFor = (a: any) => {
    if (a.status === 'resolved')
      return { icon: '✅', title: `Resolved: Bus ${a.license_plate || '?'}`, bg: BRAND.successSoft };
    if (a.type === 'sos')
      return { icon: '🚨', title: `SOS: Route ${a.route_number || '?'}`, bg: BRAND.dangerSoft };
    return { icon: '⚠️', title: `Breakdown: Route ${a.route_number || '?'}`, bg: BRAND.warningSoft };
  };

  const timeAgo = (iso: string) => {
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
        <Text style={styles.title}>Transit Alerts</Text>
        <View style={styles.bell}>
          <Text style={{ fontSize: 16 }}>🔔</Text>
        </View>
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

      {/* Recent updates */}
      <View style={styles.updatesHeader}>
        <Text style={styles.sectionLabel}>RECENT UPDATES</Text>
        <Text style={styles.markRead}>Mark all read</Text>
      </View>

      {updates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No service updates right now 🎉</Text>
        </View>
      ) : (
        updates.slice(0, 8).map((a) => {
          const s = styleFor(a);
          return (
            <View key={a.id} style={styles.updateCard}>
              <View style={[styles.updateIconWrap, { backgroundColor: s.bg }]}>
                <Text style={{ fontSize: 16 }}>{s.icon}</Text>
              </View>
              <View style={styles.updateInfo}>
                <View style={styles.updateTop}>
                  <Text style={styles.updateTitle}>{s.title}</Text>
                  <Text style={styles.updateTime}>{timeAgo(a.created_at)}</Text>
                </View>
                <Text style={styles.updateBody}>
                  {a.description ||
                    (a.type === 'sos'
                      ? 'Emergency reported. Depot control notified.'
                      : 'Mechanical issue reported. Repair team dispatched.')}
                </Text>
              </View>
            </View>
          );
        })
      )}

      {/* Depot broadcast */}
      <LinearGradient
        colors={BRAND.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.broadcast}
      >
        <Text style={styles.broadcastTag}>Depot Broadcast</Text>
        <Text style={styles.broadcastTitle}>
          Stay ahead of the curve with real-time system updates.
        </Text>
      </LinearGradient>

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: BRAND.text, letterSpacing: -0.4 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pushInfo: { flex: 1 },
  pushTitle: { fontSize: 15, fontWeight: '700', color: BRAND.text },
  pushSub: { fontSize: 12, color: BRAND.textSecondary, marginTop: 2 },
  updatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: BRAND.textSecondary,
  },
  markRead: { fontSize: 13, fontWeight: '700', color: BRAND.primary },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { color: BRAND.textSecondary, fontSize: 13, fontWeight: '600' },
  updateCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: BRAND.surface,
    borderRadius: BRAND.radius.lg,
    padding: 14,
    ...BRAND.shadow,
  },
  updateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  updateInfo: { flex: 1 },
  updateTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  updateTitle: { fontSize: 14, fontWeight: '800', color: BRAND.text, flex: 1, marginRight: 8 },
  updateTime: { fontSize: 11, color: BRAND.textTertiary, fontWeight: '600' },
  updateBody: { fontSize: 13, color: BRAND.textSecondary, lineHeight: 19 },
  broadcast: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: BRAND.radius.xl,
    padding: 22,
  },
  broadcastTag: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  broadcastTitle: { color: '#FFF', fontSize: 19, fontWeight: '800', lineHeight: 26 },
});
