'use client'

import { useEffect, useRef } from 'react'
import { useNotifications } from '../app/lib/useNotifications'

const SEVERITY_DOT = {
  critical: 'bg-[var(--danger)]',
  error: 'bg-[var(--danger)]',
  warning: 'bg-amber-500',
  info: 'bg-[var(--accent)]',
}

function relativeTime(ms) {
  if (!ms) return ''
  const diff = Math.max(0, Date.now() - ms)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ms).toLocaleDateString()
}

export function NotificationPanel({ open, onClose }) {
  const { alerts, loading, markAllRead } = useNotifications()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--background)] shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2.5">
        <p className="text-[11px] font-semibold text-[var(--foreground)]">
          Notifications
        </p>
        {alerts.length > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-[10px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {loading && alerts.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-[var(--muted)]">
            Loading…
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-[var(--muted)]">
            No notifications yet
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {alerts.map((a) => {
              const dot = SEVERITY_DOT[a.severity] ?? 'bg-[var(--muted)]'
              return (
                <li key={a.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-[var(--foreground)]">
                      {a.type || a.message || 'Alert'}
                    </p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {relativeTime(a.timestampMs)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
