// Sahaaya start-up and global voice commands.

import * as store from './store.js';
import { parseCommand } from './commands.js';
import { listenOnce, canListen, stopSpeaking, speak } from './speech.js';
import { go, back, goHome, replace, tr, P, S, announce, applySettings, readScreen, startTapWatching } from './ui.js';
import './onboarding.js';
import './home.js';
import './pay.js';

function adjust(patch) { store.updateProfile(patch); applySettings(); }

window.addEventListener('sahaaya:voice', async () => {
  if (!canListen) { announce(tr('no_listen'), { force: true }); return; }
  stopSpeaking();
  const btn = document.querySelector('[data-bar="voice"]');
  btn?.classList.add('is-listening');
  const heard = await listenOnce({ lang: P().lang });
  btn?.classList.remove('is-listening');
  if (!S().setupDone) return;
  const p = P();
  switch (parseCommand(heard)) {
    case 'pay': go('scan'); break;
    case 'home': goHome(); break;
    case 'read': readScreen(); break;
    case 'bigger': adjust({ textScale: Math.min(2.2, Math.round((p.textScale + 0.2) * 10) / 10) }); break;
    case 'smaller': adjust({ textScale: Math.max(0.9, Math.round((p.textScale - 0.2) * 10) / 10) }); break;
    case 'slower': adjust({ speechRate: Math.max(0.6, Math.round((p.speechRate - 0.15) * 100) / 100) }); speak(tr('speech_speed')); break;
    case 'faster': adjust({ speechRate: Math.min(1.4, Math.round((p.speechRate + 0.15) * 100) / 100) }); speak(tr('speech_speed')); break;
    case 'back': back(); break;
    case 'history': go('history'); break;
    case 'settings': go('settings'); break;
    case 'profile': go('profile'); break;
    case 'shops': go('shops'); break;
    case 'stop': stopSpeaking(); break;
    default: announce(tr('not_understood'), { force: true });
  }
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
