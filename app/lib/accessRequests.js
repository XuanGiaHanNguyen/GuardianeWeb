// JS port of iOS access-request handling
// (Services/FirebaseService.swift + ViewModels/AccessRequestViewModel.swift).
//
// Collection: `accessRequests`. Document shape mirrors AccessRequest.swift:
//   { childId, parentId, moduleId, requestedApp, requestedAt, status,
//     approvedAt?, deniedAt?, timeLimit?, expiresAt?, reason? }
//
// The listener queries by `parentId` (matches iOS + likely security rules).
// We then apply an additional client-side filter so only requests whose
// `childId` belongs to the parent's current family are surfaced — extra safety
// for the "only the family's children, not other children" guarantee.

import {
  collection,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

const ACCESS_REQUESTS = 'accessRequests'

export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  EXPIRED: 'expired',
}

function tsMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

/**
 * Real-time listener — mirrors iOS `FirebaseService.listenToAccessRequests`.
 * Filters by `parentId`. The optional `familyChildIds` list further restricts
 * the surfaced rows to children that belong to this family (so the parent
 * never sees requests for a child that's no longer in their family). Pass
 * `null` to skip the client-side family filter.
 *
 * Returns an unsubscribe function. `onUpdate(rows)` and `onError(err)` are
 * the snapshot callbacks.
 */
export function listenToAccessRequests({
  parentId,
  familyChildIds = null,
  onUpdate,
  onError,
}) {
  if (!parentId) return () => {}
  const q = query(
    collection(db, ACCESS_REQUESTS),
    where('parentId', '==', parentId),
  )
  const allow = Array.isArray(familyChildIds) ? new Set(familyChildIds) : null
  return onSnapshot(
    q,
    (snap) => {
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (allow) {
        rows = rows.filter((r) => allow.has(r.childId))
      }
      rows.sort((a, b) => tsMillis(b.requestedAt) - tsMillis(a.requestedAt))
      onUpdate?.(rows)
    },
    (err) => onError?.(err),
  )
}

/**
 * Approve a pending request. Matches iOS `approveRequest(_:)`.
 * `timeLimitSeconds` defaults to 1 hour. `expiresAt` is computed as
 * now + timeLimit. Optional `reason` is attached if non-empty.
 */
export async function approveAccessRequest(requestId, { timeLimitSeconds = 3600, reason = '' } = {}) {
  const now = new Date()
  const expires = new Date(now.getTime() + timeLimitSeconds * 1000)
  const data = {
    status: REQUEST_STATUS.APPROVED,
    approvedAt: serverTimestamp(),
    timeLimit: timeLimitSeconds,
    expiresAt: Timestamp.fromDate(expires),
  }
  const trimmedReason = (reason || '').trim()
  if (trimmedReason) data.reason = trimmedReason
  await updateDoc(doc(db, ACCESS_REQUESTS, requestId), data)
}

/**
 * Deny a pending request. Matches iOS `denyRequest(_:reason:)`.
 */
export async function denyAccessRequest(requestId, { reason = '' } = {}) {
  const data = {
    status: REQUEST_STATUS.DENIED,
    deniedAt: serverTimestamp(),
  }
  const trimmedReason = (reason || '').trim()
  if (trimmedReason) data.reason = trimmedReason
  await updateDoc(doc(db, ACCESS_REQUESTS, requestId), data)
}

/**
 * Hard-delete a request. Matches iOS `deleteAccessRequest(requestId:)`.
 */
export async function deleteAccessRequest(requestId) {
  await deleteDoc(doc(db, ACCESS_REQUESTS, requestId))
}

/**
 * True if the request was approved with an expiry that's now in the past.
 */
export function isAccessRequestExpired(request) {
  if (!request?.expiresAt) return false
  const ms = tsMillis(request.expiresAt)
  return ms > 0 && ms < Date.now()
}

/**
 * Effective status — promotes approved-but-past-expiry to `expired`.
 * Mirrors how iOS treats expired approvals.
 */
export function effectiveRequestStatus(request) {
  if (!request) return REQUEST_STATUS.PENDING
  if (request.status === REQUEST_STATUS.APPROVED && isAccessRequestExpired(request)) {
    return REQUEST_STATUS.EXPIRED
  }
  return request.status || REQUEST_STATUS.PENDING
}

/**
 * Format a time-limit (in seconds) as a "Xh Ym" / "Ym" string.
 * Matches iOS `getTimeLimitDisplay(_:)`.
 */
export function formatTimeLimit(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export const TIME_LIMIT_OPTIONS = [
  { id: 30 * 60, label: '30 minutes' },
  { id: 60 * 60, label: '1 hour' },
  { id: 2 * 60 * 60, label: '2 hours' },
  { id: 4 * 60 * 60, label: '4 hours' },
  { id: 24 * 60 * 60, label: '1 day' },
]

export const DENIAL_QUICK_REASONS = [
  'Screen time limit reached for today',
  'Please complete more learning modules before requesting access',
  'This app is not appropriate for your age',
  'Please complete your homework first',
]
