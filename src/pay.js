// SafeScan flow: intent -> scan -> result -> amount -> confirm -> hand-off to the user's UPI app -> save shop.
// Every step follows the profile: spoken, hold-to-pay, tremor keypad, icon + word warnings, pointers.

import * as store from './store.js';
import { parseUpiQr, buildUpiLink } from './upi.js';
import { checkPayment, checkAmount, pauseSeconds, LEVEL, STATUS } from './safety.js';
import { parseIntent, wordsToNumber, findShop } from './match.js';
import { rupeesInWords, formatRupees } from './amount.js';
import { mountKeypad } from './keypad.js';
import { startScanner } from './scanner.js';
import { listenOnce, canListen, BUZZ, vibrate, speak } from './speech.js';
import { DEMO_QRS } from './demo-codes.js';
import { route, go, render, on, esc, tr, P, announce, alertUser, setCleanup, screenHeader, wireHeader, readScreen, resetHistory } from './ui.js';

let flow = {};

const ICON = { [LEVEL.OK]: '✓', [LEVEL.CAUTION]: '!', [LEVEL.DANGER]: '✕' };
const BUZZ_FOR = { [LEVEL.OK]: BUZZ.ok, [LEVEL.CAUTION]: BUZZ.caution, [LEVEL.DANGER]: BUZZ.danger };

function money(n) { return formatRupees(n); }

function findingText(f) {
  const v = { ...(f.vars || {}) };
  for (const k of ['qr', 'planned', 'usual']) if (typeof v[k] === 'number') v[k] = money(v[k]);
  return tr(`f_${f.code}`, v);
}

