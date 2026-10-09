// Daily flow: open → scan → hear who it is and give the amount → hold to pay → the user's UPI app opens.
// Also the "add a shop" flow: scan a regular shop's QR once, name it, save its account.

import * as store from './store.js';
import { parseUpiQr, buildUpiLink, appLink, PAY_APPS } from './upi.js';
import { checkPayment, checkAmount, pauseSeconds, combine, LEVEL, STATUS } from './safety.js';
import { wordsToNumber } from './match.js';
import { rupeesInWords, formatRupees } from './amount.js';
import { mountKeypad } from './keypad.js';
import { startScanner } from './scanner.js';
import { listenOnce, canListen, BUZZ, vibrate, speak } from './speech.js';
import { DEMO_QRS } from './demo-codes.js';
import { route, go, goHome, render, on, esc, tr, P, announce, alertUser, setCleanup, readScreen } from './ui.js';

const ICON = { ok: '✓', caution: '!', danger: '✕' };
const BUZZ_FOR = { ok: BUZZ.ok, caution: BUZZ.caution, danger: BUZZ.danger };
const money = (n) => formatRupees(n);
const appName = () => (P().payApp === 'any' ? tr('any_app') : PAY_APPS[P().payApp].label);

// ---------- Scanner view (shared by paying and adding a shop) ----------
function scannerHtml(intro) {
  return `
    <div class="viewfinder"><video id="video" aria-hidden="true"></video><div class="reticle" aria-hidden="true"></div></div>
    <div class="meter" role="meter" aria-label="QR" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meter"></span></div>
    <p class="readable muted">${esc(intro)}</p>
    <p id="cam-error" class="warn" hidden>${esc(tr('camera_error'))}</p>
    <details class="dev" id="dev">
      <summary>${esc(tr('test_mode'))}</summary>
      <div class="stack tight">${DEMO_QRS.map((d, i) => `<button class="btn small" data-demo="${i}">${esc(d.label)}</button>`).join('')}</div>
      <label for="qrtext">${esc(tr('paste_qr'))}</label>
      <textarea id="qrtext" class="field" rows="2" placeholder="upi://pay?pa=...&pn=..."></textarea>
      <button class="btn small" id="usetext">${esc(tr('next'))}</button>
    </details>`;
}

function wireScanner(onQr) {
  const meter = document.getElementById('meter');
  let stop = null;
  let done = false;
  const once = (text) => { if (!done) { done = true; stop?.(); onQr(text); } };
  startScanner(document.getElementById('video'), {
    guidance: P().voice || P().contrast,
    onGuidance: (s) => { meter.style.width = `${Math.round(s * 100)}%`; meter.parentElement.setAttribute('aria-valuenow', String(Math.round(s * 100))); },
    onResult: once,
  }).then((s) => { stop = s; if (done) s(); }).catch(() => {
    document.getElementById('cam-error').hidden = false;
    document.getElementById('dev').open = true;
  });
  setCleanup(() => stop?.());
  on('[data-demo]', 'click', (e) => once(DEMO_QRS[Number(e.currentTarget.dataset.demo)].text));
  on('#usetext', 'click', () => once(document.getElementById('qrtext').value));
}

function notPayment(qr, again) {
  alertUser(BUZZ.danger);
  const msg = qr.reason === 'web_link' ? tr('web_link') : tr('not_upi');
  render(`
    <section class="screen">
      <div class="status-card danger" role="alert"><span class="status-icon" aria-hidden="true">${ICON.danger}</span><div><p class="status-title readable">${esc(msg)}</p></div></div>
      <button class="btn big primary" id="again" data-next>${esc(tr('scan_again'))}</button>
    </section>`, { bar: 'back' });
  announce(msg, { force: true });
  on('#again', 'click', again);
}

// ---------- Home = scan to pay ----------
route('home', () => {
  render(`<section class="screen">${scannerHtml(tr('point_camera'))}</section>`, { bar: 'home' });
  announce(tr('point_camera'));
  wireScanner((text) => {
    const qr = parseUpiQr(text);
    if (!qr.ok) return notPayment(qr, goHome);
    go('result', qr);
  });
});

