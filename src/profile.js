// Accessibility profile. Set in plain words by the user or a family member (no tests, no diagnoses),
// then adjusted while the app is used (voice "bigger"/"slower", or Sahaaya noticing missed taps).

export const DEFAULT_PROFILE = {
  lang: 'ml',
  textScale: 1,
  contrast: false,      // black-and-yellow high contrast
  bigTargets: false,    // larger buttons and spacing
  voice: false,         // Sahaaya speaks screens and results
  handsFree: false,     // after a scan: say the amount, then "yes" to pay
  voiceOnly: false,     // full voice control: Sahaaya listens after every screen, no buttons needed
  screenReader: false,  // user runs TalkBack: Sahaaya stays quiet and lets TalkBack read
  openScanner: false,   // open the scanner straight away when the app starts
  speechRate: 1,
  simple: false,        // fewer words, "tap here" pointer
  colourSafe: false,    // blue/orange/magenta (meaning also in icons and words)
  dyslexiaFont: false,  // easy-reading font, wider spacing, word highlight when read aloud
  tremorSafe: false,    // tremor-tolerant keypad, hold-to-pay
  visualAlerts: false,  // flash + vibrate for warnings
  payApp: 'any',
  voiceName: '',
  listenLang: 'auto',   // 'auto' = my language, then Indian English on a retry | 'own' | 'en'
  slowSpeech: false,    // wait longer after a pause before deciding the user has finished        // chosen text-to-speech voice ('' = best available)
  font: 'standard',     // 'standard' | 'easy' (Atkinson Hyperlegible) | 'dyslexic' (OpenDyslexic)
};

/** First run: big, clear and spoken, so anyone can start. */
export const START_PROFILE = { ...DEFAULT_PROFILE, textScale: 1.15, bigTargets: true, voice: true, slowSpeech: true };

export const NEEDS = ['blind', 'seeing', 'screenreader', 'reading', 'colour', 'hands', 'hearing', 'simple', 'listen'];

export function deriveProfile({ lang = 'ml', needs = [], payApp = 'any' } = {}) {
  const has = (n) => needs.includes(n);
  const p = { ...DEFAULT_PROFILE, lang, payApp };
  if (has('blind')) Object.assign(p, { slowSpeech: true, voiceOnly: true, voice: true, handsFree: true, bigTargets: true, textScale: 1.3, speechRate: 0.95 });
  if (has('seeing')) Object.assign(p, { textScale: 1.5, contrast: true, bigTargets: true, voice: true, handsFree: true, openScanner: true });
  if (has('screenreader')) Object.assign(p, { screenReader: true, voiceOnly: false, voice: false, handsFree: true, openScanner: true, bigTargets: true });
  if (has('reading')) Object.assign(p, { dyslexiaFont: true, font: 'dyslexic', voice: !p.screenReader, textScale: Math.max(p.textScale, 1.15) });
  if (has('colour')) p.colourSafe = true;
  if (has('hands')) Object.assign(p, { tremorSafe: true, bigTargets: true });
  if (has('hearing')) p.visualAlerts = true;
  if (has('simple')) Object.assign(p, { slowSpeech: true, simple: true, bigTargets: true, tremorSafe: true, textScale: Math.max(p.textScale, 1.25), speechRate: 0.85 });
  if (has('listen') && !p.screenReader) p.voice = true;
  if (has('hearing') && !has('listen') && !has('seeing')) { p.voice = false; p.handsFree = false; }
  return p;
}

export const TOGGLES = ['voiceOnly', 'voice', 'handsFree', 'screenReader', 'openScanner', 'contrast', 'bigTargets', 'simple', 'colourSafe', 'tremorSafe', 'visualAlerts'];

export function activeSettings(p) {
  return TOGGLES.filter((k) => p[k]);
}

/** Does Sahaaya speak out loud? Not when TalkBack is reading for the user. */
export const speaks = (p) => (p.voice || p.voiceOnly) && !p.screenReader;

/** Full voice control (Sahaaya talks and listens on every screen). */
export const voiceDriven = (p) => p.voiceOnly && !p.screenReader;

export function applyProfile(p, root = globalThis.document?.documentElement) {
  if (!root) return;
  root.lang = p.lang;
  root.style.setProperty('--scale', String(p.textScale));
  const font = p.font === 'dyslexic' ? 'dyslexic' : (p.font === 'easy' || p.dyslexiaFont) ? 'easy' : null;
  const flags = { huge: p.textScale >= 1.45, contrast: p.contrast, big: p.bigTargets, simple: p.simple, colourSafe: p.colourSafe, dyslexia: font === 'dyslexic' || p.dyslexiaFont, font };
  for (const [k, v] of Object.entries(flags)) {
    if (v) root.dataset[k] = typeof v === 'string' ? v : 'on'; else delete root.dataset[k];
  }
}

export function normaliseProfile(p) {
  if (!p || typeof p !== 'object') return { ...DEFAULT_PROFILE };
  const out = { ...DEFAULT_PROFILE };
  for (const k of Object.keys(DEFAULT_PROFILE)) if (k in p) out[k] = p[k];
  return out;
}

/** Which language to listen in on this try: own language first, then Indian English, which recognises
 *  commands, numbers and Indian names well and catches what a weaker Malayalam/Tamil recogniser missed. */
export function listenLangFor(p, attempt = 0) {
  if (p.listenLang === 'en') return 'en';
  if (p.listenLang === 'auto' && p.lang !== 'en' && attempt % 2 === 1) return 'en';
  return p.lang;
}
