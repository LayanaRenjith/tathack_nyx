// The guardian's side of an approval. Opens from the WhatsApp link on the son's or daughter's phone,
// works without setting Sahaaya up there, and gives a 6-digit code to send back.

import { parseRequestLink, guardianKey, approvalCode, pinLooksRight } from './guardian.js';
import { sendAnswer } from './relay.js';
import { formatRupees } from './amount.js';
import { whatsappLink, normalisePhone } from './family.js';
import { icon } from './icons.js';
import { speak } from './speech.js';
import { route, render, on, esc, P } from './ui.js';
import { t } from './i18n.js';

route('approve', (hash) => {
  const req = parseRequestLink(hash);
  const lang = req?.lang || P().lang;
  const tx = (k, v) => t(lang, k, v);
  document.documentElement.lang = lang;
  if (!req) {
    render(`<section class="screen center"><div class="hero-icon tone-amber">${icon('info')}</div><h1>${esc(tx('ap_bad_link'))}</h1></section>`, { top: null, title: tx('ap_title') });
    return;
  }
  const amount = formatRupees(req.amount);
  const user = req.user || '—';
  render(`
    <section class="screen approve">
      <div class="approve-head">
        <span class="hero-icon tone-green">${icon('shield')}</span>
        <h1>${esc(tx('ap_title'))}</h1>
      </div>
      <div class="confirm-card tone-${req.reason === 'new' ? 'amber' : 'purple'} approve-card">
        <p class="eyebrow">${esc(tx('ap_wants', { user }))}</p>
        <p class="amount center">${esc(amount)}</p>
        <dl class="confirm-rows">
          <div><dt>${esc(tx('confirm_to'))}</dt><dd>${esc(req.name || req.vpa)}</dd></div>
          <div><dt>${esc(tx('confirm_account'))}</dt><dd class="vpa">${esc(req.vpa)}</dd></div>
        </dl>
        <p class="note warn-note">${icon('info')}<span>${esc(tx(req.reason === 'new' ? 'ap_new' : req.reason === 'mismatch' ? 'ap_mismatch' : 'ap_limit'))} ${esc(tx('ap_tip'))}</span></p>
      </div>
      ${req.phone ? `<a class="btn wide" href="tel:+${esc(normalisePhone(req.phone))}">${icon('call')}<span>${esc(tx('ap_call', { user }))}</span></a>` : ''}
      <div class="card stack tight" id="pin-card">
        <label for="ap-pin">${esc(tx('ap_pin'))}</label>
        <input id="ap-pin" class="field code-field" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••">
        <p class="note warn-note" id="ap-err" role="alert" hidden>${esc(tx('ap_wrong_pin'))}</p>
        <div class="row confirm-actions">
          <button class="btn big wide ghost-danger" id="ap-no">${icon('close')}<span>${esc(tx('ap_decline'))}</span></button>
          <button class="btn big primary wide pay" id="ap-ok">${icon('check')}<span>${esc(tx('ap_get_code'))}</span></button>
        </div>
      </div>
      <div class="code-card" id="code-card" hidden>
        <span class="done-badge">${icon('check')}</span>
        <p class="done-title" id="done-title"></p>
        <p class="eyebrow">${esc(tx('ap_code_is'))}</p>
        <p class="big-code" id="code" aria-live="polite"></p>
        <a class="btn wide whatsapp" id="send" target="_blank" rel="noopener">${icon('whatsapp')}<span>${esc(tx('ap_send'))}</span></a>
      </div>
      <div class="code-card declined" id="no-card" hidden>
        <span class="done-badge">${icon('stop')}</span>
        <p class="done-title">${esc(tx('ap_declined_sent', { user }))}</p>
        ${req.phone ? `<a class="btn wide" href="tel:+${esc(normalisePhone(req.phone))}">${icon('call')}<span>${esc(tx('ap_call', { user }))}</span></a>` : ''}
      </div>
    </section>`, { top: null, title: tx('ap_title') });

  on('#ap-ok', 'click', async () => {
    const pin = document.getElementById('ap-pin').value.replace(/\D/g, '');
    const err = document.getElementById('ap-err');
    if (pin.length !== 4 || !(await pinLooksRight(pin, req.salt, req.check))) { err.hidden = false; return; }
    err.hidden = true;
    const code = await approvalCode(await guardianKey(pin, req.salt), req);
    document.getElementById('pin-card').hidden = true;
    document.getElementById('code-card').hidden = false;
    document.getElementById('code').textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
    const msg = tx('ap_code_msg', { code });
    document.getElementById('send').href = req.phone ? whatsappLink(req.phone, msg) : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    // Straight to the elder's phone; the code on WhatsApp is the backup.
    const sent = await sendAnswer(req.channel, { a: 'ok', code });
    document.getElementById('done-title').textContent = tx(sent ? 'ap_sent' : 'ap_send_code', { user });
    speak(sent ? tx('ap_sent', { user }) : code.split('').join(' '), { lang });
  });

  on('#ap-no', 'click', async () => {
    document.getElementById('pin-card').hidden = true;
    document.getElementById('no-card').hidden = false;
    const sent = await sendAnswer(req.channel, { a: 'no' });
    if (!sent && req.phone) window.open(whatsappLink(req.phone, tx('ap_decline_msg', { amount, shop: req.name || req.vpa })), '_blank');
  });
});
