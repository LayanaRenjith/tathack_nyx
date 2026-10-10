// Offline support: cache the app shell so the safety check works with no network.
const CACHE = 'sahaaya-v14';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/ui.js', './src/onboarding.js', './src/home.js', './src/pay.js',
  './src/upi.js', './src/safety.js', './src/match.js', './src/amount.js', './src/family.js', './src/auth.js',
  './src/i18n.js', './src/lang/en.js', './src/lang/ml.js', './src/lang/hi.js', './src/lang/ta.js',
  './src/speech.js', './src/keypad.js', './src/scanner.js', './src/store.js', './src/profile.js',
  './src/adapt.js', './src/commands.js', './src/spoken.js', './src/report.js', './src/report-screen.js', './src/guardian.js', './src/approve.js', './src/relay.js', './src/voice-practice.js', './src/feedback.js', './src/approval-state.js', './src/comfort.js', './src/comfort-screen.js', './src/practice.js', './src/practice-core.js', './src/icons.js', './src/demo-codes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    // One file failing must not stop the install (Android only offers "Install app" once this succeeds).
    await Promise.all(SHELL.map((f) => c.add(f).catch(() => {})));
    // Optional offline QR decoder (added by `npm run vendor`).
    await c.add('./vendor/jsQR.js').catch(() => {});
  }));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Network first, so a new version shows up as soon as it is pushed; the cache keeps it working offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameSite = new URL(e.request.url).origin === self.location.origin;
  if (!sameSite && !/jsQR|opendyslexic|fonts\.(googleapis|gstatic)/i.test(e.request.url)) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))),
  );
});
