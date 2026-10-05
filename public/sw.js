// Goal Calendly Service Worker
const STATIC_CACHE_NAME = 'goal-calendly-static-v3';
const DYNAMIC_CACHE_NAME = 'goal-calendly-dynamic-v3';

// Files to cache immediately for offline functionality
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.svg',
  '/icon-512x512.svg'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('goal-calendly-') && cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - comprehensive offline support
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Firestore streams, Auth, Functions and Stripe own their network/cache
  // behavior. Never intercept API traffic or cross-origin responses.
  if (url.origin !== location.origin || /^\/(api|__\/auth)(\/|$)/.test(url.pathname)) {
    return;
  }

  // Development modules must always come from Vite, including after a reload.
  if (url.origin === location.origin && (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  )) {
    return;
  }

  // Fetch the current app shell online; use the saved shell only when offline.
  // Cache-first HTML could keep referencing an old bundle indefinitely.
  if (url.origin === location.origin && request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && !url.pathname.startsWith('/billing/')) {
          const cache = await caches.open(DYNAMIC_CACHE_NAME);
          await cache.put(request, response.clone());
        }
        if (response.status >= 500) {
          return await caches.match('/index.html') || response;
        }
        return response;
      } catch {
        return await caches.match(request) || await caches.match('/index.html') ||
          new Response('Offline - Content not available', { status: 503 });
      }
    })());
    return;
  }

  // Cache only app assets. Same-origin API calls and background requests for
  // routes (including billing return URLs) must not receive cached data.
  if (!['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) ||
      url.pathname.startsWith('/billing/')) {
    return;
  }

  event.respondWith(
    // Try cache first for better offline experience
    caches.match(request)
      .then((cachedResponse) => {
        // If we have a cached version, return it immediately
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', request.url);
          
          // For HTML pages, try to update cache in background
          if (request.destination === 'document') {
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(request, response.clone());
                  });
                }
              })
              .catch(() => {
                // Network failed, but we have cache - that's fine
              });
          }
          
          return cachedResponse;
        }

        // Not in cache, try network
        return fetch(request)
          .then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Clone the response for caching
            const responseToCache = networkResponse.clone();

            // Cache the response
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                console.log('Service Worker: Caching:', request.url);
                cache.put(request, responseToCache);
              })
              .catch(err => console.log('Cache put failed:', err));

            return networkResponse;
          })
          .catch((error) => {
            console.log('Service Worker: Network failed for:', request.url);
            
            // For other requests, return a basic offline response
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Keep asynchronous updates in order so an older update cannot replace a
// newer timer notification or reappear after Stop.
let timerNotificationQueue = Promise.resolve();

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (!['SHOW_TIMER_NOTIFICATION', 'UPDATE_TIMER_NOTIFICATION', 'CLEAR_TIMER_NOTIFICATION'].includes(type)) return;
  timerNotificationQueue = timerNotificationQueue.then(async () => {
    if (type === 'CLEAR_TIMER_NOTIFICATION') {
      const notifications = await self.registration.getNotifications({ tag: 'timer-notification' });
      notifications.forEach(notification => notification.close());
      return;
    }
    await self.registration.showNotification(`Timer: ${payload.title}`, {
      body: `Timer: ${payload.body}`,
      tag: 'timer-notification',
      requireInteraction: true,
      silent: true,
      icon: '/icon-192x192.svg',
      badge: '/icon-192x192.svg',
      data: { goalId: payload.goalId, startTime: payload.startTime },
      actions: [{ action: 'stop', title: 'Stop', icon: '/icon-192x192.svg' }]
    });
  }).catch(error => console.error('Timer notification failed:', error));
  event.waitUntil(timerNotificationQueue);
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'stop') {
    // Send message to app to stop timer
    event.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'STOP_TIMER', goalId: event.notification.data?.goalId, startTime: event.notification.data?.startTime });
      });
    }));
  } else {
    // Focus the app
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          return clients[0].focus();
        }
        return self.clients.openWindow('/');
      })
    );
  }
});

console.log('Service Worker: Script loaded successfully');
