// Shared UI: routing, rendering, the top bar, announcements, alerts and "learns as you use".

import { t } from './i18n.js';
import * as store from './store.js';
import { applyProfile } from './profile.js';
import { createTapWatcher } from './adapt.js';
import { speak, stopSpeaking, setSpeechLang, setSpeechRate, speakWithHighlight, vibrate } from './speech.js';

const routes = {};
const stack = [];
let cleanup = null;
let current = null;

export const P = () => store.get().profile;
export const tr = (key, vars) => t(P().lang, key, vars);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const root = () => document.getElementById('app');

export function route(name, fn) { routes[name] = fn; }

export function go(name, ...args) {
  if (!routes[name]) throw new Error(`No screen ${name}`);
  if (current && current.name !== name) stack.push(current);
  if (stack.length > 30) stack.shift();
  current = { name, args };
  routes[name](...args);
}

export function back() {
  const prev = stack.pop();
  if (!prev) return go('home');
  current = prev;
  routes[prev.name](...prev.args);
}

/** Draw the current screen again (after a setting changed), keeping scroll position and history. */
export function rerender() {
  if (!current) return;
  const y = window.scrollY;
  routes[current.name](...current.args);
  window.scrollTo(0, y);
}

export function goHome() { stack.length = 0; current = null; go('home'); }

export function applySettings() {
  const p = P();
  applyProfile(p);
  setSpeechLang(p.lang);
  setSpeechRate(p.speechRate);
}

/**
 * Render a screen. `bar` adds the top bar: 'home' (brand, shops, settings) or 'back' (back + title).
 */
export function render(html, { title, bar = null } = {}) {
  cleanup?.();
  cleanup = null;
  stopSpeaking();
  const top = bar === 'home' ? homeBar() : bar === 'back' ? backBar(title) : '';
  root().innerHTML = `${top}${html}`;
  const h = root().querySelector('h1, h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  document.title = title ? `${title} · ${tr('app_name')}` : tr('app_name');
  window.scrollTo(0, 0);
  if (P().simple) root().querySelector('[data-next]')?.classList.add('point-here');
  on('[data-bar="back"]', 'click', back);
  on('[data-bar="shops"]', 'click', () => go('shops'));
  on('[data-bar="settings"]', 'click', () => go('settings'));
  on('[data-bar="voice"]', 'click', () => window.dispatchEvent(new Event('sahaaya:voice')));
}

const micBtn = () => `<button class="icon-btn" data-bar="voice" aria-label="${esc(tr('voice_btn'))}"><span aria-hidden="true">🎙</span></button>`;

function homeBar() {
  return `<header class="appbar">
    <span class="logo" aria-hidden="true"></span><span class="brand">${esc(tr('app_name'))}</span>
    <span class="spacer"></span>
    ${micBtn()}
    <button class="icon-btn" data-bar="shops" aria-label="${esc(tr('my_shops'))}"><span aria-hidden="true">🏪</span></button>
    <button class="icon-btn" data-bar="settings" aria-label="${esc(tr('settings'))}"><span aria-hidden="true">⚙</span></button>
  </header>`;
}

function backBar(title) {
  return `<header class="appbar">
    <button class="icon-btn" data-bar="back" aria-label="${esc(tr('back'))}"><span aria-hidden="true">←</span></button>
    <span class="bar-title">${esc(title || '')}</span>
    <span class="spacer"></span>
    ${micBtn()}
  </header>`;
}

export function setCleanup(fn) { cleanup = fn; }

export const on = (sel, ev, fn) => root().querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));

/** Live region for screen readers always; spoken when the profile speaks, or when forced (danger). */
export function announce(text, { force = false } = {}) {
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); }
  if (P().voice || force) return speak(text);
  return Promise.resolve();
}

export function readScreen() {
  const target = root().querySelector('.readable') || root().querySelector('h1');
  if (!target) return;
  if (P().dyslexiaFont) speakWithHighlight(target);
  else speak(target.textContent);
}

/** Alert through every channel the profile allows. Text and icon are always on screen too. */
export function alertUser(pattern) {
  vibrate(pattern);
  if (P().visualAlerts) {
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
  }
}

// ---------- Learns as you use: offer bigger buttons after missed or repeated taps ----------
const watcher = createTapWatcher();

export function startTapWatching() {
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || P().bigTargets) return;
    const hit = e.target.closest('button, a, input, textarea, summary, .key, [role="button"], video');
    if (watcher.tap(hit, performance.now())) offerBigger();
  }, true);
}

function offerBigger() {
  watcher.markOffered();
  const bar = document.createElement('div');
  bar.className = 'offer';
  bar.setAttribute('role', 'alertdialog');
  bar.innerHTML = `<p>${esc(tr('bigger_offer'))}</p>
    <div class="row"><button class="btn primary" data-offer="yes">${esc(tr('yes'))}</button><button class="btn" data-offer="no">${esc(tr('no'))}</button></div>`;
  document.body.appendChild(bar);
  announce(tr('bigger_offer'), { force: true });
  bar.querySelector('[data-offer="yes"]').addEventListener('click', () => {
    store.updateProfile({ bigTargets: true, tremorSafe: true, textScale: Math.max(P().textScale, 1.2) });
    applySettings();
    bar.remove();
  });
  bar.querySelector('[data-offer="no"]').addEventListener('click', () => bar.remove());
}
