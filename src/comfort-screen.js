// "Find what feels comfortable" screens. Every step can be skipped; nothing changes until the
// person (or their helper) confirms the summary. Leaving early keeps the current settings.

import * as store from './store.js';
import { suggestFromComfort, changesFrom } from './comfort.js';
import { playTone, vibrate, canVibrate } from './speech.js';
import { icon } from './icons.js';
import { route, render, on, esc, tr, P, applySettings, back, goHome, announce, showToast } from './ui.js';

const STEPS = ['button', 'text', 'guidance', 'alerts', 'tap', 'summary'];
let answers = {};
let after = 'home';

const frame = (i, body) => `
  <section class="screen comfort">
    <div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS.length}" aria-valuenow="${i + 1}"><span style="width:${((i + 1) / STEPS.length) * 100}%"></span></div>
    <p class="muted">${esc(tr('cf_step', { n: i + 1, total: STEPS.length }))}</p>
    ${body}
    ${i < STEPS.length - 1 ? `<button class="btn ghost wide" id="skip">${esc(tr('skip'))}</button>` : ''}
  </section>`;

function step(i) {
  const next = () => step(i + 1);
  const name = STEPS[i];
  const opts = { title: tr('cf_title'), top: 'back' };

  if (name === 'button') {
    render(frame(i, `
      <h1>${esc(tr('cf_button_q'))}</h1>
      <div class="stack tight">
        <button class="btn wide cf-normal" data-a="normal">${esc(tr('cf_this_one'))}</button>
        <button class="btn big wide cf-large" data-a="large">${esc(tr('cf_this_one'))}</button>
        <button class="btn big wide cf-xlarge" data-a="xlarge">${esc(tr('cf_this_one'))}</button>
      </div>`), opts);
    announce(tr('cf_button_q'));
    on('[data-a]', 'click', (e) => { answers.button = e.currentTarget.dataset.a; next(); });
  }

  if (name === 'text') {
    const sizes = [1, 1.3, 1.6];
    render(frame(i, `
      <h1>${esc(tr('cf_text_q'))}</h1>
      <div class="stack tight">
        ${sizes.map((z) => `<button class="sample-text" data-z="${z}" style="font-size:calc(19px * ${z})">${esc(tr('cf_sample'))}</button>`).join('')}
        <button class="sample-text contrast-sample" data-z="1.3" data-contrast="1" style="font-size:calc(19px * 1.3)">${esc(tr('cf_sample'))}</button>
      </div>`), opts);
    announce(tr('cf_text_q'));
    on('[data-z]', 'click', (e) => { answers.text = Number(e.currentTarget.dataset.z); answers.contrast = Boolean(e.currentTarget.dataset.contrast); next(); });
  }

  if (name === 'guidance') {
    render(frame(i, `
      <h1>${esc(tr('cf_guide_q'))}</h1>
      <p class="muted">${esc(tr('cf_guide_hint'))}</p>
      <button class="btn wide" id="hear">${icon('speaker')}<span>${esc(tr('cf_hear_example'))}</span></button>
      <div class="stack tight">
        <button class="option-card tone-blue" data-g="visual">${icon('eye')}<span class="grow">${esc(tr('cf_g_visual'))}</span></button>
        <button class="option-card tone-purple" data-g="spoken">${icon('speaker')}<span class="grow">${esc(tr('cf_g_spoken'))}</span></button>
        <button class="option-card tone-green" data-g="both">${icon('check')}<span class="grow">${esc(tr('cf_g_both'))}</span></button>
      </div>`), opts);
    // Nothing is said until they ask for the example.
    on('#hear', 'click', () => import('./speech.js').then((m) => m.speak(tr('cf_example'))));
    on('[data-g]', 'click', (e) => { answers.guidance = e.currentTarget.dataset.g; next(); });
  }

  if (name === 'alerts') {
    const picked = new Set(['visual']);
    render(frame(i, `
      <h1>${esc(tr('cf_alerts_q'))}</h1>
      <p class="muted">${esc(tr('cf_alerts_hint'))}</p>
      <div class="row tight-row">
        <button class="btn wide" id="t-sound">${icon('speaker')}<span>${esc(tr('cf_try_sound'))}</span></button>
        ${canVibrate() ? `<button class="btn wide" id="t-buzz">${icon('phone')}<span>${esc(tr('cf_try_buzz'))}</span></button>` : ''}
        <button class="btn wide" id="t-flash">${icon('eye')}<span>${esc(tr('cf_try_flash'))}</span></button>
      </div>
      <div class="stack tight" role="group" aria-label="${esc(tr('cf_alerts_q'))}">
        ${[['sound', 'speaker', 'cf_a_sound'], ['vibration', 'phone', 'cf_a_buzz'], ['visual', 'eye', 'cf_a_visual']].map(([k, ic, label]) => `
          <button class="need-card tone-green" data-al="${k}" aria-pressed="${picked.has(k)}"><span class="badge">${icon(ic)}</span><span class="grow">${esc(tr(label))}</span><span class="tick" aria-hidden="true">${icon('check')}</span></button>`).join('')}
      </div>
      <p class="hint">${esc(tr('cf_alerts_always'))}</p>
      <button class="btn big primary wide" id="next" data-next>${esc(tr('next'))}</button>`), opts);
    on('#t-sound', 'click', () => playTone({ ms: 300, hz: 784, volume: 0.2 }));
    on('#t-buzz', 'click', () => { if (!vibrate([200])) showToast(tr('cf_no_buzz')); });
    on('#t-flash', 'click', () => { document.body.classList.remove('flash'); void document.body.offsetWidth; document.body.classList.add('flash'); });
    on('[data-al]', 'click', (e) => {
      const k = e.currentTarget.dataset.al;
      if (picked.has(k)) picked.delete(k); else picked.add(k);
      e.currentTarget.setAttribute('aria-pressed', String(picked.has(k)));
    });
    on('#next', 'click', () => { answers.alerts = [...picked]; next(); });
  }

  if (name === 'tap') {
    const target = ['1', '2', '3'];
    let pos = 0;
    let misses = 0;
    render(frame(i, `
      <h1>${esc(tr('cf_tap_q'))}</h1>
      <p class="cf-target" aria-live="polite">${esc(tr('cf_tap_now', { n: target[0] }))}</p>
      <div class="keypad cf-pad">${['1', '2', '3', '4', '5', '6'].map((k) => `<button class="key" data-k="${k}">${k}</button>`).join('')}</div>
      <div class="stack tight" id="tap-ask" hidden>
        <p class="label">${esc(tr('cf_tap_ok_q'))}</p>
        <div class="row"><button class="btn big wide" data-easy="0">${esc(tr('cf_hard'))}</button><button class="btn big wide primary" data-easy="1">${esc(tr('cf_easy'))}</button></div>
      </div>`), opts);
    on('[data-k]', 'click', (e) => {
      if (pos >= target.length) return;
      if (e.currentTarget.dataset.k === target[pos]) pos += 1; else misses += 1;
      document.querySelector('.cf-target').textContent = pos < target.length ? tr('cf_tap_now', { n: target[pos] }) : tr('cf_tap_done');
      if (pos >= target.length) document.getElementById('tap-ask').hidden = false;
    });
    on('[data-easy]', 'click', (e) => { answers.misses = e.currentTarget.dataset.easy === '1' ? misses : Math.max(misses, 2); next(); });
  }

  if (name === 'summary') {
    const base = P();
    const sug = suggestFromComfort(answers, base);
    const changes = changesFrom(sug, base);
    const label = (k) => ({
      textScale: `${tr('text_size')}: ${Math.round(sug.textScale * 100)}%`,
      contrast: tr('opt_contrast'), bigTargets: tr('opt_bigTargets'), tremorSafe: tr('opt_tremorSafe'), simple: tr('opt_simple'),
      voice: tr('opt_voice'), silent: tr('opt_silent'), sounds: tr('opt_sounds'), haptics: tr('opt_haptics'), visualAlerts: tr('opt_visualAlerts'),
    }[k]);
    render(frame(i, `
      <h1>${esc(tr('cf_summary'))}</h1>
      ${changes.length ? `<p class="muted">${esc(tr('cf_summary_hint'))}</p>
      <div class="toggle-list">${changes.map((k) => k === 'textScale'
        ? `<div class="toggle-row"><span class="grow">${esc(label(k))}</span></div>`
        : `<button class="toggle-row" role="switch" data-k="${k}" aria-checked="${Boolean(sug[k])}"><span class="grow">${esc(label(k))}</span><span class="switch" aria-hidden="true"><span></span></span></button>`).join('')}</div>`
      : `<p class="note info-note">${icon('check')}<span>${esc(tr('cf_no_changes'))}</span></p>`}
      <button class="btn big primary wide" id="apply" data-next>${esc(tr('cf_apply'))}</button>
      <button class="btn wide" id="keep">${esc(tr('cf_keep'))}</button>`), opts);
    announce(tr('cf_summary'));
    on('[data-k]', 'click', (e) => {
      const k = e.currentTarget.dataset.k;
      sug[k] = !sug[k];
      e.currentTarget.setAttribute('aria-checked', String(sug[k]));
    });
    const finish = () => { answers = {}; if (after === 'back') back(); else goHome(); };
    on('#apply', 'click', () => {
      const patch = Object.fromEntries(changes.map((k) => [k, sug[k]]));
      store.updateProfile(patch);
      applySettings();
      announce(tr('saved'));
      finish();
    });
    on('#keep', 'click', finish);
  }

  on('#skip', 'click', next);
}

route('comfort', (returnTo = 'home') => {
  answers = {};
  after = returnTo;
  render(`
    <section class="screen center comfort">
      <div class="hero-icon tone-green">${icon('sliders')}</div>
      <h1>${esc(tr('cf_title'))}</h1>
      <p class="readable muted">${esc(tr('cf_intro'))}</p>
      <button class="btn big primary wide" id="start" data-next>${esc(tr('cf_start'))}</button>
      <button class="btn wide" id="no">${esc(tr('later'))}</button>
    </section>`, { title: tr('cf_title') });
  announce(`${tr('cf_title')}. ${tr('cf_intro')}`);
  on('#start', 'click', () => step(0));
  on('#no', 'click', () => (returnTo === 'back' ? back() : goHome()));
});
