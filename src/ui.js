// Shared UI: routing with a real back stack, top bar with a back button, bottom navigation,
// announcements, alerts and "learns as you use".

import { t } from './i18n.js';
import * as store from './store.js';
import { applyProfile, speaks } from './profile.js';
import { createTapWatcher } from './adapt.js';
import { icon } from './icons.js';
import { speak, stopSpeaking, setSpeechLang, setSpeechRate, speakWithHighlight, vibrate } from './speech.js';

const routes = {};
const stack = [];
let cleanup = null;
let current = null;

export const S = () => store.get();
export const P = () => store.get().profile;
export const tr = (key, vars) => t(P().lang, key, vars);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const root = () => document.getElementById('app');

export function route(name, fn) { routes[name] = fn; }

export function go(name, ...args) {
  if (!routes[name]) throw new Error(`No screen ${name}`);
  if (current && current.name !== name) stack.push(current);
  if (stack.length > 40) stack.shift();
  current = { name, args };
  routes[name](...args);
}

/** Replace the current screen (no back entry), e.g. after login. */
export function replace(name, ...args) {
  current = { name, args };
  routes[name](...args);
}

export function back() {
  const prev = stack.pop();
  if (!prev) return replace(store.get().setupDone ? 'home' : 'welcome');
  current = prev;
  routes[prev.name](...prev.args);
}

export function goHome() { stack.length = 0; replace('home'); }
export function currentName() { return current?.name; }

export function rerender() {
  if (!current) return;
  const y = window.scrollY;
  routes[current.name](...current.args);
  window.scrollTo(0, y);
}

export function applySettings() {
  const p = P();
  applyProfile(p);
  setSpeechLang(p.lang);
  setSpeechRate(p.speechRate);
}

/**
 * Render a screen.
 * @param {string} html
 * @param {object} o
 * @param {string} [o.title]      title shown in the top bar and the tab title
 * @param {'back'|'brand'|null} [o.top] top bar style
 * @param {'home'|'history'|'profile'|null} [o.nav] show bottom navigation with this tab active
 * @param {number} [o.step]       1-4 progress through Scan, Check, Amount, Pay
 */
export function render(html, { title = '', top = 'back', nav = null, step = 0 } = {}) {
  cleanup?.();
  cleanup = null;
  stopSpeaking();
  const topHtml = top === 'back' ? backBar(title) : top === 'brand' ? brandBar() : '';
  root().innerHTML = `${topHtml}${step ? steps(step) : ''}<div class="content">${html}</div>${nav ? navBar(nav) : ''}`;
  document.body.classList.toggle('has-nav', Boolean(nav));
  const h = root().querySelector('.content h1, .content h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  document.title = title ? `${title} · ${tr('app_name')}` : tr('app_name');
  window.scrollTo(0, 0);
  if (P().simple) root().querySelector('[data-next]')?.classList.add('point-here');
  on('[data-bar="back"]', 'click', back);
  on('[data-bar="voice"]', 'click', () => window.dispatchEvent(new Event('sahaaya:voice')));
  on('[data-nav]', 'click', (e) => {
    const target = e.currentTarget.dataset.nav;
    if (target === 'home') goHome(); else { stack.length = 0; replace(target); }
  });
}

const micBtn = () => `<button class="icon-btn" data-bar="voice" aria-label="${esc(tr('voice_btn'))}">${icon('mic')}</button>`;

function backBar(title) {
  return `<header class="appbar">
    <button class="icon-btn back" data-bar="back" aria-label="${esc(tr('back'))}">${icon('back')}</button>
    <span class="bar-title">${esc(title)}</span>
    ${micBtn()}
  </header>`;
}

function brandBar() {
  return `<header class="appbar brandbar">
    <span class="logo" aria-hidden="true"></span><span class="brand">${esc(tr('app_name'))}</span>
    <span class="spacer"></span>${micBtn()}
  </header>`;
}

function navBar(active) {
  const item = (key, ic) => `<button class="nav-item ${active === key ? 'is-active' : ''}" data-nav="${key}" ${active === key ? 'aria-current="page"' : ''}>${icon(ic)}<span>${esc(tr(key))}</span></button>`;
  return `<nav class="bottomnav" aria-label="Main">${item('home', 'home')}${item('history', 'history')}${item('profile', 'user')}</nav>`;
}

function steps(n) {
  const names = ['step_scan', 'step_check', 'step_amount', 'step_pay'];
  return `<ol class="steps" aria-label="${esc(tr(names[n - 1]))} (${n}/4)">${names.map((k, i) => `
    <li class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}" ${i + 1 === n ? 'aria-current="step"' : ''}><span class="dot">${i + 1 < n ? icon('check') : i + 1}</span><span class="lbl">${esc(tr(k))}</span></li>`).join('')}</ol>`;
}

export function setCleanup(fn) { cleanup = fn; }

export const on = (sel, ev, fn) => root().querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));

/** Live region for TalkBack always; Sahaaya's own voice when the profile speaks, or when forced (danger). */
export function announce(text, { force = false } = {}) {
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); }
  const p = P();
  if (speaks(p) || (force && !p.screenReader)) return speak(text);
  return Promise.resolve();
}

export function readScreen() {
  const target = root().querySelector('.readable') || root().querySelector('h1');
  if (!target) return;
  if (P().dyslexiaFont) speakWithHighlight(target);
  else speak(target.textContent);
}

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
    rerender();
  });
  bar.querySelector('[data-offer="no"]').addEventListener('click', () => bar.remove());
}
