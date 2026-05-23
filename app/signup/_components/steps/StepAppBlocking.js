import { useState } from 'react'
import { X } from 'lucide-react'
import { APP_ICONS, APP_SUGGESTIONS, inputCls } from '../../_lib/constants'
import { Field, StepCard, StepFooter } from '../StepShell'

export function StepAppBlocking({ onNext, onBack }) {
  const [enabled, setEnabled] = useState(false)
  const [query, setQuery] = useState('')
  const [blockedApps, setBlockedApps] = useState([])

  const addApp = (name) => {
    const val = name || query.trim()
    if (!val || blockedApps.includes(val)) return
    setBlockedApps((prev) => [...prev, val])
    setQuery('')
  }

  const removeApp = (i) => setBlockedApps((prev) => prev.filter((_, idx) => idx !== i))

  return (
    <StepCard title="App blocking" sub="Choose whether to restrict apps on your children's devices">
      <div className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--background)] px-5 py-4">
        <div>
          <p className="text-[0.84rem] font-semibold text-[var(--foreground)]">Enable app blocking</p>
          <p className="mt-0.5 text-[0.72rem] text-[var(--muted)]">
            Prevent access to specific apps on linked devices
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-5 grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Field label="Search apps to block">
            <div className="flex gap-2">
              <input
                type="text"
                className={`${inputCls} flex-1`}
                placeholder="e.g. TikTok, Instagram…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addApp()}
              />
              <button
                onClick={() => addApp()}
                className="rounded bg-[var(--accent)] px-4 font-sans text-[0.72rem] font-semibold uppercase tracking-wider text-white transition hover:bg-[var(--accent-hover)] whitespace-nowrap"
              >
                Block
              </button>
            </div>
          </Field>

          <div className="flex flex-wrap gap-2">
            {APP_SUGGESTIONS.filter((a) => !blockedApps.includes(a)).map((a) => (
              <button
                key={a}
                onClick={() => addApp(a)}
                className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 font-sans text-[0.72rem] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                + {a}
              </button>
            ))}
          </div>

          {blockedApps.length > 0 && (
            <div className="grid gap-2">
              {blockedApps.map((app, i) => {
                const icon = APP_ICONS[app.toLowerCase()] ?? '📱'
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--background)] px-4 py-3"
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="flex-1 font-sans text-[0.84rem] font-medium text-[var(--foreground)]">
                      {app}
                    </span>
                    <span className="rounded bg-red-50 px-2 py-0.5 font-sans text-[0.65rem] font-semibold uppercase tracking-wider text-red-600">
                      Blocked
                    </span>
                    <button
                      onClick={() => removeApp(i)}
                      className="ml-1 rounded p-1 text-[var(--muted)] transition hover:bg-[var(--border)] hover:text-[var(--foreground)]"
                      aria-label="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continue →" />
    </StepCard>
  )
}
