// Voice in and out, word highlighting, test tone, and vibration patterns (Web Speech, Web Audio, Vibration APIs).
// Text-to-speech works offline when the phone has the voice; Chrome speech recognition needs a network.

import { LANGS } from './i18n.js';

let currentLang = 'ml';
let currentRate = 1;
let chosenVoice = '';

export function setSpeechLang(lang) { currentLang = lang; }
export function setSpeechRate(rate) { currentRate = rate; }
export function setVoiceName(name) { chosenVoice = name || ''; }

export const canSpeak = 'speechSynthesis' in globalThis;

/** Voices for a language, the most natural-sounding first. */
export function voicesFor(lang) {
  const bcp = (LANGS[lang]?.speech || lang || 'en-IN').toLowerCase().replace('_', '-');
  const base = bcp.split('-')[0];
  const all = globalThis.speechSynthesis?.getVoices?.() || [];
  const score = (v) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-');
    let n = l === bcp ? 100 : l.startsWith(base) ? 60 : 0;
    if (/natural|neural|google|online|enhanced|premium/i.test(v.name)) n += 15;
    if (/india|indian/i.test(v.name)) n += 5;
    return n;
  };
  return all.filter((v) => score(v) >= 60).sort((a, b) => score(b) - score(a));
}

function pickVoice(bcp47, lang) {
  const list = voicesFor(lang || bcp47);
  return list.find((v) => v.name === chosenVoice) || list[0] || null;
}

export function hasVoiceFor(lang) {
  return Boolean(pickVoice(LANGS[lang]?.speech || 'en-IN'));
}

function utter(text, lang, rate) {
  const bcp = LANGS[lang]?.speech || 'en-IN';
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp;
  const voice = pickVoice(bcp, lang);
  if (voice) u.voice = voice;
  u.rate = rate ?? currentRate;
  return u;
}

let speakId = 0;

/**
 * Say text sentence by sentence. Long single utterances get cut off on many Android phones
 * (and some Malayalam/Tamil voices stop after ~15 seconds), so each sentence is its own utterance.
 */
export function speak(text, { lang = currentLang, interrupt = true, rate } = {}) {
  if (!text || !canSpeak) return Promise.resolve();
  if (interrupt) speechSynthesis.cancel();
  const id = ++speakId;
  const parts = String(text).split(/(?<=[.!?।])\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.reduce((p, part) => p.then(() => (id !== speakId ? null : new Promise((resolve) => {
    const u = utter(part, lang, rate);
    const timer = setTimeout(resolve, 2000 + part.length * 160); // never hang if the phone drops an "end" event
    u.onend = () => { clearTimeout(timer); resolve(); };
    u.onerror = () => { clearTimeout(timer); resolve(); };
    speechSynthesis.speak(u);
  }))), Promise.resolve());
}

export function stopSpeaking() {
  speakId += 1;
  globalThis.speechSynthesis?.cancel?.();
}

/**
 * Read an element aloud and highlight each word as it is spoken (dyslexia support).
 * Wraps the element's words in spans once. Browsers that don't send word boundaries
 * (some Malayalam voices) still read aloud, just without the highlight.
 */
export function speakWithHighlight(el, { lang = currentLang } = {}) {
  if (!el || !canSpeak) return Promise.resolve();
  if (!el.dataset.wrapped) {
    const text = el.textContent;
    el.textContent = '';
    let offset = 0;
    for (const part of text.split(/(\s+)/)) {
      if (/^\s+$/.test(part) || !part) { el.appendChild(document.createTextNode(part)); }
      else {
        const s = document.createElement('span');
        s.className = 'word';
        s.dataset.start = String(offset);
        s.textContent = part;
        el.appendChild(s);
      }
      offset += part.length;
    }
    el.dataset.wrapped = '1';
  }
  const words = [...el.querySelectorAll('.word')];
  const text = el.textContent;
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = utter(text, lang);
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      words.forEach((w) => w.classList.remove('speaking'));
      const hit = words.filter((w) => Number(w.dataset.start) <= e.charIndex).at(-1);
      hit?.classList.add('speaking');
    };
    const done = () => { words.forEach((w) => w.classList.remove('speaking')); resolve(); };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  });
}

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

let activeRec = null;
let holding = false;
let pauseMs = 1800;
let lastError = '';
export const isListening = () => Boolean(activeRec);
export const listenError = () => lastError;
/** How long a pause ends what the user is saying. Older users pause mid-sentence ("two hundred… fifty"). */
export function setPauseMs(ms) { pauseMs = ms || 1800; }
/** While the mic button is held down, pauses never end listening. */
export function setHolding(on) { holding = on; }

/** Stop any listening in progress (screen changed, user tapped). */
export function cancelListening() {
  try { activeRec?.abort(); } catch {}
  activeRec = null;
}

/** Finish now and use what was heard so far (mic button released). */
export function finishListening() {
  try { activeRec?.stop(); } catch {}
}

/** Ask for the microphone once, with a clear answer instead of silent failure. */
export async function ensureMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return 'ok';
  } catch (e) {
    return e?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture';
  }
}

const waitForSilence = async () => {
  // Never listen while Sahaaya is still talking (the mic would hear Sahaaya), then a short gap for the echo.
  for (let i = 0; i < 60 && globalThis.speechSynthesis?.speaking; i += 1) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 250));
};

/**
 * Listen and return every guess the recogniser makes, best first; [] on silence.
 * - Keeps listening through short pauses and ends after `pauseMs` of quiet (or when the button is released).
 * - Several pieces of speech are joined ("two hundred" + "fifty").
 * - Errors are kept in listenError(): 'not-allowed' (mic blocked), 'network' (no internet), 'audio-capture' (mic busy), 'no-speech'.
 * - A short buzz says "speak now", a soft beep says "got it".
 */