// ---------- Result + amount + pay, on one screen ----------
route('result', (qr) => {
  const check = checkPayment(qr, { savedShops: store.get().savedShops });
  const usual = check.shop?.usualAmount || null;
  let head;
  if (check.status === STATUS.SAME) head = { title: tr('r_same', { shop: check.shopName }), sub: tr('r_same_sub') };
  else if (check.status === STATUS.DIFFERENT) head = { title: tr('r_swapped', { shop: check.shopName }), sub: tr('r_swapped_sub', { shop: check.shopName }) };
  else head = { title: tr('r_new'), sub: qr.payeeName ? tr('r_new_sub_name', { name: qr.payeeName }) : tr('r_new_sub_noname') };
  const extra = check.findings.filter((f) => ['receive_money_trick', 'not_a_payment_qr'].includes(f.code)).map((f) => tr(`f_${f.code}`));
  const danger = check.level === LEVEL.DANGER;

  render(`
    <section class="screen">
      <div class="status-card ${check.level}" ${danger ? 'role="alert"' : ''}>
        <span class="status-icon" aria-hidden="true">${ICON[check.level]}</span>
        <div class="readable">
          <p class="status-title">${esc(head.title)}</p>
          <p class="status-sub">${esc(head.sub)}</p>
          ${extra.map((x) => `<p class="status-extra">${esc(x)}</p>`).join('')}
        </div>
      </div>
      <p class="vpa">${esc(qr.payeeVpa)}</p>${usual ? `<p class="muted">${esc(tr('usual', { amount: money(usual) }))}</p>` : ''}
      ${danger ? `
        <div class="stack" id="danger-actions">
          <button class="btn big primary" id="again" data-next>${esc(tr('scan_again'))}</button>
          <button class="btn" id="anyway">${esc(tr('continue_anyway'))}</button>
        </div>` : ''}
      <div id="pay-area" ${danger ? 'hidden' : ''}>
        <div class="amount-box">
          <span class="label">${esc(tr('amount_q'))}</span>
          <output id="amount" class="amount" aria-live="polite">₹0</output>
          <p id="words" class="words"></p>
          <div id="amount-warn" class="amount-warn" role="status"></div>
        </div>
        <div id="keypad"></div>
        ${canListen ? `<button class="btn" id="say"><span aria-hidden="true">🎙</span> ${esc(tr('say_amount'))}</button>` : ''}
        <button class="btn big primary pay" id="pay" data-next><span class="fill" aria-hidden="true"></span><span class="label-text"></span></button>
        <p class="hint">${esc(tr('listen_name'))}</p>
        <button class="btn ghost" id="again2">${esc(tr('scan_again'))}</button>
      </div>
    </section>`, { bar: 'back', title: head.title });

  alertUser(BUZZ_FOR[check.level]);
  const spoken = [head.title, head.sub, ...extra];
  if (!danger) spoken.push(usual ? tr('usual', { amount: money(usual) }) : '', tr('amount_q'));
  announce(spoken.filter(Boolean).join('. '), { force: danger });

  on('#again', 'click', goHome);
  on('#again2', 'click', goHome);
  on('#anyway', 'click', () => {
    document.getElementById('danger-actions').hidden = true;
    document.getElementById('pay-area').hidden = false;
    lockFor(pauseSeconds(LEVEL.DANGER));
  });

  // ----- amount entry -----
  const out = document.getElementById('amount');
  const words = document.getElementById('words');
  const warn = document.getElementById('amount-warn');
  const btn = document.getElementById('pay');
  const label = btn.querySelector('.label-text');
  const fill = btn.querySelector('.fill');
  const hold = P().tremorSafe;
  let amount = 0;
  let amountLevel = LEVEL.OK;
  let lockedUntil = 0;
  let timer = null;

  const payLabel = () => (hold ? tr('hold_to_pay') : tr('tap_to_pay'));
  const refreshButton = () => {
    const left = Math.ceil((lockedUntil - Date.now()) / 1000);
    btn.disabled = left > 0 || !amount;
    label.textContent = left > 0 ? tr('wait_s', { s: left }) : `${payLabel()}${amount ? `  ${money(amount)}` : ''}`;
  };
  function lockFor(s) {
    if (!s) return;
    lockedUntil = Date.now() + s * 1000;
    clearInterval(timer);
    timer = setInterval(() => { refreshButton(); if (Date.now() >= lockedUntil) clearInterval(timer); }, 250);
    refreshButton();
  }
  setCleanup(() => clearInterval(timer));

  const onAmount = (v) => {
    amount = Number(v || 0);
    out.textContent = money(amount);
    words.textContent = amount ? rupeesInWords(amount) : '';
    const a = amount ? checkAmount(amount, { usualAmount: usual, qrAmount: qr.amount, largeLimit: store.get().largeLimit }) : { level: LEVEL.OK, findings: [] };
    const text = a.findings.map((f) => tr(`f_${f.code}`, { usual: f.vars?.usual ? money(f.vars.usual) : '', qr: f.vars?.qr ? money(f.vars.qr) : '' }));
    warn.textContent = text.join(' ');
    warn.className = `amount-warn ${a.level}`;
    if (a.level === LEVEL.DANGER && amountLevel !== LEVEL.DANGER) {
      alertUser(BUZZ.danger);
      announce(text.join(' '), { force: true });
      lockFor(pauseSeconds(LEVEL.DANGER));
    }
    amountLevel = a.level;
    refreshButton();
  };

  const pad = mountKeypad(document.getElementById('keypad'), {
    tolerant: P().tremorSafe,
    onChange: onAmount,
    onKey: (k) => { vibrate(BUZZ.tick); if (P().voice && /^\d$/.test(k)) speak(k); },
  });
  if (qr.amount) pad.set(String(Math.round(qr.amount)));
  else onAmount(0);

  on('#say', 'click', async () => {
    announce(tr('listening'));
    const heard = await listenOnce();
    const d = (heard || '').replace(/[,\s]/g, '').match(/\d+(\.\d{1,2})?/);
    const n = d ? Number(d[0]) : wordsToNumber(heard);
    if (n) { pad.set(String(Math.round(n))); announce(tr('amount_spoken', { amount: money(n), name: check.shopName })); }
  });

  const go_ = () => { if (!btn.disabled) handOff(qr, check, amount); };
  if (hold) {
    let t = null;
    btn.addEventListener('pointerdown', (e) => {
      if (btn.disabled) return;
      e.preventDefault();
      fill.style.transition = 'width 1.2s linear';
      fill.style.width = '100%';
      t = setTimeout(go_, 1200);
    });
    const end = () => { clearTimeout(t); fill.style.transition = 'none'; fill.style.width = '0'; };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, end));
    btn.addEventListener('click', (e) => { if (!e.pointerType) go_(); }); // keyboard and screen readers
  } else {
    btn.addEventListener('click', go_);
  }
  on('#read', 'click', readScreen);
});