// ---------- 1. Intent: who and how much ----------
route('pay', (preset = {}) => {
  flow = { intendedShop: preset.shop || '', intendedAmount: preset.amount ?? null };
  const shops = store.get().savedShops;
  render(`
    <section class="screen">
      ${screenHeader(tr('intent_shop'))}
      ${shops.length ? `<div class="row wrap">${shops.map((s, i) => `<button class="btn chip" data-shop="${i}">${esc(s.name)}</button>`).join('')}</div>` : ''}
      <label for="shop">${esc(tr('shop_name_label'))}</label>
      <input id="shop" class="field" autocomplete="off" value="${esc(flow.intendedShop)}" placeholder="Lakshmi Bakery">
      <label for="amt">${esc(tr('intent_amount'))} <small>(${esc(tr('optional'))})</small></label>
      <input id="amt" class="field" inputmode="decimal" autocomplete="off" value="${flow.intendedAmount ?? ''}" placeholder="250">
      ${canListen ? `<button class="btn big" id="say"><span class="icon" aria-hidden="true">🎤</span>${esc(tr('speak'))}</button><p class="hint">${esc(tr('intent_hint'))}</p>` : ''}
      <button class="btn big primary" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: tr('pay_safely') });
  wireHeader();
  announce(`${tr('intent_shop')} ${canListen ? tr('intent_hint') : ''}`);

  const shopEl = document.getElementById('shop');
  const amtEl = document.getElementById('amt');
  on('[data-shop]', 'click', (e) => {
    const s = shops[Number(e.currentTarget.dataset.shop)];
    shopEl.value = s.name;
    amtEl.focus();
    announce(s.name);
  });
  on('#say', 'click', async () => {
    announce(tr('listening'));
    // Shop names on UPI accounts are usually English, so capture in English; numbers work either way.
    const heard = await listenOnce({ lang: 'en' });
    if (!heard) return;
    const { shop, amount } = parseIntent(heard);
    if (shop) shopEl.value = shop;
    if (amount) amtEl.value = String(amount);
    announce([shop, amount ? money(amount) : ''].filter(Boolean).join(', '));
  });
  const next = () => {
    flow.intendedShop = shopEl.value.trim();
    const a = Number(String(amtEl.value).replace(/[^\d.]/g, ''));
    flow.intendedAmount = a > 0 ? a : null;
    go('scan');
  };
  on('#next', 'click', next);
  amtEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
});

// ---------- 2. Scan ----------
route('scan', () => {
  render(`
    <section class="screen">
      ${screenHeader(tr('pay_safely'))}
      <p class="readable">${esc(tr('point_camera'))}</p>
      <div class="viewfinder"><video id="video" aria-hidden="true"></video><div class="reticle" aria-hidden="true"></div></div>
      <div class="meter" role="meter" aria-label="QR" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meter"></span></div>
      <p id="cam-error" class="warn" hidden>${esc(tr('camera_error'))}</p>
      <details class="dev" id="dev">
        <summary>${esc(tr('test_mode'))}</summary>
        <div class="stack">${DEMO_QRS.map((d, i) => `<button class="btn" data-demo="${i}">${esc(d.label)}</button>`).join('')}</div>
        <label for="qrtext">${esc(tr('paste_qr'))}</label>
        <textarea id="qrtext" class="field" rows="2" placeholder="upi://pay?pa=...&pn=..."></textarea>
        <button class="btn" id="usetext">${esc(tr('next'))}</button>
      </details>
    </section>`, { title: tr('pay_safely') });
  wireHeader();
  announce(tr('point_camera'));

  const meter = document.getElementById('meter');
  let stop = null;
  startScanner(document.getElementById('video'), {
    guidance: P().voice || P().needs.vision,
    onGuidance: (s) => { meter.style.width = `${Math.round(s * 100)}%`; meter.parentElement.setAttribute('aria-valuenow', String(Math.round(s * 100))); },
    onResult: (text) => handleQr(text),
  }).then((s) => { stop = s; }).catch(() => {
    document.getElementById('cam-error').hidden = false;
    document.getElementById('dev').open = true;
    announce(tr('camera_error'));
  });
  setCleanup(() => stop?.());
  on('[data-demo]', 'click', (e) => handleQr(DEMO_QRS[Number(e.currentTarget.dataset.demo)].text));
  on('#usetext', 'click', () => handleQr(document.getElementById('qrtext').value));
});

function handleQr(text) {
  const qr = parseUpiQr(text);
  if (!qr.ok) {
    alertUser(BUZZ.danger);
    const msg = qr.reason === 'web_link' ? tr('web_link') : tr('not_upi');
    render(`
      <section class="screen result danger" role="alert">
        ${screenHeader('')}
        <p class="status"><span class="status-icon" aria-hidden="true">${ICON.danger}</span><span class="readable">${esc(msg)}</span></p>
        <button class="btn big primary" id="again" data-next>${esc(tr('scan_again'))}</button>
      </section>`);
    wireHeader();
    announce(msg, { force: true });
    on('#again', 'click', () => go('scan'));
    return;
  }
  flow.qr = qr;
  flow.check = checkPayment(qr, { intendedShop: flow.intendedShop, intendedAmount: flow.intendedAmount, savedShops: store.get().savedShops });
  go('result');
}

// ---------- 3. Result: same / different / new ----------
route('result', () => {
  const { qr, check } = flow;
  const shop = check.shopName || qr.payeeVpa;
  const head = {
    [STATUS.SAME]: { title: tr('s_same'), detail: tr('s_same_detail', { shop }) },
    [STATUS.DIFFERENT]: { title: tr('s_different'), detail: tr('s_different_detail', { shop }) },
    [STATUS.NEW]: { title: tr('s_new'), detail: tr('s_new_detail') },
  }[check.status];
  const lines = check.findings.filter((f) => f.code !== 'different_account' && f.code !== 'new_account').map(findingText);
  const level = check.level;
  const danger = level === LEVEL.DANGER;

  render(`
    <section class="screen result ${level}" ${danger ? 'role="alert"' : ''}>
      ${screenHeader('')}
      <p class="status"><span class="status-icon" aria-hidden="true">${ICON[level]}</span><strong>${esc(head.title)}</strong></p>
      <div class="readable">
        <p>${esc(head.detail)}</p>
        ${lines.map((l) => `<p class="finding">${esc(l)}</p>`).join('')}
        <p class="listen">${esc(tr('listen_name'))}</p>
      </div>
      <div class="details">
        <p>${esc(qr.payeeName ? tr('qr_pays', { name: qr.payeeName }) : tr('qr_no_name'))}</p>
        <p class="vpa">${esc(tr('upi_id', { vpa: qr.payeeVpa }))}</p>
        ${qr.amount != null ? `<p>${esc(money(qr.amount))}</p>` : ''}
      </div>
      <button class="btn" id="read"><span class="icon" aria-hidden="true">🔊</span>${esc(tr('read_this'))}</button>
      <div class="stack">
        ${danger
          ? `<button class="btn big primary" id="again" data-next>${esc(tr('scan_again'))}</button>
             <button class="btn" id="continue">${esc(tr('continue_anyway'))}</button>`
          : `<button class="btn big primary" id="continue" data-next>${esc(tr('continue'))}</button>
             <button class="btn" id="again">${esc(tr('scan_again'))}</button>`}
      </div>
    </section>`, { title: head.title });
  wireHeader();
  alertUser(BUZZ_FOR[level]);
  // Danger is always spoken, whatever the profile: a missed warning costs money.
  announce([head.title, head.detail, ...lines, tr('listen_name')].join(' '), { force: danger });
  on('#read', 'click', readScreen);
  on('#again', 'click', () => go('scan'));
  on('#continue', 'click', () => go('amount'));
});

// ---------- 4. Amount ----------
function spokenAmount(text) {
  const d = (text || '').replace(/[,\s]/g, '').match(/\d+(\.\d{1,2})?/);
  return d ? Number(d[0]) : wordsToNumber(text);
}

route('amount', () => {
  const preset = flow.qr.amount ?? flow.intendedAmount;
  const name = flow.check.shopName || flow.qr.payeeVpa;
  render(`
    <section class="screen">
      ${screenHeader(tr('enter_amount'))}
      <p class="to">→ ${esc(name)}</p>
      <output id="amount" class="amount" aria-live="polite">₹0</output>
      <p id="words" class="words"></p>
      <div id="keypad"></div>
      ${canListen ? `<button class="btn big" id="say"><span class="icon" aria-hidden="true">🎤</span>${esc(tr('speak'))}</button>` : ''}
      <button class="btn big primary" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: tr('enter_amount') });
  wireHeader();
  const out = document.getElementById('amount');
  const words = document.getElementById('words');
  const show = (v) => { const n = Number(v || 0); out.textContent = money(n); words.textContent = n ? rupeesInWords(n) : ''; };
  const pad = mountKeypad(document.getElementById('keypad'), {
    tolerant: P().tremorSafe,
    onChange: show,
    onKey: (k) => { vibrate(BUZZ.tick); if (P().voice) speak(k === 'back' ? '⌫' : k === 'clear' ? '0' : k); },
  });
  if (preset) pad.set(String(Math.round(preset)));
  announce(tr('enter_amount'));
  on('#say', 'click', async () => {
    announce(tr('listening'));
    const n = spokenAmount(await listenOnce());
    if (n) { pad.set(String(Math.round(n))); announce(money(n)); }
  });
  on('#next', 'click', () => {
    flow.amount = Number(pad.value || 0);
    const saved = flow.check.shop;
    flow.amountCheck = checkAmount(flow.amount, {
      intendedAmount: flow.intendedAmount, usualAmount: saved?.usualAmount, largeLimit: store.get().largeLimit,
    });
    if (flow.amountCheck.findings.some((f) => f.code === 'amount_invalid')) {
      alertUser(BUZZ.caution);
      announce(tr('f_amount_invalid'), { force: true });
      return;
    }
    go('confirm');
  });
});

