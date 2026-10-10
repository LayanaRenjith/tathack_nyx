// Practice without consequences: the whole app on pretend data. Pretend shops, a pretend helper
// (you can play the helper yourself), pretend history. No payment app opens, no WhatsApp, SMS or call
// is made, and the real shops, helper and settings are left exactly as they were.

import * as store from './store.js';
import { practiceSeed, linkKind, PRACTICE_PIN } from './practice-core.js';
import { icon } from './icons.js';
import { route, render, on, esc, tr, S, go, goHome, replace, announce, applySettings, showToast } from './ui.js';

document.addEventListener('click', (e) => {
  if (!store.isPractice()) return;
  const a = e.target.closest?.('a[href]');
  const kind = a && linkKind(a.getAttribute('href'));
  if (!kind) return;
  e.preventDefault();
  e.stopPropagation();
  showToast(tr('px_link_blocked', { what: tr(kind) }));
}, true);

export async function startPractice() {
  const seed = await practiceSeed(store.get(), { helperName: tr('px_helper_name'), youName: tr('px_you') });
  store.enterPractice(seed);
  applySettings();
  goHome();
  announce(tr('px_started'), { force: true });
}

export function stopPractice() {
  store.exitPractice();
  applySettings();
  if (S().setupDone) goHome(); else replace('welcome'); // tried it before setting up
  announce(tr('px_exited'), { force: true });
}

route('practice', () => {
  render(`
    <section class="screen center practice-intro">
      <div class="hero-icon tone-amber">${icon('sprout')}</div>
      <h1>${esc(tr('px_title'))}</h1>
      <p class="readable muted">${esc(tr('px_intro'))}</p>
      <ul class="promise">
        <li class="tone-green">${icon('store')}<span>${esc(tr('px_point_shops'))}</span></li>
        <li class="tone-purple">${icon('family')}<span>${esc(tr('px_point_helper', { name: tr('px_helper_name'), pin: PRACTICE_PIN }))}</span></li>
        <li class="tone-red-soft">${icon('lock')}<span>${esc(tr('px_point_safe'))}</span></li>
      </ul>
      <button class="btn big primary wide" id="start" data-next>${esc(tr('px_start'))}</button>
      <button class="btn wide" id="no">${esc(tr('later'))}</button>
    </section>`, { title: tr('px_title') });
  announce(`${tr('px_title')}. ${tr('px_intro')}`);
  on('#start', 'click', startPractice);
  on('#no', 'click', () => (S().setupDone ? goHome() : replace('welcome')));
});

// The end of a practice payment: instead of opening the UPI app.
route('practice-done', (shop, amount, app) => {
  render(`
    <section class="screen">
      <div class="result-card info"><span class="result-icon">${icon('sprout')}</span>
        <div class="readable"><p class="result-title">${esc(tr('px_end_title'))}</p><p class="result-sub">${esc(tr('px_end_sub', { app }))}</p></div>
      </div>
      <div class="summary"><p class="amount center">${esc(amount)}</p><p class="center muted">${esc(shop)}</p></div>
      <p class="note info-note">${icon('lock')}<span>${esc(tr('pin_note', { app }))}</span></p>
      <button class="btn big primary wide" id="again" data-next>${icon('scan')}<span>${esc(tr('px_again'))}</span></button>
      <button class="btn wide" id="home">${esc(tr('home'))}</button>
      <button class="btn wide" id="exit">${esc(tr('px_exit'))}</button>
    </section>`, { title: tr('px_title') });
  announce(`${tr('px_end_title')}. ${tr('px_end_sub', { app })}`, { force: true });
  on('#again', 'click', () => go('scan'));
  on('#home', 'click', goHome);
  on('#exit', 'click', stopPractice);
});

window.addEventListener('sahaaya:exit-practice', stopPractice);
