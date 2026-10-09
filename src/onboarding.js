// First-run setup, usually done with a family member: language, who and name, needs in plain words,
// payment app, live preview, app lock, trusted person and limits, regular shops. Every step skippable.

import { LANGS } from './i18n.js';
import * as store from './store.js';
import { deriveProfile, NEEDS, TOGGLES, START_PROFILE, normaliseProfile } from './profile.js';
import { PAY_APPS } from './upi.js';
import { biometricAvailable, registerBiometric, hashCode, newSalt } from './auth.js';
import { makeGuardian } from './guardian.js';
import { speak, vibrate, BUZZ, listenAll, canListen } from './speech.js';
import { yesNo, normalise } from './spoken.js';
import { icon } from './icons.js';
import { route, go, replace, back, goHome, render, on, esc, tr, P, S, applySettings, announce, setVoice, screenId } from './ui.js';

const TOTAL = 6;
let draft = { needs: [], payApp: 'any' };
const say = (text) => { if (!P().screenReader) speak(text, { lang: P().lang }); };
const progress = (n) => `<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL}" aria-valuenow="${n}"><span style="width:${(n / TOTAL) * 100}%"></span></div>`;

export const WELCOME_ART = `<svg class="welcome-art" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="wbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3f1e6"/><stop offset=".55" stop-color="#f6f1e4"/><stop offset="1" stop-color="#fde4cf"/></linearGradient>
    <radialGradient id="wglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="wscreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f3f8f4"/></linearGradient>
    <linearGradient id="wok" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a9d70"/><stop offset="1" stop-color="#2b6a4c"/></linearGradient>
    <filter id="wsh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#2b4a3a" flood-opacity=".22"/></filter>
    <filter id="wsh2" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#2b4a3a" flood-opacity=".18"/></filter>
  </defs>
  <rect width="360" height="300" fill="url(#wbg)"/>
  <circle cx="60" cy="60" r="70" fill="#cfe6d5" opacity=".7"/><circle cx="318" cy="250" r="80" fill="#fbd3b4" opacity=".55"/><circle cx="300" cy="40" r="26" fill="#ffd98a" opacity=".8"/>
  <circle cx="180" cy="152" r="128" fill="url(#wglow)"/>
  <circle cx="180" cy="152" r="112" fill="none" stroke="#3d7a5c" stroke-opacity=".22" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
  <g fill="#3d7a5c" opacity=".35"><circle cx="34" cy="168" r="3"/><circle cx="330" cy="120" r="3"/><circle cx="92" cy="268" r="2.5"/><circle cx="262" cy="22" r="2.5"/></g>
  <!-- phone -->
  <g transform="rotate(-7 180 152)" filter="url(#wsh)">
    <rect x="122" y="40" width="116" height="226" rx="22" fill="#1f2a25"/>
    <rect x="128" y="46" width="104" height="214" rx="17" fill="url(#wscreen)"/>
    <rect x="164" y="51" width="32" height="5" rx="2.5" fill="#1f2a25"/>
    <rect x="138" y="68" width="40" height="6" rx="3" fill="#cfd8d2"/><circle cx="220" cy="71" r="5" fill="#e7f3ea"/>
    <circle cx="180" cy="116" r="30" fill="url(#wok)"/>
    <path d="M166 116 l10 10 l19 -21" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="146" y="158" width="68" height="8" rx="4" fill="#23302a"/>
    <rect x="152" y="172" width="56" height="6" rx="3" fill="#9fb3a7"/>
    <text x="180" y="208" text-anchor="middle" font-family="Baloo 2, system-ui, sans-serif" font-weight="800" font-size="24" fill="#23302a">₹250</text>
    <rect x="140" y="222" width="80" height="24" rx="12" fill="#3d7a5c"/><rect x="160" y="232" width="40" height="5" rx="2.5" fill="#fff" opacity=".9"/>
  </g>
  <!-- what Sahaaya does, around the phone -->
  <g filter="url(#wsh2)">
    <g transform="translate(52 84)"><circle r="27" fill="#fff"/><circle r="20" fill="#fdeaea"/><path d="M-7 -7 l14 14 M7 -7 l-14 14" stroke="#d33a3a" stroke-width="4" stroke-linecap="round"/></g>
    <g transform="translate(306 96)"><circle r="27" fill="#fff"/><circle r="20" fill="#eeebfb"/><path d="M-9 -4 v8 h5 l7 6 v-20 l-7 6z" fill="#6d55c9"/><path d="M6 -6 a8 8 0 0 1 0 12" stroke="#6d55c9" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>
    <g transform="translate(60 216)"><circle r="27" fill="#fff"/><circle r="20" fill="#fdebec"/><path d="M0 9 c-10 -6 -13 -11 -9 -15 c3 -3 7 -2 9 1 c2 -3 6 -4 9 -1 c4 4 1 9 -9 15z" fill="#d0475a"/></g>
    <g transform="translate(300 214)"><circle r="27" fill="#fff"/><circle r="20" fill="#fdf1e1"/><g fill="#c46a07"><rect x="-9" y="-9" width="7" height="7" rx="1"/><rect x="2" y="-9" width="7" height="7" rx="1"/><rect x="-9" y="2" width="7" height="7" rx="1"/><rect x="3" y="3" width="3" height="3"/><rect x="7" y="7" width="3" height="3"/></g></g>
  </g>
</svg>`;

