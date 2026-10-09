// One-time setup, usually done by a family member: language, who uses the phone, needs in plain
// words, payment app, a live preview, then the regular shops. No tests, no diagnoses, every step skippable.

import { LANGS } from './i18n.js';
import * as store from './store.js';
import { deriveProfile, NEEDS, TOGGLES, START_PROFILE, normaliseProfile } from './profile.js';
import { PAY_APPS } from './upi.js';
import { speak } from './speech.js';
import { route, go, goHome, render, on, esc, tr, P, applySettings } from './ui.js';

let draft = { family: false, needs: [], payApp: 'any' };
const say = (text) => speak(text, { lang: P().lang }); // setup always speaks: needs aren't known yet

function dots(n) {
  return `<p class="progress" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</p>`;
}

// ---------- 1. Language (spoken in both languages) ----------
route('welcome', () => {
  draft = { family: false, needs: [], payApp: 'any' };
  store.update({ profile: normaliseProfile({ ...START_PROFILE, lang: P().lang }) });
  applySettings();
  render(`
    <section class="screen hero">
      <div class="hero-mark" aria-hidden="true"></div>
      <h1 class="hero-title">സഹായ · Sahaaya</h1>
      <p class="hero-sub">${esc(tr('tagline'))}</p>
      <div class="stack">
        ${Object.entries(LANGS).map(([code, l]) => `
          <button class="btn big ${code === 'ml' ? 'primary' : ''}" data-lang="${code}" ${code === 'ml' ? 'data-next' : ''}>${esc(l.label)}</button>`).join('')}
      </div>
    </section>`);
  speak('ഭാഷ തിരഞ്ഞെടുക്കൂ. മലയാളം.', { lang: 'ml' }).then(() => speak('Choose a language. English.', { lang: 'en', interrupt: false }));
  on('[data-lang]', 'click', (e) => {
    store.updateProfile({ lang: e.currentTarget.dataset.lang });
    applySettings();
    go('setup-who');
  });
});

// ---------- 2. Who will use the phone ----------
route('setup-who', () => {
  render(`
    <section class="screen">
      ${dots(1)}
      <h1>${esc(tr('who_q'))}</h1>
      <div class="stack">
        <button class="btn big choice" data-who="me" data-next><span class="emoji" aria-hidden="true">🙂</span>${esc(tr('who_me'))}</button>
        <button class="btn big choice" data-who="family"><span class="emoji" aria-hidden="true">🤝</span>${esc(tr('who_family'))}</button>
      </div>
    </section>`, { title: tr('who_q') });
  say(`${tr('who_q')} ${tr('who_me')}. ${tr('who_family')}`);
  on('[data-who]', 'click', (e) => { draft.family = e.currentTarget.dataset.who === 'family'; go('setup-needs'); });
});

// ---------- 3. Needs, in plain words ----------
const NEED_ICON = { seeing: '👓', reading: '📖', colour: '🎨', hands: '✋', hearing: '👂', simple: '🌱', listen: '🔊' };

