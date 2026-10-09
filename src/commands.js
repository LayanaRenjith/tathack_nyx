// Voice commands that work on every screen, in Malayalam and English.
// parseCommand is pure so it can be tested; app.js runs the actions.

const COMMANDS = [
  { cmd: 'pay', words: ['pay', 'scan', 'safescan', 'payment', 'പണം', 'അയക്ക', 'സ്കാൻ', 'പേ'] },
  { cmd: 'read', words: ['read', 'repeat', 'again', 'വായിക്ക', 'വീണ്ടും', 'ആവർത്തിക്ക'] },
  { cmd: 'bigger', words: ['bigger', 'larger', 'zoom in', 'വലുതാക്ക', 'വലുത്'] },
  { cmd: 'smaller', words: ['smaller', 'zoom out', 'ചെറുതാക്ക', 'ചെറുത്'] },
  { cmd: 'slower', words: ['slower', 'slow', 'പതുക്കെ', 'സാവധാനം'] },
  { cmd: 'faster', words: ['faster', 'fast', 'വേഗം', 'വേഗത്തിൽ'] },
  { cmd: 'back', words: ['back', 'go back', 'previous', 'തിരികെ', 'പിന്നോട്ട്'] },
  { cmd: 'home', words: ['home', 'start', 'main', 'ഹോം', 'തുടക്കം'] },
  { cmd: 'settings', words: ['settings', 'setting', 'ക്രമീകരണ', 'സെറ്റിങ്'] },
  { cmd: 'shops', words: ['my shops', 'shops', 'saved', 'എന്റെ കടകൾ', 'കടകൾ'] },
  { cmd: 'stop', words: ['stop', 'quiet', 'silence', 'നിർത്ത', 'മതി'] },
];

/** Returns the command for a transcript, or null. Earlier entries win ("pay" beats "back"). */
export function parseCommand(transcript) {
  const t = ` ${(transcript || '').toLowerCase().trim()} `;
  if (!t.trim()) return null;
  for (const { cmd, words } of COMMANDS) {
    if (words.some((w) => (/^[a-z ]+$/.test(w) ? t.includes(` ${w} `) || t.includes(` ${w}`) : t.includes(w)))) {
      return cmd;
    }
  }
  return null;
}
