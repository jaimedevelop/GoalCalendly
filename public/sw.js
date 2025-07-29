// Goal Calendly Service Worker
const CACHE_NAME = 'goal-calendly-v1';
const STATIC_CACHE_NAME = 'goal-calendly-static-v1';
const DYNAMIC_CACHE_NAME = 'goal-calendly-dynamic-v1';

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
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
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

  // Skip external requests (except for essential CDNs)
  if (url.origin !== location.origin && !url.hostname.includes('googleapis.com')) {
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

// Timer notification handling
let timerNotification = null;

self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SHOW_TIMER_NOTIFICATION':
      showTimerNotification(payload);
      break;
    case 'UPDATE_TIMER_NOTIFICATION':
      updateTimerNotification(payload);
      break;
    case 'CLEAR_TIMER_NOTIFICATION':
      clearTimerNotification();
      break;
  }
});

function showTimerNotification(options) {
  console.log('SW: Showing timer notification', options);
  if (self.registration && self.registration.showNotification) {
    const notificationTitle = `⏱️ ${options.title}`;
    const notificationBody = `Timer: ${options.body}`;
    
    self.registration.showNotification(notificationTitle, {
      body: notificationBody,
      tag: options.tag || 'timer-notification',
      requireInteraction: options.requireInteraction || true,
      silent: options.silent || true,
      icon: '/icon-192x192.svg',
      badge: '/icon-192x192.svg',
      ongoing: true,
      actions: [
        {
          action: 'stop',
          title: '⏹️ Stop',
          icon: '/icon-192x192.svg'
        }
      ]
    }).then(() => {
      console.log('SW: Timer notification shown successfully');
    }).catch(err => {
      console.error('SW: Error showing notification:', err);
    });
  }
}

function updateTimerNotification(options) {
  console.log('SW: Updating timer notification', options);
  if (self.registration && self.registration.showNotification) {
    self.registration.getNotifications({ tag: 'timer-notification' })
      .then(notifications => {
        if (notifications.length > 0) {
          notifications[0].close();
        }
        
        const notificationTitle = `⏱️ ${options.title}`;
        const notificationBody = `Timer: ${options.body}`;
        
        return self.registration.showNotification(notificationTitle, {
          body: notificationBody,
          tag: 'timer-notification',
          requireInteraction: true,
          silent: true,
          icon: '/icon-192x192.svg',
          badge: '/icon-192x192.svg',
          ongoing: true,
          actions: [
            {
              action: 'stop',
              title: '⏹️ Stop',
              icon: '/icon-192x192.svg'
            }
          ]
        }).then(() => {
          console.log('SW: Timer notification updated successfully');
        });
      }).catch(err => {
        console.error('SW: Error updating notification:', err);
      });
  }
}

function clearTimerNotification() {
  if (self.registration) {
    self.registration.getNotifications({ tag: 'timer-notification' })
      .then(notifications => {
        notifications.forEach(notification => notification.close());
      });
  }
}

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'stop') {
    // Send message to app to stop timer
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'STOP_TIMER' });
      });
    });
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