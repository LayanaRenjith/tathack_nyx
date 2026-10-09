// Sahaaya app shell: home, saved shops, settings, global voice commands, start-up.

import * as store from './store.js';
import { SAMPLE_SHOPS } from './demo-codes.js';
import { formatRupees } from './amount.js';
import { parseCommand } from './commands.js';
import { listenOnce, canListen, stopSpeaking, speak } from './speech.js';
import { route, go, back, render, on, esc, tr, P, announce, applySettings, screenHeader, wireHeader, readScreen, resetHistory } from './ui.js';
import { settingsControls, wireSettingsControls } from './setup.js';
import './pay.js';

// ---------- Home ----------
route('home', () => {
  const simple = P().simple;
  render(`
    <section class="screen">
      <header class="bar"><span class="brand small">${esc(tr('app_name'))}</span></header>
      <h1>${esc(tr('home_hello'))}</h1>
      <div class="stack home">
        <button class="btn big primary card-btn" id="pay" data-next>
          <span class="icon" aria-hidden="true">🛡️</span>
          <span><strong>${esc(tr('pay_safely'))}</strong>${simple ? '' : `<small>${esc(tr('pay_safely_sub'))}</small>`}</span>
        </button>
        <button class="btn big card-btn" id="shops">
          <span class="icon" aria-hidden="true">🏪</span>
          <span><strong>${esc(tr('my_shops'))}</strong>${simple ? '' : `<small>${esc(tr('my_shops_sub'))}</small>`}</span>
        </button>
        <button class="btn big card-btn" id="settings">
          <span class="icon" aria-hidden="true">⚙️</span>
          <span><strong>${esc(tr('settings'))}</strong>${simple ? '' : `<small>${esc(tr('settings_sub'))}</small>`}</span>
        </button>
      </div>
    </section>`, { title: tr('home_hello') });
  announce(`${tr('home_hello')} ${tr('pay_safely')}. ${tr('my_shops')}. ${tr('settings')}.`);
  on('#pay', 'click', () => go('pay'));
  on('#shops', 'click', () => go('shops'));
  on('#settings', 'click', () => go('settings'));
});

// ---------- My shops ----------
route('shops', () => {
  const shops = store.get().savedShops;
  render(`
    <section class="screen">
      ${screenHeader(tr('my_shops'))}
      ${shops.length ? `<ul class="shop-list">${shops.map((s, i) => `
        <li class="card">
          <p class="shop-name">${esc(s.name)}</p>
          <p class="vpa">${esc(s.vpa)}</p>
          ${s.usualAmount ? `<p class="hint">${esc(tr('usual', { amount: formatRupees(s.usualAmount) }))}</p>` : ''}
          <div class="row">
            <button class="btn primary" data-pay="${i}" ${i === 0 ? 'data-next' : ''}>${esc(tr('pay_this_shop', { shop: s.name }))}</button>
            <button class="btn" data-remove="${i}" aria-label="${esc(`${tr('remove')}: ${s.name}`)}">${esc(tr('remove'))}</button>
          </div>
        </li>`).join('')}</ul>` : `<p class="readable">${esc(tr('shops_empty'))}</p>`}
    </section>`, { title: tr('my_shops') });
  wireHeader();
  announce(shops.length ? shops.map((s) => s.name).join(', ') : tr('shops_empty'));
  on('[data-pay]', 'click', (e) => go('pay', { shop: shops[Number(e.currentTarget.dataset.pay)].name }));
  on('[data-remove]', 'click', (e) => {
    store.removeShop(shops[Number(e.currentTarget.dataset.remove)].vpa);
    announce(tr('removed'));
    go('shops');
  });
});

// ---------- Settings ----------
route('settings', () => {
  const p = P();
  render(`
    <section class="screen">
      ${screenHeader(tr('settings'))}
      <div class="control">
        <span id="lang-label">${esc(tr('language'))}</span>
        <div class="row" role="group" aria-labelledby="lang-label">
          <button class="btn chip ${p.lang === 'ml' ? 'is-on' : ''}" data-lang="ml" aria-pressed="${p.lang === 'ml'}">മലയാളം</button>
          <button class="btn chip ${p.lang === 'en' ? 'is-on' : ''}" data-lang="en" aria-pressed="${p.lang === 'en'}">English</button>
        </div>
      </div>
      ${settingsControls(p)}
      <hr>
      <button class="btn" id="redo">${esc(tr('redo_setup'))}</button>
      <button class="btn" id="samples">${esc(tr('sample_shops'))}</button>
      <button class="btn danger-outline" id="reset">${esc(tr('reset_all'))}</button>
    </section>`, { title: tr('settings') });
  wireHeader();
  wireSettingsControls(p, (next) => { store.updateProfile(next); applySettings(); go('settings'); });
  on('[data-lang]', 'click', (e) => { store.updateProfile({ lang: e.currentTarget.dataset.lang }); applySettings(); go('settings'); });
  on('#redo', 'click', () => { resetHistory(); go('welcome'); });
  on('#samples', 'click', () => {
    [...SAMPLE_SHOPS].reverse().forEach((s) => store.saveShop(s));
    announce(tr('samples_added'), { force: true });
  });
  on('#reset', 'click', () => {
    if (!window.confirm(tr('reset_confirm'))) return;
    store.reset();
    applySettings();
    resetHistory();
    go('welcome');
  });
});

// ---------- Global voice commands ----------
function adjust(patch) { store.updateProfile(patch); applySettings(); }

async function voiceCommand() {
  const btn = document.getElementById('voice-btn');
  if (!canListen) { announce(tr('no_listen'), { force: true }); return; }
  stopSpeaking();
  btn.classList.add('is-listening');
  btn.setAttribute('aria-label', tr('listening'));
  const heard = await listenOnce({ lang: P().lang });
  btn.classList.remove('is-listening');
  btn.setAttribute('aria-label', tr('voice_btn'));
  const cmd = parseCommand(heard);
  const p = P();
  switch (cmd) {
    case 'pay': go('pay'); break;
    case 'read': readScreen(); break;
    case 'bigger': adjust({ textScale: Math.min(2.2, Math.round((p.textScale + 0.2) * 10) / 10) }); break;
    case 'smaller': adjust({ textScale: Math.max(0.9, Math.round((p.textScale - 0.2) * 10) / 10) }); break;
    case 'slower': adjust({ speechRate: Math.max(0.6, Math.round((p.speechRate - 0.15) * 100) / 100) }); speak(tr('speech_speed')); break;
    case 'faster': adjust({ speechRate: Math.min(1.4, Math.round((p.speechRate + 0.15) * 100) / 100) }); speak(tr('speech_speed')); break;
    case 'back': back(); break;
    case 'home': resetHistory(); go('home'); break;
    case 'settings': go('settings'); break;
    case 'shops': go('shops'); break;
    case 'stop': stopSpeaking(); break;
    default: announce(tr('not_understood'), { force: true });
  }
}

// ---------- Start ----------
applySettings();
const vb = document.getElementById('voice-btn');
vb.setAttribute('aria-label', tr('voice_btn'));
vb.addEventListener('click', voiceCommand);
go(store.get().setupDone ? 'home' : 'welcome');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
