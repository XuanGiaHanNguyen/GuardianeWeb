"use client";

// App Restrictions manager — web port of AppBlockManagerView.swift.
//
// iOS uses Apple's FamilyActivityPicker + ManagedSettings to block apps
// locally on the device. The browser can't enforce that, so the web manager
// edits the syncable policy on the child document (`blockedApps` +
// `screenTimeLimit`, both already on the iOS Child model) for the child's
// device app to enforce. Mirrors the iOS layout: header, app selection,
// blocked-apps summary, and a clear-all action — plus a per-child selector
// and a daily screen-time limit.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { APP_CATEGORIES, appName } from "../../lib/apps";
import { updateChildRestrictions } from "../../lib/database";

function formatLimit(minutes) {
  if (!minutes) return "No limit";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function AppBlockManagerModal({
  open,
  onClose,
  childList = [],
  initialChildId = null,
  onSaved,
}) {
  if (!open || typeof document === "undefined") return null;
  return (
    <Content
      onClose={onClose}
      childList={childList}
      initialChildId={initialChildId}
      onSaved={onSaved}
    />
  );
}

function Content({ onClose, childList, initialChildId, onSaved }) {
  const [selectedChildId, setSelectedChildId] = useState(
    initialChildId || childList[0]?.id || null,
  );
  const [blocked, setBlocked] = useState(() => new Set());
  const [screenTimeLimit, setScreenTimeLimit] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const selectedChild = useMemo(
    () => childList.find((c) => c.id === selectedChildId) || null,
    [childList, selectedChildId],
  );

  // Load the selected child's existing policy whenever it changes.
  useEffect(() => {
    if (!selectedChild) {
      setBlocked(new Set());
      setScreenTimeLimit(0);
      return;
    }
    setBlocked(new Set(selectedChild.blockedApps || []));
    setScreenTimeLimit(
      typeof selectedChild.screenTimeLimit === "number"
        ? selectedChild.screenTimeLimit
        : 0,
    );
    setSavedFlash(false);
  }, [selectedChild]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function toggleApp(id) {
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSavedFlash(false);
  }

  function clearAll() {
    setBlocked(new Set());
    setScreenTimeLimit(0);
    setSavedFlash(false);
  }

  async function handleSave() {
    if (!selectedChild) return;
    setSaving(true);
    try {
      await updateChildRestrictions(selectedChild.id, {
        blockedApps: Array.from(blocked),
        screenTimeLimit,
      });
      onSaved?.();
      setSavedFlash(true);
    } catch (_) {
      // Surface nothing destructive; leave the form as-is so the parent can retry.
    } finally {
      setSaving(false);
    }
  }

  const childFirstName = selectedChild?.name?.split(" ")[0] || "your child";
  const blockedCount = blocked.size;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-block-title"
        onClick={(e) => e.stopPropagation()}
        className="relative my-4 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-elevated)]"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="w-12" />
          <h1
            id="app-block-title"
            className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]"
          >
            App Restrictions
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="w-12 text-right text-[15px] font-semibold text-[var(--accent)] hover:opacity-80"
          >
            Done
          </button>
        </div>

        <div className="space-y-5 px-5 pb-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 pt-1 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-bg)]">
              <svg
                width="28"
                height="28"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
                <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
                <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
              </svg>
            </div>
            <h2 className="text-[18px] font-bold text-[var(--foreground)]">
              Block Distracting Apps
            </h2>
            <p className="text-[13px] text-[var(--muted)]">
              Select apps to block on {childFirstName}&apos;s device. Changes
              sync to the child app.
            </p>
          </div>

          {childList.length === 0 ? (
            <p className="rounded-xl bg-[var(--surface-muted)] px-4 py-6 text-center text-[13px] text-[var(--muted)]">
              Add a child first to manage app restrictions.
            </p>
          ) : (
            <>
              {/* Child selector */}
              {childList.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {childList.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChildId(c.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                        c.id === selectedChildId
                          ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {c.name?.split(" ")[0] || "Child"}
                    </button>
                  ))}
                </div>
              )}

              {/* Screen time limit */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--foreground)]">
                      Daily screen time
                    </p>
                    <p className="text-[12.5px] text-[var(--muted)]">
                      Total app time allowed per day
                    </p>
                  </div>
                  <span className="text-[15px] font-semibold text-[var(--accent)]">
                    {formatLimit(screenTimeLimit)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={480}
                  step={15}
                  value={screenTimeLimit}
                  onChange={(e) => {
                    setScreenTimeLimit(Number(e.target.value));
                    setSavedFlash(false);
                  }}
                  className="mt-3 w-full accent-[var(--accent)]"
                  aria-label="Daily screen time limit"
                />
              </div>

              {/* Blocked summary */}
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[var(--foreground)]">
                  Blocked Apps ({blockedCount})
                </h3>
                {(blockedCount > 0 || screenTimeLimit > 0) && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[12.5px] font-semibold text-rose-500 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* App catalog grouped by category */}
              <div className="space-y-4">
                {APP_CATEGORIES.map((cat) => (
                  <div key={cat.id}>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {cat.label}
                    </p>
                    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                      {cat.apps.map((app, i) => (
                        <label
                          key={app.id}
                          className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 ${
                            i === cat.apps.length - 1
                              ? ""
                              : "border-b border-[var(--border)]"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[13px] font-semibold text-[var(--foreground)]">
                              {app.name[0]}
                            </span>
                            <span className="text-[14px] text-[var(--foreground)]">
                              {app.name}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={blocked.has(app.id)}
                            onChange={() => toggleApp(app.id)}
                            className="h-5 w-5 accent-[var(--accent)]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Save */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {saving
                    ? "Saving…"
                    : savedFlash
                      ? "Saved ✓"
                      : "Save Restrictions"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
