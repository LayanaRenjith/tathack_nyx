// Payment flow: Scan → Check → Amount → Pay (opens the user's UPI app).
// Blind users: vibration guides the camera, everything is spoken (or read by TalkBack), and in
// hands-free mode the amount and the "yes" are given by voice, with no buttons to find.
// Family: over-limit or risky payments prompt a one-tap WhatsApp/SMS to the trusted person.

import * as store from './store.js';
import { parseUpiQr, buildUpiLink, appLink, PAY_APPS } from './upi.js';
import { checkPayment, checkAmount, pauseSeconds, LEVEL, STATUS } from './safety.js';
import { rupeesInWords, formatRupees } from './amount.js';
import { overLimit, whatsappLink, smsLink } from './family.js';
import { yesNo, amountFrom, spokenDigits } from './spoken.js';
import { speaks, voiceDriven, listenLangFor } from './profile.js';
import { mountKeypad } from './keypad.js';
import { startScanner } from './scanner.js';
import { listenOnce, listenAll, canListen, BUZZ, vibrate, speak } from './speech.js';
import { newRequestId, checkApproval, checkGuardianPin, requestLink } from './guardian.js';
import { newChannel, listenForAnswer } from './relay.js';
import { normalisePhone } from './family.js';
import { parseCommand } from './commands.js';
import { DEMO_QRS } from './demo-codes.js';
import { icon } from './icons.js';
import { route, go, goHome, render, on, esc, tr, P, S, announce, alertUser, setCleanup, readScreen, setVoice, screenId, voiceTurn, explainMicProblem } from './ui.js';

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

