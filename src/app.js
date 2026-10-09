// SafeScan app shell: screens, modes and the scan -> check -> amount -> confirm -> UPI flow.

import { t, LANGS } from './i18n.js';
import { parseUpiQr, buildUpiLink } from './upi.js';
import { checkPayee, checkAmount, pauseSeconds, LEVEL } from './safety.js';
import { rupeesInWords, formatRupees } from './amount.js';
import { parseAnnouncement, wordsToNumber } from './soundbox.js';
import { mountKeypad } from './keypad.js';
import { startScanner } from './scanner.js';
import {
  speak, stopSpeaking, setSpeechLang, setSpeechEnabled, listenOnce, listenContinuous,
  canListen, vibrate, BUZZ,
} from './speech.js';
import * as store from './store.js';
import { DEMO_QRS } from './demo-codes.js';

const app = document.getElementById('app');
const live = document.getElementById('live');

// Per-mode behaviour. One engine, different ways of talking to the user.
const MODES = {
  standard: { voice: false, tolerantKeypad: false, holdToPay: false, guidance: false },
  blind: { voice: true, tolerantKeypad: true, holdToPay: true, guidance: true },
  elderly: { voice: true, tolerantKeypad: true, holdToPay: true, guidance: false },
  tremor: { voice: false, tolerantKeypad: true, holdToPay: true, guidance: false },
  deaf: { voice: false, tolerantKeypad: false, holdToPay: false, guidance: false },
};

let flow = {};          // the payment in progress
let cleanup = null;     // stop camera / microphone when leaving a screen

const S = () => store.get();
const L = () => S().lang;
const M = () => MODES[S().mode] || MODES.standard;
const tr = (key, vars) => t(L(), key, vars);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applySettings() {
  const s = S();
  document.documentElement.lang = s.lang;
  document.body.dataset.mode = s.mode;
  setSpeechLang(s.lang);
  setSpeechEnabled(M().voice);
}

/** Say something: screen-reader live region always, voice when the mode wants it. */
function announce(text, { force = false } = {}) {
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 30);
  if (M().voice || force) return speak(text, { lang: L() });
  return Promise.resolve();
}

function render(html, { title } = {}) {
  cleanup?.();
  cleanup = null;
  stopSpeaking();
  app.innerHTML = html;
  const h = app.querySelector('h1, h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  if (title) document.title = `${title} · SafeScan`;
  window.scrollTo(0, 0);
}

const on = (sel, ev, fn) => app.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));

// ---------- Onboarding ----------

function screenOnboarding() {
  render(`
    <section class="screen">
      <h1 class="brand">SafeScan</h1>
      <p class="lead">${esc(tr('tagline'))}</p>
      <h2>${esc(tr('language'))}</h2>
      <div class="row">
        ${Object.entries(LANGS).map(([code, l]) => `
          <button class="btn chip ${S().lang === code ? 'is-on' : ''}" data-lang="${code}" aria-pressed="${S().lang === code}">${esc(l.label)}</button>`).join('')}
      </div>
      <h2>${esc(tr('onboard_q'))}</h2>
      <div class="stack">
        ${['blind', 'elderly', 'tremor', 'deaf', 'standard'].map((m) => `
          <button class="btn big mode-btn" data-mode="${m}">
            <span class="icon" aria-hidden="true">${{ blind: '👁️', elderly: '🔠', tremor: '✋', deaf: '👂', standard: '📱' }[m]}</span>
            ${esc(tr(`mode_${m}`))}
          </button>`).join('')}
      </div>
    </section>`, { title: 'Welcome' });

  // Speak the question in the chosen language even before a mode is picked.
  speak(`${tr('onboard_q')}`, { lang: L() });

  on('[data-lang]', 'click', (e) => {
    store.update({ lang: e.currentTarget.dataset.lang });
    applySettings();
    screenOnboarding();
  });
  on('[data-mode]', 'click', (e) => {
    store.update({ mode: e.currentTarget.dataset.mode, onboarded: true });
    applySettings();
    vibrate(BUZZ.ok);
    screenHome();
  });
}

