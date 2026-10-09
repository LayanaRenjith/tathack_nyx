// Shared UI: routing with a real back stack, top bar with a back button, bottom navigation,
// announcements, alerts and "learns as you use".

import { t } from './i18n.js';
import * as store from './store.js';
import { applyProfile, speaks, voiceDriven } from './profile.js';
import { parseCommand } from './commands.js';
import { createTapWatcher } from './adapt.js';
import { icon } from './icons.js';
import { speak, stopSpeaking, setSpeechLang, setSpeechRate, speakWithHighlight, vibrate, listenAll, cancelListening, canListen, setVoiceName } from './speech.js';

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
  setVoiceName(p.voiceName);
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
  clearInterval(pointerTimer);
  document.getElementById('pointer-hand')?.remove();
  if (P().simple) {
    root().querySelector('[data-next]')?.classList.add('point-here');
    placePointer();
    pointerTimer = setInterval(placePointer, 400); // follows the button when the layout changes
  }
  on('[data-bar="back"]', 'click', back);
  on('[data-bar="size"]', 'click', cycleTextSize);
  on('[data-bar="voice"]', 'click', () => window.dispatchEvent(new Event('sahaaya:voice')));
  on('.voice-bar', 'click', () => { stopSpeaking(); voiceTurn(); });
  const hint = root().querySelector('.voice-hint');
  if (hint) hint.textContent = voiceHelp();
  on('[data-nav]', 'click', (e) => {
    const target = e.currentTarget.dataset.nav;
    if (target === 'home') goHome(); else { stack.length = 0; replace(target); }
  });
}

// ---------- "Tap here" pointer (simple mode) ----------
// A hand drawn under the next button, pointing up at its centre. Positioned from the button's real box,
// so it lines up at any text size, in any language, and never gets clipped by the button.
let pointerTimer = null;
const HAND = `<svg viewBox="0 0 48 58" width="44" height="54" aria-hidden="true"><path d="M19 7a4.5 4.5 0 0 1 9 0v17l1.6-.4a4.2 4.2 0 0 1 4.9 2.5 4.2 4.2 0 0 1 5.6 2.8 4.2 4.2 0 0 1 5.4 4V41c0 8.5-6.5 15-15 15h-3.6c-5 0-8.6-2.4-11.2-6.6L5.6 39a4.3 4.3 0 0 1 6.9-5.2L19 40z" fill="#fff" stroke="#23302a" stroke-width="2.6" stroke-linejoin="round"/><path d="M28 30v8M34.4 31v7M40 33v6" stroke="#23302a" stroke-width="2.2" stroke-linecap="round"/></svg>`;

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && !el.disabled && !el.closest('[hidden]'); };

function placePointer() {
  // Always point at the first next-step button that can be pressed right now.
  const target = [...root().querySelectorAll('[data-next]')].find(visible);
  root().querySelectorAll('.point-here').forEach((x) => { if (x !== target) x.classList.remove('point-here'); });
  target?.classList.add('point-here');
  const el = target;
  let hand = document.getElementById('pointer-hand');
  const r = el?.getBoundingClientRect();
  if (!el || !r.width || el.disabled || el.closest('[hidden]')) { if (hand) hand.hidden = true; return; }
  if (!hand) {
    hand = document.createElement('div');
    hand.id = 'pointer-hand';
    hand.className = 'pointer-hand';
    hand.innerHTML = HAND;
    document.body.appendChild(hand);
  }
  hand.hidden = false;
  hand.style.left = `${Math.round(r.left + window.scrollX + r.width / 2 - 21)}px`;
  hand.style.top = `${Math.round(r.bottom + window.scrollY - 10)}px`;
}
window.addEventListener('resize', () => placePointer());

const micBtn = () => `<button class="icon-btn" data-bar="voice" aria-label="${esc(tr('voice_btn'))}">${icon('mic')}</button>`;
export const textSizeBtn = () => `<button class="icon-btn text-size" data-bar="size" aria-label="${esc(tr('text_size'))}"><span aria-hidden="true">A<b>A</b></span></button>`;

// Back is a labelled button, not just an arrow: many older users don't read icons.
function backBar(title) {
  return `<header class="appbar">
    <button class="back-btn" data-bar="back">${icon('back')}<span>${esc(tr('back'))}</span></button>
    <span class="bar-title">${esc(title)}</span>
    ${textSizeBtn()}${micBtn()}
  </header>`;
}

