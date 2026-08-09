import { useEffect, useRef, useState } from 'react'
import useCommuterStore from '../store/useCommuterStore'

/**
 * useRealTimeBus — live bus tracking for the Commuter App.
 *
 * Subscribes to the backend's raw WebSocket at ws://<server>/ws/subscribe.
 * Protocol (see BACKEND/src/tracking/tracking.ws.ts):
 *   on connect  → { type: 'SNAPSHOT',   data: LiveBusState[] }
 *   per update  → { type: 'BUS_UPDATE', data: LiveBusState & { stop_etas } }
 *   bus offline → { type: 'BUS_OFFLINE', trip_id }
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'

/** Map a backend LiveBusState into the store's BusPosition shape */
function toBusPosition(bus: any, routeNumbers: Record<number, string>) {
  // First upcoming stop with a numeric ETA
  const nextEta = (bus.stop_etas || []).find(
    (s: any) => s.eta_seconds !== null && s.eta_seconds !== undefined
  )
  return {
    busId: String(bus.trip_id),
    lat: bus.latitude,
    lng: bus.longitude,
    routeNo: routeNumbers[bus.route_id] || String(bus.route_id),
    // occupancy (0–50 seats) → 0–10 crowd scale
    crowdLevel: Math.min(10, Math.round((bus.occupancy_count || 0) / 5)),
    speed: Math.round(bus.speed || 0),
    eta: nextEta ? Math.max(1, Math.round(nextEta.eta_seconds / 60)) : undefined,
    licensePlate: bus.license_plate,
  }
}

export default function useRealTimeBus(routeId?: number) {
  const wsRef = useRef<WebSocket | null>(null)
  const routeNumbersRef = useRef<Record<number, string>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { busPositions, updateBusPosition, removeBusPosition, setBusPositions } = useCommuterStore()

  useEffect(() => {
    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    // Load route_id → route_number mapping once for friendly labels
    fetch(`${API_URL}/api/routes`)
      .then((r) => r.json())
      .then((routes: any[]) => {
        const map: Record<number, string> = {}
        for (const r of routes) map[r.id] = r.route_number
        routeNumbersRef.current = map
      })
      .catch(() => { /* labels fall back to route_id */ })

    const wsUrl =
      API_URL.replace(/^http/, 'ws') +
      '/ws/subscribe' +
      (routeId ? `?route_id=${routeId}` : '')

    const connect = () => {
      if (cancelled) return
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setError(null)
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string)
          if (msg.type === 'SNAPSHOT') {
            const positions: Record<string, any> = {}
            for (const bus of msg.data) {
              positions[String(bus.trip_id)] = toBusPosition(bus, routeNumbersRef.current)
            }
            setBusPositions(positions)
          } else if (msg.type === 'BUS_UPDATE') {
            const pos = toBusPosition(msg.data, routeNumbersRef.current)
            updateBusPosition(pos.busId, pos)
          } else if (msg.type === 'BUS_OFFLINE') {
            removeBusPosition(String(msg.trip_id))
          }
        } catch {
          /* ignore malformed frames */
        }
      }

      ws.onerror = () => setError('Live tracking connection error')

      ws.onclose = () => {
        setIsConnected(false)
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [routeId])

  return { busPositions, isConnected, error }
}