// ---------- Home ----------

function screenHome() {
  const deaf = S().mode === 'deaf';
  render(`
    <section class="screen">
      <header class="top">
        <h1 class="brand">SafeScan</h1>
        <button class="btn ghost" id="settings">${esc(tr('settings'))}</button>
      </header>
      <div class="stack home">
        <button class="btn big primary" id="scan"><span class="icon" aria-hidden="true">📷</span>${esc(tr('scan_pay'))}</button>
        <button class="btn big" id="saved"><span class="icon" aria-hidden="true">🏪</span>${esc(tr('pay_saved'))}</button>
        <button class="btn big" id="history"><span class="icon" aria-hidden="true">🧾</span>${esc(tr('history'))}</button>
        <button class="btn big ${deaf ? 'primary' : ''}" id="soundbox"><span class="icon" aria-hidden="true">🔔</span>${esc(tr('mode_deaf'))}</button>
      </div>
    </section>`, { title: 'Home' });

  announce(`${tr('scan_pay')}. ${tr('pay_saved')}. ${tr('history')}.`);
  on('#scan', 'click', () => { flow = {}; screenPayee(); });
  on('#saved', 'click', screenSaved);
  on('#history', 'click', screenHistory);
  on('#soundbox', 'click', screenSoundbox);
  on('#settings', 'click', () => { store.update({ onboarded: false }); screenOnboarding(); });
}

// ---------- Who are you paying? ----------

