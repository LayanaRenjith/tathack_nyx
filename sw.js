// Offline support: cache the app shell so the safety check works with no network.
const CACHE = 'sahaaya-v13';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/ui.js', './src/onboarding.js', './src/home.js', './src/pay.js',
  './src/upi.js', './src/safety.js', './src/match.js', './src/amount.js', './src/family.js', './src/auth.js',
  './src/i18n.js', './src/lang/en.js', './src/lang/ml.js', './src/lang/hi.js', './src/lang/ta.js',
  './src/speech.js', './src/keypad.js', './src/scanner.js', './src/store.js', './src/profile.js',
  './src/adapt.js', './src/commands.js', './src/spoken.js', './src/report.js', './src/report-screen.js', './src/guardian.js', './src/approve.js', './src/relay.js', './src/voice-practice.js', './src/feedback.js', './src/approval-state.js', './src/comfort.js', './src/comfort-screen.js', './src/intro-video.js', './src/icons.js', './src/demo-codes.js',
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
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Network first, so a new version shows up as soon as it is pushed; the cache keeps it working offline.
// The guide video is large, so it is never downloaded at install. It is saved the first time someone
// plays it (whole file, in its own cache) and then served from the cache, including the byte ranges
// a <video> element asks for, so it also plays offline.
const MEDIA = 'sahaaya-media-v1';

async function fromMedia(request) {
  const cache = await caches.open(MEDIA);
  const url = request.url.split('#')[0];
  let full = await cache.match(url);
  if (!full) {
    const res = await fetch(url);
    if (!res.ok || res.status !== 200) return res;
    await cache.put(url, res.clone());
    full = res;
  }
  const range = request.headers.get('range');
  if (!range) return full;
  const buf = await full.arrayBuffer();
  const [startS, endS] = range.replace(/bytes=/, '').split('-');
  const start = Number(startS) || 0;
  const end = endS ? Math.min(Number(endS), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': full.headers.get('Content-Type') || 'video/webm', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' },
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameSite = url.origin === self.location.origin;
  if (sameSite && /\/media\/.+\.(webm|mp4)$/.test(url.pathname)) { e.respondWith(fromMedia(e.request).catch(() => fetch(e.request))); return; }
  if (!sameSite && !/jsQR|opendyslexic|fonts\.(googleapis|gstatic)/i.test(e.request.url)) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))),
  );
});
