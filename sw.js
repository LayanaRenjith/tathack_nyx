// Offline support: cache the app shell so the safety check works with no network.
const CACHE = 'safescan-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg',
  './src/app.js', './src/upi.js', './src/safety.js', './src/match.js', './src/amount.js',
  './src/i18n.js', './src/speech.js', './src/keypad.js', './src/scanner.js', './src/store.js',
  './src/soundbox.js', './src/demo-codes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    // Optional offline QR decoder (added by `npm run vendor`).
    await c.add('./vendor/jsQR.js').catch(() => {});
  }));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      // Cache the CDN copy of jsQR the first time it loads.
      if (res.ok && e.request.url.includes('jsQR')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })),
  );
});