function screenPayee() {
  const saved = S().savedPayees;
  render(`
    <section class="screen">
      <h1>${esc(tr('where_are_you'))}</h1>
      <label class="sr-only" for="payee">${esc(tr('where_are_you'))}</label>
      <input id="payee" class="field" autocomplete="off" placeholder="Sharma Medicals" value="${esc(flow.expectedPayee || '')}">
      ${canListen ? `<button class="btn big" id="speak"><span class="icon" aria-hidden="true">🎤</span>${esc(tr('speak'))}</button>` : ''}
      ${saved.length ? `<div class="row wrap">${saved.map((p, i) => `<button class="btn chip" data-saved="${i}">${esc(p.name)}</button>`).join('')}</div>` : ''}
      <div class="row">
        <button class="btn" id="skip">${esc(tr('skip'))}</button>
        <button class="btn primary" id="next">${esc(tr('next'))}</button>
      </div>
    </section>`, { title: 'Who are you paying' });

  announce(tr('where_are_you'));
  const input = app.querySelector('#payee');
  on('#speak', 'click', async () => {
    announce(tr('listening'));
    // Shop names in UPI QR codes are written in English, so capture names in English.
    const text = await listenOnce({ lang: 'en' });
    if (text) { input.value = text; announce(text); }
  });
  on('[data-saved]', 'click', (e) => {
    const p = saved[Number(e.currentTarget.dataset.saved)];
    flow.expectedPayee = p.name;
    screenScan();
  });
  on('#skip', 'click', () => { flow.expectedPayee = ''; screenScan(); });
  on('#next', 'click', () => { flow.expectedPayee = input.value.trim(); screenScan(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { flow.expectedPayee = input.value.trim(); screenScan(); } });
}

// ---------- Scan ----------

function screenScan() {
  render(`
    <section class="screen">
      <h1>${esc(tr('scan_pay'))}</h1>
      <p class="lead">${esc(tr('point_camera'))}</p>
      <div class="viewfinder">
        <video id="video" aria-hidden="true"></video>
        <div class="reticle" aria-hidden="true"></div>
      </div>
      <div class="meter" role="meter" aria-label="QR distance" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meter"></span></div>
      <p id="cam-error" class="warn" hidden>${esc(tr('camera_error'))}</p>
      <details class="dev">
        <summary>${esc(tr('test_mode'))}</summary>
        <textarea id="qrtext" class="field" rows="3" placeholder="upi://pay?pa=...&pn=..."></textarea>
        <button class="btn" id="usetext">${esc(tr('next'))}</button>
        <div class="row wrap">${DEMO_QRS.map((d, i) => `<button class="btn chip" data-demo="${i}">${esc(d.label)}</button>`).join('')}</div>
      </details>
      <button class="btn" id="cancel">${esc(tr('cancel'))}</button>
    </section>`, { title: 'Scan' });

  announce(tr('point_camera'));
  const meter = app.querySelector('#meter');
  const meterBox = app.querySelector('.meter');
  let stop = null;
  startScanner(app.querySelector('#video'), {
    guidance: M().guidance,
    onGuidance: (score) => {
      meter.style.width = `${Math.round(score * 100)}%`;
      meterBox.setAttribute('aria-valuenow', String(Math.round(score * 100)));
    },
    onResult: (text) => handleQr(text),
  }).then((s) => { stop = s; }).catch(() => {
    app.querySelector('#cam-error').hidden = false;
    app.querySelector('details.dev').open = true;
    announce(tr('camera_error'));
  });
  cleanup = () => stop?.();

  on('#usetext', 'click', () => handleQr(app.querySelector('#qrtext').value));
  on('[data-demo]', 'click', (e) => handleQr(DEMO_QRS[Number(e.currentTarget.dataset.demo)].text));
  on('#cancel', 'click', screenHome);
}

function handleQr(text) {
  const qr = parseUpiQr(text);
  if (!qr.ok) {
    vibrate(BUZZ.danger);
    const msg = qr.reason === 'web_link' ? tr('web_link') : tr('not_upi');
    render(`
      <section class="screen result danger" role="alert">
        <h1>⚠️</h1>
        <p class="verdict">${esc(msg)}</p>
        <button class="btn big" id="again">${esc(tr('scan_again'))}</button>
        <button class="btn" id="home">${esc(tr('cancel'))}</button>
      </section>`);
    announce(msg, { force: S().mode !== 'deaf' });
    on('#again', 'click', screenScan);
    on('#home', 'click', screenHome);
    return;
  }
  flow.qr = qr;
  flow.check = checkPayee(qr, { expectedPayee: flow.expectedPayee, knownPayees: S().savedPayees });
  screenCheck();
}

// ---------- Payee check result ----------

function findingText(f) {
  return tr(`f_${f.code}`, { expected: flow.expectedPayee, usual: f.usual ? formatRupees(f.usual) : '' });
}

function screenCheck() {
  const { qr, check } = flow;
  const level = check.level;
  const lines = [
    qr.payeeName ? tr('pays', { name: qr.payeeName }) : tr('pays_no_name', { vpa: qr.payeeVpa }),
    ...check.findings.map(findingText),
  ];
  if (level === LEVEL.OK && flow.expectedPayee) lines.push(tr('all_good'));

  render(`
    <section class="screen result ${level}" ${level === LEVEL.DANGER ? 'role="alert"' : ''}>
      <p class="badge">${level === LEVEL.DANGER ? '⛔' : level === LEVEL.CAUTION ? '⚠️' : '✅'}</p>
      <h1 class="payee">${esc(qr.payeeName || qr.payeeVpa)}</h1>
      <p class="vpa">${esc(tr('upi_id', { vpa: qr.payeeVpa }))}</p>
      <ul class="findings">
        ${check.findings.map((f) => `<li class="${f.level}">${esc(findingText(f))}</li>`).join('')}
        ${level === LEVEL.OK && flow.expectedPayee ? `<li class="ok">${esc(tr('all_good'))}</li>` : ''}
      </ul>
      <div class="stack">
        <button class="btn big ${level === LEVEL.DANGER ? '' : 'primary'}" id="continue">${esc(tr('next'))}</button>
        <button class="btn big ${level === LEVEL.DANGER ? 'primary' : ''}" id="again">${esc(tr('scan_again'))}</button>
        <button class="btn" id="cancel">${esc(tr('cancel'))}</button>
      </div>
    </section>`, { title: 'Check' });

  vibrate(level === LEVEL.DANGER ? BUZZ.danger : level === LEVEL.CAUTION ? BUZZ.caution : BUZZ.ok);
  // Danger is always spoken (unless the user is deaf), whatever the mode.
  announce(lines.join(' '), { force: level === LEVEL.DANGER && S().mode !== 'deaf' });
  on('#continue', 'click', screenAmount);
  on('#again', 'click', screenScan);
  on('#cancel', 'click', screenHome);
}

// ---------- Amount ----------

function parseSpokenAmount(text) {
  const digits = (text || '').replace(/[,\s]/g, '').match(/\d+(\.\d{1,2})?/);
  if (digits) return Number(digits[0]);
  return wordsToNumber(text || '');
}

function screenAmount() {
  const preset = flow.qr.amount;
  render(`
    <section class="screen">
      <h1>${esc(tr('enter_amount'))}</h1>
      <p class="to">→ ${esc(flow.qr.payeeName || flow.qr.payeeVpa)}</p>
      <output id="amount" class="amount" aria-live="polite">₹0</output>
      <p id="words" class="words"></p>
      <div id="keypad"></div>
      ${canListen ? `<button class="btn big" id="say"><span class="icon" aria-hidden="true">🎤</span>${esc(tr('speak'))}</button>` : ''}
      <div class="row">
        <button class="btn" id="cancel">${esc(tr('cancel'))}</button>
        <button class="btn primary" id="next">${esc(tr('next'))}</button>
      </div>
    </section>`, { title: 'Amount' });

  const out = app.querySelector('#amount');
  const words = app.querySelector('#words');
  const show = (v) => {
    const n = Number(v || 0);
    out.textContent = formatRupees(n);
    words.textContent = n ? rupeesInWords(n) : '';
  };
  const pad = mountKeypad(app.querySelector('#keypad'), {
    tolerant: M().tolerantKeypad,
    onChange: show,
    onKey: (k) => { vibrate(BUZZ.tick); if (M().voice) speak(k === 'back' ? '⌫' : k === 'clear' ? '0' : k, { lang: L() }); },
  });
  if (preset) pad.set(String(Math.round(preset)));

  announce(tr('enter_amount'));
  on('#say', 'click', async () => {
    announce(tr('listening'));
    const n = parseSpokenAmount(await listenOnce({ lang: L() }));
    if (n) { pad.set(String(Math.round(n))); announce(tr('amount_is', { amount: formatRupees(n) })); }
  });
  on('#cancel', 'click', screenHome);
  on('#next', 'click', () => {
    flow.amount = Number(pad.value || 0);
    const known = S().savedPayees.find((p) => p.vpa === flow.qr.payeeVpa);
    flow.amountCheck = checkAmount(flow.amount, {
      usualAmount: known?.usualAmount, largeLimit: S().largeLimit, qrAmount: flow.qr.amount,
    });
    if (flow.amountCheck.findings.some((f) => f.code === 'amount_invalid')) {
      announce(tr('f_amount_invalid'), { force: true });
      vibrate(BUZZ.caution);
      return;
    }
    screenConfirm();
  });
}

// ---------- Confirm and hand off ----------

function screenConfirm() {
  const level = [flow.check.level, flow.amountCheck.level].includes(LEVEL.DANGER) ? LEVEL.DANGER
    : [flow.check.level, flow.amountCheck.level].includes(LEVEL.CAUTION) ? LEVEL.CAUTION : LEVEL.OK;
  const wait = pauseSeconds(level);
  const hold = M().holdToPay;
  const name = flow.qr.payeeName || flow.qr.payeeVpa;
  const amountFindings = flow.amountCheck.findings.map(findingText);

  render(`
    <section class="screen result ${level}">
      <h1 class="amount">${esc(formatRupees(flow.amount))}</h1>
      <p class="words">${esc(rupeesInWords(flow.amount))}</p>
      <p class="to">→ ${esc(name)}</p>
      <ul class="findings">${flow.amountCheck.findings.map((f) => `<li class="${f.level}">${esc(findingText(f))}</li>`).join('')}</ul>
      <button class="btn big primary pay" id="pay" ${wait ? 'disabled' : ''}>
        <span class="fill" aria-hidden="true"></span>
        <span class="label">${esc(wait ? tr('paying_in', { s: wait }) : hold ? tr('confirm_hold') : tr('next'))}</span>
      </button>
      <button class="btn" id="cancel">${esc(tr('cancel'))}</button>
    </section>`, { title: 'Confirm' });

  vibrate(level === LEVEL.DANGER ? BUZZ.danger : level === LEVEL.CAUTION ? BUZZ.caution : BUZZ.ok);
  announce([tr('amount_is', { amount: formatRupees(flow.amount) }), `→ ${name}`, ...amountFindings].join(' '),
    { force: level === LEVEL.DANGER && S().mode !== 'deaf' });

  const btn = app.querySelector('#pay');
  const label = btn.querySelector('.label');
  const fill = btn.querySelector('.fill');

  // Pause before risky payments: the button unlocks after a countdown.
  let remaining = wait;
  const timer = remaining ? setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      label.textContent = hold ? tr('confirm_hold') : tr('next');
    } else {
      label.textContent = tr('paying_in', { s: remaining });
    }
  }, 1000) : null;
  cleanup = () => timer && clearInterval(timer);

  const go = () => handOff();
  if (hold) {
    // Hold-to-pay: 1.2 s press, so a tremor tap or a brush can never send money.
    let holdTimer = null;
    const start = (e) => {
      if (btn.disabled) return;
      e.preventDefault();
      fill.style.transition = 'width 1.2s linear';
      fill.style.width = '100%';
      holdTimer = setTimeout(go, 1200);
    };
    const end = () => { clearTimeout(holdTimer); fill.style.transition = 'none'; fill.style.width = '0'; };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', end);
    btn.addEventListener('pointercancel', end);
    // Screen readers activate with a click (no pointer hold possible): accept it.
    btn.addEventListener('click', (e) => { if (!e.pointerType && !btn.disabled) go(); });
  } else {
    btn.addEventListener('click', go);
  }
  on('#cancel', 'click', screenHome);
}

