// First-run setup, usually done with a family member: language, who and name, needs in plain words,
// payment app, live preview, app lock, trusted person and limits, regular shops. Every step skippable.

import { LANGS } from './i18n.js';
import * as store from './store.js';
import { deriveProfile, NEEDS, TOGGLES, START_PROFILE, normaliseProfile } from './profile.js';
import { PAY_APPS } from './upi.js';
import { biometricAvailable, registerBiometric, hashCode, newSalt } from './auth.js';
import { speak, vibrate, BUZZ } from './speech.js';
import { icon } from './icons.js';
import { route, go, replace, back, goHome, render, on, esc, tr, P, S, applySettings, announce } from './ui.js';

const TOTAL = 6;
let draft = { needs: [], payApp: 'any' };
const say = (text) => { if (!P().screenReader) speak(text, { lang: P().lang }); };
const progress = (n) => `<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL}" aria-valuenow="${n}"><span style="width:${(n / TOTAL) * 100}%"></span></div>`;

const WELCOME_ART = `<svg class="welcome-art" viewBox="0 0 320 170" aria-hidden="true">
  <circle cx="160" cy="92" r="78" fill="var(--tint-blue)"/>
  <g><circle cx="92" cy="70" r="16" fill="var(--c-amber)"/><rect x="72" y="90" width="40" height="58" rx="18" fill="var(--c-blue)"/><path d="M60 150 l12 -38" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/></g>
  <g><circle cx="160" cy="58" r="18" fill="var(--c-amber)"/><rect x="137" y="80" width="46" height="70" rx="20" fill="var(--c-green)"/><rect x="146" y="98" width="28" height="40" rx="6" fill="#fff"/><path d="M152 112h16M152 120h10" stroke="var(--c-green)" stroke-width="3" stroke-linecap="round"/></g>
  <g><circle cx="228" cy="72" r="15" fill="var(--c-amber)"/><rect x="209" y="90" width="38" height="58" rx="17" fill="var(--c-purple)"/><rect x="243" y="96" width="14" height="22" rx="3" fill="var(--ink)"/></g>
  <circle cx="268" cy="34" r="16" fill="var(--c-green)"/><path d="M261 34l5 5 9-10" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ---------- Welcome ----------
route('welcome', () => {
  if (!S().setupDone) store.update({ profile: normaliseProfile({ ...START_PROFILE, lang: P().lang }) });
  applySettings();
  render(`
    <section class="screen welcome">
      <div class="brand-lockup"><span class="logo big" aria-hidden="true"></span><h1 class="hero-title">${esc(tr('app_name'))}</h1></div>
      <p class="hero-sub">${esc(tr('tagline'))}</p>
      ${WELCOME_ART}
      <p class="readable muted center">${esc(tr('intro'))}</p>
      <div class="lang-grid" role="group" aria-label="${esc(tr('choose_lang'))}">
        ${Object.entries(LANGS).map(([code, l]) => `<button class="chip ${P().lang === code ? 'is-on' : ''}" data-lang="${code}" aria-pressed="${P().lang === code}" lang="${code}">${esc(l.label)}</button>`).join('')}
      </div>
      <button class="btn big primary wide" id="start" data-next>${esc(tr('get_started'))}</button>
    </section>`, { top: null, title: tr('app_name') });
  say(`${tr('choose_lang')}. ${tr('intro')}`);
  on('[data-lang]', 'click', (e) => { store.updateProfile({ lang: e.currentTarget.dataset.lang }); applySettings(); replace('welcome'); });
  on('#start', 'click', () => go('signup'));
});

// ---------- 1. Who and name ----------
route('signup', () => {
  const u = S().user;
  render(`
    <section class="screen">
      ${progress(1)}
      <h1>${esc(tr('signup_title'))}</h1>
      <fieldset class="field-group">
        <legend>${esc(tr('who_q'))}</legend>
        <div class="choice-row">
          <button class="choice-card ${!u.helper ? 'is-on' : ''}" data-helper="0" aria-pressed="${!u.helper}">${icon('user')}<span>${esc(tr('who_me'))}</span></button>
          <button class="choice-card ${u.helper ? 'is-on' : ''}" data-helper="1" aria-pressed="${u.helper}">${icon('family')}<span>${esc(tr('who_family'))}</span></button>
        </div>
      </fieldset>
      <label for="name">${esc(tr('name_label'))}</label>
      <input id="name" class="field" autocomplete="name" value="${esc(u.name)}" placeholder="${esc(tr('name_ph'))}">
      <label for="phone">${esc(tr('phone_label'))} <small>(${esc(tr('optional'))})</small></label>
      <input id="phone" class="field" inputmode="tel" autocomplete="tel" value="${esc(u.phone)}" placeholder="98470 12345">
      <button class="btn big primary wide" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: tr('signup_title') });
  say(`${tr('signup_title')}. ${tr('name_label')}`);
  let helper = u.helper;
  on('[data-helper]', 'click', (e) => {
    helper = e.currentTarget.dataset.helper === '1';
    document.querySelectorAll('[data-helper]').forEach((b) => { const onNow = b === e.currentTarget; b.classList.toggle('is-on', onNow); b.setAttribute('aria-pressed', String(onNow)); });
  });
  on('#next', 'click', () => {
    const name = document.getElementById('name').value.trim();
    if (!name) { document.getElementById('name').focus(); return; }
    store.update({ user: { name, phone: document.getElementById('phone').value.trim(), helper } });
    go('needs');
  });
});

