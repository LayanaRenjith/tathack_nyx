// Accessible setup: short tests instead of a form, so the app can measure needs and adapt.
// Starts in its most accessible form (large, spoken, one big button) and every step can be skipped.
// A family member can choose needs directly instead ("setting this up for someone else").

import { LANGS } from './i18n.js';
import * as store from './store.js';
import { deriveProfile, READING_SIZES, TOGGLES, normaliseProfile } from './profile.js';
import { speak, playTone, vibrate, BUZZ } from './speech.js';
import { route, go, render, on, esc, tr, P, applySettings, resetHistory } from './ui.js';

const TOTAL = 6;
let answers = {};

const say = (text) => speak(text, { lang: P().lang }); // setup always speaks: voice needs aren't known yet

function stepLabel(n) {
  return `<p class="step" aria-hidden="true">${esc(tr('step', { n, total: TOTAL }))}</p>`;
}

function skipRow(nextFn) {
  return `<button class="btn ghost" id="skip-step">${esc(tr('skip'))}</button>`;
}

// ---------- Welcome ----------
route('welcome', () => {
  answers = { lang: P().lang };
  store.updateProfile({ textScale: 1, contrast: false, bigTargets: true, dyslexiaFont: false, colourSafe: false, simple: false });
  applySettings();
  render(`
    <section class="screen welcome">
      <h1 class="brand">${esc(tr('app_name'))}</h1>
      <p class="tagline">${esc(tr('tagline'))}</p>
      <p class="readable">${esc(tr('welcome_intro'))}</p>
      <div class="row" role="group" aria-label="${esc(tr('language'))}">
        ${Object.entries(LANGS).map(([code, l]) => `
          <button class="btn chip ${P().lang === code ? 'is-on' : ''}" data-lang="${code}" aria-pressed="${P().lang === code}">${esc(l.label)}</button>`).join('')}
      </div>
      <button class="btn big primary" id="start" data-next>${esc(tr('start'))}</button>
      <button class="btn" id="someone">${esc(tr('for_someone'))}</button>
      <button class="btn ghost" id="skip-all">${esc(tr('skip_setup'))}</button>
    </section>`, { title: tr('app_name') });
  say(`${tr('app_name')}. ${tr('welcome_intro')}`);

  on('[data-lang]', 'click', (e) => {
    store.updateProfile({ lang: e.currentTarget.dataset.lang });
    applySettings();
    go('welcome');
  });
  on('#start', 'click', () => go('setup-reading'));
  on('#someone', 'click', () => go('setup-choose'));
  on('#skip-all', 'click', () => finish(deriveProfile({ lang: P().lang })));
});

// ---------- 1. Reading test ----------
route('setup-reading', () => {
  render(`
    <section class="screen">
      ${stepLabel(1)}
      <h1>${esc(tr('read_q'))}</h1>
      <div class="stack reading-test">
        ${[...READING_SIZES].map((px) => `
          <button class="btn read-line" data-px="${px}" style="font-size:${px}px">${esc(tr('read_sample'))}</button>`).join('')}
      </div>
      <button class="btn big" id="none">${esc(tr('read_none'))}</button>
      ${skipRow()}
    </section>`, { title: tr('read_q') });
  say(tr('read_q'));
  on('[data-px]', 'click', (e) => { answers.readingSize = Number(e.currentTarget.dataset.px); go('setup-colour'); });
  on('#none', 'click', () => { answers.readingSize = Infinity; go('setup-touch'); }); // colour test needs sight
  on('#skip-step', 'click', () => go('setup-colour'));
});

// ---------- 2. Colour test ----------
const CIRCLES = [
  { id: 'green', fill: '#2ca02c' },
  { id: 'red', fill: '#d62728' },
  { id: 'olive', fill: '#8a8a1e' },
  { id: 'blue', fill: '#1f77b4' },
];

route('setup-colour', () => {
  render(`
    <section class="screen">
      ${stepLabel(2)}
      <h1>${esc(tr('colour_q'))}</h1>
      <div class="colour-test">
        ${CIRCLES.map((c, i) => `
          <button class="dot" data-colour="${c.id}" aria-label="${esc(tr('colour_aria', { n: i + 1 }))}">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="${c.fill}"/></svg>
          </button>`).join('')}
      </div>
      <button class="btn" id="unsure">${esc(tr('not_sure'))}</button>
      ${skipRow()}
    </section>`, { title: tr('colour_q') });
  say(tr('colour_q'));
  on('[data-colour]', 'click', (e) => { answers.colourCorrect = e.currentTarget.dataset.colour === 'red'; go('setup-touch'); });
  on('#unsure', 'click', () => { answers.colourCorrect = false; go('setup-touch'); });
  on('#skip-step', 'click', () => go('setup-touch'));
});

// ---------- 3. Touch test ----------
const TARGETS = [{ x: 22, y: 22 }, { x: 74, y: 52 }, { x: 34, y: 80 }]; // % of the test area