// ---------- 5. Confirm (pause on risk, hold-to-pay when shaky hands or simple mode) ----------
route('confirm', () => {
  const levels = [flow.check.level, flow.amountCheck.level];
  const level = levels.includes(LEVEL.DANGER) ? LEVEL.DANGER : levels.includes(LEVEL.CAUTION) ? LEVEL.CAUTION : LEVEL.OK;
  const wait = pauseSeconds(level === LEVEL.CAUTION && flow.check.status === STATUS.NEW && !flow.amountCheck.findings.length ? LEVEL.OK : level);
  const hold = P().tremorSafe;
  const name = flow.check.shopName || flow.qr.payeeVpa;
  const extra = flow.amountCheck.findings.map(findingText);
  const label = () => (hold ? tr('confirm_hold') : tr('confirm_tap'));

  render(`
    <section class="screen result ${level}">
      ${screenHeader('')}
      <p class="amount">${esc(money(flow.amount))}</p>
      <p class="words">${esc(rupeesInWords(flow.amount))}</p>
      <p class="to">→ ${esc(name)} <span class="vpa">(${esc(flow.qr.payeeVpa)})</span></p>
      <div class="readable">${extra.map((l) => `<p class="finding">${esc(l)}</p>`).join('')}<p class="listen">${esc(tr('listen_name'))}</p></div>
      <button class="btn big primary pay" id="pay" data-next ${wait ? 'disabled' : ''}>
        <span class="fill" aria-hidden="true"></span><span class="label">${esc(wait ? tr('paying_in', { s: wait }) : label())}</span>
      </button>
      <button class="btn" id="cancel">${esc(tr('cancel'))}</button>
    </section>`, { title: tr('confirm_tap') });
  wireHeader();
  alertUser(BUZZ_FOR[level]);
  announce([tr('amount_is', { amount: money(flow.amount), name }), ...extra].join(' '), { force: level === LEVEL.DANGER });

  const btn = document.getElementById('pay');
  const lab = btn.querySelector('.label');
  const fill = btn.querySelector('.fill');
  let remaining = wait;
  const timer = remaining ? setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) { clearInterval(timer); btn.disabled = false; lab.textContent = label(); }
    else lab.textContent = tr('paying_in', { s: remaining });
  }, 1000) : null;
  setCleanup(() => timer && clearInterval(timer));

  if (hold) {
    let t = null;
    const start = (e) => {
      if (btn.disabled) return;
      e.preventDefault();
      fill.style.transition = 'width 1.2s linear';
      fill.style.width = '100%';
      t = setTimeout(handOff, 1200);
    };
    const end = () => { clearTimeout(t); fill.style.transition = 'none'; fill.style.width = '0'; };
    btn.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, end));
    btn.addEventListener('click', (e) => { if (!e.pointerType && !btn.disabled) handOff(); }); // keyboard / screen reader
  } else {
    btn.addEventListener('click', handOff);
  }
  on('#cancel', 'click', () => { resetHistory(); go('home'); });
});

