import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { BRAND } from '../styles/brand'
import type { CityStop } from '../utils/cities'

/**
 * Searchable stop selector.
 *
 * Replaces free-text entry for origin/destination. Typing a stop name by hand
 * had to match the backend's ILIKE search exactly enough to return anything, so
 * a typo silently produced "no routes found" with no indication why. Picking
 * from the real stop list makes the search always well-formed.
 */

interface Props {
  visible: boolean
  title: string
  stops: CityStop[]
  /** Stop the user must not pick again (the other end of the journey). */
  excludeStopId?: number | null
  onSelect: (stop: CityStop) => void
  onClose: () => void
}

export default function StopPicker({ visible, title, stops, excludeStopId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return stops
      .filter((s) => s.stop_id !== excludeStopId)
      .filter((s) => (q ? s.stop_name.toLowerCase().includes(q) : true))
  }, [stops, query, excludeStopId])

  const close = () => {
    setQuery('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search stops…"
              placeholderTextColor={BRAND.textTertiary}
              autoFocus
            />
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No stops match “{query}”.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.stop_id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    setQuery('')
                    onSelect(item)
                  }}
                >
                  <Text style={styles.rowIcon}>🚏</Text>
                  <Text style={styles.rowText}>{item.stop_name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BRAND.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 20,
    height: '75%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: BRAND.text },
  close: { fontSize: 18, fontWeight: '800', color: BRAND.textSecondary },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.surfaceMuted,
    borderRadius: BRAND.radius.pill,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  search: { flex: 1, height: 46, fontSize: 14, fontWeight: '600', color: BRAND.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
  },
  rowIcon: { fontSize: 15 },
  rowText: { fontSize: 15, fontWeight: '600', color: BRAND.text },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: BRAND.textSecondary },
})
