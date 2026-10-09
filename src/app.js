// Sahaaya app shell: My shops, Settings, voice commands, start-up.

import * as store from './store.js';
import { SAMPLE_SHOPS } from './demo-codes.js';
import { formatRupees } from './amount.js';
import { parseCommand } from './commands.js';
import { PAY_APPS, buildUpiLink, appLink } from './upi.js';
import { listenOnce, canListen, stopSpeaking, speak } from './speech.js';
import { route, go, back, goHome, render, on, esc, tr, P, announce, applySettings, readScreen, startTapWatching, rerender } from './ui.js';
import { settingsControls, wireSettingsControls } from './setup.js';
import './pay.js';

// ---------- My shops ----------
route('shops', () => {
  const shops = store.get().savedShops;
  render(`
    <section class="screen">
      <h1>${esc(tr('my_shops'))}</h1>
      ${shops.length ? `<ul class="shop-list">${shops.map((s, i) => `
        <li class="shop">
          <span class="shop-icon" aria-hidden="true">🏪</span>
          <div class="grow">
            <p class="shop-name">${esc(s.name)}</p>
            <p class="vpa">${esc(s.vpa)}</p>${s.usualAmount ? `<p class="muted">${esc(tr('usual', { amount: formatRupees(s.usualAmount) }))}</p>` : ''}
          </div>
          <button class="btn small" data-remove="${i}" aria-label="${esc(`${tr('remove')}: ${s.name}`)}">${esc(tr('remove'))}</button>
        </li>`).join('')}</ul>` : `<p class="readable muted">${esc(tr('shops_empty'))}</p>`}
      <button class="btn big primary" id="add" data-next><span class="emoji" aria-hidden="true">📷</span>${esc(tr('add_shop'))}</button>
    </section>`, { bar: 'back', title: tr('my_shops') });
  announce(shops.length ? shops.map((s) => s.name).join(', ') : tr('shops_empty'));
  on('#add', 'click', () => go('add-shop', 'shops'));
  on('[data-remove]', 'click', (e) => {
    store.removeShop(shops[Number(e.currentTarget.dataset.remove)].vpa);
    announce(tr('removed'));
    go('shops');
  });
});

// ---------- Settings ----------
route('settings', () => {
  const p = P();
  const appLabel = p.payApp === 'any' ? tr('any_app') : PAY_APPS[p.payApp].label;
  render(`
    <section class="screen">
      <h1>${esc(tr('settings'))}</h1>
      <div class="control">
        <span class="label" id="lang-label">${esc(tr('language'))}</span>
        <div class="seg" role="group" aria-labelledby="lang-label">
          <button class="btn" data-lang="ml" aria-pressed="${p.lang === 'ml'}">മലയാളം</button>
          <button class="btn" data-lang="en" aria-pressed="${p.lang === 'en'}">English</button>
        </div>
      </div>
      <div class="control">
        <span class="label" id="app-label">${esc(tr('payment_app'))}</span>
        <div class="seg wrap" role="group" aria-labelledby="app-label">
          ${Object.entries(PAY_APPS).map(([k, a]) => `<button class="btn" data-app="${k}" aria-pressed="${p.payApp === k}">${esc(k === 'any' ? tr('app_any') : a.label)}</button>`).join('')}
        </div>
      </div>
      ${settingsControls(p)}
      <details class="panel">
        <summary>${esc(tr('test_payment'))}</summary>
        <p class="hint">${esc(tr('test_payment_hint', { app: appLabel }))}</p>
        <label for="vpa">${esc(tr('test_vpa_label'))}</label>
        <input id="vpa" class="field" autocomplete="off" placeholder="name@okaxis">
        <button class="btn" id="test">${esc(tr('test_go', { app: appLabel }))}</button>
      </details>
      <div class="stack tight">
        <button class="btn" id="redo">${esc(tr('redo_setup'))}</button>
        <button class="btn" id="samples">${esc(tr('sample_shops'))}</button>
        <button class="btn danger-outline" id="reset">${esc(tr('reset_all'))}</button>
      </div>
    </section>`, { bar: 'back', title: tr('settings') });
  wireSettingsControls(p, (next) => { store.updateProfile(next); applySettings(); refresh(); });
  on('[data-lang]', 'click', (e) => { store.updateProfile({ lang: e.currentTarget.dataset.lang }); applySettings(); refresh(); });
  on('[data-app]', 'click', (e) => { store.updateProfile({ payApp: e.currentTarget.dataset.app }); refresh(); });
  on('#test', 'click', () => {
    const vpa = document.getElementById('vpa').value.trim();
    if (!vpa.includes('@')) { document.getElementById('vpa').focus(); return; }
    window.location.href = appLink(buildUpiLink({ payeeVpa: vpa, payeeName: 'Sahaaya test', amount: 1, note: 'Sahaaya test' }), P().payApp);
  });
  on('#redo', 'click', () => go('welcome'));
  on('#samples', 'click', () => { SAMPLE_SHOPS.forEach((s) => store.saveShop(s)); announce(tr('samples_added'), { force: true }); });
  on('#reset', 'click', () => {
    if (!window.confirm(tr('reset_confirm'))) return;
    store.reset();
    applySettings();
    go('welcome');
  });
});

const refresh = () => rerender();

// ---------- Voice commands ----------
function adjust(patch) { store.updateProfile(patch); applySettings(); }

window.addEventListener('sahaaya:voice', async () => {
  if (!canListen) { announce(tr('no_listen'), { force: true }); return; }
  stopSpeaking();
  const btn = document.querySelector('[data-bar="voice"]');
  btn?.classList.add('is-listening');
  const heard = await listenOnce({ lang: P().lang });
  btn?.classList.remove('is-listening');
  const p = P();
  switch (parseCommand(heard)) {
    case 'pay': case 'home': goHome(); break;
    case 'read': readScreen(); break;
    case 'bigger': adjust({ textScale: Math.min(2.2, Math.round((p.textScale + 0.2) * 10) / 10) }); break;
    case 'smaller': adjust({ textScale: Math.max(0.9, Math.round((p.textScale - 0.2) * 10) / 10) }); break;
    case 'slower': adjust({ speechRate: Math.max(0.6, Math.round((p.speechRate - 0.15) * 100) / 100) }); speak(tr('speech_speed')); break;
    case 'faster': adjust({ speechRate: Math.min(1.4, Math.round((p.speechRate + 0.15) * 100) / 100) }); speak(tr('speech_speed')); break;
    case 'back': back(); break;
    case 'settings': go('settings'); break;
    case 'shops': go('shops'); break;
    case 'stop': stopSpeaking(); break;
    default: announce(tr('not_understood'), { force: true });
  }
});

// ---------- Start ----------
applySettings();
startTapWatching();
if (store.get().setupDone) goHome(); else go('welcome');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
