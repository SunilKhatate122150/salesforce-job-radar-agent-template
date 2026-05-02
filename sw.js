const CACHE_NAME = 'sf-prep-v20260502-upgrade2';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/responsive.css',
  '/src/components.js',
  '/app.js',
  '/src/ui-shell.js',
  '/code-practice.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;600;700&family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500;600&display=swap'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 PWA: Caching Assets...');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => {
        console.log('🧹 PWA: Cleaning old cache:', key);
        return caches.delete(key);
      })
    ))
  );
});

// Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  // Skip API calls and non-GET requests
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Update cache with fresh version
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
