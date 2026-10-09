// Accessibility profile. Set once by the user or a family member in plain words (no tests, no diagnoses),
// then adjusted while the app is used (voice "bigger"/"slower", or Sahaaya noticing missed taps).

export const DEFAULT_PROFILE = {
  lang: 'ml',
  textScale: 1,
  contrast: false,     // high-contrast colours
  bigTargets: false,   // larger buttons and spacing
  voice: false,        // speak every screen and result
  speechRate: 1,       // 0.6 .. 1.4
  simple: false,       // fewer words and buttons per screen, "tap here" pointer
  colourSafe: false,   // blue/orange palette (meaning always also in icons and words)
  dyslexiaFont: false, // easy-reading font, wider spacing, word highlight when reading aloud
  tremorSafe: false,   // tremor-tolerant keypad, hold-to-pay
  visualAlerts: false, // flash + vibrate for alerts
  payApp: 'any',       // which UPI app to open
};

/** First-run default before anyone has chosen: big, clear and spoken, so anyone can start. */
export const START_PROFILE = { ...DEFAULT_PROFILE, textScale: 1.25, bigTargets: true, voice: true };

/** Needs a family member can tick, in plain words. */
export const NEEDS = ['seeing', 'reading', 'colour', 'hands', 'hearing', 'simple', 'listen'];

/** Turn ticked needs into settings. Several needs combine. */
export function deriveProfile({ lang = 'ml', needs = [], payApp = 'any' } = {}) {
  const has = (n) => needs.includes(n);
  const p = { ...DEFAULT_PROFILE, lang, payApp };
  if (has('seeing')) Object.assign(p, { textScale: 1.6, contrast: true, bigTargets: true, voice: true });
  if (has('reading')) Object.assign(p, { dyslexiaFont: true, voice: true, textScale: Math.max(p.textScale, 1.15) });
  if (has('colour')) p.colourSafe = true;
  if (has('hands')) Object.assign(p, { tremorSafe: true, bigTargets: true });
  if (has('hearing')) p.visualAlerts = true;
  if (has('simple')) Object.assign(p, { simple: true, bigTargets: true, tremorSafe: true, textScale: Math.max(p.textScale, 1.3), speechRate: 0.85 });
  if (has('listen')) p.voice = true;
  // Someone who can't hear the voice and can see the screen gets visual alerts instead of speech.
  if (has('hearing') && !has('listen') && !has('seeing')) p.voice = false;
  return p;
}

export const TOGGLES = ['voice', 'contrast', 'bigTargets', 'simple', 'colourSafe', 'dyslexiaFont', 'tremorSafe', 'visualAlerts'];

export function activeSettings(p) {
  return TOGGLES.filter((k) => p[k]);
}

/** Apply a profile to the page: CSS variables and data attributes read by styles.css. */
export function applyProfile(p, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.lang = p.lang;
  root.style.setProperty('--scale', String(p.textScale));
  const flags = { contrast: p.contrast, big: p.bigTargets, simple: p.simple, colourSafe: p.colourSafe, dyslexia: p.dyslexiaFont };
  for (const [k, v] of Object.entries(flags)) {
    if (v) root.dataset[k] = 'on'; else delete root.dataset[k];
  }
}

export function normaliseProfile(p) {
  if (!p || typeof p !== 'object') return { ...DEFAULT_PROFILE };
  const out = { ...DEFAULT_PROFILE };
  for (const k of Object.keys(DEFAULT_PROFILE)) if (k in p) out[k] = p[k];
  return out;
}
