/**
 * Storage — localStorage and IndexedDB helpers.
 * localStorage: preferences, calibration profiles (< 10KB each)
 * IndexedDB: solver pruning tables, binary data (up to ~50MB)
 */

/** Version prefix to namespace all localStorage keys. */
const LS_PREFIX = 'mc:v1:';

// ──────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Reads a JSON-parsed value from localStorage.
 * @template T
 * @param {string} key - Storage key (prefix is added automatically)
 * @param {T} [defaultValue] - Fallback if key is absent or parse fails
 * @returns {T}
 */
export function lsGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) { return defaultValue; }
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * Serializes a value as JSON and writes it to localStorage.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} True if successful, false if storage is unavailable/full
 */
export function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes a key from localStorage.
 * @param {string} key
 */
export function lsRemove(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers
// ──────────────────────────────────────────────────────────────────────────────

const IDB_NAME = 'magic-cube';
const IDB_VERSION = 1;
const IDB_STORE = 'binary';

/** @type {IDBDatabase|null} */
let _db = null;

/**
 * Opens (or returns cached) IndexedDB connection.
 * @returns {Promise<IDBDatabase>}
 */
export function idbOpen() {
  if (_db) { return Promise.resolve(_db); }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Reads a value from IndexedDB.
 * @param {string} key
 * @returns {Promise<*>} Resolves to the stored value, or undefined if absent
 */
export async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Writes a value to IndexedDB.
 * @param {string} key
 * @param {*} value - Any structured-clonable value (ArrayBuffer, Blob, plain objects, etc.)
 * @returns {Promise<void>}
 */
export async function idbPut(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a key from IndexedDB.
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function idbDelete(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const req = tx.objectStore(IDB_STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Closes the IndexedDB connection. Useful in tests.
 */
export function idbClose() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