route('setup-touch', () => {
  render(`
    <section class="screen">
      ${stepLabel(3)}
      <h1>${esc(tr('touch_q'))}</h1>
      <p class="lead" id="progress">${esc(tr('touch_progress', { n: 0 }))}</p>
      <div class="touch-area" id="area" role="application" aria-label="${esc(tr('touch_q'))}">
        <button class="target" id="target" aria-label="${esc(tr('touch_progress', { n: 1 }))}"></button>
      </div>
      ${skipRow()}
    </section>`, { title: tr('touch_q') });
  say(tr('touch_q'));

  const area = document.getElementById('area');
  const target = document.getElementById('target');
  const progress = document.getElementById('progress');
  let i = 0;
  let misses = 0;
  let doubles = 0;
  let lastHit = -Infinity;
  let waiting = false;

  const place = () => {
    target.style.left = `${TARGETS[i].x}%`;
    target.style.top = `${TARGETS[i].y}%`;
    target.setAttribute('aria-label', tr('touch_progress', { n: i + 1 }));
    target.hidden = false;
  };
  place();

  area.addEventListener('pointerdown', (e) => {
    const now = performance.now();
    if (e.target === target) {
      if (waiting) return;
      waiting = true;
      lastHit = now;
      vibrate(BUZZ.tick);
      i += 1;
      progress.textContent = tr('touch_progress', { n: i });
      target.hidden = true;
      if (i >= TARGETS.length) {
        setTimeout(() => { answers.touch = { misses, doubles }; go('setup-hearing'); }, 450);
        return;
      }
      setTimeout(() => { waiting = false; place(); }, 450);
    } else if (now - lastHit < 600) {
      doubles += 1; // a second tap right after a hit: tremor double tap
    } else {
      misses += 1;
    }
  });
  // Keyboard / screen-reader users activate with click and no pointer: count as clean taps.
  target.addEventListener('click', (e) => {
    if (e.pointerType || e.detail > 0) return;
    i += 1;
    progress.textContent = tr('touch_progress', { n: i });
    if (i >= TARGETS.length) { answers.touch = { misses, doubles }; go('setup-hearing'); } else place();
  });
  on('#skip-step', 'click', () => go('setup-hearing'));
});

// ---------- 4. Hearing check ----------
route('setup-hearing', () => {
  render(`
    <section class="screen">
      ${stepLabel(4)}
      <h1>${esc(tr('hear_q'))}</h1>
      <button class="btn big primary" id="play" data-next><span class="icon" aria-hidden="true">🔊</span>${esc(tr('play_sound'))}</button>
      <div id="answer" hidden>
        <h2>${esc(tr('heard_q'))}</h2>
        <div class="row">
          <button class="btn big" data-heard="yes">${esc(tr('yes'))}</button>
          <button class="btn big" data-heard="no">${esc(tr('no'))}</button>
        </div>
        <button class="btn" data-heard="unsure">${esc(tr('not_sure'))}</button>
      </div>
      ${skipRow()}
    </section>`, { title: tr('hear_q') });
  say(tr('hear_q'));
  on('#play', 'click', async () => {
    await playTone();
    document.getElementById('answer').hidden = false;
  });
  on('[data-heard]', 'click', (e) => {
    const v = e.currentTarget.dataset.heard;
    answers.heard = v === 'yes' ? true : v === 'no' ? false : null;
    go('setup-prefs');
  });
  on('#skip-step', 'click', () => go('setup-prefs'));
});

// ---------- 5. Preferences ----------
const PREFS = [
  { key: 'readingHard', q: 'pref_dyslexia' },
  { key: 'wantsSimple', q: 'pref_simple' },
  { key: 'prefersListening', q: 'pref_listen' },
];

