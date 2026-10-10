// Camera QR scanner with vibration guidance for blind users.
// Uses the browser's native BarcodeDetector (Chrome on Android) and falls back to jsQR.
// While a QR is in view, the phone ticks faster as the code gets bigger and more centred,
// so the user can find it without seeing the screen.

import { playTone, BUZZ, vibrate } from './speech.js';

const JSQR_SOURCES = [
  './vendor/jsQR.js', // offline copy: run `npm run vendor` once
  'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
];

let jsQRPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsQRPromise) return jsQRPromise;
  jsQRPromise = JSQR_SOURCES.reduce(
    (p, src) => p.catch(() => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR missing')));
      s.onerror = reject;
      document.head.appendChild(s);
    })),
    Promise.reject(new Error('start')),
  );
  return jsQRPromise;
}

async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const bd = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (source) => {
          const [code] = await bd.detect(source);
          if (!code) return null;
          const { x, y, width, height } = code.boundingBox;
          return { text: code.rawValue, box: { x, y, width, height } };
        };
      }
    } catch { /* fall through to jsQR */ }
  }
  const jsQR = await loadJsQR();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    // Downscale for speed on low-end phones.
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (!code) return null;
    const xs = [code.location.topLeftCorner.x, code.location.bottomRightCorner.x];
    const ys = [code.location.topLeftCorner.y, code.location.bottomRightCorner.y];
    return {
      text: code.data,
      box: {
        x: Math.min(...xs) / scale,
        y: Math.min(...ys) / scale,
        width: Math.abs(xs[1] - xs[0]) / scale,
        height: Math.abs(ys[1] - ys[0]) / scale,
      },
    };
  };
}

/**
 * How "close" the QR is: 0 (tiny, at the edge) .. 1 (large, centred).
 * Exported for tests.
 */
export function guidanceScore(box, frameW, frameH) {
  if (!box || !frameW || !frameH) return 0;
  const size = Math.min(1, (box.width * box.height) / (frameW * frameH) / 0.12);
  const cx = (box.x + box.width / 2) / frameW - 0.5;
  const cy = (box.y + box.height / 2) / frameH - 0.5;
  const centred = Math.max(0, 1 - Math.hypot(cx, cy) * 2);
  return Math.round((0.6 * size + 0.4 * centred) * 100) / 100;
}

/**
 * Start scanning into a <video>. Calls onResult(text) once a code has been read
 * on two frames in a row (avoids half-read stickers). Returns stop().
 */
export async function startScanner(video, { onResult, onGuidance, guidance = true, sound = false } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();

  const detect = await makeDetector();
  let stopped = false;
  let lastText = null;
  let lastTick = 0;

  const loop = async () => {
    if (stopped) return;
    let hit = null;
    try { hit = await detect(video); } catch { hit = null; }
    const now = performance.now();

    if (hit) {
      const score = guidanceScore(hit.box, video.videoWidth, video.videoHeight);
      onGuidance?.(score);
      // Tick interval shrinks from ~700ms (far) to ~120ms (close).
      if (guidance && now - lastTick > 700 - score * 580) {
        vibrate(BUZZ.tick);
        if (sound) playTone({ ms: 45, hz: 480 + score * 760, volume: 0.12 }); // pitch rises as the QR comes into place
        lastTick = now;
      }
      if (hit.text === lastText && score >= 0.25) {
        stop();
        onResult?.(hit.text); // feedback comes once, from the checked result (see feedback.js)
        return;
      }
      lastText = hit.text;
    } else {
      onGuidance?.(0);
      lastText = null;
    }
    setTimeout(loop, 120);
  };
  loop();

  function stop() {
    stopped = true;
    stream.getTracks().forEach((tr) => tr.stop());
    video.srcObject = null;
  }
  return stop;
}
