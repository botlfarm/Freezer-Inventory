import { InventoryState, Action } from '../types';

const DB_NAME = 'freezer_inventory_offline_db';
const DB_VERSION = 2;
const STATE_STORE = 'state_cache';
const QUEUE_STORE = 'action_queue';
const IMAGES_STORE = 'offline_images';
const STATE_KEY = 'current_inventory_state';
const LOCAL_STORAGE_BACKUP_KEY = 'freezer_cached_inventory_state';
const LOCAL_STORAGE_QUEUE_KEY = 'freezer_offline_action_queue';

export interface OfflineImage {
  id: string; // e.g. "offline-image://unique_id"
  base64: string;
  filename: string;
  savedAt: number;
}

export interface QueuedOfflineAction {
  id: number;
  action: Action;
  timestamp: number;
  clientId: string;
  retryCount: number;
  lastError?: string;
}

let dbInstancePromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbInstancePromise) {
    return dbInstancePromise;
  }

  dbInstancePromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.onversionchange = () => {
          db.close();
          dbInstancePromise = null;
        };
        resolve(db);
      };

      request.onerror = (event) => {
        console.warn('IndexedDB open error, falling back to localStorage:', (event.target as IDBOpenDBRequest).error);
        dbInstancePromise = null;
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (e) {
      dbInstancePromise = null;
      reject(e);
    }
  });

  return dbInstancePromise;
}

/**
 * Persists the entire inventory state to IndexedDB with localStorage fallback.
 */
export async function saveCachedState(state: InventoryState): Promise<void> {
  if (!state) return;
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STATE_STORE, 'readwrite');
        const store = tx.objectStore(STATE_STORE);
        store.put({
          key: STATE_KEY,
          state,
          savedAt: Date.now()
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    // Fallback to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify({ state, savedAt: Date.now() }));
    } catch (e) {
      console.warn('Could not cache state in localStorage:', e);
    }
  }
}

/**
 * Retrieves the cached inventory state from IndexedDB or localStorage for instant 0ms app boot.
 */
export async function getCachedState(): Promise<InventoryState | null> {
  try {
    const db = await getIndexedDB();
    const result = await new Promise<any>((resolve, reject) => {
      try {
        const tx = db.transaction(STATE_STORE, 'readonly');
        const store = tx.objectStore(STATE_STORE);
        const req = store.get(STATE_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });

    if (result && result.state) {
      return result.state as InventoryState;
    }
  } catch (err) {
    // Attempt fallback from localStorage
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.state) {
          return parsed.state as InventoryState;
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Retrieves the timestamp (savedAt) of when the state was last cached.
 */
export async function getCachedStateTimestamp(): Promise<number | null> {
  try {
    const db = await getIndexedDB();
    const result = await new Promise<any>((resolve, reject) => {
      try {
        const tx = db.transaction(STATE_STORE, 'readonly');
        const store = tx.objectStore(STATE_STORE);
        const req = store.get(STATE_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });

    if (result && result.savedAt) {
      return result.savedAt;
    }
  } catch (err) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.savedAt) {
          return parsed.savedAt;
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Adds an action to the offline FIFO mutation queue.
 */
export async function enqueueOfflineAction(action: Action, clientId: string): Promise<number> {
  const item = {
    action,
    timestamp: Date.now(),
    clientId,
    retryCount: 0
  };

  try {
    const db = await getIndexedDB();
    const id = await new Promise<number>((resolve, reject) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result as number);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
    return id;
  } catch (err) {
    // Fallback to localStorage array
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
      const queue: QueuedOfflineAction[] = raw ? JSON.parse(raw) : [];
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      queue.push({ ...item, id: newId });
      localStorage.setItem(LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(queue));
      return newId;
    } catch (e) {
      console.warn('Failed to enqueue offline action in localStorage:', e);
      return Date.now();
    }
  }
}

/**
 * Retrieves all pending queued offline actions in FIFO order.
 */
export async function getOfflineQueue(): Promise<QueuedOfflineAction[]> {
  try {
    const db = await getIndexedDB();
    const items = await new Promise<QueuedOfflineAction[]>((resolve, reject) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []) as QueuedOfflineAction[];
          list.sort((a, b) => a.timestamp - b.timestamp);
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
    return items;
  } catch (err) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as QueuedOfflineAction[];
        list.sort((a, b) => a.timestamp - b.timestamp);
        return list;
      }
    } catch (e) {}
    return [];
  }
}

/**
 * Removes an action from the offline queue upon successful server sync.
 */
export async function removeOfflineAction(id: number): Promise<void> {
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
      if (raw) {
        let list = JSON.parse(raw) as QueuedOfflineAction[];
        list = list.filter(item => item.id !== id);
        localStorage.setItem(LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(list));
      }
    } catch (e) {}
  }
}

/**
 * Returns the count of pending offline actions.
 */
export async function getOfflineQueueCount(): Promise<number> {
  try {
    const db = await getIndexedDB();
    const count = await new Promise<number>((resolve, reject) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readonly');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
    return count;
  } catch (err) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_QUEUE_KEY);
      if (raw) {
        const list = JSON.parse(raw) as QueuedOfflineAction[];
        return list.length;
      }
    } catch (e) {}
    return 0;
  }
}

/**
 * Clears the entire offline action queue.
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(QUEUE_STORE, 'readwrite');
        const store = tx.objectStore(QUEUE_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {}
  try {
    localStorage.removeItem(LOCAL_STORAGE_QUEUE_KEY);
  } catch (e) {}
}

/**
 * Saves an offline image to IndexedDB.
 */
export async function saveOfflineImage(image: OfflineImage): Promise<void> {
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(IMAGES_STORE, 'readwrite');
        const store = tx.objectStore(IMAGES_STORE);
        store.put(image);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn('Failed to save offline image in IndexedDB:', err);
  }
}

/**
 * Retrieves an offline image from IndexedDB.
 */
export async function getOfflineImage(id: string): Promise<OfflineImage | null> {
  try {
    const db = await getIndexedDB();
    const result = await new Promise<any>((resolve, reject) => {
      try {
        const tx = db.transaction(IMAGES_STORE, 'readonly');
        const store = tx.objectStore(IMAGES_STORE);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
    return result || null;
  } catch (err) {
    console.warn('Failed to retrieve offline image from IndexedDB:', err);
    return null;
  }
}

/**
 * Deletes an offline image from IndexedDB.
 */
export async function deleteOfflineImage(id: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(IMAGES_STORE, 'readwrite');
        const store = tx.objectStore(IMAGES_STORE);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  } catch (err) {
    console.warn('Failed to delete offline image from IndexedDB:', err);
  }
}