function handOff() {
  const { qr, amount } = flow;
  const link = buildUpiLink({ payeeVpa: qr.payeeVpa, payeeName: qr.payeeName, amount, note: qr.note });
  store.addHistory({ vpa: qr.payeeVpa, name: qr.payeeName || qr.payeeVpa, amount });
  announce(tr('open_upi'));
  vibrate(BUZZ.ok);

  const isSaved = S().savedPayees.some((p) => p.vpa === qr.payeeVpa);
  render(`
    <section class="screen result ok">
      <p class="badge">✅</p>
      <h1>${esc(tr('open_upi'))}</h1>
      <p class="amount">${esc(formatRupees(amount))}</p>
      <p class="to">→ ${esc(qr.payeeName || qr.payeeVpa)}</p>
      <a class="btn big primary" href="${esc(link)}" id="open">UPI</a>
      ${isSaved ? '' : `<button class="btn big" id="save">${esc(tr('save_shop'))}</button>`}
      <button class="btn" id="home">SafeScan</button>
    </section>`, { title: 'Open UPI app' });

  on('#save', 'click', (e) => {
    store.savePayee({ vpa: qr.payeeVpa, name: qr.payeeName || flow.expectedPayee || qr.payeeVpa, amount });
    e.currentTarget.textContent = tr('saved');
    e.currentTarget.disabled = true;
    announce(tr('saved'));
  });
  on('#home', 'click', screenHome);
  // Try to open the UPI app straight away; the button stays as a fallback.
  setTimeout(() => { window.location.href = link; }, 900);
}

