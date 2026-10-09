// Payment flow: Scan → Check → Amount → Pay (opens the user's UPI app).
// Blind users: vibration guides the camera, everything is spoken (or read by TalkBack), and in
// hands-free mode the amount and the "yes" are given by voice, with no buttons to find.
// Family: over-limit or risky payments prompt a one-tap WhatsApp/SMS to the trusted person.

import * as store from './store.js';
import { parseUpiQr, buildUpiLink, appLink, PAY_APPS } from './upi.js';
import { checkPayment, checkAmount, pauseSeconds, LEVEL, STATUS } from './safety.js';
import { wordsToNumber } from './match.js';
import { rupeesInWords, formatRupees } from './amount.js';
import { overLimit, whatsappLink, smsLink } from './family.js';
import { yesNo } from './i18n.js';
import { speaks } from './profile.js';
import { mountKeypad } from './keypad.js';
import { startScanner } from './scanner.js';
import { listenOnce, canListen, BUZZ, vibrate, speak } from './speech.js';
import { DEMO_QRS } from './demo-codes.js';
import { icon } from './icons.js';
import { route, go, goHome, render, on, esc, tr, P, S, announce, alertUser, setCleanup, readScreen, currentName } from './ui.js';

const RESULT_ICON = { ok: 'check', caution: 'info', danger: 'stop' };
const BUZZ_FOR = { ok: BUZZ.ok, caution: BUZZ.caution, danger: BUZZ.danger };
const money = (n) => formatRupees(n);
const appName = () => (P().payApp === 'any' ? tr('any_app') : PAY_APPS[P().payApp].label);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Say something and wait until it has been said (own voice), or give TalkBack time to read it. */
async function sayAndWait(text) {
  if (speaks(P())) { await speak(text); return; }
  announce(text);
  await sleep(Math.min(9000, 900 + text.length * 55));
}

function parseAmount(heard) {
  const d = (heard || '').replace(/[,\s]/g, '').match(/\d+(\.\d{1,2})?/);
  return d ? Number(d[0]) : wordsToNumber(heard);
}

