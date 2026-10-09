// Voice in and out, word highlighting, test tone, and vibration patterns (Web Speech, Web Audio, Vibration APIs).
// Text-to-speech works offline when the phone has the voice; Chrome speech recognition needs a network.

import { LANGS } from './i18n.js';

let currentLang = 'ml';
let currentRate = 1;

export function setSpeechLang(lang) { currentLang = lang; }
export function setSpeechRate(rate) { currentRate = rate; }

export const canSpeak = 'speechSynthesis' in globalThis;

function pickVoice(bcp47) {
  const voices = globalThis.speechSynthesis?.getVoices?.() || [];
  return voices.find((v) => v.lang === bcp47) || voices.find((v) => v.lang?.startsWith(bcp47.split('-')[0])) || null;
}

export function hasVoiceFor(lang) {
  return Boolean(pickVoice(LANGS[lang]?.speech || 'en-IN'));
}

function utter(text, lang, rate) {
  const bcp = LANGS[lang]?.speech || 'en-IN';
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp;
  const voice = pickVoice(bcp);
  if (voice) u.voice = voice;
  u.rate = rate ?? currentRate;
  return u;
}

export function speak(text, { lang = currentLang, interrupt = true, rate } = {}) {
  if (!text || !canSpeak) return Promise.resolve();
  if (interrupt) speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = utter(text, lang, rate);
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
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
export const isListening = () => Boolean(activeRec);

/** Stop any listening in progress (screen changed, user tapped). */
export function cancelListening() {
  try { activeRec?.abort(); } catch {}
  activeRec = null;
}

/**
 * Listen once and return every guess the recogniser makes (up to 5), best first; [] on silence.
 * A rising beep says "speak now", a falling beep says "got it", so a blind user knows when to talk.
 */
export function listenAll({ lang = currentLang, timeoutMs = 8000, beep = true } = {}) {
  if (!Recognition) return Promise.resolve([]);
  cancelListening();
  return new Promise((resolve) => {
    const rec = new Recognition();
    activeRec = rec;
    rec.lang = LANGS[lang]?.speech || lang || 'en-IN';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 5;
    let done = false;
    const finish = (list) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { rec.stop(); } catch {}
      if (activeRec === rec) activeRec = null;
      if (beep && list.length) playTone({ ms: 90, hz: 520, volume: 0.15 });
      resolve(list);
    };
    rec.onresult = (e) => {
      const r = e.results[0];
      const list = [];
      for (let i = 0; i < (r?.length || 0); i++) if (r[i].transcript) list.push(r[i].transcript);
      finish(list);
    };
    rec.onerror = () => finish([]);
    rec.onend = () => finish([]);
    const timer = setTimeout(() => finish([]), timeoutMs);
    const start = () => { try { rec.start(); } catch { finish([]); } };
    if (beep) playTone({ ms: 110, hz: 880, volume: 0.15 }).then(start); else start();
  });
}

/** Listen once; resolves with the best transcript ('' on failure or timeout). */
export async function listenOnce(opts = {}) {
  return (await listenAll(opts))[0] || '';
}

/** A short 880 Hz tone for the hearing check. */
export function playTone({ ms = 700, hz = 880, volume = 0.25 } = {}) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return Promise.resolve(false);
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = hz;
  gain.gain.value = volume;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  return new Promise((resolve) => setTimeout(() => { osc.stop(); ctx.close(); resolve(true); }, ms));
}

// Distinct vibration patterns, always paired with text and icons, never used alone.
export const BUZZ = {
  tick: [30],
  found: [80, 60, 80],
  ok: [200],
  caution: [300, 150, 300],
  danger: [600, 200, 600, 200, 600],
};

export function vibrate(pattern) {
  try { globalThis.navigator?.vibrate?.(pattern); } catch {}
}
