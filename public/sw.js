// Custom Service Worker for Offline AI Assistant
const CACHE_NAME = 'offline-ai-v1';
const STATIC_CACHE = 'static-v1';
const MODELS_CACHE = 'ai-models-v1';
const RUNTIME_CACHE = 'runtime-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.svg',
  '/pwa-512x512.svg'
];

// AI model files to cache
const AI_MODELS = [
  '/models/tinyllama-1.1b-chat-v1.0.onnx',
  '/models/phi-3-mini-4k-instruct.onnx',
  '/models/distilbert-base-uncased.onnx',
  '/models/manifest.json'
];

// Install event - cache static assets and AI models
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache AI models
      caches.open(MODELS_CACHE).then((cache) => {
        console.log('Caching AI models');
        return cache.addAll(AI_MODELS.map(url => new Request(url, { mode: 'no-cors' })));
      })
    ]).then(() => {
      console.log('Service Worker installed successfully');
      // Force activation
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== MODELS_CACHE && 
              cacheName !== RUNTIME_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with fallback strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method !== 'GET') {
    return;
  }

  // AI Models - Cache First (they rarely change)
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(
      caches.open(MODELS_CACHE).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            console.log('Serving AI model from cache:', url.pathname);
            return response;
          }
          
          // If not in cache, fetch and cache
          return fetch(request).then((fetchResponse) => {
            if (fetchResponse.ok) {
              cache.put(request, fetchResponse.clone());
            }
            return fetchResponse;
          }).catch(() => {
            console.error('Failed to fetch AI model:', url.pathname);
            return new Response('AI model not available offline', { status: 503 });
          });
        });
      })
    );
    return;
  }

  // Static assets - Cache First
  if (STATIC_ASSETS.includes(url.pathname) || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.ico')) {
    
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            return response;
          }
          
          return fetch(request).then((fetchResponse) => {
            if (fetchResponse.ok) {
              cache.put(request, fetchResponse.clone());
            }
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // API calls and dynamic content - Network First with cache fallback
  if (url.pathname.startsWith('/api/') || url.search.includes('api')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          // Cache successful API responses
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, response.clone());
          });
        }
        return response;
      }).catch(() => {
        // Fallback to cache if network fails
        return caches.open(RUNTIME_CACHE).then((cache) => {
          return cache.match(request).then((response) => {
            if (response) {
              return response;
            }
            // Return offline message for API calls
            return new Response(JSON.stringify({
              error: 'Offline',
              message: 'This feature requires an internet connection'
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      })
    );
    return;
  }

  // HTML pages - Network First with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, response.clone());
          });
        }
        return response;
      }).catch(() => {
        return caches.open(STATIC_CACHE).then((cache) => {
          return cache.match('/index.html');
        });
      })
    );
    return;
  }

  // Default: try network first, then cache
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.keys()),
      caches.open(MODELS_CACHE).then(cache => cache.keys()),
      caches.open(RUNTIME_CACHE).then(cache => cache.keys())
    ]).then(([staticKeys, modelKeys, runtimeKeys]) => {
      event.ports[0].postMessage({
        type: 'CACHE_STATUS',
        static: staticKeys.length,
        models: modelKeys.length,
        runtime: runtimeKeys.length,
        total: staticKeys.length + modelKeys.length + runtimeKeys.length
      });
    });
  }
});

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Sync any pending data when connection is restored
      syncPendingData()
    );
  }
});

async function syncPendingData() {
  try {
    // Check for any pending data to sync
    const pendingData = await getStoredPendingData();
    if (pendingData.length > 0) {
      console.log('Syncing pending data:', pendingData.length, 'items');
      // Process pending data...
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function getStoredPendingData() {
  // This would integrate with IndexedDB to get pending sync data
  return [];
}

console.log('Service Worker loaded');