// ---------- 6. Hand-off to the user's UPI app, then offer to save the shop ----------
function handOff() {
  const { qr, amount, check } = flow;
  const link = buildUpiLink({ payeeVpa: qr.payeeVpa, payeeName: qr.payeeName, amount, note: qr.note });
  store.addHistory({ name: check.shopName || qr.payeeVpa, vpa: qr.payeeVpa, amount, status: check.status });
  const shopName = flow.intendedShop || qr.payeeName || '';
  const offerSave = check.status === STATUS.NEW && shopName && !findShop(store.get().savedShops, shopName);

  render(`
    <section class="screen">
      <h1>${esc(tr('open_upi'))}</h1>
      <p class="amount">${esc(money(amount))}</p>
      <p class="to">→ ${esc(check.shopName || qr.payeeVpa)}</p>
      <a class="btn big primary" href="${esc(link)}" id="open">${esc(tr('open_upi_btn'))}</a>
      <p class="hint">${esc(tr('upi_fallback'))}</p>
      ${offerSave ? `
        <div class="card" id="save-card">
          <p><strong>${esc(tr('save_shop_q', { shop: shopName }))}</strong></p>
          <p class="hint">${esc(tr('save_shop_note'))}</p>
          <div class="row">
            <button class="btn primary" id="save" data-next>${esc(tr('save'))}</button>
            <button class="btn" id="later">${esc(tr('not_now'))}</button>
          </div>
        </div>` : ''}
      <button class="btn" id="home">${esc(tr('home'))}</button>
    </section>`, { title: tr('open_upi_btn') });
  alertUser(BUZZ.ok);
  announce(`${tr('open_upi')} ${offerSave ? tr('save_shop_q', { shop: shopName }) : ''}`);

  on('#save', 'click', () => {
    store.saveShop({ name: shopName, vpa: qr.payeeVpa, usualAmount: amount });
    document.getElementById('save-card').innerHTML = `<p>${esc(tr('saved'))}</p>`;
    announce(tr('saved'));
  });
  on('#later', 'click', () => { document.getElementById('save-card').remove(); });
  on('#home', 'click', () => { resetHistory(); go('home'); });
  setTimeout(() => { window.location.href = link; }, 1200);
}
