// JS port of iOS `LearningModuleService` (Services/LearningModuleService.swift).
// Talks directly to Firestore. Field names and shapes match the iOS writer so
// modules created on either platform are interoperable.
//
// Collections:
//   modules/{id}                       — module documents
//   modules/{id}/lessons/{lessonId}    — lesson documents (subcollection)
//   module_assignments/{childId_moduleId} — per-child assignment
//   learning_progress/{*}              — progress (read-only here)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export const MODULE_CATEGORIES = {
  SAFETY: 'safety',
  PRIVACY: 'privacy',
  CYBERBULLYING: 'cyberbullying',
  SCREEN_TIME: 'screen_time',
  EMOTIONAL_HEALTH: 'emotional_health',
  COMMUNICATION: 'communication',
  CUSTOM: 'custom',
  PARENT: 'parent',
  CHILD: 'child',
}

export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  FILL_BLANK: 'fill_blank',
}

const MODULES = 'modules'
const LESSONS = 'lessons'
const ASSIGNMENTS = 'assignments'
const LEARNING_PROGRESS = 'learning_progress'

export const ASSIGNMENT_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
}

export const ASSIGNMENT_STATUS = {
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
}

function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function withId(snap) {
  return { id: snap.id, ...snap.data() }
}

function tsMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return 0
}

function sortNewestFirst(rows) {
  return [...rows].sort(
    (a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt),
  )
}

// ─── Modules: read ───────────────────────────────────────────────────────────

export async function getModulesByCategory(category) {
  const snap = await getDocs(
    query(collection(db, MODULES), where('category', '==', category)),
  )
  return sortNewestFirst(snap.docs.map(withId))
}

export async function getModulesForChild(childId, category) {
  const rows = await getModulesByCategory(category)
  return rows.filter((m) => {
    if (!m.isChildSpecific) return true
    const targets = Array.isArray(m.targetChildIds) ? m.targetChildIds : []
    return targets.includes(childId)
  })
}

export async function getModuleById(moduleId) {
  const snap = await getDoc(doc(db, MODULES, moduleId))
  return snap.exists() ? withId(snap) : null
}

export async function getLessonsForModule(moduleId, category = null) {
  const lessonsRef = collection(db, MODULES, moduleId, LESSONS)
  const snap = category
    ? await getDocs(query(lessonsRef, where('category', '==', category)))
    : await getDocs(lessonsRef)
  return sortNewestFirst(snap.docs.map(withId))
}

export async function getLessonById(moduleId, lessonId) {
  const snap = await getDoc(doc(db, MODULES, moduleId, LESSONS, lessonId))
  return snap.exists() ? withId(snap) : null
}

export async function getModuleWithLessons(moduleId) {
  const module_ = await getModuleById(moduleId)
  if (!module_) return null
  const lessons = await getLessonsForModule(moduleId)
  return { ...module_, lessons }
}

/**
 * Mirrors Swift `fetchModules()`. Returns all parent + child modules with their
 * lessons folded in. Lessons are fetched in parallel; failures degrade to the
 * bare module.
 */
export async function fetchAllModules() {
  const [parentModules, childModules] = await Promise.all([
    getModulesByCategory(MODULE_CATEGORIES.PARENT),
    getModulesByCategory(MODULE_CATEGORIES.CHILD),
  ])
  const all = [...parentModules, ...childModules]

  const withLessons = await Promise.all(
    all.map(async (m) => {
      try {
        const lessons = await getLessonsForModule(m.id)
        return { ...m, lessons }
      } catch {
        return { ...m, lessons: [] }
      }
    }),
  )
  return withLessons
}

// ─── Modules: write ──────────────────────────────────────────────────────────

/**
 * Create a module with no lessons. Mirrors Swift `createModule(...)`.
 * `estimatedDuration` is in MINUTES — stored as seconds to match iOS.
 */