function brandBar() {
  return `<header class="appbar brandbar">
    <span class="logo" aria-hidden="true"></span><span class="brand">${esc(tr('app_name'))}</span>
    <span class="spacer"></span>${textSizeBtn()}${micBtn()}
  </header>`;
}

/** One tap cycles the text size: normal, large, extra large. */
const SIZES = [1, 1.2, 1.45, 1.75];
export function cycleTextSize() {
  const now = P().textScale;
  const next = SIZES.find((x) => x > now + 0.01) ?? SIZES[0];
  store.updateProfile({ textScale: next, bigTargets: next >= 1.2 || P().bigTargets });
  applySettings();
  rerender();
  announce(`${tr('text_size')}: ${Math.round(next * 100)}%`);
}

function navBar(active) {
  const item = (key, ic, label) => `<button class="nav-item ${active === key ? 'is-active' : ''}" data-nav="${key}" ${active === key ? 'aria-current="page"' : ''}><span class="nav-ic">${icon(ic)}</span><span>${esc(tr(label))}</span></button>`;
  return `<nav class="bottomnav" aria-label="Main">${item('home', 'home', 'home')}${item('history', 'history', 'nav_payments')}${item('report', 'chart', 'nav_report')}${item('profile', 'user', 'profile')}</nav>`;
}

function voiceBar() {
  return `<button class="voice-bar" aria-label="${esc(tr('vm_tap'))}"><span class="voice-orb">${icon('mic')}</span><span class="voice-copy"><span class="voice-text">${esc(tr('vm_tap'))}</span><small class="voice-hint"></small></span></button>`;
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
export function setVoice(o) {
  screenVoice = { ...screenVoice, ...o };
  const hint = document.querySelector('.voice-bar .voice-hint'); // what you can say here, on screen too
  if (hint) hint.textContent = voiceHelp();
}
export function onGlobalCommand(fn) { globalHandler = fn; }
export const voiceHelp = () => screenVoice.help || tr(current?.name === 'home' ? 'vm_help_home' : 'vm_help');

/** Run one heard phrase: screen commands first, then the app-wide ones. True if understood. */
export async function handleHeard(alternatives) {
  const keys = Object.keys(screenVoice.actions);
  const local = keys.length ? parseCommand(alternatives, keys) : null;
  if (local) { await screenVoice.actions[local](alternatives); return local; }
  const cmd = parseCommand(alternatives);
  // A saved shop's name ("Lakshmi Bakery 250", "pay Lakshmi Bakery") means pay that shop.
  if (globalHandler && (!cmd || cmd === 'pay' || cmd === 'shops') && (await globalHandler('payShop', alternatives)) !== false) return 'payShop';
  if (cmd && globalHandler) { const ok = await globalHandler(cmd, alternatives); if (ok !== false) return cmd; }
  return null;
}

function setBarText(text) {
  const el = document.querySelector('.voice-bar .voice-text');
  if (el) el.textContent = text;
}

const QUIET_AFTER = new Set(['stop', 'voiceOff', 'call', 'send', 'tell']);

/** Listen, act, and keep the conversation going while the screen stays the same. */
export async function voiceTurn({ retries = 2 } = {}) {
  if (!canListen) return;
  const gen = screenGen;
  const bar = document.querySelector('.voice-bar');
  for (let i = 0; i <= retries; i += 1) {
    bar?.classList.add('is-listening');
    bar?.classList.remove('is-paused');
    setBarText(tr('listening'));
    const heard = await listenAll({ lang: P().lang, onInterim: (t) => setBarText(`“${t}…”`) });
    bar?.classList.remove('is-listening');
    if (gen !== screenGen) return;
    setBarText(heard[0] ? `“${heard[0]}”` : tr('vm_tap'));
    if (heard.length) {
      const cmd = await handleHeard(heard);
      if (cmd) vibrate([40]);
      if (gen !== screenGen) return;           // moved to another screen; it will listen itself
      if (cmd) { if (!QUIET_AFTER.has(cmd) && voiceDriven(P())) { i = -1; continue; } return; }
    }
    if (i < retries) await speak(i === 0 ? tr('vm_try_again') : voiceHelp());
    if (gen !== screenGen) return;
  }
  bar?.classList.add('is-paused');
  setBarText(tr('vm_tap'));
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