// ---------- Saved shops ----------

function screenSaved() {
  const saved = S().savedPayees;
  render(`
    <section class="screen">
      <h1>${esc(tr('pay_saved'))}</h1>
      <div class="stack">
        ${saved.length ? saved.map((p, i) => `
          <button class="btn big" data-i="${i}">
            <span class="icon" aria-hidden="true">🏪</span>${esc(p.name)}
            ${p.usualAmount ? `<small>${esc(formatRupees(p.usualAmount))}</small>` : ''}
          </button>`).join('') : `<p class="lead">—</p>`}
      </div>
      <button class="btn" id="home">${esc(tr('cancel'))}</button>
    </section>`, { title: 'Saved shops' });

  announce(saved.map((p) => p.name).join('. ') || tr('pay_saved'));
  on('[data-i]', 'click', (e) => {
    const p = saved[Number(e.currentTarget.dataset.i)];
    // Saved payees were checked when first saved, so skip the camera and go to the amount.
    flow = {
      expectedPayee: p.name,
      qr: { ok: true, payeeVpa: p.vpa, payeeName: p.name, amount: null, note: '', action: 'pay', isMerchant: true },
    };
    flow.check = checkPayee(flow.qr, { expectedPayee: p.name, knownPayees: S().savedPayees });
    screenAmount();
  });
  on('#home', 'click', screenHome);
}