export async function createModule({
  title,
  description,
  category,
  difficulty = 1,
  estimatedDuration = 15,
  createdBy,
  createdByName,
}) {
  const payload = {
    title: trim(title),
    subtitle: trim(title),
    description: trim(description),
    icon: 'book.closed',
    difficulty,
    estimatedDuration: estimatedDuration * 60,
    category: category === MODULE_CATEGORIES.CHILD ? MODULE_CATEGORIES.CHILD : MODULE_CATEGORIES.PARENT,
    isActive: true,
    isCustomModule: true,
    lessonCount: 0,
    createdBy,
    createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = doc(collection(db, MODULES))
  await setDoc(ref, payload)
  return { id: ref.id, ...payload }
}

/**
 * Atomically create a module + its first lesson. Mirrors Swift
 * `createModuleWithLesson(...)`. Throws if `questions` is empty.
 *
 * `questions` should already be in iOS dict shape — see `buildQuestion()`.
 */
export async function createModuleWithLesson({
  title,
  description,
  category,
  difficulty = 1,
  estimatedDuration = 15,
  questions,
  createdBy,
  createdByName,
  targetChildIds = null,
  isChildSpecific = false,
}) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('At least one question is required to create a lesson.')
  }

  const batch = writeBatch(db)
  const moduleRef = doc(collection(db, MODULES))
  const lessonRef = doc(collection(db, MODULES, moduleRef.id, LESSONS))

  const normalizedCategory =
    category === MODULE_CATEGORIES.CHILD ? MODULE_CATEGORIES.CHILD : MODULE_CATEGORIES.PARENT

  const modulePayload = {
    title: trim(title),
    subtitle: trim(title),
    description: trim(description),
    icon: 'book.closed',
    difficulty,
    estimatedDuration: estimatedDuration * 60,
    category: normalizedCategory,
    isActive: true,
    isCustomModule: true,
    lessonCount: 1,
    createdBy,
    createdByName,
    isChildSpecific,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  if (Array.isArray(targetChildIds) && targetChildIds.length > 0) {
    modulePayload.targetChildIds = targetChildIds
  }

  const lessonPayload = {
    title: trim(title),
    description: trim(description),
    questions,
    createdBy,
    createdByName,
    category: normalizedCategory,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  batch.set(moduleRef, modulePayload)
  batch.set(lessonRef, lessonPayload)
  await batch.commit()

  return {
    id: moduleRef.id,
    lessonId: lessonRef.id,
    ...modulePayload,
  }
}

/**
 * Add a lesson to an existing module. Mirrors Swift `createLesson(...)`.
 * Enforces the same permission check: only the module creator can add lessons.
 */
export async function createLesson({
  moduleId,
  title,
  description,
  questions,
  createdBy,
  createdByName,
  category,
}) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('At least one question is required to create a lesson.')
  }
  const module_ = await getModuleById(moduleId)
  if (!module_) throw new Error('Module not found')
  if (module_.createdBy && module_.createdBy !== createdBy) {
    throw new Error('You do not have permission to add lessons to this module.')
  }

  const actualCategory = module_.category || category
  const lessonRef = doc(collection(db, MODULES, moduleId, LESSONS))
  const payload = {
    title: trim(title),
    description: trim(description),
    questions,
    createdBy,
    createdByName,
    category: actualCategory,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(lessonRef, payload)
  await updateModuleLessonCount(moduleId)
  return { id: lessonRef.id, ...payload }
}

export async function updateModuleLessonCount(moduleId) {
  const lessons = await getLessonsForModule(moduleId)
  await updateDoc(doc(db, MODULES, moduleId), {
    lessonCount: lessons.length,
    updatedAt: serverTimestamp(),
  })
}

// ─── Assignments ─────────────────────────────────────────────────────────────
//
// Mirrors iOS Module Assignment (FirebaseService.createAssignment +
// ModuleAssignmentViewModel). Writes to the `assignments` collection with the
// full schema: priority / dueDate / status / isActive / privacyLevel / etc.
// Soft delete via isActive=false (matches iOS deleteAssignment).

/**
 * Create a new assignment. Mirrors Swift `FirebaseService.createAssignment`.
 * Caller is responsible for passing `familyId` (read from the parent's user
 * profile). `dueDate`, if provided, should be a JS Date or null.
 */
export async function assignModule({
  moduleId,
  childId,
  parentId,
  familyId,
  priority = ASSIGNMENT_PRIORITY.MEDIUM,
  dueDate = null,
}) {
  if (!moduleId) throw new Error('moduleId is required')
  if (!childId) throw new Error('childId is required')
  if (!parentId) throw new Error('parentId is required')
  if (!familyId) throw new Error('familyId is required')

  const data = {
    moduleId,
    childId,
    parentId,
    familyId,
    assignedAt: serverTimestamp(),
    isCompleted: false,
    isActive: true,
    progress: 0,
    priority,
    status: ASSIGNMENT_STATUS.ASSIGNED,
    privacyLevel: 'standard',
  }
  if (dueDate instanceof Date) {
    data.dueDate = Timestamp.fromDate(dueDate)
  }

  const ref = await addDoc(collection(db, ASSIGNMENTS), data)
  return ref.id
}

/**
 * Mirrors iOS `FirebaseService.getAssignments(familyId:)` — filter by family,
 * isActive=true, newest first.
 */
export async function getAssignmentsForFamily(familyId) {
  if (!familyId) return []
  const snap = await getDocs(
    query(
      collection(db, ASSIGNMENTS),
      where('familyId', '==', familyId),
      where('isActive', '==', true),
    ),
  )
  const rows = snap.docs.map(withId)
  return rows.sort((a, b) => tsMillis(b.assignedAt) - tsMillis(a.assignedAt))
}

/**
 * Real-time listener. Mirrors iOS `FirebaseService.listenToAssignments`.
 * `onUpdate` receives the array of assignments. `onError` is called on snapshot
 * errors. Returns an unsubscribe function.
 */
export function listenToAssignments(parentId, onUpdate, onError) {
  if (!parentId) return () => {}
  const q = query(
    collection(db, ASSIGNMENTS),
    where('parentId', '==', parentId),
    where('isActive', '==', true),
  )
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map(withId)
        .sort((a, b) => tsMillis(b.assignedAt) - tsMillis(a.assignedAt))
      onUpdate?.(rows)
    },
    (err) => onError?.(err),
  )
}

