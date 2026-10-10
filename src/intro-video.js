// Optional 1-minute guide, offered when a helper sets Sahaaya up for someone, and replayable from
// Easy settings. It is a recording of the real app with captions in all four languages. It has no
// sound track: nothing plays aloud unless the viewer turns on "Read captions aloud", which uses the
// phone's own voice. It never autoplays, and can be skipped at any point without losing anything.

import { speak, stopSpeaking } from './speech.js';
import { icon } from './icons.js';
import { route, render, on, esc, tr, P, go, back } from './ui.js';

export const GUIDE = { video: 'media/sahaaya-guide.webm', poster: 'media/sahaaya-guide.jpg', captions: (lang) => `media/guide.${lang}.vtt` };

route('intro-video', (next = 'back') => {
  const lang = P().lang;
  const leave = () => { stopSpeaking(); if (next === 'back') back(); else go(next); };
  render(`
    <section class="screen video-screen">
      <h1>${esc(tr('vid_title'))}</h1>
      <p class="readable muted">${esc(tr('vid_intro'))}</p>
      <div class="video-frame">
        <video id="guide" preload="none" playsinline poster="${GUIDE.poster}" aria-describedby="vid-cap">
          <source src="${GUIDE.video}" type="video/webm">
          <track kind="captions" srclang="${lang}" label="${esc(tr('language'))}" src="${GUIDE.captions(lang)}" default>
        </video>
      </div>
      <p class="video-caption" id="vid-cap" aria-live="polite"></p>
      <p class="note warn-note" id="vid-err" hidden>${icon('info')}<span>${esc(tr('vid_missing'))}</span></p>
      <div class="row">
        <button class="btn big wide primary" id="play" data-next>${icon('chevron')}<span id="play-label">${esc(tr('vid_play'))}</span></button>
      </div>
      <button class="toggle-row boxed" id="read" role="switch" aria-checked="false"><span class="grow">${esc(tr('vid_read'))}</span><span class="switch" aria-hidden="true"><span></span></span></button>
      <button class="btn big wide" id="skip">${esc(next === 'back' ? tr('back') : tr('vid_skip'))}</button>
    </section>`, { title: tr('vid_title') });

  const v = document.getElementById('guide');
  const cap = document.getElementById('vid-cap');
  const label = document.getElementById('play-label');
  const readBtn = document.getElementById('read');
  let readAloud = false;

  // Captions shown big under the video (easier to read than the browser's own), and optionally spoken.
  const track = v.textTracks[0];
  if (track) {
    track.mode = 'hidden';
    track.addEventListener('cuechange', () => {
      const cue = track.activeCues?.[0];
      cap.textContent = cue ? cue.text : '';
      if (cue && readAloud) speak(cue.text, { lang });
    });
  }
  v.addEventListener('error', () => { document.getElementById('vid-err').hidden = false; }, true);
  v.querySelector('source').addEventListener('error', () => { document.getElementById('vid-err').hidden = false; });
  v.addEventListener('play', () => { label.textContent = tr('vid_pause'); });
  v.addEventListener('pause', () => { label.textContent = tr('vid_play'); });
  v.addEventListener('ended', () => { label.textContent = tr('vid_replay'); document.getElementById('skip').textContent = tr('vid_done'); });

  on('#play', 'click', () => { if (v.paused) v.play().catch(() => { document.getElementById('vid-err').hidden = false; }); else v.pause(); });
  on('#read', 'click', () => {
    readAloud = !readAloud;
    readBtn.setAttribute('aria-checked', String(readAloud));
    if (!readAloud) stopSpeaking();
  });
  on('#skip', 'click', leave);
});
