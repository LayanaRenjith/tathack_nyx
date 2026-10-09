// Strings in four languages. English is the fallback for anything missing.
// Malayalam, Hindi and Tamil should be reviewed by native speakers.

import en from './lang/en.js';
import ml from './lang/ml.js';
import hi from './lang/hi.js';
import ta from './lang/ta.js';

export const LANGS = {
  ml: { label: 'മലയാളം', english: 'Malayalam', speech: 'ml-IN' },
  en: { label: 'English', english: 'English', speech: 'en-IN' },
  hi: { label: 'हिन्दी', english: 'Hindi', speech: 'hi-IN' },
  ta: { label: 'தமிழ்', english: 'Tamil', speech: 'ta-IN' },
};

const STRINGS = { en, ml, hi, ta };

export function t(lang, key, vars = {}) {
  const str = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

export function missingKeys() {
  const keys = Object.keys(STRINGS.en);
  return Object.keys(STRINGS).flatMap((l) => keys.filter((k) => !(k in STRINGS[l])).map((k) => `${l}.${k}`));
}

/** Words that mean "yes" / "no" in each language, for hands-free confirmation. */
export const YES_WORDS = ['yes', 'yeah', 'ok', 'okay', 'pay', 'sure', 'അതെ', 'ശരി', 'ഉവ്വ്', 'हाँ', 'हां', 'जी', 'ठीक', 'ஆம்', 'சரி', 'ஆமா'];
export const NO_WORDS = ['no', 'stop', 'cancel', 'wait', 'ഇല്ല', 'വേണ്ട', 'നിർത്ത', 'नहीं', 'नही', 'रुको', 'இல்லை', 'வேண்டாம்', 'நிறுத்து'];

export function yesNo(transcript) {
  const t_ = ` ${(transcript || '').toLowerCase().trim()} `;
  const hit = (w) => (/^[a-z]+$/.test(w) ? new RegExp(`\\b${w}\\b`).test(t_) : t_.includes(w));
  if (NO_WORDS.some(hit)) return 'no';
  if (YES_WORDS.some(hit)) return 'yes';
  return null;
}