// ---------- Hand-off to the user's UPI app ----------
function handOff(qr, check, amount) {
  const upi = buildUpiLink({ payeeVpa: qr.payeeVpa, payeeName: qr.payeeName, amount, note: qr.note });
  const link = appLink(upi, P().payApp);
  store.addHistory({ name: check.shopName, vpa: qr.payeeVpa, amount, status: check.status });
  const app = appName();
  const offerSave = check.status === STATUS.NEW && qr.payeeName;
  render(`
    <section class="screen">
      <div class="status-card neutral"><span class="status-icon" aria-hidden="true">₹</span>
        <div class="readable"><p class="status-title">${esc(tr('opening', { app }))}</p><p class="status-sub">${esc(tr('opening_sub', { app }))}</p></div>
      </div>
      <p class="amount center">${esc(money(amount))}</p>
      <p class="center muted">${esc(check.shopName)}</p>
      <a class="btn big primary" href="${esc(link)}" id="open">${esc(tr('open_again', { app }))}</a>
      <p class="hint">${esc(tr('fallback', { app }))}</p>
      ${offerSave ? `<button class="btn" id="save">${esc(tr('save_this_shop', { name: qr.payeeName }))}</button><p class="hint">${esc(tr('save_note'))}</p>` : ''}
      <button class="btn ghost" id="done">${esc(tr('done'))}</button>
    </section>`, { bar: 'back' });
  alertUser(BUZZ.ok);
  announce(`${tr('opening', { app })}. ${tr('opening_sub', { app })}`);
  on('#save', 'click', () => go('name-shop', qr, 'home'));
  on('#done', 'click', goHome);
  setTimeout(() => { window.location.href = link; }, 700);
}

// ---------- Add a regular shop: scan its QR once, then name it ----------
route('add-shop', (returnTo = 'shops') => {
  render(`<section class="screen"><h1>${esc(tr('scan_shop'))}</h1>${scannerHtml(tr('point_camera'))}</section>`, { bar: 'back', title: tr('scan_shop') });
  announce(tr('point_camera'));
  wireScanner((text) => {
    const qr = parseUpiQr(text);
    if (!qr.ok) return notPayment(qr, () => go('add-shop', returnTo));
    go('name-shop', qr, returnTo);
  });
});

route('name-shop', (qr, returnTo = 'shops') => {
  render(`
    <section class="screen">
      <h1>${esc(tr('name_shop_q'))}</h1>
      <p class="muted">${esc(tr('name_shop_hint', { vpa: qr.payeeVpa }))}${qr.payeeName ? ` ${esc(tr('name_shop_from_qr', { name: qr.payeeName }))}` : ''}</p>
      <label class="sr-only" for="name">${esc(tr('name_shop_q'))}</label>
      <input id="name" class="field big-field" autocomplete="off" value="${esc(qr.payeeName || '')}">
      ${canListen ? `<button class="btn" id="say"><span aria-hidden="true">🎙</span> ${esc(tr('speak'))}</button>` : ''}
      <button class="btn big primary" id="save" data-next>${esc(tr('save'))}</button>
    </section>`, { bar: 'back', title: tr('name_shop_q') });
  announce(`${tr('name_shop_q')} ${qr.payeeName ? tr('name_shop_from_qr', { name: qr.payeeName }) : ''}`);
  const input = document.getElementById('name');
  on('#say', 'click', async () => {
    announce(tr('listening'));
    const heard = await listenOnce({ lang: 'en' });
    if (heard) { input.value = heard; announce(heard); }
  });
  on('#save', 'click', () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    store.saveShop({ name, vpa: qr.payeeVpa, usualAmount: qr.amount || null });
    alertUser(BUZZ.ok);
    announce(tr('shop_saved', { name }), { force: true });
    if (returnTo === 'home') goHome(); else go(returnTo);
  });
});
