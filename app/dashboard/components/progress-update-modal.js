"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { updateAssignmentProgress } from "../../lib/learningModules";

export function ProgressUpdateModal({ open, onClose, assignment, onUpdated }) {
  if (!open || typeof document === "undefined" || !assignment) return null;
  return (
    <ProgressUpdateContent
      assignment={assignment}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}

function ProgressUpdateContent({ assignment, onClose, onUpdated }) {
  const [progress, setProgress] = useState(Math.round((assignment.progress || 0) * 100));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

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

  async function handleSave() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await updateAssignmentProgress(assignment.id, progress / 100);
      onUpdated?.();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "Failed to update progress");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-update-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-[var(--shadow-elevated)]"
      >
        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-[14px] font-semibold text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
            >
              Cancel
            </button>
            <h1
              id="progress-update-title"
              className="text-lg font-semibold tracking-tight text-[var(--foreground)]"
            >
              Update Progress
            </h1>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className={`text-[14px] font-semibold transition-colors ${
                submitting
                  ? "cursor-not-allowed text-[var(--muted)]"
                  : "text-[var(--accent)] hover:text-[var(--accent-hover)]"
              }`}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="h-px w-full bg-[var(--border)]" />

          {errorMessage && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-[12.5px] text-[var(--danger)]">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
            <p className="text-3xl font-bold text-[var(--accent)]">{progress}%</p>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {[0, 25, 50, 75, 100].map((v) => {
                const active = progress === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setProgress(v)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {v}%
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