route('setup-needs', () => {
  const picked = new Set(draft.needs);
  const q = draft.family ? tr('needs_q_family') : tr('needs_q_me');
  render(`
    <section class="screen">
      ${dots(2)}
      <h1>${esc(q)}</h1>
      <p class="muted">${esc(tr('needs_hint'))}</p>
      <div class="stack" role="group" aria-label="${esc(q)}">
        ${NEEDS.map((n) => `
          <button class="btn toggle need" data-need="${n}" aria-pressed="${picked.has(n)}">
            <span class="emoji" aria-hidden="true">${NEED_ICON[n]}</span><span class="grow">${esc(tr(`need_${n}`))}</span><span class="check" aria-hidden="true"></span>
          </button>`).join('')}
      </div>
      <button class="btn big primary" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: q });
  say(`${q} ${NEEDS.map((n) => tr(`need_${n}`)).join('. ')}`);
  on('[data-need]', 'click', (e) => {
    const n = e.currentTarget.dataset.need;
    if (picked.has(n)) picked.delete(n); else picked.add(n);
    e.currentTarget.setAttribute('aria-pressed', String(picked.has(n)));
    if (P().voice) speak(tr(`need_${n}`));
  });
  on('#next', 'click', () => { draft.needs = [...picked]; go('setup-app'); });
});

// ---------- 4. Payment app ----------
route('setup-app', () => {
  render(`
    <section class="screen">
      ${dots(3)}
      <h1>${esc(tr('app_q'))}</h1>
      <div class="stack">
        ${Object.entries(PAY_APPS).filter(([k]) => k !== 'any').map(([k, a]) => `
          <button class="btn big choice" data-app="${k}" ${k === 'gpay' ? 'data-next' : ''}>${esc(a.label)}</button>`).join('')}
        <button class="btn choice" data-app="any">${esc(tr('app_any'))}</button>
      </div>
    </section>`, { title: tr('app_q') });
  say(tr('app_q'));
  on('[data-app]', 'click', (e) => {
    draft.payApp = e.currentTarget.dataset.app;
    go('setup-preview', deriveProfile({ lang: P().lang, needs: draft.needs, payApp: draft.payApp }));
  });
});

// ---------- 5. Live preview ----------
route('setup-preview', (profile) => {
  let p = normaliseProfile(profile);
  const draw = () => {
    const y = window.scrollY;
    store.updateProfile(p);
    applySettings();
    render(`
      <section class="screen">
        ${dots(4)}
        <h1>${esc(tr('preview_title'))}</h1>
        <p class="muted">${esc(tr('preview_intro'))}</p>
        <div class="status-card ok preview" aria-hidden="true">
          <span class="status-icon">✓</span>
          <div><p class="status-title">${esc(tr('preview_sample'))}</p><p class="status-sub">${esc(tr('preview_sample_sub'))}</p></div>
        </div>
        ${settingsControls(p)}
        <button class="btn big primary" id="done" data-next>${esc(tr('looks_good'))}</button>
      </section>`, { title: tr('preview_title') });
    wireSettingsControls(p, (next) => { p = next; draw(); });
    on('#done', 'click', () => go('setup-shops'));
    window.scrollTo(0, y);
  };
  draw();
  say(tr('preview_title'));
});

// ---------- 6. Regular shops ----------
route('setup-shops', () => {
  const shops = store.get().savedShops;
  render(`
    <section class="screen">
      ${dots(5)}
      <h1>${esc(tr('shops_setup_title'))}</h1>
      <p class="readable">${esc(tr('shops_setup_intro'))}</p>
      ${shops.length ? `<ul class="list">${shops.map((s) => `<li><span aria-hidden="true">🏪</span> ${esc(s.name)}</li>`).join('')}</ul>` : ''}
      <button class="btn big ${shops.length ? '' : 'primary'}" id="scan" ${shops.length ? '' : 'data-next'}><span class="emoji" aria-hidden="true">📷</span>${esc(tr('scan_shop'))}</button>
      <button class="btn big ${shops.length ? 'primary' : ''}" id="finish" ${shops.length ? 'data-next' : ''}>${esc(shops.length ? tr('finish') : tr('later'))}</button>
    </section>`, { title: tr('shops_setup_title') });
  say(`${tr('shops_setup_title')}. ${tr('shops_setup_intro')}`);
  on('#scan', 'click', () => go('add-shop', 'setup-shops'));
  on('#finish', 'click', () => { store.update({ setupDone: true }); goHome(); });
});

// ---------- Settings controls shared with the Settings screen ----------
export function settingsControls(p) {
  return `
    <div class="control">
      <span class="label" id="ts-label">${esc(tr('text_size'))}</span>
      <div class="stepper" role="group" aria-labelledby="ts-label">
        <button class="btn" data-scale="-0.1" aria-label="${esc(tr('text_size'))} −">A−</button>
        <output>${Math.round(p.textScale * 100)}%</output>
        <button class="btn" data-scale="0.1" aria-label="${esc(tr('text_size'))} +">A+</button>
      </div>
    </div>
    <div class="control">
      <span class="label" id="sp-label">${esc(tr('speech_speed'))}</span>
      <div class="stepper" role="group" aria-labelledby="sp-label">
        <button class="btn" data-rate="-0.1" aria-label="${esc(tr('speech_speed'))} −">🐢</button>
        <output>${Math.round(p.speechRate * 100)}%</output>
        <button class="btn" data-rate="0.1" aria-label="${esc(tr('speech_speed'))} +">🐇</button>
      </div>
    </div>
    <div class="stack tight">
      ${TOGGLES.map((k) => `
        <button class="btn toggle" data-toggle="${k}" aria-pressed="${p[k]}">
          <span class="grow">${esc(tr(`opt_${k}`))}</span><span class="check" aria-hidden="true"></span>
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
  on('[data-toggle]', 'click', (e) => onChange({ ...p, [e.currentTarget.dataset.toggle]: !p[e.currentTarget.dataset.toggle] }));
}

export { goHome };
