"use client";

import { useState } from "react";
import { ProgressUpdateModal } from "./progress-update-modal";
import {
  updateAssignmentProgress,
  softDeleteAssignment,
  ASSIGNMENT_PRIORITY,
  ASSIGNMENT_STATUS,
  isAssignmentOverdue,
  effectiveAssignmentStatus,
} from "../../lib/learningModules";

const PRIORITY_META = {
  [ASSIGNMENT_PRIORITY.LOW]: { label: "Low", className: "bg-emerald-500/15 text-emerald-500" },
  [ASSIGNMENT_PRIORITY.MEDIUM]: { label: "Medium", className: "bg-amber-500/15 text-amber-500" },
  [ASSIGNMENT_PRIORITY.HIGH]: { label: "High", className: "bg-rose-500/15 text-rose-500" },
};

const STATUS_META = {
  [ASSIGNMENT_STATUS.ASSIGNED]: { label: "Assigned", className: "bg-sky-500/15 text-sky-500" },
  [ASSIGNMENT_STATUS.IN_PROGRESS]: { label: "In progress", className: "bg-amber-500/15 text-amber-500" },
  [ASSIGNMENT_STATUS.COMPLETED]: { label: "Completed", className: "bg-emerald-500/15 text-emerald-500" },
  [ASSIGNMENT_STATUS.OVERDUE]: { label: "Overdue", className: "bg-rose-500/15 text-rose-500" },
};

function formatDate(value) {
  if (!value) return "—";
  try {
    const d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function DetailRow({ label, value, accent }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[12.5px] text-[var(--muted)]">{label}</span>
      <span className={`text-[13px] font-semibold ${accent || "text-[var(--foreground)]"}`}>
        {value}
      </span>
    </div>
  );
}

export function AssignmentDetailView({
  assignment,
  module: assignedModule,
  child,
  onBack,
  onChanged,
}) {
  const [showProgress, setShowProgress] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!assignment) return null;

  const effStatus = effectiveAssignmentStatus(assignment);
  const overdue = isAssignmentOverdue(assignment);
  const priorityMeta = PRIORITY_META[assignment.priority] || PRIORITY_META[ASSIGNMENT_PRIORITY.MEDIUM];
  const statusMeta = STATUS_META[effStatus] || STATUS_META[ASSIGNMENT_STATUS.ASSIGNED];
  const progressPct = Math.round((assignment.progress || 0) * 100);

  async function handleMarkComplete() {
    setBusy(true);
    setErrorMessage(null);
    try {
      await updateAssignmentProgress(assignment.id, 1);
      onChanged?.();
    } catch (err) {
      setErrorMessage(err.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign() {
    setBusy(true);
    setErrorMessage(null);
    try {
      await softDeleteAssignment(assignment.id);
      onChanged?.();
      onBack?.();
    } catch (err) {
      setErrorMessage(err.message || "Failed to unassign");
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 p-6">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Assignment
          </p>
          <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {assignedModule?.title || "Module"}
          </h1>
        </div>
      </div>

      <div className="h-px w-full bg-[var(--border)]" />

      <div className="space-y-6 p-6">
        {errorMessage && (
          <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-[12.5px] text-[var(--danger)]">
            {errorMessage}
          </div>
        )}

        {/* Module summary */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                {assignedModule?.title || "Module"}
              </p>
              {assignedModule?.subtitle && assignedModule.subtitle !== assignedModule.title && (
                <p className="text-[12px] text-[var(--muted)]">{assignedModule.subtitle}</p>
              )}
              {assignedModule?.description && (
                <p className="line-clamp-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  {assignedModule.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11.5px] text-[var(--muted)]">
                {assignedModule?.estimatedDuration != null && (
                  <span>
                    {Math.round((assignedModule.estimatedDuration || 0) / 60)} min
                  </span>
                )}
                {assignedModule?.category && (
                  <span className="capitalize">{assignedModule.category}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold tracking-tight text-[var(--foreground)]">
              Progress
            </p>
            {!assignment.isCompleted && (
              <button
                type="button"
                onClick={() => setShowProgress(true)}
                className="text-[12px] font-semibold text-[var(--accent)] hover:underline"
              >
                Update
              </button>
            )}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-semibold text-[var(--foreground)]">
              {progressPct}% complete
            </span>
            {assignment.isCompleted && (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14.5-4-4 1.5-1.5 2.5 2.5 5.5-5.5 1.5 1.5z" />
                </svg>
                Completed
              </span>
            )}
          </div>
        </div>

        {/* Assignment details */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-1 text-[14px] font-semibold tracking-tight text-[var(--foreground)]">
            Assignment Details
          </p>
          <div className="divide-y divide-[var(--border)]">
            <DetailRow label="Assigned to" value={child?.name || "Unknown"} />
            <DetailRow label="Assigned date" value={formatDate(assignment.assignedAt)} />
            {assignment.dueDate && (
              <DetailRow
                label="Due date"
                value={formatDate(assignment.dueDate)}
                accent={overdue ? "text-rose-500" : undefined}
              />
            )}
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[12.5px] text-[var(--muted)]">Priority</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityMeta.className}`}>
                {priorityMeta.label}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[12.5px] text-[var(--muted)]">Status</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
            {assignment.quizScore != null && (
              <DetailRow
                label="Quiz score"
                value={`${Math.round(Number(assignment.quizScore) * 100)}%`}
              />
            )}
            {assignment.completedAt && (
              <DetailRow label="Completed" value={formatDate(assignment.completedAt)} />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {!assignment.isCompleted && (
            <button
              type="button"
              onClick={handleMarkComplete}
              disabled={busy}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Working…" : "Mark as Complete"}
            </button>
          )}

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="w-full rounded-2xl bg-rose-500 px-4 py-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Unassign Module
            </button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-[13px] font-semibold text-[var(--foreground)]">
                Unassign this module?
              </p>
              <p className="text-[12px] text-[var(--muted)]">
                The child will no longer see it in their learning hub.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUnassign}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Working…" : "Unassign"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProgressUpdateModal
        open={showProgress}
        onClose={() => setShowProgress(false)}
        assignment={assignment}
        onUpdated={onChanged}
      />
    </div>
  );
}