// ---------- History ----------

function screenHistory() {
  const h = S().history.slice(0, 20);
  const lines = h.map((x) => tr('paid_to', { amount: formatRupees(x.amount), name: x.name }));
  render(`
    <section class="screen">
      <h1>${esc(tr('history'))}</h1>
      <ul class="history">
        ${h.length ? h.map((x, i) => `<li><strong>${esc(formatRupees(x.amount))}</strong> ${esc(x.name)}<br><small>${esc(new Date(x.at).toLocaleString(L() === 'ml' ? 'ml-IN' : 'en-IN'))}</small><span class="sr-only">${esc(lines[i])}</span></li>`).join('') : `<li>${esc(tr('nothing_paid'))}</li>`}
      </ul>
      <button class="btn big" id="read"><span class="icon" aria-hidden="true">🔊</span>${esc(tr('history'))}</button>
      <button class="btn" id="home">${esc(tr('cancel'))}</button>
    </section>`, { title: 'History' });

  const all = lines.slice(0, 5).join('. ') || tr('nothing_paid');
  announce(all);
  on('#read', 'click', () => announce(all, { force: true }));
  on('#home', 'click', screenHome);
}

// ---------- Deaf merchant: soundbox captions ----------

function screenSoundbox() {
  render(`
    <section class="screen soundbox">
      <h1>${esc(tr('mode_deaf'))}</h1>
      <p class="lead">${esc(tr('soundbox_listen'))}</p>
      <div id="flash" class="flash" role="status" aria-live="assertive"></div>
      <ul id="log" class="history"></ul>
      <details class="dev">
        <summary>${esc(tr('test_mode'))}</summary>
        <input id="fake" class="field" value="Received 500 rupees from Anil on Paytm">
        <button class="btn" id="simulate">${esc(tr('next'))}</button>
      </details>
      <button class="btn big" id="stop">${esc(tr('stop'))}</button>
    </section>`, { title: 'Soundbox' });

  const flash = app.querySelector('#flash');
  const log = app.querySelector('#log');
  const show = (text) => {
    const p = parseAnnouncement(text);
    if (!p) return;
    vibrate(BUZZ.received);
    flash.innerHTML = `<span class="big-amount">${esc(tr('soundbox_received', { amount: formatRupees(p.amount) }))}</span>${p.from ? `<span>${esc(tr('soundbox_from', { name: p.from }))}</span>` : ''}`;
    flash.classList.remove('pulse');
    void flash.offsetWidth; // restart the flash animation
    flash.classList.add('pulse');
    const li = document.createElement('li');
    li.textContent = `${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · ${formatRupees(p.amount)}${p.from ? ` · ${p.from}` : ''}`;
    log.prepend(li);
  };
  const stop = listenContinuous(show, { lang: 'en' });
  cleanup = stop;
  on('#simulate', 'click', () => show(app.querySelector('#fake').value));
  on('#stop', 'click', screenHome);
}

// ---------- Start ----------

applySettings();
if (S().onboarded) screenHome(); else screenOnboarding();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