/** Ask a question and listen, up to 3 tries. Returns the recogniser's guesses, or [] (or null if the screen changed). */
async function ask(question, accept, gen = screenId(), { askedAlready = false } = {}) {
  for (let i = 0; i < 3; i += 1) {
    if (i > 0 || !askedAlready) await sayAndWait(i === 0 ? question : `${tr('vm_try_again')} ${question}`);
    if (gen !== screenId()) return null;
    const heard = await listenAll({ lang: listenLangFor(P(), i) });
    if (gen !== screenId()) return null;
    if (!heard.length && (await explainMicProblem())) return [];
    if (heard.length && accept(heard)) return heard;
  }
  return [];
}
const amountWords = (n) => (P().lang === 'en' ? rupeesInWords(n) : money(n));

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
    guidance: P().voice || P().voiceOnly || P().screenReader || P().contrast,
    sound: voiceDriven(P()) || P().screenReader,
    onGuidance: (s) => { meter.style.width = `${Math.round(s * 100)}%`; meter.parentElement.setAttribute('aria-valuenow', String(Math.round(s * 100))); },
    onResult: once,
  }).then((s) => { stop = s; if (done) s(); }).catch(() => {
    document.getElementById('cam-error').hidden = false;
    document.getElementById('dev').open = true;
    document.getElementById('dev').classList.add('needed');
  });
  // Blind users: a spoken tip every 12 seconds until the QR is found.
  const tips = (voiceDriven(P()) || P().screenReader) ? setInterval(() => { if (!done) announce(tr('scan_tip'), { force: true }); }, 12000) : null;
  setCleanup(() => { stop?.(); clearInterval(tips); });
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
  setVoice({ own: true });
  announce(voiceDriven(P()) ? `${tr('point_camera')} ${tr('scan_tip')}` : tr('point_camera'));
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
  // No helper to ask: a short safety check stands in for them on a new shop.
  const solo = check.status === STATUS.NEW && !person && !danger;
  const soloQs = [
    { key: 'solo_q_here', want: 'yes' },
    { key: 'solo_q_call', want: 'no' },
    ...(qr.payeeName ? [{ key: 'solo_q_name', want: 'yes', vars: { name: qr.payeeName } }] : []),
  ];
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
      ${danger ? `<a class="btn wide report-fraud" href="tel:1930">${icon('call')}<span>${esc(tr('call_1930'))}</span></a>` : ''}
      ${solo ? `
        <div class="solo-card" id="solo">
          <p class="solo-title">${icon('shield')}<span>${esc(tr('solo_title'))}</span></p>
          <p class="solo-q readable" id="solo-q"></p>
          <div class="row"><button class="btn big wide" data-solo="no">${icon('close')}<span>${esc(tr('no'))}</span></button><button class="btn big wide primary" data-solo="yes" data-next>${icon('check')}<span>${esc(tr('yes'))}</span></button></div>
          <p class="solo-step" id="solo-step"></p>
        </div>
        <div class="solo-stop" id="solo-stop" role="alert" hidden>
          <p class="result-title">${esc(tr('solo_stop'))}</p>
          <p>${esc(tr('solo_stop_sub'))}</p>
          <a class="btn big wide primary" href="tel:1930">${icon('call')}<span>${esc(tr('call_1930'))}</span></a>
          <button class="btn wide" id="solo-again">${icon('scan')}<span>${esc(tr('scan_again'))}</span></button>
        </div>` : ''}
      <div id="pay-area" ${danger || solo ? 'hidden' : ''}>
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
  const voiceFlow = (P().handsFree || voiceDriven(P())) && canListen;
  if (solo && !voiceFlow) spoken.push(tr('solo_title'), tr(soloQs[0].key, soloQs[0].vars));
  else if (!danger) spoken.push(usual ? tr('usual', { amount: money(usual) }) : '', voiceFlow ? '' : tr('amount_q'));
  const intro = announce(spoken.filter(Boolean).join('. '), { force: danger });

  on('#again', 'click', () => go('scan'));
  on('#read', 'click', readScreen);
  on('#anyway', 'click', () => {
    document.getElementById('danger-actions').hidden = true;
    document.getElementById('pay-area').hidden = false;
    lockFor(pauseSeconds(LEVEL.DANGER));
  });

  // ----- Safety check for people with no helper -----
  let soloStep = 0;
  const soloAsk = () => {
    const q = soloQs[soloStep];
    document.getElementById('solo-q').textContent = tr(q.key, q.vars);
    document.getElementById('solo-step').textContent = `${soloStep + 1} / ${soloQs.length}`;
    return tr(q.key, q.vars);
  };
  const soloAnswer = (ans, { quiet = false } = {}) => {
    if (!solo || soloStep >= soloQs.length) return 'done';
    if (ans !== soloQs[soloStep].want) {
      document.getElementById('solo').hidden = true;
      document.getElementById('solo-stop').hidden = false;
      alertUser(BUZZ.danger);
      announce(`${tr('solo_stop')} ${tr('solo_stop_sub')}`, { force: true });
      return 'stop';
    }
    soloStep += 1;
    vibrate(BUZZ.tick);
    if (soloStep >= soloQs.length) {
      document.getElementById('solo').hidden = true;
      document.getElementById('pay-area').hidden = false;
      if (!quiet) announce(tr('solo_ok'));
      return 'done';
    }
    const next = soloAsk();
    if (!quiet) announce(next);
    return 'next';
  };
  if (solo) {
    soloAsk();
    on('[data-solo]', 'click', (e) => soloAnswer(e.currentTarget.dataset.solo));
    on('#solo-again', 'click', () => go('scan'));
  }

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
  let soloPaused = false;
  let lockedUntil = 0;
  let timer = null;
  let limit = null;
  let asked = false;

  // ----- Guardian approval: new shops (and payments over the limit) need the trusted person's code -----
  const guardian = s.guardian?.key ? s.guardian : null;
  const needNew = Boolean(check.status === STATUS.NEW && person && guardian && s.limits.newShops !== false);
  const reqId = newRequestId();
  const channel = newChannel();
  const askedAt = Date.now();
  let approved = false;
  let declined = false;
  let stopListening = () => {};
  const reason = () => (needNew ? 'new' : limit ? 'limit' : null);
  const request = () => ({ id: reqId, vpa: qr.payeeVpa, amount });

  const payLabel = () => (hold ? tr('hold_to_pay') : tr('tap_to_pay'));
  const needsOk = () => Boolean(person && reason() && (!approved || declined) && (guardian ? true : !asked));
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
  setCleanup(() => { clearInterval(timer); stopListening(); });

  const approveNow = async (how) => {
    approved = true;
    alertUser(BUZZ.ok);
    const card = document.querySelector('.result-card');
    if (card && needNew) {
      card.className = 'result-card ok';
      card.querySelector('.result-icon').innerHTML = icon('check');
      card.querySelector('.result-title').textContent = check.shopName;
      card.querySelector('.result-sub').textContent = tr('g_ok', { name: person.name });
    }
    if (needNew) store.saveShop({ name: qr.payeeName || qr.payeeVpa, vpa: qr.payeeVpa, usualAmount: null });
    showFamily();
    refreshButton();
    await sayAndWait(`${tr('g_ok', { name: person.name })}${needNew ? `. ${tr('g_saved_shop', { shop: check.shopName })}` : ''}`);
    return how;
  };
  const tryCode = async (code) => {
    if (await checkApproval(code, guardian, request())) { await approveNow('code'); return true; }
    const err = familyBox.querySelector('#g-err');
    if (err) { err.hidden = false; err.textContent = tr('g_bad', { name: person.name }); }
    alertUser(BUZZ.caution);
    announce(tr('g_bad', { name: person.name }), { force: true });
    return false;
  };
  const askMessage = () => {
    const base = `${location.origin}${location.pathname}`;
    const link = requestLink(base, { ...request(), name: check.shopName, user: s.user.name, phone: s.user.phone, lang: P().lang, reason: reason(), channel }, guardian);
    return tr('g_msg', { user: s.user.name, amount: money(amount), shop: check.shopName, vpa: qr.payeeVpa, reason: tr(needNew ? 'g_reason_new' : 'g_reason_limit'), link });
  };

  const showFamily = () => {
    limit = overLimit(amount, s.limits, s.history);
    if (!reason() || !person) { familyBox.hidden = true; return; }
    familyBox.hidden = false;
    if (approved) {
      familyBox.className = 'family-box approved';
      familyBox.innerHTML = `<p class="family-text">${icon('check')}<span>${esc(tr('g_ok', { name: person.name }))}</span></p>`;
      return;
    }
    familyBox.className = 'family-box';
    const text = needNew ? tr('g_new_shop', { name: person.name })
      : tr(limit.reason === 'payment' ? 'over_payment' : 'over_daily', { limit: money(limit.limit), name: person.name });
    if (!guardian) { // no Guardian PIN set: the older "ask first" nudge
      const msg = tr('family_msg_risky', { user: s.user.name, amount: money(amount), shop: check.shopName, vpa: qr.payeeVpa });
      familyBox.innerHTML = `
        <p class="family-text">${icon('family')}<span>${esc(asked ? tr('asked', { name: person.name }) : text)}</span></p>
        <a class="btn wide whatsapp" id="wa" href="${esc(whatsappLink(person.phone, msg))}" target="_blank" rel="noopener">${icon('whatsapp')}<span>${esc(tr('ask_family', { name: person.name }))}</span></a>
        <a class="btn small wide" id="sms" href="${esc(smsLink(person.phone, msg))}">${esc(tr('ask_family_sms'))}</a>`;
      const mark = () => { asked = true; setTimeout(() => { showFamily(); refreshButton(); }, 300); };
      familyBox.querySelector('#wa').addEventListener('click', mark);
      familyBox.querySelector('#sms').addEventListener('click', mark);
      return;
    }
    familyBox.innerHTML = `
      <p class="family-text">${icon('shield')}<span>${esc(text)}</span></p>
      ${amount ? `
        <a class="btn big wide whatsapp" id="wa" href="${esc(whatsappLink(person.phone, askMessage()))}" target="_blank" rel="noopener">${icon('whatsapp')}<span>${esc(tr('g_ask', { name: person.name }))}</span></a>
        <p class="waiting" aria-live="polite"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>${esc(tr('g_waiting', { name: person.name }))}</p>
        <details class="here"><summary>${icon('info')} ${esc(tr('g_have_code', { name: person.name }))}</summary>
        <label for="g-code">${esc(tr('g_enter_code', { name: person.name }))}</label>
        <div class="code-row">
          <input id="g-code" class="field code-field" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${esc(tr('g_code_ph'))}">
          <button class="btn primary" id="g-check">${esc(tr('g_check'))}</button>
        </div>
        ${canListen ? `<button class="btn small wide" id="g-say">${icon('mic')}<span>${esc(tr('g_say_code'))}</span></button>` : ''}
        </details>
        <p class="note warn-note" id="g-err" role="alert" hidden></p>
        <details class="here">
          <summary>${icon('family')} ${esc(tr('g_here', { name: person.name }))}</summary>
          <label for="g-pin">${esc(tr('ap_pin'))}</label>
          <div class="code-row">
            <input id="g-pin" class="field code-field" type="password" inputmode="numeric" maxlength="4" autocomplete="off">
            <button class="btn" id="g-pin-ok">${esc(tr('g_check'))}</button>
          </div>
        </details>` : `<p class="hint">${esc(tr('g_amount_first'))}</p>`}`;
    if (declined) {
      familyBox.className = 'family-box declined';
      familyBox.innerHTML = `<p class="family-text">${icon('stop')}<span>${esc(tr('g_declined', { name: person.name }))}</span></p>
        <a class="btn wide" href="tel:+${esc(normalisePhone(person.phone))}">${icon('call')}<span>${esc(tr('tile_call', { name: person.name }))}</span></a>`;
      return;
    }
    // Instant answer: the helper's Accept unlocks this screen by itself (the WhatsApp code is the backup).
    if (amount) {
      stopListening();
      stopListening = listenForAnswer(channel, askedAt, async (msg) => {
        if (msg.a === 'no') { declined = true; alertUser(BUZZ.danger); showFamily(); refreshButton(); announce(tr('g_declined', { name: person.name }), { force: true }); return; }
        if (msg.code && !approved) { const box = familyBox.querySelector('#g-code'); if (box) box.value = msg.code; await tryCode(msg.code); if (approved && voiceFlow && gen === screenId()) voiceAmount(); }
      });
    }
    const codeEl = familyBox.querySelector('#g-code');
    familyBox.querySelector('#g-check')?.addEventListener('click', () => tryCode(codeEl.value));
    codeEl?.addEventListener('input', () => { if (codeEl.value.replace(/\D/g, '').length === 6) tryCode(codeEl.value); });
    familyBox.querySelector('#g-say')?.addEventListener('click', async () => {
      announce(tr('listening'));
      const d = spokenDigits(await listenAll({ lang: listenLangFor(P(), 0) })) || spokenDigits(await listenAll({ lang: 'en' }));
      if (d) { codeEl.value = d.slice(0, 6); tryCode(codeEl.value); } else announce(tr('hf_not_heard'), { force: true });
    });
    familyBox.querySelector('#g-pin-ok')?.addEventListener('click', async () => {
      if (await checkGuardianPin(familyBox.querySelector('#g-pin').value, guardian)) approveNow('pin');
      else { const err = familyBox.querySelector('#g-err'); err.hidden = false; err.textContent = tr('ap_wrong_pin'); alertUser(BUZZ.caution); }
    });
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
    // No helper: a big or over-limit payment gets a 30-second pause to think, with a spoken reminder.
    if (!person && amount && !soloPaused && (overLimit(amount, s.limits, s.history) || (check.status === STATUS.NEW && amount > (s.limits.soloNew || 1000)))) {
      soloPaused = true;
      warn.innerHTML = `${icon('info')}<span>${esc(tr('solo_wait'))}</span>`;
      warn.className = 'amount-warn caution';
      announce(tr('solo_wait'), { force: true });
      lockFor(30);
    }
    asked = false;
    approved = false; // an approval is for one amount only
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
    let n = amountFrom(await listenAll({ lang: listenLangFor(P(), 0) }));
    if (!n && !(await explainMicProblem()) && listenLangFor(P(), 1) !== listenLangFor(P(), 0)) { announce(tr('vm_try_again')); n = amountFrom(await listenAll({ lang: 'en' })); }
    if (n) { pad.set(String(Math.round(n))); announce(tr('amount_spoken', { amount: money(n), name: check.shopName })); }
    else announce(tr('hf_not_heard'), { force: true });
  });

  const finalCheck = () => (approved && needNew ? { ...check, status: 'approved' } : check);
  const pay = () => { if (!btn.disabled) go('confirm', qr, finalCheck(), amount); };
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

  on('#anyway', 'click', () => { if (voiceDriven(P()) || P().handsFree) setTimeout(voiceAmount, pauseSeconds(LEVEL.DANGER) * 1000 + 300); });

  // ----- Voice: amount, then "right?", then the final check screen -----
  const gen = screenId();
  async function voiceAmount() {
    if (!canListen || gen !== screenId()) return;
    while (solo && soloStep < soloQs.length) {
      const heard = await ask(soloAsk(), (h) => Boolean(yesNo(h)), gen);
      if (!heard || !heard.length) return;
      if (soloAnswer(yesNo(heard), { quiet: true }) === 'stop') return;
    }
    if (!amount) {
      const heard = await ask(tr('hf_amount'), (h) => Boolean(amountFrom(h)), gen);
      if (heard === null) return;
      const n = amountFrom(heard);
      if (!n) { announce(tr('hf_not_heard'), { force: true }); return; }
      pad.set(String(Math.round(n)));
    }
    if (gen !== screenId()) return;
    if (btn.disabled && needsOk() && guardian) { if (!(await voiceApproval())) return; }
    if (gen !== screenId()) return;
    if (btn.disabled) { // a warning, a pause or a family check is pending
      if (needsOk()) {
        await sayAndWait(familyBox.querySelector('.family-text')?.textContent || '');
        setVoice({ actions: { tell: () => familyBox.querySelector('#wa')?.click(), send: () => familyBox.querySelector('#wa')?.click() }, help: tr('ask_family', { name: person.name }) });
        voiceTurn();
      }
      return;
    }
    const heard = await ask(tr('hf_amount_ok', { amount: amountWords(amount), name: check.shopName }), (h) => Boolean(yesNo(h) || amountFrom(h)), gen);
    if (heard === null) return;
    const n = amountFrom(heard);
    if (yesNo(heard) === 'no' || (n && n !== amount)) {
      if (n && n !== amount) { pad.set(String(Math.round(n))); return voiceAmount(); }
      pad.set('');
      return voiceAmount();
    }
    if (yesNo(heard) === 'yes' && !btn.disabled) go('confirm', qr, finalCheck(), amount);
    else announce(tr('hf_not_heard'), { force: true });
  }

  // Voice: ask the guardian on WhatsApp, then say the code they send back.
  let waitingForCode = false;
  async function voiceApproval() {
    const q = `${familyBox.querySelector('.family-text')?.textContent || ''} ${tr('vm_guard_help', { name: person.name })}`;
    for (let round = 0; round < 3 && gen === screenId() && !approved; round += 1) {
      const heard = await ask(q, (h) => Boolean(spokenDigits(h).length >= 6 || parseCommand(h, ['tell', 'send', 'call'])), gen);
      if (!heard || !heard.length) return false;
      const digits = spokenDigits(heard);
      if (digits.length >= 6) { const code = digits.slice(0, 6); const box = familyBox.querySelector('#g-code'); if (box) box.value = code; if (await tryCode(code)) return true; continue; }
      waitingForCode = true;
      await sayAndWait(tr('g_wait_code', { name: person.name }));
      familyBox.querySelector('#wa')?.click();
      return false; // continues when the user comes back to Sahaaya
    }
    return approved;
  }
  const onBack = () => {
    if (document.visibilityState !== 'visible' || !waitingForCode || gen !== screenId()) return;
    waitingForCode = false;
    setTimeout(() => voiceAmount(), 600);
  };
  if (voiceFlow) { document.addEventListener('visibilitychange', onBack); setCleanup(() => { clearInterval(timer); stopListening(); document.removeEventListener('visibilitychange', onBack); }); }

  if (danger && voiceDriven(P())) {
    setVoice({
      help: tr('vm_danger_help', { name: person?.name || '' }),
      actions: {
        again: () => go('scan'),
        tell: () => { if (swapMsg) window.open(whatsappLink(person.phone, swapMsg), '_blank'); },
        send: () => { if (swapMsg) window.open(whatsappLink(person.phone, swapMsg), '_blank'); },
        continue: () => { document.getElementById('anyway').click(); return sayAndWait(tr('wait_s', { s: pauseSeconds(LEVEL.DANGER) })); },
      },
    });
    intro.then(() => { if (gen === screenId()) sayAndWait(tr('vm_danger_help', { name: person?.name || '' })); });
  } else if ((P().handsFree || voiceDriven(P())) && canListen && !danger) {
    setVoice({ own: true });
    intro.then(voiceAmount);
  }
});