// ---------- Welcome ----------
route('welcome', () => {
  if (!S().setupDone) store.update({ profile: normaliseProfile({ ...START_PROFILE, lang: P().lang }) });
  applySettings();
  render(`
    <section class="screen welcome">
      <div class="welcome-hero">${WELCOME_ART}</div>
      <div class="readable cover-copy">
        <div class="brand-lockup"><span class="logo big" aria-hidden="true"></span><h1 class="hero-title">${esc(tr('app_name'))}</h1></div>
        <p class="cover-sub">${esc(tr('tagline'))}</p>
      </div>
      <ul class="promise">
        <li class="tone-red-soft">${icon('stop')}<span>${esc(tr('promise_fake'))}</span></li>
        <li class="tone-purple">${icon('speaker')}<span>${esc(tr('promise_voice'))}</span></li>
        <li class="tone-pink">${icon('family')}<span>${esc(tr('promise_family'))}</span></li>
      </ul>
      <div class="lang-list" role="radiogroup" aria-label="${esc(tr('choose_lang'))}">
        <p class="label">${icon('globe')} ${esc(tr('choose_lang'))}</p>
        ${Object.entries(LANGS).map(([code, l]) => `<button class="lang-row ${P().lang === code ? 'is-on' : ''}" role="radio" data-lang="${code}" aria-checked="${P().lang === code}" lang="${code}"><span class="grow">${esc(l.label)}</span><span class="lang-check">${icon('check')}</span></button>`).join('')}
      </div>
      <button class="btn big primary wide" id="start" data-next>${esc(tr('get_started'))}</button>
      ${canListen ? `<button class="btn big wide voice-start" id="by-voice">${icon('mic')}<span>${esc(tr('voice_setup'))}</span></button>` : ''}
    </section>`, { top: null, title: tr('app_name') });
  say(`${tr('app_name')}. ${tr('tagline')} ${tr('choose_lang')}.`);
  on('[data-lang]', 'click', (e) => { store.updateProfile({ lang: e.currentTarget.dataset.lang }); applySettings(); replace('welcome'); });
  on('#start', 'click', () => go('signup'));
  on('#by-voice', 'click', () => go('voice-setup'));
});

// ---------- Set up by voice (for someone who cannot see the screen) ----------
const LANG_WORDS = {
  ml: ['malayalam', 'മലയാളം', 'മലയാള', 'मलयालम', 'மலையாளம்'],
  en: ['english', 'ഇംഗ്ലീഷ്', 'इंग्लिश', 'अंग्रेजी', 'அங்கிலம்', 'ஆங்கிலம்', 'இங்கிலீஷ்'],
  hi: ['hindi', 'ഹിന്ദി', 'हिंदी', 'हिन्दी', 'இந்தி', 'ஹிந்தி'],
  ta: ['tamil', 'തമിഴ്', 'तमिल', 'தமிழ்'],
};
const LANG_PROMPT = { ml: 'ഭാഷ പറയൂ: മലയാളം', en: 'Say your language: English', hi: 'अपनी भाषा बोलिए: हिंदी', ta: 'உங்கள் மொழியைச் சொல்லுங்கள்: தமிழ்' };