route('setup-prefs', () => {
  render(`
    <section class="screen">
      ${stepLabel(5)}
      ${PREFS.map((p) => `
        <fieldset class="question">
          <legend>${esc(tr(p.q))}</legend>
          <div class="row">
            <button class="btn ${answers[p.key] === true ? 'is-on' : ''}" data-key="${p.key}" data-val="yes" aria-pressed="${answers[p.key] === true}">${esc(tr('yes'))}</button>
            <button class="btn ${answers[p.key] === false ? 'is-on' : ''}" data-key="${p.key}" data-val="no" aria-pressed="${answers[p.key] === false}">${esc(tr('no'))}</button>
          </div>
        </fieldset>`).join('')}
      <button class="btn big primary" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: tr('next') });
  say(PREFS.map((p) => tr(p.q)).join(' '));
  on('[data-key]', 'click', (e) => {
    const { key, val } = e.currentTarget.dataset;
    answers[key] = val === 'yes';
    e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => {
      const onNow = b === e.currentTarget;
      b.classList.toggle('is-on', onNow);
      b.setAttribute('aria-pressed', String(onNow));
    });
  });
  on('#next', 'click', () => go('setup-preview', deriveProfile(answers)));
});

// ---------- For someone else: choose needs directly ----------
const NEED_CHOICES = [
  { key: 'seeing', label: { en: 'Difficulty seeing or reading small text', ml: 'കാണാനോ ചെറിയ അക്ഷരം വായിക്കാനോ ബുദ്ധിമുട്ട്' } },
  { key: 'colour', label: { en: 'Difficulty telling colours apart', ml: 'നിറങ്ങൾ തിരിച്ചറിയാൻ ബുദ്ധിമുട്ട്' } },
  { key: 'reading', label: { en: 'Reading long text is hard', ml: 'നീണ്ട വാചകം വായിക്കാൻ ബുദ്ധിമുട്ട്' } },
  { key: 'tremor', label: { en: 'Hands shake or taps are imprecise', ml: 'കൈ വിറയ്ക്കും, കൃത്യമായി തൊടാൻ ബുദ്ധിമുട്ട്' } },
  { key: 'hearing', label: { en: 'Difficulty hearing', ml: 'കേൾക്കാൻ ബുദ്ധിമുട്ട്' } },
  { key: 'simple', label: { en: 'Needs simple, step-by-step screens', ml: 'ലളിതമായ, ഘട്ടം ഘട്ടമായ സ്ക്രീനുകൾ വേണം' } },
  { key: 'listen', label: { en: 'Prefers listening to reading', ml: 'വായിക്കുന്നതിനേക്കാൾ കേൾക്കാൻ ഇഷ്ടം' } },
];

route('setup-choose', () => {
  const picked = new Set();
  render(`
    <section class="screen">
      <h1>${esc(tr('for_someone'))}</h1>
      <div class="stack">
        ${NEED_CHOICES.map((c) => `
          <button class="btn big toggle" data-need="${c.key}" aria-pressed="false">
            <span class="check" aria-hidden="true"></span>${esc(c.label[P().lang] || c.label.en)}
          </button>`).join('')}
      </div>
      <button class="btn big primary" id="next" data-next>${esc(tr('next'))}</button>
    </section>`, { title: tr('for_someone') });
  on('[data-need]', 'click', (e) => {
    const k = e.currentTarget.dataset.need;
    if (picked.has(k)) picked.delete(k); else picked.add(k);
    e.currentTarget.setAttribute('aria-pressed', String(picked.has(k)));
  });
  on('#next', 'click', () => {
    go('setup-preview', deriveProfile({
      lang: P().lang,
      readingSize: picked.has('seeing') ? 30 : null,
      colourCorrect: picked.has('colour') ? false : null,
      readingHard: picked.has('reading'),
      touch: picked.has('tremor') ? { misses: 2, doubles: 1 } : null,
      heard: picked.has('hearing') ? false : null,
      wantsSimple: picked.has('simple'),
      prefersListening: picked.has('listen'),
    }));
  });
});

// ---------- 6. Preview: see the result, adjust, confirm ----------
route('setup-preview', (profile) => {
  let p = normaliseProfile(profile);
  const draw = () => {
    store.updateProfile(p);
    applySettings();
    render(`
      <section class="screen">
        ${stepLabel(6)}
        <h1>${esc(tr('preview_title'))}</h1>
        <p class="readable">${esc(tr('preview_intro'))}</p>
        <div class="card sample"><p>${esc(tr('preview_sample'))}</p><p class="amount-sample">₹250</p></div>
        ${settingsControls(p)}
        <button class="btn big primary" id="done" data-next>${esc(tr('looks_good'))}</button>
      </section>`, { title: tr('preview_title') });
    wireSettingsControls(p, (next) => { p = next; draw(); });
    on('#done', 'click', () => finish(p));
  };
  draw();
  const on_ = TOGGLES.filter((k) => p[k]).map((k) => tr(`opt_${k}`));
  say(`${tr('preview_intro')} ${on_.join(', ') || tr('nothing_on')}`);
});

function finish(profile) {
  store.update({ setupDone: true });
  store.updateProfile(profile);
  applySettings();
  resetHistory();
  go('home');
}

// ---------- Shared settings controls (used by preview and Settings) ----------
export function settingsControls(p) {
  return `
    <div class="control">
      <span id="ts-label">${esc(tr('text_size'))}</span>
      <div class="row stepper" role="group" aria-labelledby="ts-label">
        <button class="btn" data-scale="-0.1" aria-label="${esc(tr('text_size'))} −">A−</button>
        <output>${Math.round(p.textScale * 100)}%</output>
        <button class="btn" data-scale="0.1" aria-label="${esc(tr('text_size'))} +">A+</button>
      </div>
    </div>
    <div class="control">
      <span id="sp-label">${esc(tr('speech_speed'))}</span>
      <div class="row stepper" role="group" aria-labelledby="sp-label">
        <button class="btn" data-rate="-0.1" aria-label="${esc(tr('speech_speed'))} −">🐢</button>
        <output>${Math.round(p.speechRate * 100)}%</output>
        <button class="btn" data-rate="0.1" aria-label="${esc(tr('speech_speed'))} +">🐇</button>
      </div>
    </div>
    <div class="stack toggles">
      ${TOGGLES.map((k) => `
        <button class="btn toggle" data-toggle="${k}" aria-pressed="${p[k]}">
          <span class="check" aria-hidden="true"></span>${esc(tr(`opt_${k}`))}
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
    onChange({ ...p, [k]: !p[k] });
  });
}