// ---------- Final check: one more "yes" (or say the amount) before the UPI app opens ----------
route('confirm', (qr, check, amount) => {
  const app = appName();
  const level = check.level === LEVEL.OK ? 'ok' : check.level === LEVEL.DANGER ? 'danger' : 'caution';
  render(`
    <section class="screen confirm">
      <div class="confirm-card tone-${level === 'ok' ? 'green' : level === 'danger' ? 'danger' : 'amber'}">
        <span class="confirm-badge">${icon('shield')}</span>
        <p class="eyebrow">${esc(tr('confirm_title'))}</p>
        <p class="amount center">${esc(money(amount))}</p>
        <p class="words center">${esc(rupeesInWords(amount))}</p>
        <div class="readable center">
          <p class="confirm-q">${esc(tr('confirm_q', { amount: money(amount), name: check.shopName }))}</p>
        </div>
        <dl class="confirm-rows">
          <div><dt>${esc(tr('confirm_to'))}</dt><dd>${esc(check.shopName)}</dd></div>
          <div><dt>${esc(tr('confirm_account'))}</dt><dd class="vpa">${esc(qr.payeeVpa)}</dd></div>
          <div><dt>${esc(tr('confirm_app'))}</dt><dd>${esc(app)}</dd></div>
        </dl>
      </div>
      <p id="said" class="note warn-note" role="alert" hidden></p>
      ${canListen ? `<p class="hint center">${icon('mic')} ${esc(tr('confirm_say'))}</p>` : ''}
      <div class="row confirm-actions">
        <button class="btn big wide ghost-danger" id="no">${icon('close')}<span>${esc(tr('confirm_no'))}</span></button>
        <button class="btn big primary wide pay" id="yes" data-next>${icon('check')}<span>${esc(tr('confirm_yes'))}</span></button>
      </div>
    </section>`, { title: tr('confirm_title'), step: 4 });
  alertUser(BUZZ.found);
  const question = `${tr('confirm_title')}. ${tr('confirm_q', { amount: amountWords(amount), name: check.shopName })} ${tr('confirm_sub', { app })}`;
  const gen = screenId();
  const cancel = () => { announce(tr('hf_cancelled'), { force: true }); goHome(); };
  on('#yes', 'click', () => handOff(qr, check, amount));
  on('#no', 'click', cancel);
  setVoice({ own: true });

  const voice = canListen && (speaks(P()) || P().handsFree || voiceDriven(P()));
  const intro = announce(voice ? `${question} ${tr('confirm_say')}` : question, { force: true });
  if (!voice) return;
  (async () => {
    await intro;
    if (gen !== screenId()) return;
    const heard = await ask(tr('confirm_say'), (h) => Boolean(yesNo(h) || amountFrom(h)), gen, { askedAlready: true });
    if (heard === null || gen !== screenId()) return;
    const said = amountFrom(heard);
    if (said && said !== amount) {
      const box = document.getElementById('said');
      box.hidden = false;
      box.textContent = tr('confirm_mismatch', { said: money(said), amount: money(amount) });
      alertUser(BUZZ.danger);
      await sayAndWait(box.textContent);
      if (gen === screenId()) goHome();
      return;
    }
    const answer = yesNo(heard);
    if (said === amount || answer === 'yes') handOff(qr, check, amount);
    else if (answer === 'no') cancel();
    else announce(tr('hf_not_heard'), { force: true });
  })();
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
      ${offerSave ? `<button class="btn wide" id="save">${icon('store')}<span>${esc(tr('save_this_shop', { name: qr.payeeName }))}</span></button><p class="hint">${esc(tr('save_note'))}</p>` : ''}
      <button class="btn ghost wide" id="done">${esc(tr('done'))}</button>
    </section>`, { title: tr('step_pay'), step: 4 });
  alertUser(BUZZ.ok);
  setVoice({ own: true });
  // Phones only let a website open another app straight after a tap. After a voice "yes" there was no tap,
  // so in voice mode any tap on the screen opens the payment app (a blind user can't find a button).
  const voiceOpen = voiceDriven(P()) || P().handsFree;
  announce(`${tr('opening', { app })}. ${voiceOpen ? tr('tap_open', { app }) : tr('opening_sub', { app })}`, { force: true });
  if (voiceOpen) {
    const anyTap = (e) => { if (e.target.closest('#done, #save')) return; document.removeEventListener('pointerup', anyTap, true); window.location.href = link; };
    document.addEventListener('pointerup', anyTap, true);
    setCleanup(() => document.removeEventListener('pointerup', anyTap, true));
  }
  on('#save', 'click', () => go('name-shop', qr, 'home'));
  on('#done', 'click', goHome);
  const gen = screenId();
  setTimeout(() => { if (gen === screenId()) window.location.href = link; }, 1600);
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
