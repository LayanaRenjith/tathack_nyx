// Practise voice commands safely: nothing is paid. Each step says what to try, listens, and
// tells the user what Sahaaya understood, so they learn the words that work for their voice.

import { listenAll, speak, canListen, BUZZ, vibrate } from './speech.js';
import { parseCommand } from './commands.js';
import { amountFrom, yesNo } from './spoken.js';
import { formatRupees } from './amount.js';
import { icon } from './icons.js';
import { route, render, on, esc, tr, P, goHome, setVoice, screenId } from './ui.js';

const STEPS = [
  { say: 'pr_step_pay', ok: (h) => parseCommand(h) === 'pay', good: () => 'pr_good_pay' },
  { say: 'pr_step_amount', ok: (h) => Boolean(amountFrom(h)), good: (h) => ['pr_good_amount', { amount: formatRupees(amountFrom(h)) }] },
  { say: 'pr_step_yes', ok: (h) => yesNo(h) === 'yes', good: () => 'pr_good_yes' },
  { say: 'pr_step_help', ok: (h) => ['help', 'report', 'call', 'history'].includes(parseCommand(h)), good: () => 'pr_good_help' },
];

route('voice-practice', () => {
  render(`
    <section class="screen center practice">
      <div class="voice-hero"><span class="voice-orb big" id="orb">${icon('mic')}</span></div>
      <h1>${esc(tr('practice_title'))}</h1>
      <p class="muted">${esc(tr('practice_intro'))}</p>
      <ol class="practice-steps">${STEPS.map((st, i) => `<li data-step="${i}"><span class="num">${i + 1}</span><span class="grow">${esc(tr(st.say))}</span><span class="tick">${icon('check')}</span></li>`).join('')}</ol>
      <p class="vs-heard" id="heard" aria-live="polite"></p>
      <button class="btn big primary wide" id="start" data-next>${icon('mic')}<span>${esc(tr('practice_start'))}</span></button>
      <button class="btn wide" id="done">${esc(tr('done'))}</button>
    </section>`, { title: tr('practice_title') });
  setVoice({ own: true });
  const gen = screenId();
  const heardEl = document.getElementById('heard');
  const orb = document.getElementById('orb');
  on('#done', 'click', goHome);

  const run = async () => {
    if (!canListen) { heardEl.textContent = tr('no_listen'); return; }
    document.getElementById('start').hidden = true;
    for (let i = 0; i < STEPS.length && gen === screenId(); i += 1) {
      const li = document.querySelector(`[data-step="${i}"]`);
      li.classList.add('now');
      let passed = false;
      for (let tryNo = 0; tryNo < 3 && !passed && gen === screenId(); tryNo += 1) {
        await speak(tryNo ? `${tr('vm_try_again')} ${tr(STEPS[i].say)}` : tr(STEPS[i].say));
        if (gen !== screenId()) return;
        orb.classList.add('is-listening');
        const heard = await listenAll({ lang: P().lang, onInterim: (t) => { heardEl.textContent = `“${t}…”`; } });
        orb.classList.remove('is-listening');
        heardEl.textContent = heard[0] ? `“${heard[0]}”` : '';
        if (heard.length && STEPS[i].ok(heard)) {
          passed = true;
          vibrate(BUZZ.ok);
          const g = STEPS[i].good(heard);
          await speak(Array.isArray(g) ? tr(g[0], g[1]) : tr(g));
        }
      }
      li.classList.remove('now');
      li.classList.add(passed ? 'done' : 'skipped');
    }
    if (gen === screenId()) { await speak(tr('practice_done')); heardEl.textContent = tr('practice_done'); }
  };
  on('#start', 'click', run);
});
