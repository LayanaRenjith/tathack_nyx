// Shared UI: routing with a real back stack, top bar with a back button, bottom navigation,
// announcements, alerts and "learns as you use".

import { t } from './i18n.js';
import * as store from './store.js';
import { applyProfile, speaks, voiceDriven } from './profile.js';
import { parseCommand } from './commands.js';
import { createTapWatcher } from './adapt.js';
import { icon } from './icons.js';
import { speak, stopSpeaking, setSpeechLang, setSpeechRate, speakWithHighlight, vibrate, listenAll, cancelListening, canListen } from './speech.js';

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
  cancelListening();
  screenGen += 1;
  screenVoice = { actions: {}, help: '', own: false };
  const vm = voiceDriven(P()) && canListen;
  autoListenPending = vm;
  const topHtml = top === 'back' ? backBar(title) : top === 'brand' ? brandBar() : '';
  root().innerHTML = `${topHtml}${step ? steps(step) : ''}<div class="content">${html}</div>${vm ? voiceBar() : nav ? navBar(nav) : ''}`;
  document.body.classList.toggle('has-nav', Boolean(nav) || vm);
  const h = root().querySelector('.content h1, .content h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  document.title = title ? `${title} · ${tr('app_name')}` : tr('app_name');
  window.scrollTo(0, 0);
  if (P().simple) root().querySelector('[data-next]')?.classList.add('point-here');
  on('[data-bar="back"]', 'click', back);
  on('[data-bar="voice"]', 'click', () => window.dispatchEvent(new Event('sahaaya:voice')));
  on('.voice-bar', 'click', () => voiceTurn());
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
  const item = (key, ic, label) => `<button class="nav-item ${active === key ? 'is-active' : ''}" data-nav="${key}" ${active === key ? 'aria-current="page"' : ''}><span class="nav-ic">${icon(ic)}</span><span>${esc(tr(label))}</span></button>`;
  return `<nav class="bottomnav" aria-label="Main">${item('home', 'home', 'home')}${item('history', 'history', 'nav_payments')}${item('report', 'chart', 'nav_report')}${item('profile', 'user', 'profile')}</nav>`;
}

function voiceBar() {
  return `<button class="voice-bar" aria-label="${esc(tr('vm_tap'))}"><span class="voice-orb">${icon('mic')}</span><span class="voice-text">${esc(tr('vm_tap'))}</span></button>`;
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
  const gen = screenGen;
  const done = (speaks(p) || (force && !p.screenReader)) ? (cancelListening(), speak(text)) : Promise.resolve();
  // Full voice control: once the screen has been read out, start listening for what to do next.
  if (autoListenPending) {
    autoListenPending = false;
    done.then(() => { if (gen === screenGen && !screenVoice.own) voiceTurn(); });
  }
  return done;
}

// ---------- Full voice control ----------
let screenGen = 0;
let screenVoice = { actions: {}, help: '', own: false };
let autoListenPending = false;
let globalHandler = null;
export const screenId = () => screenGen;

/**
 * What this screen understands by voice.
 * @param {object} o
 * @param {Record<string, Function>} [o.actions]  screen commands (keys from COMMANDS) to handlers
 * @param {string} [o.help]  what to say when the user asks for help or isn't understood
 * @param {boolean} [o.own]  the screen runs its own spoken conversation; don't auto-listen
 */
export function setVoice(o) { screenVoice = { ...screenVoice, ...o }; }
export function onGlobalCommand(fn) { globalHandler = fn; }
export const voiceHelp = () => screenVoice.help || tr(current?.name === 'home' ? 'vm_help_home' : 'vm_help');

/** Run one heard phrase: screen commands first, then the app-wide ones. True if understood. */
export async function handleHeard(alternatives) {
  const keys = Object.keys(screenVoice.actions);
  const local = keys.length ? parseCommand(alternatives, keys) : null;
  if (local) { await screenVoice.actions[local](alternatives); return local; }
  const cmd = parseCommand(alternatives);
  if (cmd && globalHandler) { const ok = await globalHandler(cmd, alternatives); if (ok !== false) return cmd; }
  return null;
}

const QUIET_AFTER = new Set(['stop', 'voiceOff', 'call', 'send', 'tell']);

/** Listen, act, and keep the conversation going while the screen stays the same. */
export async function voiceTurn({ retries = 2 } = {}) {
  if (!canListen) return;
  const gen = screenGen;
  const bar = document.querySelector('.voice-bar');
  for (let i = 0; i <= retries; i += 1) {
    bar?.classList.add('is-listening');
    const heard = await listenAll({ lang: P().lang });
    bar?.classList.remove('is-listening');
    if (gen !== screenGen) return;
    if (heard.length) {
      const cmd = await handleHeard(heard);
      if (gen !== screenGen) return;           // moved to another screen; it will listen itself
      if (cmd) { if (!QUIET_AFTER.has(cmd) && voiceDriven(P())) { i = -1; continue; } return; }
    }
    if (i < retries) await speak(i === 0 ? tr('vm_try_again') : voiceHelp());
    if (gen !== screenGen) return;
  }
  bar?.classList.add('is-paused');
  if (speaks(P())) speak(tr('vm_paused'));
}

export function readScreen() {
  const target = root().querySelector('.readable') || root().querySelector('h1');
  if (!target) return Promise.resolve();
  cancelListening();
  if (P().dyslexiaFont) return speakWithHighlight(target);
  return speak(voiceDriven(P()) ? `${target.textContent}. ${voiceHelp()}` : target.textContent);
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
