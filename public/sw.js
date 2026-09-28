// Service Worker for Freezer Inventory Tracker PWA
const CACHE_NAME = 'freezer-tracker-v2.46.0';

// Install event - caching basic shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Helper: Open IndexedDB and read an offline image
function getOfflineImageFromDB(id) {
  return new Promise((resolve, reject) => {
    // Note: Database name and object store name MUST match the values in offlineStorage.ts
    const openReq = indexedDB.open('freezer_inventory_offline_db');
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = () => {
      const db = openReq.result;
      try {
        const tx = db.transaction('offline_images', 'readonly');
        const store = tx.objectStore('offline_images');
        const getReq = store.get(id);
        getReq.onerror = () => reject(getReq.error);
        getReq.onsuccess = () => resolve(getReq.result);
      } catch (err) {
        reject(err);
      }
    };
  });
}

// Helper: Parse base64 string to extract mime type and raw data
function parseBase64(base64) {
  let mimeType = 'image/jpeg';
  let rawData = base64;
  if (base64.startsWith('data:')) {
    const parts = base64.split(';base64,');
    if (parts.length === 2) {
      mimeType = parts[0].substring(5);
      rawData = parts[1];
    }
  }
  return { mimeType, rawData };
}

// Helper: Convert base64 data to Blob inside the Service Worker
function base64ToBlob(base64Data, contentType) {
  const sliceSize = 1024;
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

// Helper: Resolve relative paths to absolute API paths supporting Home Assistant Ingress
function getServiceWorkerApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const ingressMatch = self.location.pathname.match(/^\/api\/hassio_ingress\/[^/]+\/?/);
  if (ingressMatch) {
    const base = ingressMatch[0].endsWith('/') ? ingressMatch[0] : `${ingressMatch[0]}/`;
    return `${base}${cleanPath}`;
  }
  return `/${cleanPath}`;
}

// Helper: Save the updated database state to IndexedDB state_cache
function saveStateToIndexedDB(state) {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open('freezer_inventory_offline_db');
    openReq.onerror = () => reject(openReq.error);
    openReq.onsuccess = () => {
      const db = openReq.result;
      try {
        const tx = db.transaction('state_cache', 'readwrite');
        const store = tx.objectStore('state_cache');
        const req = store.put({
          key: 'current_inventory_state',
          state: state,
          savedAt: Date.now()
        });
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      } catch (err) {
        reject(err);
      }
    };
  });
}

// Helper: Broadcast a message to all active/open client windows
async function broadcastToClients(message) {
  const clientsList = await self.clients.matchAll({ type: 'window' });
  for (const client of clientsList) {
    client.postMessage(message);
  }
}

// Main routine: Fetch the latest database state and update IndexedDB cache
async function updateDatabaseInBackground() {
  const url = getServiceWorkerApiUrl('api/inventory');
  try {
    const response = await fetch(`${url}?_t=${Date.now()}`, {
      headers: {
        'Authorization': 'Bearer ha-token-bypass',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }
    const data = await response.json();
    if (data) {
      await saveStateToIndexedDB(data);
      console.log('[PWA sw.js] Database successfully updated in the background');
      await broadcastToClients({ type: 'BACKGROUND_SYNC_COMPLETE', state: data });
    }
  } catch (err) {
    console.warn('[PWA sw.js] Background sync fetch failed:', err);
  }
}

// Throttled background sync check: Runs if cached state is older than 3 hours
async function checkAndTriggerSyncThrottled() {
  try {
    const openReq = indexedDB.open('freezer_inventory_offline_db');
    openReq.onerror = () => {};
    openReq.onsuccess = () => {
      const db = openReq.result;
      try {
        if (!db.objectStoreNames.contains('state_cache')) return;
        const tx = db.transaction('state_cache', 'readonly');
        const store = tx.objectStore('state_cache');
        const req = store.get('current_inventory_state');
        req.onerror = () => {};
        req.onsuccess = () => {
          const record = req.result;
          const lastSaved = record ? record.savedAt : 0;
          const now = Date.now();
          // 3 hours = 10800000 ms
          if (now - lastSaved > 10800000) {
            console.log('[PWA sw.js] Stale cache detected. Starting background sync fetch...');
            updateDatabaseInBackground();
          }
        };
      } catch (err) {}
    };
  } catch (e) {}
}

// Periodic Background Sync event listener
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-database') {
    event.waitUntil(updateDatabaseInBackground());
  }
});

// Fetch event - network first with cache fallback for offline resilience
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);

  // Trigger throttled background update check on navigating to any HTML page (app launch/refresh)
  if (event.request.mode === 'navigate') {
    event.waitUntil(checkAndTriggerSyncThrottled());
  }
  
  // Intercept images, uploads, and photos
  const isUploadImg = url.pathname.startsWith('/uploads/') || 
                       url.pathname.startsWith('/images/') || 
                       url.pathname.startsWith('/photos/');
  const isApi = url.pathname.startsWith('/api/');
  
  // If it's a standard API call but not checking for photos list, bypass Service Worker
  if (isApi && !url.pathname.includes('/api/photos')) {
    return;
  }
  
  // Case A: Request for a temporary offline image (uploaded while offline)
  if (isUploadImg && url.pathname.includes('offline-image-')) {
    const filename = url.pathname.split('/').pop();
    const idKey = filename.split('.')[0]; // Extract "offline-image-xxxxx" (ignoring extension)
    
    event.respondWith(
      getOfflineImageFromDB(idKey)
        .then((record) => {
          if (record && record.base64) {
            const { mimeType, rawData } = parseBase64(record.base64);
            const blob = base64ToBlob(rawData, mimeType);
            return new Response(blob, {
              headers: { 
                'Content-Type': mimeType, 
                'Cache-Control': 'public, max-age=31536000' 
              }
            });
          }
          return new Response('Offline image not found in IndexedDB', { status: 404 });
        })
        .catch((err) => {
          return new Response('Failed to read offline image from IndexedDB: ' + err.message, { status: 500 });
        })
    );
    return;
  }
  
  // Case B: Request for a regular uploaded image file - Cache it for offline viewing!
  if (isUploadImg) {
    event.respondWith(
      caches.open('freezer-tracker-images').then((cache) => {
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            return cache.match(event.request).then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              return new Response('Image not available offline', { status: 503 });
            });
          });
      })
    );
    return;
  }

  // Case C: Standard static assets and documents - standard cache fallback
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          return caches.match('/') || caches.match('/index.html');
        }
      });
    })
  );
});
