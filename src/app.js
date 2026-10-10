// Sahaaya start-up and global voice commands.

import * as store from './store.js';
import { listenAll, canListen, stopSpeaking, speak } from './speech.js';
import { speaks, voiceDriven, listenLangFor } from './profile.js';
import { monthlyReport } from './report.js';
import { findShopBySpeech, amountFrom } from './spoken.js';
import { formatRupees } from './amount.js';
import { normalisePhone } from './family.js';
import { currentName, go, back, goHome, replace, rerender, tr, P, S, announce, applySettings, readScreen, startTapWatching, onGlobalCommand, handleHeard, voiceTurn, voiceHelp, explainMicProblem, showToast } from './ui.js';
import './onboarding.js';
import './home.js';
import './pay.js';
import './report-screen.js';
import './approve.js';
import './voice-practice.js';
import './comfort-screen.js';
import './practice.js';

function adjust(patch) { store.updateProfile(patch); applySettings(); }
const sayIt = (text) => (speaks(P()) ? speak(text) : announce(text, { force: true }));

// App-wide voice commands. Returns false for words that only mean something on certain screens.
onGlobalCommand(async (cmd, alts) => {
  if (!S().setupDone) return false;
  const p = P();
  const s = S();
  switch (cmd) {
    case 'pay': case 'again': go('scan'); break;
    case 'home': goHome(); break;
    case 'back': back(); break;
    case 'history': go('history'); break;
    case 'report': go('report'); break;
    case 'settings': go('settings'); break;
    case 'profile': go('profile'); break;
    case 'shops': go('shops'); break;
    case 'family': go('trusted'); break;
    case 'read': case 'who': await readScreen(); break;
    case 'limit': {
      const person = s.trusted[0];
      await sayIt(person && s.limits.perPayment ? tr('limit_note', { amount: formatRupees(s.limits.perPayment), name: person.name }) : tr('no_family'));
      break;
    }
    case 'help': await sayIt(voiceHelp()); break;
    case 'bigger': adjust({ textScale: Math.min(2.2, Math.round((p.textScale + 0.2) * 10) / 10) }); rerender(); break;
    case 'smaller': adjust({ textScale: Math.max(0.9, Math.round((p.textScale - 0.2) * 10) / 10) }); rerender(); break;
    case 'slower': adjust({ speechRate: Math.max(0.6, Math.round((p.speechRate - 0.15) * 100) / 100) }); await sayIt(tr('speech_speed')); break;
    case 'faster': adjust({ speechRate: Math.min(1.4, Math.round((p.speechRate + 0.15) * 100) / 100) }); await sayIt(tr('speech_speed')); break;
    case 'louder': await sayIt(tr('vm_louder')); break;
    case 'spent': {
      const now = new Date();
      const r = monthlyReport(s.history, now.getFullYear(), now.getMonth());
      await sayIt(tr('spent_month', { total: formatRupees(r.total), n: r.count }));
      break;
    }
    case 'call': {
      const person = s.trusted[0];
      if (!person) { await sayIt(tr('no_family')); break; }
      await sayIt(tr('call_who', { name: person.name }));
      window.location.href = `tel:+${normalisePhone(person.phone)}`;
      break;
    }
    case 'voiceOn': adjust({ voiceOnly: true, voice: true, handsFree: true, screenReader: false }); await sayIt(tr('vm_voice_on')); rerender(); break;
    case 'voiceOff': adjust({ voiceOnly: false }); await sayIt(tr('vm_voice_off')); rerender(); break;
    case 'stop': stopSpeaking(); break;
    case 'cancel': await sayIt(tr('hf_cancelled')); goHome(); break;
    case 'practice': go('voice-practice'); break;
    case 'simulate': go('practice'); break;
    case 'payShop': {
      // "Pay Lakshmi Bakery two fifty": a saved shop, so its account is already known. No QR needed.
      const shop = findShopBySpeech(alts, s.savedShops);
      if (!shop) return false;
      go('result', { ok: true, payeeVpa: shop.vpa, payeeName: shop.name, amount: amountFrom(alts) || null, note: '' });
      break;
    }
    default: return false;
  }
  return true;
});

// The mic button in the top bar (and the big voice bar in full voice control).
window.addEventListener('sahaaya:voice', async () => {
  if (!canListen) { announce(tr('no_listen'), { force: true }); return; }
  stopSpeaking();
  if (voiceDriven(P())) { voiceTurn(); return; }
  const btns = document.querySelectorAll('[data-bar="voice"]');
  btns.forEach((b) => b.classList.add('is-listening'));
  let heard = await listenAll({ lang: listenLangFor(P(), 0), onSpeech: () => showToast(tr('vm_hearing')) });
  if (!heard.length && (await explainMicProblem())) { btns.forEach((b) => b.classList.remove('is-listening')); return; }
  let cmd = heard.length ? await handleHeard(heard) : null;
  if (!cmd && listenLangFor(P(), 1) !== listenLangFor(P(), 0)) {
    // Not understood in their language: one more try in Indian English.
    await announce(tr('vm_try_again'), { force: true });
    heard = await listenAll({ lang: listenLangFor(P(), 1) });
    cmd = heard.length ? await handleHeard(heard) : null;
  }
  btns.forEach((b) => b.classList.remove('is-listening'));
  if (!cmd) announce(heard[0] ? `${tr('vm_heard', { text: heard[0] })} ${tr('not_understood')}` : tr('not_understood'), { force: true });
});

// Full voice control: shake the phone to talk (no button to find).
let lastShake = 0;
window.addEventListener('devicemotion', (e) => {
  if (!voiceDriven(P())) return;
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const force = Math.abs(a.x || 0) + Math.abs(a.y || 0) + Math.abs(a.z || 0);
  const now = Date.now();
  if (force > 38 && now - lastShake > 2500) { lastShake = now; stopSpeaking(); voiceTurn(); }
});

// Full voice control: double-tap anywhere to talk (no button to find).
document.addEventListener('dblclick', (e) => {
  if (!voiceDriven(P()) || e.target.closest('input, textarea')) return;
  e.preventDefault();
  stopSpeaking();
  voiceTurn();
});

// Android back button / browser back: step back inside Sahaaya instead of leaving it.
history.pushState(null, '', location.href);
window.addEventListener('popstate', () => { history.pushState(null, '', location.href); back(); });

applySettings();
startTapWatching();
// Phones load their voices late; refresh the voice list on the settings screen when they arrive.
if (globalThis.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (currentName() === 'settings') rerender(); };
const s = S();
const after = s.profile.openScanner ? 'scan' : 'home';
if (location.hash.includes('approve?')) replace('approve', location.hash); // a guardian opening an approval link
else if (!s.setupDone) replace('welcome');
else if (s.lock.type !== 'none') replace('lock', after);
else if (after === 'scan') { replace('home'); go('scan'); }
else replace('home');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