// ---------- 2. Needs ----------
const NEED_ICON = { seeing: 'eye', screenreader: 'talkback', reading: 'book', colour: 'palette', hands: 'hand', hearing: 'ear', simple: 'sprout', listen: 'speaker' };
const NEED_TONE = { seeing: 'blue', screenreader: 'blue', reading: 'purple', colour: 'pink', hands: 'amber', hearing: 'teal', simple: 'green', listen: 'purple' };

route('needs', () => {
  const picked = new Set(draft.needs);
  const q = S().user.helper ? tr('needs_q_family', { name: S().user.name }) : tr('needs_q_me');
  render(`
    <section class="screen">
      ${progress(2)}
      <h1>${esc(q)}</h1>
      <p class="muted">${esc(tr('needs_hint'))}</p>
      <div class="stack tight" role="group" aria-label="${esc(q)}">
        ${NEEDS.map((n) => `
          <button class="need-card tone-${NEED_TONE[n]}" data-need="${n}" aria-pressed="${picked.has(n)}">
            <span class="badge">${icon(NEED_ICON[n])}</span><span class="grow">${esc(tr(`need_${n}`))}</span><span class="tick" aria-hidden="true">${icon('check')}</span>
          </button>`).join('')}
      </div>
      <button class="btn big primary wide" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: q });
  say(`${q} ${NEEDS.map((n) => tr(`need_${n}`)).join('. ')}`);
  on('[data-need]', 'click', (e) => {
    const n = e.currentTarget.dataset.need;
    if (picked.has(n)) picked.delete(n); else picked.add(n);
    e.currentTarget.setAttribute('aria-pressed', String(picked.has(n)));
    vibrate(BUZZ.tick);
  });
  on('#next', 'click', () => { draft.needs = [...picked]; go('choose-app'); });
});

// ---------- 3. Payment app ----------
route('choose-app', () => {
  render(`
    <section class="screen">
      ${progress(3)}
      <h1>${esc(tr('app_q'))}</h1>
      <div class="app-grid">
        ${Object.entries(PAY_APPS).filter(([k]) => k !== 'any').map(([k, a]) => `
          <button class="app-card app-${k}" data-app="${k}" ${k === 'gpay' ? 'data-next' : ''}><span class="app-dot" aria-hidden="true">${esc(a.label[0])}</span>${esc(a.label)}</button>`).join('')}
      </div>
      <button class="btn wide" data-app="any">${esc(tr('app_any'))}</button>
    </section>`, { title: tr('app_q') });
  say(tr('app_q'));
  on('[data-app]', 'click', (e) => {
    draft.payApp = e.currentTarget.dataset.app;
    go('preview', deriveProfile({ lang: P().lang, needs: draft.needs, payApp: draft.payApp }));
  });
});

// ---------- 4. Preview ----------
route('preview', (profile) => {
  let p = normaliseProfile(profile);
  const draw = () => {
    const y = window.scrollY;
    store.updateProfile(p);
    applySettings();
    render(`
      <section class="screen">
        ${progress(4)}
        <h1>${esc(tr('preview_title'))}</h1>
        <p class="muted">${esc(tr('preview_intro'))}</p>
        <div class="result-card ok" aria-hidden="true">
          <span class="result-icon">${icon('check')}</span>
          <div><p class="result-title">${esc(tr('preview_sample'))}</p><p class="result-sub">${esc(tr('preview_sample_sub'))}</p></div>
        </div>
        ${settingsControls(p)}
        <button class="btn big primary wide" id="done" data-next>${esc(tr('looks_good'))}</button>
      </section>`, { title: tr('preview_title') });
    wireSettingsControls(p, (next) => { p = next; draw(); });
    on('#done', 'click', () => go('secure'));
    window.scrollTo(0, y);
  };
  draw();
  say(tr('preview_title'));
});

// ---------- 5. App lock ----------
route('secure', async (next = 'trusted-setup') => {
  const after = () => (next === 'back' ? back() : go(next));
  const bio = await biometricAvailable();
  render(`
    <section class="screen">
      ${progress(5)}
      <div class="hero-icon tone-blue">${icon('lock')}</div>
      <h1>${esc(tr('secure_title'))}</h1>
      <p class="muted">${esc(tr('secure_intro', { name: S().user.name }))}</p>
      <button class="option-card tone-green" id="bio" ${bio ? 'data-next' : ''}>${icon('finger')}<span class="grow">${esc(tr('use_bio'))}</span>${icon('chevron')}</button>
      ${bio ? '' : `<p class="note warn-note">${icon('info')}<span>${esc(tr('bio_unavailable'))}</span></p>`}
      <button class="option-card tone-blue" id="code" ${bio ? '' : 'data-next'}>${icon('lock')}<span class="grow">${esc(tr('use_code'))}</span>${icon('chevron')}</button>
      <button class="btn ghost wide" id="none">${esc(tr('no_lock'))}</button>
      <p id="msg" class="note" role="status" hidden></p>
    </section>`, { title: tr('secure_title') });
  say(`${tr('secure_title')}. ${tr('secure_intro', { name: S().user.name })}`);
  on('#bio', 'click', async () => {
    const msg = document.getElementById('msg');
    if (!bio) { msg.hidden = false; msg.textContent = tr('bio_unavailable'); return; }
    try {
      const credId = await registerBiometric(S().user.name);
      store.update({ lock: { type: 'bio', credId, codeHash: null, salt: null } });
      announce(tr('lock_ready'), { force: true });
      after();
    } catch {
      msg.hidden = false; msg.textContent = tr('bio_failed');
    }
  });
  on('#code', 'click', () => go('set-code', next === 'back' ? 'back-twice' : 'trusted-setup'));
  on('#none', 'click', () => { store.update({ lock: { type: 'none', credId: null, codeHash: null, salt: null } }); after(); });
});

/** Code pad markup and wiring, shared with the lock screen. */
export function codePad(onDone) {
  let code = '';
  const dotsEl = () => document.getElementById('dots');
  const draw = () => { dotsEl().innerHTML = [0, 1, 2, 3].map((i) => `<span class="${i < code.length ? 'on' : ''}"></span>`).join(''); dotsEl().setAttribute('aria-label', `${code.length} / 4`); };
  on('[data-digit]', 'click', (e) => {
    const d = e.currentTarget.dataset.digit;
    if (d === 'back') code = code.slice(0, -1);
    else if (code.length < 4) code += d;
    vibrate(BUZZ.tick);
    draw();
    if (code.length === 4) { const c = code; code = ''; setTimeout(() => { draw(); onDone(c); }, 120); }
  });
  draw();
}

export const codePadHtml = () => `
  <div class="code-dots" id="dots" role="status" aria-live="polite"></div>
  <div class="codepad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((d) => (d === ''
    ? '<span></span>'
    : `<button class="code-key" data-digit="${d}" aria-label="${d === 'back' ? esc(tr('back')) : d}">${d === 'back' ? icon('back') : d}</button>`)).join('')}</div>`;

route('set-code', (next = 'home') => {
  let first = null;
  const draw = (title, error = '') => {
    render(`
      <section class="screen center">
        <div class="hero-icon tone-blue">${icon('lock')}</div>
        <h1>${esc(title)}</h1>
        <p class="note warn-note" role="alert" ${error ? '' : 'hidden'}>${esc(error)}</p>
        ${codePadHtml()}
      </section>`, { title });
    say(title);
    codePad(async (c) => {
      if (!first) { first = c; draw(tr('code_confirm_q')); return; }
      if (c !== first) { first = null; draw(tr('code_set_q'), tr('code_mismatch')); return; }
      const salt = newSalt();
      store.update({ lock: { type: 'code', credId: null, salt, codeHash: await hashCode(c, salt) } });
      announce(tr('lock_ready'), { force: true });
      if (next === 'back-twice') { back(); back(); } else if (next === 'back') back(); else replace(next);
    });
  };
  draw(tr('code_set_q'));
});

// ---------- 6. Trusted person and limits ----------
route('trusted-setup', () => {
  render(`
    <section class="screen">
      ${progress(6)}
      <div class="hero-icon tone-purple">${icon('family')}</div>
      <h1>${esc(tr('trusted_setup_title'))}</h1>
      <p class="muted">${esc(tr('trusted_intro'))}</p>
      ${trustedForm()}
      ${limitsForm()}
      <button class="btn big primary wide" id="next" data-next>${esc(tr('next'))}</button>
      <button class="btn ghost wide" id="skip">${esc(tr('skip'))}</button>
    </section>`, { title: tr('trusted_setup_title') });
  say(`${tr('trusted_setup_title')}. ${tr('trusted_intro')}`);
  on('#next', 'click', () => { saveTrustedForm(); saveLimitsForm(); go('shops-setup'); });
  on('#skip', 'click', () => go('shops-setup'));
});

export const trustedForm = () => `
  <div class="card stack tight">
    <label for="p-name">${esc(tr('person_name'))}</label>
    <input id="p-name" class="field" autocomplete="off" placeholder="Raju">
    <label for="p-rel">${esc(tr('person_relation'))}</label>
    <input id="p-rel" class="field" autocomplete="off" placeholder="${esc(tr('person_relation_ph'))}">
    <label for="p-phone">${esc(tr('person_phone'))}</label>
    <input id="p-phone" class="field" inputmode="tel" autocomplete="off" placeholder="98470 12345">
  </div>`;

export function saveTrustedForm() {
  const name = document.getElementById('p-name')?.value.trim();
  const phone = document.getElementById('p-phone')?.value.trim();
  if (name && phone) store.addTrusted({ name, phone, relation: document.getElementById('p-rel').value });
  return Boolean(name && phone);
}

export const limitsForm = () => {
  const l = S().limits;
  return `
  <div class="card stack tight">
    <h2 class="card-title">${icon('rupee')} ${esc(tr('limits_title'))}</h2>
    <label for="l-pay">${esc(tr('limit_payment'))}</label>
    <div class="money-field"><span>₹</span><input id="l-pay" class="field" inputmode="numeric" value="${l.perPayment ?? ''}"></div>
    <label for="l-day">${esc(tr('limit_daily'))}</label>
    <div class="money-field"><span>₹</span><input id="l-day" class="field" inputmode="numeric" value="${l.daily ?? ''}"></div>
  </div>`;
};

export function saveLimitsForm() {
  const num = (id) => { const v = Number(String(document.getElementById(id)?.value || '').replace(/\D/g, '')); return v > 0 ? v : null; };
  store.update({ limits: { perPayment: num('l-pay'), daily: num('l-day') } });
}

// ---------- 7. Regular shops ----------
route('shops-setup', () => {
  const shops = S().savedShops;
  render(`
    <section class="screen">
      <div class="hero-icon tone-teal">${icon('store')}</div>
      <h1>${esc(tr('shops_setup_title'))}</h1>
      <p class="readable muted">${esc(tr('shops_setup_intro'))}</p>
      ${shops.length ? `<ul class="list-cards">${shops.map((s) => `<li>${icon('store')}<span>${esc(s.name)}</span></li>`).join('')}</ul>` : ''}
      <button class="btn big ${shops.length ? '' : 'primary'} wide" id="scan" ${shops.length ? '' : 'data-next'}>${icon('scan')}<span>${esc(tr('scan_shop'))}</span></button>
      <button class="btn big ${shops.length ? 'primary' : ''} wide" id="finish" ${shops.length ? 'data-next' : ''}>${esc(shops.length ? tr('finish') : tr('later'))}</button>
    </section>`, { title: tr('shops_setup_title') });
  say(`${tr('shops_setup_title')}. ${tr('shops_setup_intro')}`);
  on('#scan', 'click', () => go('add-shop', 'shops-setup'));
  on('#finish', 'click', () => { store.update({ setupDone: true }); goHome(); });
});

// ---------- Accessibility controls (also used by Settings) ----------
export function settingsControls(p) {
  return `
    <div class="card stack tight">
      <div class="control">
        <span class="label" id="ts-label">${esc(tr('text_size'))}</span>
        <div class="stepper" role="group" aria-labelledby="ts-label">
          <button class="step-btn" data-scale="-0.1" aria-label="${esc(tr('text_size'))} −">A−</button>
          <output>${Math.round(p.textScale * 100)}%</output>
          <button class="step-btn" data-scale="0.1" aria-label="${esc(tr('text_size'))} +">A+</button>
        </div>
      </div>
      <div class="control">
        <span class="label" id="sp-label">${esc(tr('speech_speed'))}</span>
        <div class="stepper" role="group" aria-labelledby="sp-label">
          <button class="step-btn" data-rate="-0.1" aria-label="${esc(tr('speech_speed'))} −">−</button>
          <output>${Math.round(p.speechRate * 100)}%</output>
          <button class="step-btn" data-rate="0.1" aria-label="${esc(tr('speech_speed'))} +">+</button>
        </div>
      </div>
    </div>
    <div class="toggle-list">
      ${TOGGLES.map((k) => `
        <button class="toggle-row" data-toggle="${k}" role="switch" aria-checked="${p[k]}">
          <span class="grow">${esc(tr(`opt_${k}`))}</span><span class="switch" aria-hidden="true"><span></span></span>
        </button>`).join('')}
    </div>`;
}

export function wireSettingsControls(p, onChange) {
  const clamp = (n, lo, hi) => Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10;
  on('[data-scale]', 'click', (e) => onChange({ ...p, textScale: clamp(p.textScale + Number(e.currentTarget.dataset.scale), 0.9, 2.2) }));
  on('[data-rate]', 'click', (e) => {
    const next = { ...p, speechRate: clamp(p.speechRate + Number(e.currentTarget.dataset.rate), 0.6, 1.4) };
    onChange(next);
    speak(tr('speech_speed'), { rate: next.speechRate });
  });
  on('[data-toggle]', 'click', (e) => {
    const k = e.currentTarget.dataset.toggle;
    const next = { ...p, [k]: !p[k] };
    if (k === 'screenReader' && next.screenReader) next.voice = false;
    onChange(next);
  });
}

export { goHome };