export function listenAll({ lang = currentLang, timeoutMs = 15000, beep = true, onInterim = null, onSpeech = null } = {}) {
  if (!Recognition) { lastError = 'unsupported'; return Promise.resolve([]); }
  cancelListening();
  return waitForSilence().then(() => new Promise((resolve) => {
    const rec = new Recognition();
    activeRec = rec;
    rec.lang = LANGS[lang]?.speech || lang || 'en-IN';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 5;
    lastError = '';
    let done = false;
    let heardAt = 0;
    const finals = [];       // best transcript of each finished piece
    let lastAlts = [];       // alternatives of the latest finished piece
    let interim = '';
    const result = () => {
      const before = finals.slice(0, -1).join(' ');
      const alts = lastAlts.length ? lastAlts.map((a) => `${before} ${a}`.trim()) : [];
      if (!alts.length && interim) alts.push(`${finals.join(' ')} ${interim}`.trim());
      return [...new Set(alts.filter(Boolean))];
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(hardStop);
      clearInterval(silenceTimer);
      try { rec.stop(); } catch {}
      if (activeRec === rec) activeRec = null;
      const list = result();
      if (!list.length && !lastError) lastError = 'no-speech';
      if (beep && list.length) playTone({ ms: 80, hz: 660, volume: 0.12 });
      resolve(list);
    };
    rec.onspeechstart = () => { heardAt = Date.now(); onSpeech?.(); };
    rec.onresult = (e) => {
      heardAt = Date.now();
      // Rebuild from every piece each time. Some Android phones repeat earlier words inside later
      // pieces ("two hundred", "two hundred fifty"), so a piece that starts with the one before replaces it.
      finals.length = 0;
      lastAlts = [];
      interim = '';
      for (let i = 0; i < e.results.length; i += 1) {
        const r = e.results[i];
        const text = (r[0]?.transcript || '').trim();
        if (r.isFinal === false) { interim += ` ${text}`; continue; }
        const prev = finals.at(-1);
        if (prev && text.toLowerCase().startsWith(prev.toLowerCase())) finals.pop();
        finals.push(text);
        lastAlts = [];
        for (let j = 0; j < r.length; j += 1) if (r[j].transcript) lastAlts.push(r[j].transcript.trim());
      }
      interim = interim.trim();
      onInterim?.(`${finals.join(' ')} ${interim}`.trim());
    };
    rec.onerror = (e) => { if (e.error !== 'aborted') lastError = e.error || 'error'; if (e.error !== 'no-speech') finish(); };
    rec.onend = () => finish();
    const startedAt = Date.now();
    const silenceTimer = setInterval(() => {
      if (holding) return;
      const now = Date.now();
      if (heardAt && now - heardAt > pauseMs) finish();          // they spoke, then paused
      else if (!heardAt && now - startedAt > 8000) finish();      // nothing at all
    }, 200);
    const hardStop = setTimeout(finish, timeoutMs);
    try { navigator.vibrate?.(40); } catch {}
    try { rec.start(); } catch { lastError = 'busy'; finish(); }
  }));
}

/** Listen once; resolves with the best transcript ('' on failure or timeout). */
export async function listenOnce(opts = {}) {
  return (await listenAll(opts))[0] || '';
}

// One shared audio context: phones limit how many can be open, and opening one per beep can clash with the mic.
let audioCtx = null;
function ctx() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** One soft note with a gentle start and fade (no click). */
function note(c, { hz, at = 0, ms = 160, volume = 0.18, type = 'sine' }) {
  const t0 = c.currentTime + at / 1000;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + ms / 1000 + 0.02);
}

/** A short tone (hearing check, listening beeps, scanner guidance). */
export function playTone({ ms = 700, hz = 880, volume = 0.25 } = {}) {
  const c = ctx();
  if (!c) return Promise.resolve(false);
  note(c, { hz, ms, volume });
  return new Promise((resolve) => setTimeout(() => resolve(true), ms));
}

/**
 * Sounds that mean something without words, paired with the vibration patterns below:
 * safe = bright rising two-note chime, caution = two even mid notes, danger = low firm tone, three times.
 */
export const CHIMES = {
  ok: [{ hz: 784, ms: 180 }, { hz: 1175, at: 140, ms: 320 }],
  found: [{ hz: 988, ms: 90, volume: 0.12 }],
  caution: [{ hz: 587, ms: 220 }, { hz: 587, at: 300, ms: 220 }],
  danger: [{ hz: 196, ms: 420, type: 'square', volume: 0.12 }, { hz: 196, at: 560, ms: 420, type: 'square', volume: 0.12 }, { hz: 147, at: 1120, ms: 600, type: 'square', volume: 0.12 }],
};

export function playChime(kind) {
  const c = ctx();
  const notes = CHIMES[kind];
  if (!c || !notes) return;
  notes.forEach((n) => note(c, n));
}

// Distinct vibration patterns, always paired with text and icons, never used alone.
export const BUZZ = {
  tick: [30],
  found: [80, 60, 80],
  ok: [200],
  caution: [300, 150, 300],
  danger: [600, 200, 600, 200, 600],
};

let hapticsOn = true;
/** The user's vibration setting; every buzz in the app goes through vibrate(). */
export function setHaptics(on) { hapticsOn = on !== false; }
export const canVibrate = () => typeof globalThis.navigator?.vibrate === 'function';

export function vibrate(pattern) {
  if (!hapticsOn || !pattern) return false;
  try { return Boolean(globalThis.navigator?.vibrate?.(pattern)); } catch { return false; }
}
