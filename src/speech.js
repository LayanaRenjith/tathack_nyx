// Voice in and out, plus vibration patterns. Wraps the browser Web Speech API.
// Text-to-speech works offline when the phone has the voice installed;
// speech recognition in Chrome needs a network connection.

import { LANGS } from './i18n.js';

let currentLang = 'ml';
let enabled = true;

export function setSpeechLang(lang) { currentLang = lang; }
export function setSpeechEnabled(on) { enabled = on; if (!on) stopSpeaking(); }

function pickVoice(bcp47) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return voices.find((v) => v.lang === bcp47)
    || voices.find((v) => v.lang?.startsWith(bcp47.split('-')[0]))
    || null;
}

/** True if the phone has a voice for the chosen language. */
export function hasVoiceFor(lang) {
  return Boolean(pickVoice(LANGS[lang]?.speech || 'en-IN'));
}

export function speak(text, { lang = currentLang, interrupt = true, rate } = {}) {
  if (!enabled || !text || !('speechSynthesis' in window)) return Promise.resolve();
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  const bcp = LANGS[lang]?.speech || 'en-IN';
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp;
    const voice = pickVoice(bcp);
    if (voice) u.voice = voice;
    u.rate = rate ?? 0.95;
    u.onend = resolve;
    u.onerror = resolve;
    synth.speak(u);
  });
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel?.();
}

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const canListen = Boolean(Recognition);

/**
 * Listen once and resolve with the transcript ('' on failure).
 * Shop names are proper nouns and usually written in English in UPI QR codes,
 * so callers can force lang 'en' for name capture.
 */
export function listenOnce({ lang = currentLang, timeoutMs = 7000 } = {}) {
  if (!Recognition) return Promise.resolve('');
  return new Promise((resolve) => {
    const rec = new Recognition();
    rec.lang = LANGS[lang]?.speech || 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    const finish = (text) => { if (!done) { done = true; try { rec.stop(); } catch {} resolve(text); } };
    rec.onresult = (e) => finish(e.results[0]?.[0]?.transcript || '');
    rec.onerror = () => finish('');
    rec.onend = () => finish('');
    setTimeout(() => finish(''), timeoutMs);
    rec.start();
  });
}

/** Continuous listening (deaf merchant soundbox mode). Returns a stop() function. */
export function listenContinuous(onText, { lang = 'en' } = {}) {
  if (!Recognition) return () => {};
  let active = true;
  const rec = new Recognition();
  rec.lang = LANGS[lang]?.speech || 'en-IN';
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    if (last?.isFinal) onText(last[0].transcript);
  };
  rec.onend = () => { if (active) { try { rec.start(); } catch {} } };
  rec.onerror = () => {};
  rec.start();
  return () => { active = false; try { rec.stop(); } catch {} };
}

// Distinct vibration patterns so blind and deaf users can feel the result.
export const BUZZ = {
  tick: [30],
  found: [80, 60, 80],
  ok: [200],
  caution: [300, 150, 300],
  danger: [600, 200, 600, 200, 600],
  received: [400, 100, 400],
};

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch {}
}
