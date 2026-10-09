// Shared UI helpers: routing, rendering, announcements and the "tap here" pointer.

import { t } from './i18n.js';
import * as store from './store.js';
import { applyProfile } from './profile.js';
import { speak, stopSpeaking, setSpeechLang, setSpeechRate, speakWithHighlight, vibrate } from './speech.js';

const routes = {};
const historyStack = [];
let cleanup = null;
let current = null;

export const P = () => store.get().profile;
export const tr = (key, vars) => t(P().lang, key, vars);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const root = () => document.getElementById('app');

export function route(name, fn) { routes[name] = fn; }

/** Go to a screen. `remember: false` keeps it out of the back stack (for transient screens). */
export function go(name, ...args) {
  if (!routes[name]) throw new Error(`No screen ${name}`);
  if (current && current.name !== name) historyStack.push(current);
  if (historyStack.length > 30) historyStack.shift();
  current = { name, args };
  routes[name](...args);
}

export function back() {
  const prev = historyStack.pop();
  if (!prev) return go('home');
  current = prev;
  routes[prev.name](...prev.args);
}

export function resetHistory() { historyStack.length = 0; }

export function applySettings() {
  const p = P();
  applyProfile(p);
  setSpeechLang(p.lang);
  setSpeechRate(p.speechRate);
}

export function render(html, { title } = {}) {
  cleanup?.();
  cleanup = null;
  stopSpeaking();
  const el = root();
  el.innerHTML = html;
  const h = el.querySelector('h1, h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  if (title) document.title = `${title} · ${tr('app_name')}`;
  window.scrollTo(0, 0);
  pointNext();
}

export function setCleanup(fn) { cleanup = fn; }

export const on = (sel, ev, fn) => root().querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));

/** Screen-reader live region always; voice when the profile reads aloud, or when forced (danger). */
export function announce(text, { force = false } = {}) {
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); }
  if (P().voice || force) return speak(text);
  return Promise.resolve();
}

/** Read the main content of the current screen, highlighting words if easy-reading is on. */
export function readScreen() {
  const target = root().querySelector('.readable') || root().querySelector('h1');
  if (!target) return;
  if (P().dyslexiaFont) speakWithHighlight(target);
  else speak(target.textContent);
}

/** Alert by every channel the profile allows: vibration, a flash for visual alerts, text is already on screen. */
export function alertUser(pattern) {
  vibrate(pattern);
  if (P().visualAlerts) {
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
  }
}

/** Elderly / simple mode: mark the next step with a "tap here" pointer. */
function pointNext() {
  if (!P().pointers) return;
  const next = root().querySelector('[data-next]');
  if (next) next.classList.add('point-here');
}

export function screenHeader(title, { showBack = true } = {}) {
  return `
    <header class="bar">
      ${showBack ? `<button class="btn ghost" data-action="back" aria-label="${esc(tr('back'))}">← ${esc(tr('back'))}</button>` : '<span></span>'}
      <button class="btn ghost" data-action="home" aria-label="${esc(tr('home'))}">${esc(tr('home'))}</button>
    </header>
    <h1>${esc(title)}</h1>`;
}

/** Wire the standard back/home buttons rendered by screenHeader. */
export function wireHeader() {
  on('[data-action="back"]', 'click', back);
  on('[data-action="home"]', 'click', () => { resetHistory(); go('home'); });
}
