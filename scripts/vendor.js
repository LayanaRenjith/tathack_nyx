// Download jsQR into vendor/ so QR decoding works offline on phones without
// the native BarcodeDetector. Run once: `npm run vendor`, then commit vendor/jsQR.js.
import { writeFile, mkdir } from 'node:fs/promises';

const URL = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
await mkdir(new globalThis.URL('../vendor/', import.meta.url), { recursive: true });
await writeFile(new globalThis.URL('../vendor/jsQR.js', import.meta.url), await res.text());
console.log('Saved vendor/jsQR.js');
