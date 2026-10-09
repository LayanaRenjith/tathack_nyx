// Accessibility profile: turns setup answers into settings, and applies settings to the page.
// One person can have several needs at once; nothing here is a diagnosis.

export const READING_SIZES = [14, 18, 24, 30, 38]; // px, shown smallest first in the reading test

export const DEFAULT_PROFILE = {
  lang: 'ml',
  needs: { vision: false, colour: false, dyslexia: false, tremor: false, hearing: false, elderly: false },
  textScale: 1,        // multiplies the base font size
  contrast: false,     // high-contrast colours
  bigTargets: false,   // larger buttons and spacing
  voice: false,        // speak every screen and result
  speechRate: 1,       // 0.6 .. 1.4
  simple: false,       // fewer buttons per screen
  pointers: false,     // "tap here" hint on the next step
  colourSafe: false,   // blue/orange palette, never colour alone
  dyslexiaFont: false, // easy-reading font, wider spacing, word highlight when reading aloud
  tremorSafe: false,   // tremor-tolerant keypad, hold-to-confirm
  visualAlerts: false, // flash + vibrate for alerts
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Build a profile from setup answers. Every answer is optional (null = skipped).
 * @param {object} a
 * @param {string}  [a.lang]
 * @param {number|null}  [a.readingSize]   smallest comfortable px from the reading test; Infinity = could not read any
 * @param {boolean|null} [a.colourCorrect] tapped the right circle in the colour test
 * @param {{misses:number, doubles:number}|null} [a.touch] touch test result
 * @param {boolean|null} [a.heard]         heard the test sound
 * @param {boolean|null} [a.readingHard]   long text is tiring / letters move
 * @param {boolean|null} [a.wantsSimple]   wants fewer buttons and step-by-step help
 * @param {boolean|null} [a.prefersListening]
 */
export function deriveProfile(a = {}) {
  const p = structuredCloneSafe(DEFAULT_PROFILE);
  if (a.lang) p.lang = a.lang;

  // Reading: scale text so the smallest comfortable size becomes body size.
  if (a.readingSize != null) {
    if (!Number.isFinite(a.readingSize)) {
      p.needs.vision = true;
      p.textScale = 2;
    } else {
      p.textScale = clamp(Math.round((a.readingSize / 16) * 10) / 10, 1, 2);
      if (a.readingSize >= 24) p.needs.vision = true;
    }
  }
  if (p.needs.vision) {
    p.contrast = true;
    p.bigTargets = true;
    if (p.textScale >= 1.8) p.voice = true;
  }

  if (a.colourCorrect === false) p.needs.colour = true;
  if (p.needs.colour) p.colourSafe = true;

  if (a.touch && (a.touch.misses >= 2 || a.touch.doubles >= 1)) p.needs.tremor = true;
  if (p.needs.tremor) { p.tremorSafe = true; p.bigTargets = true; }

  if (a.heard === false) p.needs.hearing = true;
  if (p.needs.hearing) p.visualAlerts = true;

  if (a.readingHard) { p.needs.dyslexia = true; p.dyslexiaFont = true; }

  if (a.wantsSimple) {
    p.needs.elderly = true;
    p.simple = true;
    p.pointers = true;
    p.bigTargets = true;
    p.tremorSafe = true; // hold-to-confirm protects against accidental taps too
    p.speechRate = Math.min(p.speechRate, 0.85);
  }

  if (a.prefersListening) p.voice = true;
  // Someone who can't hear the voice gets visual alerts instead of speech by default.
  if (p.needs.hearing && !a.prefersListening && !p.needs.vision) p.voice = false;

  return p;
}

/** Which settings are on, for the preview and settings screens. */
export const TOGGLES = ['voice', 'contrast', 'bigTargets', 'simple', 'pointers', 'colourSafe', 'dyslexiaFont', 'tremorSafe', 'visualAlerts'];

export function activeSettings(p) {
  return TOGGLES.filter((k) => p[k]);
}

/** Apply a profile to the page: CSS variables and data attributes that styles.css reads. */
export function applyProfile(p, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.lang = p.lang;
  root.style.setProperty('--scale', String(p.textScale));
  const flags = { contrast: p.contrast, big: p.bigTargets, simple: p.simple, 'colour-safe': p.colourSafe, dyslexia: p.dyslexiaFont };
  for (const [k, v] of Object.entries(flags)) {
    if (v) root.dataset[camel(k)] = 'on'; else delete root.dataset[camel(k)];
  }
}

function camel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

/** Merge a stored profile with defaults (new settings added in later versions get defaults). */
export function normaliseProfile(p) {
  const base = structuredCloneSafe(DEFAULT_PROFILE);
  if (!p || typeof p !== 'object') return base;
  return { ...base, ...p, needs: { ...base.needs, ...(p.needs || {}) } };
}
