'use client'

// Notifications store — three-tier read path that mirrors the architecture spec:
//   L1 in-memory React state (this hook)
//   L2 IndexedDB              (notificationsCache.js, 7-day TTL)
//   L4 Firestore              (source of truth, subscribed via onSnapshot)
//
// L3 Redis is intentionally skipped — there's no backend server, and Firestore's
// onSnapshot already provides the WebSocket-style push tier described as Tier 1.
//
// Read flow on cold start:
//   render → hydrate L1 from L2 immediately (fast paint) → onSnapshot replaces
//   L1 with authoritative L4 data → mirror back to L2.
//
// Write flow (alerts arrive from Cloud Functions):
//   Firestore write → onSnapshot fires → L1 updated → async persist to L2.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { COLLECTIONS } from './database'
import { useAuth } from '../context/AuthContext'
import { readCachedAlerts, writeCachedAlerts } from './notificationsCache'

const MAX_ALERTS = 50
const READ_AT_KEY = 'guardiane.notifications.readAt'
const EMPTY_ALERTS = []

const NotificationsContext = createContext({
  alerts: [],
  unreadCount: 0,
  loading: true,
  markAllRead: () => {},
})

function toMillis(ts) {
  if (!ts) return 0
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (ts instanceof Date) return ts.getTime()
  return 0
}

// Strip Firestore Timestamp wrappers so the row is JSON-safe for IndexedDB.
function serializeAlert(raw) {
  const timestampMs = toMillis(raw.timestamp)
  return {
    id: raw.id,
    familyId: raw.familyId ?? null,
    childId: raw.childId ?? null,
    type: raw.type ?? null,
    message: raw.message ?? null,
    severity: raw.severity ?? null,
    status: raw.status ?? null,
    timestampMs,
  }
}

function readReadAt() {
  if (typeof window === 'undefined') return 0
  const raw = window.localStorage.getItem(READ_AT_KEY)
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

export function NotificationsProvider({ children }) {
  const { userProfile } = useAuth()
  const familyId = userProfile?.familyId ?? null

  const [alertsState, setAlertsState] = useState([])
  const [loadingState, setLoadingState] = useState(true)
  const [readAt, setReadAt] = useState(() => readReadAt())

  // L2 → L1 hydrate on cold start (fast paint while the listener warms up).
  useEffect(() => {
    if (!familyId) return undefined
    let cancelled = false
    readCachedAlerts(familyId).then((cached) => {
      if (cancelled) return
      if (cached.length > 0) setAlertsState(cached.slice(0, MAX_ALERTS))
    })
    return () => {
      cancelled = true
    }
  }, [familyId])

  // L4 live subscription — Firestore onSnapshot is the WebSocket push tier.
  useEffect(() => {
    if (!familyId) return undefined
    const q = query(
      collection(db, COLLECTIONS.ALERTS),
      where('familyId', '==', familyId),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => serializeAlert({ id: d.id, ...d.data() }))
          .sort((a, b) => b.timestampMs - a.timestampMs)
          .slice(0, MAX_ALERTS)
        setAlertsState(rows)
        setLoadingState(false)
        // Fire-and-forget mirror to L2.
        writeCachedAlerts(rows).catch(() => {})
      },
      () => setLoadingState(false),
    )
    return unsub
  }, [familyId])

  // Derive public view: when there's no family, nothing to show and nothing to load.
  const alerts = useMemo(
    () => (familyId ? alertsState : EMPTY_ALERTS),
    [familyId, alertsState],
  )
  const loading = familyId ? loadingState : false

  const markAllRead = useCallback(() => {
    const now = Date.now()
    setReadAt(now)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(READ_AT_KEY, String(now))
    }
  }, [])

  const unreadCount = useMemo(
    () => alerts.filter((a) => a.timestampMs > readAt).length,
    [alerts, readAt],
  )

  const value = useMemo(
    () => ({ alerts, unreadCount, loading, markAllRead }),
    [alerts, unreadCount, loading, markAllRead],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
