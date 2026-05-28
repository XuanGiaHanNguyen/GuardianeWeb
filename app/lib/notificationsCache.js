// L2 cache for notifications — IndexedDB store keyed by alert id.
// Rows older than TTL_MS are dropped on read so the store self-prunes.

const DB_NAME = 'guardiane-notifications'
const DB_VERSION = 1
const STORE = 'alerts'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('familyId', 'familyId', { unique: false })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE)
}

/** Read all cached alerts for a family, newest first, dropping expired rows. */
export async function readCachedAlerts(familyId) {
  if (!familyId) return []
  let db
  try {
    db = await openDb()
  } catch {
    return []
  }
  return new Promise((resolve) => {
    const store = tx(db, 'readonly')
    const idx = store.index('familyId')
    const req = idx.getAll(familyId)
    req.onsuccess = () => {
      const now = Date.now()
      const fresh = (req.result || [])
        .filter((row) => now - (row.cachedAt ?? 0) < TTL_MS)
        .sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0))
      resolve(fresh)
    }
    req.onerror = () => resolve([])
  })
}

/** Upsert alerts. Each row needs id + familyId; we add cachedAt. */
export async function writeCachedAlerts(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return
  let db
  try {
    db = await openDb()
  } catch {
    return
  }
  const store = tx(db, 'readwrite')
  const now = Date.now()
  for (const row of rows) {
    if (!row?.id || !row?.familyId) continue
    store.put({ ...row, cachedAt: now })
  }
  return new Promise((resolve) => {
    store.transaction.oncomplete = () => resolve()
    store.transaction.onerror = () => resolve()
  })
}

/** Drop a single alert from cache (e.g. on dismiss). */
export async function deleteCachedAlert(id) {
  if (!id) return
  let db
  try {
    db = await openDb()
  } catch {
    return
  }
  const store = tx(db, 'readwrite')
  store.delete(id)
  return new Promise((resolve) => {
    store.transaction.oncomplete = () => resolve()
    store.transaction.onerror = () => resolve()
  })
}