/**
 * Generic update. Mirrors iOS `FirebaseService.updateAssignment`.
 */
export async function updateAssignment(assignmentId, data) {
  await updateDoc(doc(db, ASSIGNMENTS, assignmentId), data)
}

/**
 * Set progress and derive status / isCompleted from the value. Matches
 * Swift `ModuleAssignmentViewModel.updateAssignmentProgress`.
 */
export async function updateAssignmentProgress(assignmentId, progress) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0))
  const isComplete = clamped >= 1
  await updateAssignment(assignmentId, {
    progress: clamped,
    isCompleted: isComplete,
    status: isComplete
      ? ASSIGNMENT_STATUS.COMPLETED
      : clamped > 0
      ? ASSIGNMENT_STATUS.IN_PROGRESS
      : ASSIGNMENT_STATUS.ASSIGNED,
  })
}

/**
 * Mirrors Swift `completeModule(assignmentId:quizScore:timeSpent:)`.
 */
export async function completeAssignment(assignmentId, { quizScore = null, timeSpent = null } = {}) {
  const data = {
    progress: 1,
    isCompleted: true,
    status: ASSIGNMENT_STATUS.COMPLETED,
    completedAt: serverTimestamp(),
  }
  if (quizScore != null) data.quizScore = quizScore
  if (timeSpent != null) data.timeSpent = timeSpent
  await updateAssignment(assignmentId, data)
}

/**
 * Soft delete by flipping isActive=false. Matches iOS `deleteAssignment`.
 */
export async function softDeleteAssignment(assignmentId) {
  await updateAssignment(assignmentId, { isActive: false })
}

/**
 * True if the assignment has a dueDate in the past and is not completed.
 */
export function isAssignmentOverdue(assignment) {
  if (!assignment || assignment.isCompleted) return false
  const due = assignment.dueDate
  if (!due) return false
  const ms = typeof due.toMillis === 'function' ? due.toMillis() : new Date(due).getTime()
  return Number.isFinite(ms) && ms < Date.now()
}

/**
 * Returns the effective status, taking overdue into account.
 */
export function effectiveAssignmentStatus(assignment) {
  if (!assignment) return ASSIGNMENT_STATUS.ASSIGNED
  if (assignment.isCompleted) return ASSIGNMENT_STATUS.COMPLETED
  if (isAssignmentOverdue(assignment)) return ASSIGNMENT_STATUS.OVERDUE
  return assignment.status || ASSIGNMENT_STATUS.ASSIGNED
}

// ─── Progress ────────────────────────────────────────────────────────────────

export async function getLearningProgressForChild(childId, category = null) {
  const constraints = [where('childId', '==', childId)]
  if (category) constraints.push(where('category', '==', category))
  const snap = await getDocs(
    query(collection(db, LEARNING_PROGRESS), ...constraints),
  )
  return snap.docs.map(withId)
}

// ─── Question builders ───────────────────────────────────────────────────────
// Helpers that produce the dict shape Swift's Question(from: dict) expects.

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function buildMultipleChoiceQuestion({
  question,
  explanation = '',
  options,
  correctAnswerIndex,
}) {
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('Question text is required.')
  }
  if (!Array.isArray(options) || options.length < 2) {
    throw new Error('Multiple-choice questions need at least two options.')
  }
  if (
    typeof correctAnswerIndex !== 'number' ||
    correctAnswerIndex < 0 ||
    correctAnswerIndex >= options.length
  ) {
    throw new Error('Pick which option is correct.')
  }
  return {
    id: makeId(),
    type: QUESTION_TYPES.MULTIPLE_CHOICE,
    question: question.trim(),
    explanation: explanation.trim(),
    options: options.map((o) => o.trim()),
    correctAnswer: options[correctAnswerIndex].trim(),
    correctAnswerIndex,
  }
}

export function buildTrueFalseQuestion({ question, explanation = '', correctAnswer }) {
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('Question text is required.')
  }
  const normalized = String(correctAnswer).toLowerCase()
  if (normalized !== 'true' && normalized !== 'false') {
    throw new Error('Pick True or False.')
  }
  return {
    id: makeId(),
    type: QUESTION_TYPES.TRUE_FALSE,
    question: question.trim(),
    explanation: explanation.trim(),
    options: ['True', 'False'],
    correctAnswer: normalized === 'true' ? 'True' : 'False',
    correctAnswerIndex: normalized === 'true' ? 0 : 1,
  }
}

export function buildFillBlankQuestion({ question, explanation = '', acceptedAnswers }) {
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('Question text is required.')
  }
  const cleaned = (Array.isArray(acceptedAnswers) ? acceptedAnswers : [])
    .map((a) => (typeof a === 'string' ? a.trim() : ''))
    .filter(Boolean)
  if (cleaned.length === 0) {
    throw new Error('Provide at least one accepted answer.')
  }
  return {
    id: makeId(),
    type: QUESTION_TYPES.FILL_BLANK,
    question: question.trim(),
    explanation: explanation.trim(),
    acceptedAnswers: cleaned,
    correctAnswer: cleaned[0],
  }
}