// ---------- Scanner (shared by paying and adding a shop) ----------
function scannerHtml() {
  return `
    <div class="viewfinder"><video id="video" aria-hidden="true"></video><div class="reticle" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>
    <div class="meter" role="meter" aria-label="QR" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="meter"></span></div>
    <p class="readable muted center">${esc(tr('point_camera'))}</p>
    <p id="cam-error" class="note warn-note" hidden>${icon('info')}<span>${esc(tr('camera_error'))}</span></p>
    <details class="dev" id="dev">
      <summary>${esc(tr('test_mode'))}</summary>
      <div class="stack tight">${DEMO_QRS.map((d, i) => `<button class="btn small wide left" data-demo="${i}">${esc(d.label)}</button>`).join('')}</div>
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
    guidance: P().voice || P().screenReader || P().contrast,
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

function notPayment(qr) {
  alertUser(BUZZ.danger);
  const msg = qr.reason === 'web_link' ? tr('web_link') : tr('not_upi');
  render(`
    <section class="screen">
      <div class="result-card danger" role="alert"><span class="result-icon">${icon('stop')}</span><div><p class="result-title readable">${esc(msg)}</p></div></div>
      <button class="btn big primary wide" id="again" data-next>${icon('scan')}<span>${esc(tr('scan_again'))}</span></button>
    </section>`, { title: tr('step_check'), step: 2 });
  announce(msg, { force: true });
  on('#again', 'click', () => go('scan'));
}

route('scan', () => {
  render(`<section class="screen">${scannerHtml()}</section>`, { title: tr('tile_pay'), step: 1 });
  announce(tr('point_camera'));
  wireScanner((text) => {
    const qr = parseUpiQr(text);
    if (!qr.ok) return notPayment(qr);
    go('result', qr);
  });
});

// ---------- Check + Amount on one screen ----------
route('result', (qr) => {
  const s = S();
  const person = s.trusted[0] || null;
  const check = checkPayment(qr, { savedShops: s.savedShops });
  const usual = check.shop?.usualAmount || null;
  let head;
  if (check.status === STATUS.SAME) head = { title: tr('r_same', { shop: check.shopName }), sub: tr('r_same_sub') };
  else if (check.status === STATUS.DIFFERENT) head = { title: tr('r_swapped', { shop: check.shopName }), sub: tr('r_swapped_sub', { shop: check.shopName }) };
  else head = { title: tr('r_new'), sub: qr.payeeName ? tr('r_new_sub_name', { name: qr.payeeName }) : tr('r_new_sub_noname') };
  const extra = check.findings.filter((f) => ['receive_money_trick', 'not_a_payment_qr'].includes(f.code)).map((f) => tr(`f_${f.code}`));
  const danger = check.level === LEVEL.DANGER;
  const swapMsg = check.status === STATUS.DIFFERENT && person
    ? tr('family_msg_swap', { user: s.user.name, shop: check.shopName, vpa: qr.payeeVpa }) : null;

  render(`
    <section class="screen">
      <div class="result-card ${check.level}" ${danger ? 'role="alert"' : ''}>
        <span class="result-icon">${icon(RESULT_ICON[check.level])}</span>
        <div class="readable">
          <p class="result-title">${esc(head.title)}</p>
          <p class="result-sub">${esc(head.sub)}</p>
          ${extra.map((x) => `<p class="result-extra">${esc(x)}</p>`).join('')}
        </div>
      </div>
      <div class="payee-row"><span class="badge tone-${check.status === STATUS.SAME ? 'teal' : 'slate'}">${icon('store')}</span>
        <div class="grow"><p class="h-meta">${esc(qr.payeeVpa)}</p>${usual ? `<p class="h-meta">${esc(tr('usual', { amount: money(usual) }))}</p>` : ''}</div>
        <button class="icon-btn" id="read" aria-label="${esc(tr('read_this'))}">${icon('speaker')}</button>
      </div>
      ${danger ? `
        <div class="stack tight" id="danger-actions">
          <button class="btn big primary wide" id="again" data-next>${icon('scan')}<span>${esc(tr('scan_again'))}</span></button>
          ${swapMsg ? `<a class="btn wide whatsapp" href="${esc(whatsappLink(person.phone, swapMsg))}" target="_blank" rel="noopener">${icon('whatsapp')}<span>${esc(tr('alert_family_swap', { name: person.name }))}</span></a>` : ''}
          <button class="btn ghost wide" id="anyway">${esc(tr('continue_anyway'))}</button>
        </div>` : ''}
      <div id="pay-area" ${danger ? 'hidden' : ''}>
        <div class="amount-box">
          <span class="label">${esc(tr('amount_q'))}</span>
          <output id="amount" class="amount" aria-live="polite">₹0</output>
          <p id="words" class="words"></p>
          <div id="amount-warn" class="amount-warn" role="status"></div>
        </div>
        <div id="family-box" class="family-box" hidden></div>
        <div id="keypad"></div>
        ${canListen ? `<button class="btn wide" id="say">${icon('mic')}<span>${esc(tr('say_amount'))}</span></button>` : ''}
        <button class="btn big primary wide pay" id="pay" data-next><span class="fill" aria-hidden="true"></span><span class="label-text"></span></button>
        <p class="hint center">${esc(tr('listen_name'))}</p>
      </div>
    </section>`, { title: tr('step_check'), step: danger ? 2 : 3 });

  alertUser(BUZZ_FOR[check.level]);
  const spoken = [head.title, head.sub, ...extra];
  if (!danger) spoken.push(usual ? tr('usual', { amount: money(usual) }) : '', tr('amount_q'));
  const intro = announce(spoken.filter(Boolean).join('. '), { force: danger });

  on('#again', 'click', () => go('scan'));
  on('#read', 'click', readScreen);
  on('#anyway', 'click', () => {
    document.getElementById('danger-actions').hidden = true;
    document.getElementById('pay-area').hidden = false;
    lockFor(pauseSeconds(LEVEL.DANGER));
  });

  // ----- amount, limits, pay button -----
  const out = document.getElementById('amount');
  const words = document.getElementById('words');
  const warn = document.getElementById('amount-warn');
  const familyBox = document.getElementById('family-box');
  const btn = document.getElementById('pay');
  const label = btn.querySelector('.label-text');
  const fill = btn.querySelector('.fill');
  const hold = P().tremorSafe;
  let amount = 0;
  let amountLevel = LEVEL.OK;
  let lockedUntil = 0;
  let timer = null;
  let limit = null;
  let asked = false;

  const payLabel = () => (hold ? tr('hold_to_pay') : tr('tap_to_pay'));
  const needsOk = () => Boolean(limit && person && !asked);
  const refreshButton = () => {
    const left = Math.ceil((lockedUntil - Date.now()) / 1000);
    btn.disabled = left > 0 || !amount || needsOk();
    label.textContent = left > 0 ? tr('wait_s', { s: left }) : `${payLabel()}${amount ? `  ${money(amount)}` : ''}`;
  };
  function lockFor(sec) {
    if (!sec) return;
    lockedUntil = Date.now() + sec * 1000;
    clearInterval(timer);
    timer = setInterval(() => { refreshButton(); if (Date.now() >= lockedUntil) clearInterval(timer); }, 250);
    refreshButton();
  }
  setCleanup(() => clearInterval(timer));

  const showFamily = () => {
    limit = overLimit(amount, s.limits, s.history);
    if (!limit) { familyBox.hidden = true; return; }
    const text = tr(limit.reason === 'payment' ? 'over_payment' : 'over_daily', { limit: money(limit.limit), name: person?.name || '' });
    if (!person) { familyBox.hidden = true; return; }
    const msg = tr('family_msg_risky', { user: s.user.name, amount: money(amount), shop: check.shopName, vpa: qr.payeeVpa });
    familyBox.hidden = false;
    familyBox.innerHTML = `
      <p class="family-text">${icon('family')}<span>${esc(asked ? tr('asked', { name: person.name }) : text)}</span></p>
      <a class="btn wide whatsapp" id="wa" href="${esc(whatsappLink(person.phone, msg))}" target="_blank" rel="noopener">${icon('whatsapp')}<span>${esc(tr('ask_family', { name: person.name }))}</span></a>
      <a class="btn small wide" id="sms" href="${esc(smsLink(person.phone, msg))}">${esc(tr('ask_family_sms'))}</a>`;
    const mark = () => { asked = true; setTimeout(() => { showFamily(); refreshButton(); }, 300); };
    familyBox.querySelector('#wa').addEventListener('click', mark);
    familyBox.querySelector('#sms').addEventListener('click', mark);
  };

  const onAmount = (v) => {
    amount = Number(v || 0);
    out.textContent = money(amount);
    words.textContent = amount ? rupeesInWords(amount) : '';
    const a = amount ? checkAmount(amount, { usualAmount: usual, qrAmount: qr.amount, largeLimit: s.largeLimit }) : { level: LEVEL.OK, findings: [] };
    const text = a.findings.map((f) => tr(`f_${f.code}`, { usual: f.vars?.usual ? money(f.vars.usual) : '', qr: f.vars?.qr ? money(f.vars.qr) : '' }));
    warn.innerHTML = text.length ? `${icon(a.level === LEVEL.DANGER ? 'alert' : 'info')}<span>${esc(text.join(' '))}</span>` : '';
    warn.className = `amount-warn ${a.level}`;
    if (a.level === LEVEL.DANGER && amountLevel !== LEVEL.DANGER) {
      alertUser(BUZZ.danger);
      announce(text.join(' '), { force: true });
      lockFor(pauseSeconds(LEVEL.DANGER));
    }
    amountLevel = a.level;
    asked = false;
    showFamily();
    refreshButton();
  };

  const pad = mountKeypad(document.getElementById('keypad'), {
    tolerant: P().tremorSafe,
    onChange: onAmount,
    onKey: (k) => { vibrate(BUZZ.tick); if (speaks(P()) && /^\d$/.test(k)) speak(k); },
  });
  if (qr.amount) pad.set(String(Math.round(qr.amount))); else onAmount(0);

  on('#say', 'click', async () => {
    announce(tr('listening'));
    const n = parseAmount(await listenOnce());
    if (n) { pad.set(String(Math.round(n))); announce(tr('amount_spoken', { amount: money(n), name: check.shopName })); }
  });

  const pay = () => { if (!btn.disabled) handOff(qr, check, amount); };
  if (hold) {
    let t = null;
    btn.addEventListener('pointerdown', (e) => {
      if (btn.disabled) return;
      e.preventDefault();
      fill.style.transition = 'width 1.2s linear';
      fill.style.width = '100%';
      t = setTimeout(pay, 1200);
    });
    const end = () => { clearTimeout(t); fill.style.transition = 'none'; fill.style.width = '0'; };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, end));
    btn.addEventListener('click', (e) => { if (!e.pointerType) pay(); }); // keyboard, switch access, TalkBack double-tap
  } else {
    btn.addEventListener('click', pay);
  }

  // ----- Hands-free: amount and "yes" by voice -----
  if (P().handsFree && canListen && !danger) {
    (async () => {
      await intro;
      if (currentName() !== 'result') return;
      if (!amount) {
        await sayAndWait(tr('hf_amount'));
        const n = parseAmount(await listenOnce());
        if (currentName() !== 'result') return;
        if (!n) { announce(tr('hf_not_heard'), { force: true }); return; }
        pad.set(String(Math.round(n)));
      }
      if (btn.disabled) return; // a warning, a pause or a family check is pending: hand back to buttons
      await sayAndWait(tr('hf_confirm', { amount: money(amount), name: check.shopName }));
      const answer = yesNo(await listenOnce());
      if (currentName() !== 'result') return;
      if (answer === 'yes' && !btn.disabled) handOff(qr, check, amount);
      else if (answer === 'no') announce(tr('hf_cancelled'), { force: true });
      else announce(tr('hf_not_heard'), { force: true });
    })();
  }
});

// ---------- Hand-off to the user's UPI app ----------
function handOff(qr, check, amount) {
  const link = appLink(buildUpiLink({ payeeVpa: qr.payeeVpa, payeeName: qr.payeeName, amount, note: qr.note }), P().payApp);
  store.addHistory({ name: check.shopName, vpa: qr.payeeVpa, amount, status: check.status });
  const app = appName();
  const offerSave = check.status === STATUS.NEW && qr.payeeName;
  render(`
    <section class="screen">
      <div class="result-card info"><span class="result-icon">${icon('rupee')}</span>
        <div class="readable"><p class="result-title">${esc(tr('opening', { app }))}</p><p class="result-sub">${esc(tr('opening_sub', { app }))}</p></div>
      </div>
      <div class="summary">
        <p class="amount center">${esc(money(amount))}</p>
        <p class="center muted">${esc(check.shopName)}</p>
      </div>
      <a class="btn big primary wide" href="${esc(link)}" id="open" data-next>${esc(tr('open_again', { app }))}</a>
      <p class="hint">${esc(tr('fallback', { app }))}</p>
      <p class="note info-note">${icon('finger')}<span>${esc(tr('bio_upi_tip', { app }))}</span></p>
      ${offerSave ? `<button class="btn wide" id="save">${icon('store')}<span>${esc(tr('save_this_shop', { name: qr.payeeName }))}</span></button><p class="hint">${esc(tr('save_note'))}</p>` : ''}
      <button class="btn ghost wide" id="done">${esc(tr('done'))}</button>
    </section>`, { title: tr('step_pay'), step: 4 });
  alertUser(BUZZ.ok);
  announce(`${tr('opening', { app })}. ${tr('opening_sub', { app })}`);
  on('#save', 'click', () => go('name-shop', qr, 'home'));
  on('#done', 'click', goHome);
  setTimeout(() => { if (currentName() !== 'name-shop') window.location.href = link; }, 900);
}

// ---------- Add a regular shop ----------
route('add-shop', (returnTo = 'shops') => {
  render(`<section class="screen"><h1>${esc(tr('scan_shop'))}</h1>${scannerHtml()}</section>`, { title: tr('scan_shop') });
  announce(tr('point_camera'));
  wireScanner((text) => {
    const qr = parseUpiQr(text);
    if (!qr.ok) { notPayment(qr); return; }
    go('name-shop', qr, returnTo);
  });
});

route('name-shop', (qr, returnTo = 'shops') => {
  render(`
    <section class="screen">
      <div class="hero-icon tone-teal">${icon('store')}</div>
      <h1>${esc(tr('name_shop_q'))}</h1>
      <p class="muted">${esc(tr('name_shop_hint', { vpa: qr.payeeVpa }))}${qr.payeeName ? ` ${esc(tr('name_shop_from_qr', { name: qr.payeeName }))}` : ''}</p>
      <label class="sr-only" for="name">${esc(tr('name_shop_q'))}</label>
      <input id="name" class="field big-field" autocomplete="off" value="${esc(qr.payeeName || '')}">
      ${canListen ? `<button class="btn wide" id="say">${icon('mic')}<span>${esc(tr('speak'))}</span></button>` : ''}
      <button class="btn big primary wide" id="save" data-next>${esc(tr('save'))}</button>
    </section>`, { title: tr('name_shop_q') });
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
    if (returnTo === 'home') goHome(); else { go(returnTo); }
  });
});