route('voice-setup', () => {
  render(`
    <section class="screen center voice-setup">
      <div class="voice-hero"><span class="voice-orb big">${icon('mic')}</span></div>
      <h1>${esc(tr('voice_setup'))}</h1>
      <p class="readable muted" id="vs-status">${esc(tr('vs_intro'))}</p>
      <p class="vs-heard" id="vs-heard" aria-live="polite"></p>
      <button class="btn wide" id="vs-screen">${esc(tr('vs_use_screen'))}</button>
    </section>`, { top: 'back', title: tr('voice_setup') });
  setVoice({ own: true });
  const gen = screenId();
  const status = document.getElementById('vs-status');
  const heardEl = document.getElementById('vs-heard');
  const live = () => gen === screenId();
  on('#vs-screen', 'click', () => replace('welcome'));

  async function askVoice(question, accept, { lang = P().lang } = {}) {
    for (let i = 0; i < 3 && live(); i += 1) {
      status.textContent = question;
      await speak(i ? `${tr('vm_try_again')} ${question}` : question, { lang });
      if (!live()) return null;
      const alts = await listenAll({ lang });
      if (!live()) return null;
      heardEl.textContent = alts[0] || '';
      const v = alts.length ? accept(alts) : null;
      if (v !== null && v !== undefined) return v;
    }
    return null;
  }
  const yes = (alts) => yesNo(alts);

  (async () => {
    // 1. Language: each option spoken in its own language, heard in Indian English (all names are recognised).
    let lang = null;
    for (let i = 0; i < 2 && !lang && live(); i += 1) {
      for (const [code, text] of Object.entries(LANG_PROMPT)) { if (!live()) return; status.textContent = text; await speak(text, { lang: code }); }
      const alts = await listenAll({ lang: 'en' });
      if (!live()) return;
      heardEl.textContent = alts[0] || '';
      lang = Object.keys(LANG_WORDS).find((code) => alts.some((a) => LANG_WORDS[code].some((w) => a.toLowerCase().includes(w))));
    }
    if (!live()) return;
    lang = lang || P().lang;
    store.updateProfile(deriveProfile({ lang, needs: ['blind'] }));
    applySettings();
    // 2. Name
    let name = null;
    while (live() && !name) {
      const heard = await askVoice(tr('vs_name_q'), (a) => a[0].trim());
      if (heard === null) break;
      const ok = await askVoice(tr('vs_name_ok', { name: heard }), yes);
      if (ok === 'yes') name = heard;
    }
    if (!live()) return;
    if (!name) { await speak(tr('vs_fail')); if (live()) replace('signup'); return; }
    store.update({ user: { name, phone: '', helper: false } });
    // 3. A family member's number (optional)
    const num = await askVoice(tr('vs_family_q'), (a) => {
      if (yesNo(a) === 'no') return 'skip';
      const d = a.map((x) => normalise(x).replace(/\D/g, '')).find((x) => x.length >= 10);
      return d || null;
    });
    if (!live()) return;
    if (num && num !== 'skip') {
      const spaced = num.slice(-10).split('').join(' ');
      const ok = await askVoice(tr('vs_number_ok', { num: spaced }), yes);
      if (ok === 'yes') {
        const who = await askVoice(tr('vs_family_name'), (a) => a[0].trim());
        store.addTrusted({ name: who || tr('family_default'), phone: num.slice(-10), relation: '' });
      }
    }
    if (!live()) return;
    store.update({ setupDone: true, lock: { type: 'none', credId: null, codeHash: null, salt: null } });
    await speak(tr('vs_done', { name }));
    if (live()) goHome();
  })();
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
const NEED_ICON = { blind: 'mic', seeing: 'eye', screenreader: 'talkback', reading: 'book', colour: 'palette', hands: 'hand', hearing: 'ear', simple: 'sprout', listen: 'speaker' };
const NEED_TONE = { blind: 'green', seeing: 'blue', screenreader: 'blue', reading: 'purple', colour: 'pink', hands: 'amber', hearing: 'teal', simple: 'green', listen: 'purple' };

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
      ${guardianForm()}
      ${limitsForm()}
      <button class="btn big primary wide" id="next" data-next>${esc(tr('next'))}</button>
      <button class="btn ghost wide" id="skip">${esc(tr('skip'))}</button>
    </section>`, { title: tr('trusted_setup_title') });
  say(`${tr('trusted_setup_title')}. ${tr('trusted_intro')}`);
  wireGuardianForm();
  on('#next', 'click', async () => { saveTrustedForm(); saveLimitsForm(); await saveGuardianForm(); go('shops-setup'); });
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

/** Guardian PIN: chosen by the trusted person, used only to approve new shops and big payments. */
export const guardianForm = () => `
  <div class="card stack tight guardian-card">
    <h2 class="card-title">${icon('shield')} ${esc(tr('guardian_title'))}</h2>
    <p class="hint">${esc(tr(S().guardian ? 'guardian_set' : 'guardian_hint'))}</p>
    <label for="g-new">${esc(S().guardian ? tr('guardian_change') : tr('guardian_pin'))}</label>
    <input id="g-new" class="field code-field" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••">
    <button class="toggle-row" id="l-new" role="switch" aria-checked="${S().limits.newShops !== false}"><span class="grow">${esc(tr('new_shops_rule'))}</span><span class="switch" aria-hidden="true"><span></span></span></button>
  </div>`;

export function wireGuardianForm() {
  const t = document.getElementById('l-new');
  t?.addEventListener('click', () => t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true')));
}

export async function saveGuardianForm() {
  const pin = String(document.getElementById('g-new')?.value || '').replace(/\D/g, '');
  const rule = document.getElementById('l-new');
  if (rule) store.update({ limits: { ...S().limits, newShops: rule.getAttribute('aria-checked') === 'true' } });
  if (pin.length === 4) store.update({ guardian: await makeGuardian(pin) });
}

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
  store.update({ limits: { ...S().limits, perPayment: num('l-pay'), daily: num('l-day') } });
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
