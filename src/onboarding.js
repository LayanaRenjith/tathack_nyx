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

export const WELCOME_ART = `<svg class="welcome-art" viewBox="0 0 360 270" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9b0"/><stop offset=".55" stop-color="#fdeccf"/><stop offset="1" stop-color="#f8f1e4"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d6"/><stop offset="1" stop-color="#fff6d6" stop-opacity="0"/></radialGradient>
    <radialGradient id="safe" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7fd3a1" stop-opacity=".55"/><stop offset="1" stop-color="#7fd3a1" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="360" height="270" fill="url(#sky)"/>
  <circle cx="92" cy="92" r="70" fill="url(#glow)"/><circle cx="92" cy="92" r="26" fill="#ffc96b"/>
  <path d="M0 196 C70 168 130 182 200 170 C260 160 310 172 360 160 V270 H0Z" fill="#cfe3cf"/>
  <!-- coconut palms -->
  <g fill="none" stroke="#6f9a72" stroke-width="5" stroke-linecap="round"><path d="M40 196 C44 160 40 130 50 104"/><path d="M330 178 C326 146 330 120 322 98"/></g>
  <g fill="#7fae84"><path d="M50 104 c-18 -6 -34 2 -42 12 c16 -4 30 -6 42 -12z"/><path d="M50 104 c4 -18 20 -26 34 -26 c-10 8 -20 16 -34 26z"/><path d="M50 104 c16 -8 34 -2 42 10 c-16 -4 -30 -6 -42 -10z"/><path d="M50 104 c-8 -16 -4 -32 6 -40 c-2 14 -2 26 -6 40z"/>
    <path d="M322 98 c18 -6 32 2 38 12 c-14 -4 -26 -6 -38 -12z"/><path d="M322 98 c-4 -16 -20 -24 -32 -24 c10 8 18 14 32 24z"/><path d="M322 98 c-14 -6 -30 0 -36 10 c14 -4 26 -6 36 -10z"/></g>
  <!-- little shop -->
  <g transform="translate(196 104)">
    <rect x="0" y="34" width="118" height="82" rx="6" fill="#f3e2c7"/>
    <path d="M-6 34 h130 l-8 -24 h-114z" fill="#3d7a5c"/>
    <g fill="#fff"><path d="M8 10 h12 l-3 24 h-14z"/><path d="M36 10 h12 l1 24 h-14z"/><path d="M64 10 h12 l5 24 h-14z"/><path d="M92 10 h12 l9 24 h-14z"/></g>
    <rect x="0" y="80" width="118" height="10" fill="#b98a5e"/><rect x="8" y="46" width="44" height="30" rx="3" fill="#fff8ec"/>
    <g fill="#e9a54a"><circle cx="18" cy="58" r="5"/><circle cx="30" cy="60" r="5"/><circle cx="42" cy="57" r="5"/></g>
    <rect x="72" y="44" width="34" height="36" rx="4" fill="#fff" stroke="#23302a" stroke-width="2"/>
    <g fill="#23302a"><rect x="77" y="49" width="8" height="8"/><rect x="93" y="49" width="8" height="8"/><rect x="77" y="66" width="8" height="8"/><rect x="88" y="60" width="4" height="4"/><rect x="94" y="66" width="6" height="3"/><rect x="95" y="71" width="3" height="5"/></g>
  </g>
  <!-- grandmother, holding her phone up to the QR -->
  <g transform="translate(118 112)">
    <path d="M14 150 C10 108 18 78 46 70 C74 78 84 108 80 150Z" fill="#e7b94a"/>
    <path d="M30 76 C46 92 58 120 62 150 L80 150 C84 108 74 78 46 70Z" fill="#c9553f"/>
    <path d="M24 92 c-10 10 -12 26 -6 36" stroke="#b9853c" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M66 86 C80 80 92 70 98 58" stroke="#e0a77f" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="90" y="30" width="18" height="30" rx="4" fill="#23302a" transform="rotate(14 99 45)"/>
    <rect x="93" y="34" width="12" height="20" rx="2" fill="#9fe0b8" transform="rotate(14 99 45)"/>
    <circle cx="46" cy="50" r="19" fill="#e0a77f"/>
    <path d="M27 48 a19 19 0 0 1 38 -4 c-6 -10 -30 -12 -38 4z" fill="#f4f1ec"/><circle cx="34" cy="34" r="9" fill="#f4f1ec"/>
    <path d="M50 50 q4 3 8 0" stroke="#7a4a33" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="44" cy="48" r="1.8" fill="#4a3226"/><circle cx="56" cy="47" r="1.8" fill="#4a3226"/>
    <path d="M46 57 q5 4 10 0" stroke="#a5523e" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="51" cy="44" r="1.4" fill="#c9553f"/>
  </g>
  <!-- the check: a green shield glowing over the phone -->
  <circle cx="230" cy="122" r="34" fill="url(#safe)"/>
  <g transform="translate(214 102)"><path d="M16 0 l16 6 v12 c0 10 -7 17 -16 20 c-9 -3 -16 -10 -16 -20 v-12z" fill="#2f8a5b"/><path d="M9 18 l5 5 l9 -10" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
  <!-- family, one tap away -->
  <g transform="translate(18 18)"><rect width="128" height="40" rx="20" fill="#fff" opacity=".92"/><circle cx="20" cy="20" r="13" fill="#eeebfb"/><path d="M14 26 c1 -5 4 -7 6 -7 s5 2 6 7" fill="#6d55c9"/><circle cx="20" cy="14" r="4" fill="#6d55c9"/>
    <path d="M44 15 h58 M44 25 h40" stroke="#c9c3e9" stroke-width="4" stroke-linecap="round"/><path d="M112 14 c-3 -4 -9 -1 -6 4 l6 6 l6 -6 c3 -5 -3 -8 -6 -4z" fill="#d0475a"/></g>
</svg>`;

// ---------- Welcome ----------
route('welcome', () => {
  if (!S().setupDone) store.update({ profile: normaliseProfile({ ...START_PROFILE, lang: P().lang }) });
  applySettings();
  render(`
    <section class="screen welcome">
      <div class="welcome-hero">${WELCOME_ART}<div class="brand-chip"><span class="logo" aria-hidden="true"></span>${esc(tr('app_name'))}</div></div>
      <div class="readable cover-copy">
        <h1 class="cover-title">${esc(tr('cover_title'))}</h1>
        <p class="cover-sub">${esc(tr('cover_sub'))}</p>
      </div>
      <div class="lang-list" role="radiogroup" aria-label="${esc(tr('choose_lang'))}">
        <p class="label">${icon('globe')} ${esc(tr('choose_lang'))}</p>
        ${Object.entries(LANGS).map(([code, l]) => `<button class="lang-row ${P().lang === code ? 'is-on' : ''}" role="radio" data-lang="${code}" aria-checked="${P().lang === code}" lang="${code}"><span class="grow">${esc(l.label)}</span><span class="lang-check">${icon('check')}</span></button>`).join('')}
      </div>
      <button class="btn big primary wide" id="start" data-next>${esc(tr('get_started'))}</button>
      ${canListen ? `<button class="btn big wide voice-start" id="by-voice">${icon('mic')}<span>${esc(tr('voice_setup'))}</span></button>` : ''}
    </section>`, { top: null, title: tr('app_name') });
  say(`${tr('cover_title')} ${tr('cover_sub')} ${tr('choose_lang')}.`);
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
