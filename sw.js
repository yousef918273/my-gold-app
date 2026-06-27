// ===== SERVICE WORKER - سعر النهارده v3 =====
const CACHE_NAME = 'seary-v3';
const API_CACHE = 'seary-api-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/login.html',
  '/terms-of-service.html',
  '/privacy-policy.html'
];

const API_ROUTES = [
  'gold-scraper-server.onrender.com',
  'open.er-api.com'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(()=>{})));
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== API_CACHE)
        .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // API: Network first → cache fallback (offline support)
  if (API_ROUTES.some(route => url.includes(route))) {
    event.respondWith(
      fetch(event.request.clone(), { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined })
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(JSON.stringify({ offline: true, error: 'offline' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Static: Cache first
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(res => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
        return cached || networkFetch;
      })
    );
  }
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', event => {
  let data = { title: 'سعر النهارده', body: '📊 تحديث جديد للأسعار', icon: '/icons/icon-192x192.png' };
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } catch (e) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      tag: 'gold-price',
      renotify: true,
      actions: [
        { action: 'open', title: '📱 فتح التطبيق' },
        { action: 'close', title: 'إغلاق' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});
