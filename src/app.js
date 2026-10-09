// Sahaaya start-up and global voice commands.

import * as store from './store.js';
import { listenAll, canListen, stopSpeaking, speak } from './speech.js';
import { speaks, voiceDriven } from './profile.js';
import { monthlyReport } from './report.js';
import { formatRupees } from './amount.js';
import { normalisePhone } from './family.js';
import { go, back, goHome, replace, rerender, tr, P, S, announce, applySettings, readScreen, startTapWatching, onGlobalCommand, handleHeard, voiceTurn, voiceHelp } from './ui.js';
import './onboarding.js';
import './home.js';
import './pay.js';
import './report-screen.js';

function adjust(patch) { store.updateProfile(patch); applySettings(); }
const sayIt = (text) => (speaks(P()) ? speak(text) : announce(text, { force: true }));

// App-wide voice commands. Returns false for words that only mean something on certain screens.
onGlobalCommand(async (cmd) => {
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
    case 'read': await readScreen(); break;
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
    default: return false;
  }
  return true;
});

// The mic button in the top bar (and the big voice bar in full voice control).
window.addEventListener('sahaaya:voice', async () => {
  if (!canListen) { announce(tr('no_listen'), { force: true }); return; }
  stopSpeaking();
  if (voiceDriven(P())) { voiceTurn(); return; }
  const btn = document.querySelector('[data-bar="voice"]');
  btn?.classList.add('is-listening');
  const heard = await listenAll({ lang: P().lang });
  btn?.classList.remove('is-listening');
  if (!(await handleHeard(heard))) announce(tr('not_understood'), { force: true });
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
const s = S();
const after = s.profile.openScanner ? 'scan' : 'home';
if (!s.setupDone) replace('welcome');
else if (s.lock.type !== 'none') replace('lock', after);
else if (after === 'scan') { replace('home'); go('scan'); }
else replace('home');

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
