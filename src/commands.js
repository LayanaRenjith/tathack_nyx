// Voice commands that work on every screen, in Malayalam, English, Hindi and Tamil.

const COMMANDS = [
  { cmd: 'pay', words: ['pay', 'scan', 'payment', 'പണം', 'അയക്ക', 'സ്കാൻ', 'भुगतान', 'पेमेंट', 'स्कैन', 'பணம்', 'செலுத்து', 'ஸ்கேன்'] },
  { cmd: 'read', words: ['read', 'repeat', 'again', 'വായിക്ക', 'വീണ്ടും', 'पढ़ो', 'पढ़', 'दोबारा', 'படி', 'மீண்டும்'] },
  { cmd: 'bigger', words: ['bigger', 'larger', 'zoom in', 'വലുതാക്ക', 'വലുത്', 'बड़ा', 'बड़े', 'பெரிதாக்கு', 'பெரிது'] },
  { cmd: 'smaller', words: ['smaller', 'zoom out', 'ചെറുതാക്ക', 'ചെറുത്', 'छोटा', 'சிறிதாக்கு', 'சிறிது'] },
  { cmd: 'slower', words: ['slower', 'slow', 'പതുക്കെ', 'സാവധാനം', 'धीरे', 'மெதுவாக', 'மெதுவா'] },
  { cmd: 'faster', words: ['faster', 'fast', 'വേഗം', 'तेज़', 'जल्दी', 'வேகமாக'] },
  { cmd: 'back', words: ['back', 'go back', 'previous', 'തിരികെ', 'പിന്നോട്ട്', 'पीछे', 'वापस', 'பின்செல்', 'பின்னால்'] },
  { cmd: 'home', words: ['home', 'main', 'ഹോം', 'होम', 'முகப்பு'] },
  { cmd: 'history', words: ['history', 'payments', 'ചരിത്രം', 'पेमेंट्स', 'इतिहास', 'வரலாறு'] },
  { cmd: 'settings', words: ['settings', 'setting', 'ക്രമീകരണ', 'सेटिंग', 'அமைப்பு'] },
  { cmd: 'profile', words: ['profile', 'പ്രൊഫൈൽ', 'प्रोफ़ाइल', 'प्रोफाइल', 'சுயவிவரம்'] },
  { cmd: 'shops', words: ['my shops', 'shops', 'കടകൾ', 'दुकान', 'கடை'] },
  { cmd: 'stop', words: ['stop', 'quiet', 'silence', 'നിർത്ത', 'മതി', 'रुको', 'बस', 'நிறுத்து', 'போதும்'] },
];

export function parseCommand(transcript) {
  const t = ` ${(transcript || '').toLowerCase().trim()} `;
  if (!t.trim()) return null;
  for (const { cmd, words } of COMMANDS) {
    if (words.some((w) => (/^[a-z ]+$/.test(w) ? new RegExp(`\\b${w}\\b`).test(t) : t.includes(w)))) return cmd;
  }
  return null;
}
