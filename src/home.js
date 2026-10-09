// Lock screen, dashboard, history, shops, trusted people, profile and accessibility settings.

import * as store from './store.js';
import { LANGS } from './i18n.js';
import { SAMPLE_SHOPS } from './demo-codes.js';
import { formatRupees } from './amount.js';
import { PAY_APPS, buildUpiLink, appLink } from './upi.js';
import { verifyBiometric, checkCode } from './auth.js';
import { normalisePhone } from './family.js';
import { icon } from './icons.js';
import { BUZZ } from './speech.js';
import { route, go, replace, goHome, render, on, esc, tr, P, S, announce, applySettings, rerender, alertUser } from './ui.js';
import { codePad, codePadHtml, settingsControls, wireSettingsControls, trustedForm, saveTrustedForm, limitsForm, saveLimitsForm } from './onboarding.js';

const money = (n) => formatRupees(n);
const initials = (name) => (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
let unlocked = false;
export const isUnlocked = () => unlocked || S().lock.type === 'none';

// ---------- Lock screen ----------
route('lock', (after = 'home') => {
  const lock = S().lock;
  const done = () => { unlocked = true; alertUser(BUZZ.ok); if (after === 'scan') { replace('home'); go('scan'); } else replace(after); };
  render(`
    <section class="screen center lock">
      <div class="avatar big">${esc(initials(S().user.name))}</div>
      <h1>${esc(tr('lock_title', { name: S().user.name }))}</h1>
      ${lock.type === 'bio' ? `<button class="btn big primary wide" id="bio" data-next>${icon('finger')}<span>${esc(tr('unlock_bio'))}</span></button>` : ''}
      ${lock.type === 'code' ? `<p class="muted">${esc(tr('unlock_code'))}</p><p class="note warn-note" id="err" role="alert" hidden>${esc(tr('wrong_code'))}</p>${codePadHtml()}` : ''}
      <p class="hint">${esc(tr('forgot'))}</p>
    </section>`, { top: null, title: tr('lock_label') });
  announce(`${tr('lock_title', { name: S().user.name })}. ${lock.type === 'bio' ? tr('unlock_bio') : tr('unlock_code')}`);
  if (lock.type === 'bio') {
    const tryBio = async () => { if (await verifyBiometric(lock.credId)) done(); };
    on('#bio', 'click', tryBio);
    tryBio();
  } else if (lock.type === 'code') {
    codePad(async (c) => {
      if (await checkCode(c, lock)) done();
      else { document.getElementById('err').hidden = false; alertUser(BUZZ.caution); announce(tr('wrong_code'), { force: true }); }
    });
  } else done();
});

export function lockNow() { unlocked = false; replace('lock'); }

// ---------- Dashboard ----------
route('home', () => {
  const s = S();
  const person = s.trusted[0];
  const tile = (id, tone, ic, title, sub) => `
    <button class="tile tone-${tone}" id="${id}">
      <span class="badge">${icon(ic)}</span>
      <span class="tile-text"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
      <span class="chev">${icon('chevron')}</span>
    </button>`;
  render(`
    <section class="screen">
      <div class="greeting">
        <div><h1>${esc(tr('hello', { name: s.user.name || '' }))}</h1><p class="muted">${esc(tr('hello_sub'))}</p></div>
        <button class="avatar" id="me" aria-label="${esc(tr('profile'))}">${esc(initials(s.user.name))}</button>
      </div>
      <button class="hero-card" id="pay" data-next>
        <span class="hero-badge">${icon('scan')}</span>
        <span class="hero-text"><strong>${esc(tr('tile_pay'))}</strong><small>${esc(tr('tile_pay_sub'))}</small></span>
        <span class="chev">${icon('chevron')}</span>
      </button>
      ${person && s.limits.perPayment ? `<p class="note info-note">${icon('family')}<span>${esc(tr('limit_note', { amount: money(s.limits.perPayment), name: person.name }))}</span></p>` : ''}
      <div class="tiles">
        ${tile('shops', 'teal', 'store', tr('tile_shops'), tr('tile_shops_sub', { n: s.savedShops.length }))}
        ${tile('family', 'purple', 'family', tr('tile_family'), person ? tr('tile_family_sub', { name: person.name }) : tr('tile_family_sub_none'))}
        ${tile('history', 'blue', 'history', tr('tile_history'), tr('tile_history_sub'))}
        ${tile('access', 'amber', 'sliders', tr('tile_settings'), tr('tile_settings_sub'))}
      </div>
    </section>`, { top: 'brand', nav: 'home', title: tr('home') });
  announce(`${tr('hello', { name: s.user.name })}. ${tr('tile_pay')}.`);
  on('#pay', 'click', () => go('scan'));
  on('#shops', 'click', () => go('shops'));
  on('#family', 'click', () => go('trusted'));
  on('#history', 'click', () => go('history'));
  on('#access', 'click', () => go('settings'));
  on('#me', 'click', () => go('profile'));
});

// ---------- History ----------
route('history', () => {
  const h = S().history;
  const tone = { same: 'ok', new: 'caution', different: 'danger' };
  const ic = { same: 'check', new: 'info', different: 'alert' };
  const fmt = (at) => new Date(at).toLocaleString(P().lang === 'en' ? 'en-IN' : `${P().lang}-IN`, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  render(`
    <section class="screen">
      <h1>${esc(tr('tile_history'))}</h1>
      ${h.length ? `<ul class="history-list">${h.slice(0, 50).map((x) => `
        <li class="history-item">
          <span class="badge tone-${tone[x.status] || 'caution'}">${icon(ic[x.status] || 'info')}</span>
          <div class="grow"><p class="h-name">${esc(x.name)}</p><p class="h-meta">${esc(fmt(x.at))}</p><p class="h-tag tone-${tone[x.status] || 'caution'}">${esc(tr(`st_${x.status}`))}</p></div>
          <p class="h-amount">${esc(money(x.amount))}</p>
        </li>`).join('')}</ul>` : empty('history', tr('history_empty'))}
    </section>`, { top: 'back', nav: 'history', title: tr('tile_history') });
  announce(h.length ? h.slice(0, 3).map((x) => `${tr('amount_spoken', { amount: money(x.amount), name: x.name })}`).join('. ') : tr('history_empty'));
});

const empty = (ic, text) => `<div class="empty">${icon(ic)}<p>${esc(text)}</p></div>`;

// ---------- My shops ----------
route('shops', () => {
  const shops = S().savedShops;
  render(`
    <section class="screen">
      <h1>${esc(tr('tile_shops'))}</h1>
      ${shops.length ? `<ul class="list-cards rich">${shops.map((s, i) => `
        <li>
          <span class="badge tone-teal">${icon('store')}</span>
          <div class="grow"><p class="h-name">${esc(s.name)}</p><p class="h-meta">${esc(s.vpa)}</p>${s.usualAmount ? `<p class="h-meta">${esc(tr('usual', { amount: money(s.usualAmount) }))}</p>` : ''}</div>
          <button class="btn small" data-remove="${i}" aria-label="${esc(`${tr('remove')}: ${s.name}`)}">${esc(tr('remove'))}</button>
        </li>`).join('')}</ul>` : empty('store', tr('shops_empty'))}
      <button class="btn big primary wide" id="add" data-next>${icon('plus')}<span>${esc(tr('add_shop'))}</span></button>
    </section>`, { title: tr('tile_shops') });
  announce(shops.length ? shops.map((s) => s.name).join(', ') : tr('shops_empty'));
  on('#add', 'click', () => go('add-shop', 'shops'));
  on('[data-remove]', 'click', (e) => { store.removeShop(shops[Number(e.currentTarget.dataset.remove)].vpa); announce(tr('removed')); rerender(); });
});

// ---------- Trusted people and limits ----------
route('trusted', () => {
  const people = S().trusted;
  render(`
    <section class="screen">
      <h1>${esc(tr('tile_family'))}</h1>
      <p class="muted">${esc(tr('trusted_intro'))}</p>
      ${people.length ? `<ul class="list-cards rich">${people.map((p, i) => `
        <li>
          <span class="avatar small tone-purple">${esc(initials(p.name))}</span>
          <div class="grow"><p class="h-name">${esc(p.name)}${p.relation ? ` <span class="muted">(${esc(p.relation)})</span>` : ''}</p><p class="h-meta">+${esc(normalisePhone(p.phone))}</p></div>
          <button class="btn small" data-remove="${i}" aria-label="${esc(`${tr('remove')}: ${p.name}`)}">${esc(tr('remove'))}</button>
        </li>`).join('')}</ul>` : `<p class="muted">${esc(tr('no_trusted'))}</p>`}
      <details class="card" ${people.length ? '' : 'open'}>
        <summary>${icon('plus')} ${esc(tr('add_person'))}</summary>
        ${trustedForm()}
        <button class="btn primary wide" id="add">${esc(tr('add_person'))}</button>
      </details>
      ${limitsForm()}
      <button class="btn big primary wide" id="save" data-next>${esc(tr('save'))}</button>
    </section>`, { title: tr('tile_family') });
  on('#add', 'click', () => { if (saveTrustedForm()) { announce(tr('saved')); rerender(); } });
  on('[data-remove]', 'click', (e) => { store.removeTrusted(people[Number(e.currentTarget.dataset.remove)].phone); rerender(); });
  on('#save', 'click', () => { saveTrustedForm(); saveLimitsForm(); announce(tr('saved'), { force: true }); goHome(); });
});

// ---------- Profile ----------
route('profile', () => {
  const s = S();
  const p = s.profile;
  const appLabel = p.payApp === 'any' ? tr('any_app') : PAY_APPS[p.payApp].label;
  const lockLabel = { bio: tr('lock_bio'), code: tr('lock_code'), none: tr('lock_none') }[s.lock.type];
  const row = (id, tone, ic, title, value) => `<button class="list-row" id="${id}"><span class="badge tone-${tone}">${icon(ic)}</span><span class="grow">${esc(title)}</span>${value ? `<span class="value">${esc(value)}</span>` : ''}${icon('chevron')}</button>`;
  render(`
    <section class="screen">
      <div class="profile-head">
        <div class="avatar big">${esc(initials(s.user.name))}</div>
        <div><h1>${esc(s.user.name)}</h1>${s.user.phone ? `<p class="muted">+${esc(normalisePhone(s.user.phone))}</p>` : ''}</div>
      </div>
      <details class="card" id="edit-box">
        <summary>${esc(tr('edit_profile'))}</summary>
        <label for="name">${esc(tr('name_label'))}</label>
        <input id="name" class="field" value="${esc(s.user.name)}">
        <label for="phone">${esc(tr('phone_label'))}</label>
        <input id="phone" class="field" inputmode="tel" value="${esc(s.user.phone)}">
        <button class="btn primary wide" id="save-me">${esc(tr('save'))}</button>
      </details>
      <div class="control">
        <span class="label" id="lang-label">${icon('globe')} ${esc(tr('language'))}</span>
        <div class="lang-grid" role="group" aria-labelledby="lang-label">
          ${Object.entries(LANGS).map(([code, l]) => `<button class="chip ${p.lang === code ? 'is-on' : ''}" data-lang="${code}" aria-pressed="${p.lang === code}" lang="${code}">${esc(l.label)}</button>`).join('')}
        </div>
      </div>
      <div class="control">
        <span class="label" id="app-label">${icon('phone')} ${esc(tr('payment_app'))}</span>
        <div class="lang-grid" role="group" aria-labelledby="app-label">
          ${Object.entries(PAY_APPS).map(([k, a]) => `<button class="chip ${p.payApp === k ? 'is-on' : ''}" data-app="${k}" aria-pressed="${p.payApp === k}">${esc(k === 'any' ? tr('app_any') : a.label)}</button>`).join('')}
        </div>
      </div>
      <div class="list-group">
        ${row('r-lock', 'blue', 'lock', tr('lock_label'), lockLabel)}
        ${row('r-family', 'purple', 'family', tr('tile_family'), s.trusted[0]?.name || '')}
        ${row('r-shops', 'teal', 'store', tr('tile_shops'), String(s.savedShops.length))}
        ${row('r-access', 'amber', 'sliders', tr('tile_settings'), '')}
      </div>
      <details class="card">
        <summary>${esc(tr('test_payment'))}</summary>
        <p class="hint">${esc(tr('test_payment_hint', { app: appLabel }))}</p>
        <label for="vpa">${esc(tr('test_vpa_label'))}</label>
        <input id="vpa" class="field" autocomplete="off" placeholder="name@okaxis">
        <button class="btn wide" id="test">${esc(tr('test_go', { app: appLabel }))}</button>
      </details>
      <div class="stack tight">
        ${s.lock.type !== 'none' ? `<button class="btn wide" id="lock-now">${icon('lock')}<span>${esc(tr('lock_now'))}</span></button>` : ''}
        <button class="btn wide" id="samples">${esc(tr('sample_shops'))}</button>
        <button class="btn wide danger-outline" id="reset">${esc(tr('reset_all'))}</button>
      </div>
    </section>`, { top: 'back', nav: 'profile', title: tr('profile') });
  on('#save-me', 'click', () => { store.update({ user: { ...s.user, name: document.getElementById('name').value.trim() || s.user.name, phone: document.getElementById('phone').value.trim() } }); announce(tr('saved')); rerender(); });
  on('[data-lang]', 'click', (e) => { store.updateProfile({ lang: e.currentTarget.dataset.lang }); applySettings(); rerender(); });
  on('[data-app]', 'click', (e) => { store.updateProfile({ payApp: e.currentTarget.dataset.app }); rerender(); });
  on('#r-lock', 'click', () => go('secure', 'back'));
  on('#r-family', 'click', () => go('trusted'));
  on('#r-shops', 'click', () => go('shops'));
  on('#r-access', 'click', () => go('settings'));
  on('#test', 'click', () => {
    const vpa = document.getElementById('vpa').value.trim();
    if (!vpa.includes('@')) { document.getElementById('vpa').focus(); return; }
    window.location.href = appLink(buildUpiLink({ payeeVpa: vpa, payeeName: 'Sahaaya test', amount: 1, note: 'Sahaaya test' }), P().payApp);
  });
  on('#lock-now', 'click', lockNow);
  on('#samples', 'click', () => { SAMPLE_SHOPS.forEach((x) => store.saveShop(x)); announce(tr('samples_added'), { force: true }); rerender(); });
  on('#reset', 'click', () => {
    if (!window.confirm(tr('reset_confirm'))) return;
    store.reset();
    unlocked = false;
    applySettings();
    replace('welcome');
  });
});

// ---------- Accessibility settings ----------
route('settings', () => {
  const p = P();
  render(`
    <section class="screen">
      <h1>${esc(tr('tile_settings'))}</h1>
      ${settingsControls(p)}
      <button class="btn wide" id="redo">${esc(tr('redo_setup'))}</button>
    </section>`, { title: tr('tile_settings') });
  wireSettingsControls(p, (next) => { store.updateProfile(next); applySettings(); rerender(); });
  on('#redo', 'click', () => go('needs'));
});
