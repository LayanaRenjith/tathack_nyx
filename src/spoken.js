// Understanding speech in Malayalam, English, Hindi and Tamil, with no network or model.
// - Amounts: digits in any script, number words, Indian forms ("dhai sau" = 250, "two fifty" = 250,
//   "ഇരുന്നൂറ്റി അമ്പത്" = 250, "இருநூற்று ஐம்பது" = 250, "2 हज़ार" = 2000).
// - Commands and yes/no: token matching with stems for Malayalam and Tamil (words change their
//   endings: ആയിരം / ആയിരത്തി) and a small typo allowance for English.
// The recogniser gives several guesses; every guess is tried before giving up.

const NATIVE_DIGITS = { '०': 0, '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9,
  '൦': 0, '൧': 1, '൨': 2, '൩': 3, '൪': 4, '൫': 5, '൬': 6, '൭': 7, '൮': 8, '൯': 9,
  '௦': 0, '௧': 1, '௨': 2, '௩': 3, '௪': 4, '௫': 5, '௬': 6, '௭': 7, '௮': 8, '௯': 9 };

const isStemScript = (s) => /[஀-௿ഀ-ൿ]/.test(s); // Tamil, Malayalam

/** Lower-case, native digits to 0-9, punctuation (incl. danda) to spaces, "2,500" to "2500". */
export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[०-९൦-൯௦-௯]/g, (d) => String(NATIVE_DIGITS[d]))
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/₹/g, ' ')
    .replace(/(\d)([^\d\s.])/g, '$1 $2')
    .replace(/([^\d\s.])(\d)/g, '$1 $2')
    .replace(/[.](?!\d)/g, ' ')
    .replace(/[,!?;:"“”'’()।॥\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const tokens = (text) => normalise(text).split(' ').filter(Boolean);

// ---------- Numbers ----------
// kind n = a number to add, h = ×100, k = ×1000, l = ×1 lakh, c = ×1 crore,
// half/quarter modifiers for Hindi sawa, saadhe, paune.
const N = (v) => ({ k: 'n', v });
const EXACT = {
  // English
  zero: N(0), one: N(1), two: N(2), three: N(3), four: N(4), five: N(5), six: N(6), seven: N(7), eight: N(8), nine: N(9),
  ten: N(10), eleven: N(11), twelve: N(12), thirteen: N(13), fourteen: N(14), fifteen: N(15), sixteen: N(16),
  seventeen: N(17), eighteen: N(18), nineteen: N(19), twenty: N(20), thirty: N(30), forty: N(40), fourty: N(40),
  fifty: N(50), sixty: N(60), seventy: N(70), eighty: N(80), ninety: N(90),
  hundred: { k: 'h' }, hundreds: { k: 'h' }, thousand: { k: 'k' }, thousands: { k: 'k' },
  lakh: { k: 'l' }, lakhs: { k: 'l' }, lac: { k: 'l' }, crore: { k: 'c' }, crores: { k: 'c' },
  // Hindi (Devanagari)
  'एक': N(1), 'दो': N(2), 'तीन': N(3), 'चार': N(4), 'पांच': N(5), 'पाँच': N(5), 'छह': N(6), 'छः': N(6), 'छे': N(6),
  'सात': N(7), 'आठ': N(8), 'नौ': N(9), 'दस': N(10), 'ग्यारह': N(11), 'बारह': N(12), 'तेरह': N(13), 'चौदह': N(14),
  'पंद्रह': N(15), 'पन्द्रह': N(15), 'सोलह': N(16), 'सत्रह': N(17), 'अठारह': N(18), 'उन्नीस': N(19), 'बीस': N(20),
  'पच्चीस': N(25), 'तीस': N(30), 'पैंतीस': N(35), 'चालीस': N(40), 'पैंतालीस': N(45), 'पचास': N(50), 'पचपन': N(55),
  'साठ': N(60), 'पैंसठ': N(65), 'सत्तर': N(70), 'पचहत्तर': N(75), 'अस्सी': N(80), 'पचासी': N(85), 'नब्बे': N(90), 'पंचानवे': N(95),
  'सौ': { k: 'h' }, 'हज़ार': { k: 'k' }, 'हजार': { k: 'k' }, 'लाख': { k: 'l' }, 'करोड़': { k: 'c' }, 'करोड': { k: 'c' },
  'डेढ़': N(1.5), 'डेढ': N(1.5), 'ढाई': N(2.5), 'सवा': { k: 'add', v: 0.25 }, 'साढ़े': { k: 'add', v: 0.5 }, 'साढे': { k: 'add', v: 0.5 }, 'पौने': { k: 'add', v: -0.25 },
  // Hindi (Latin letters, as some recognisers write it)
  ek: N(1), do: N(2), teen: N(3), char: N(4), chaar: N(4), panch: N(5), paanch: N(5), chhe: N(6), saat: N(7), aath: N(8),
  nau: N(9), das: N(10), bees: N(20), pachees: N(25), tees: N(30), chalis: N(40), chaalis: N(40), pachas: N(50), pachaas: N(50),
  sau: { k: 'h' }, hazaar: { k: 'k' }, hazar: { k: 'k' }, hajar: { k: 'k' }, dedh: N(1.5), dhai: N(2.5), dhaai: N(2.5),
  sawa: { k: 'add', v: 0.25 }, sadhe: { k: 'add', v: 0.5 }, saade: { k: 'add', v: 0.5 }, paune: { k: 'add', v: -0.25 },
  // Malayalam / Tamil words that are whole on their own
  'ഒരു': N(1), 'ஒரு': N(1),
  // lakh: whole words only, so names like Lakshmi (ലക്ഷ്മി, லட்சுமி) are not read as numbers
  'ലക്ഷം': { k: 'l' }, 'ലക്ഷത്തി': { k: 'l' }, 'ലക്ഷത്തിന്': { k: 'l' }, 'லட்சம்': { k: 'l' }, 'லட்சத்து': { k: 'l' }, 'லட்ச': { k: 'l' },
};

// Stems for Malayalam and Tamil: a word counts when it starts with the stem (longest stem wins).
const STEMS = {
  // Malayalam
  'ഒന്ന': N(1), 'രണ്ട': N(2), 'മൂന്ന': N(3), 'നാല': N(4), 'അഞ്ച': N(5), 'ആറ': N(6), 'ഏഴ': N(7), 'എട്ട': N(8),
  'ഒമ്പത': N(9), 'ഒൻപത': N(9), 'പത്ത': N(10), 'പതിനൊന്ന': N(11), 'പന്ത്രണ്ട': N(12), 'പതിമൂന്ന': N(13), 'പതിനാല': N(14),
  'പതിനഞ്ച': N(15), 'പതിനാറ': N(16), 'പതിനേഴ': N(17), 'പതിനെട്ട': N(18), 'പത്തൊമ്പത': N(19), 'ഇരുപത': N(20),
  'മുപ്പത': N(30), 'നാല്പത': N(40), 'നാൽപത': N(40), 'അമ്പത': N(50), 'അൻപത': N(50), 'അറുപത': N(60), 'എഴുപത': N(70),
  'എൺപത': N(80), 'എണ്പത': N(80), 'തൊണ്ണൂറ': N(90),
  'നൂറ': { k: 'h' }, 'ഇരുന്നൂറ': N(200), 'മുന്നൂറ': N(300), 'നാനൂറ': N(400), 'അഞ്ഞൂറ': N(500), 'അറുന്നൂറ': N(600),
  'എഴുന്നൂറ': N(700), 'എണ്ണൂറ': N(800), 'തൊള്ളായിര': N(900),
  'ആയിര': { k: 'k' }, 'രണ്ടായിര': N(2000), 'മൂവായിര': N(3000), 'നാലായിര': N(4000), 'അയ്യായിര': N(5000), 'ആറായിര': N(6000),
  'ഏഴായിര': N(7000), 'എട്ടായിര': N(8000), 'ഒമ്പതിനായിര': N(9000), 'പതിനായിര': N(10000), 'കോടി': { k: 'c' },
  // Tamil
  'ஒன்ற': N(1), 'இரண்ட': N(2), 'ரெண்ட': N(2), 'மூன்ற': N(3), 'நான்க': N(4), 'நால': N(4), 'ஐந்த': N(5), 'அஞ்ச': N(5),
  'ஆற': N(6), 'ஏழ': N(7), 'எட்ட': N(8), 'ஒன்பத': N(9), 'பத்த': N(10), 'பதினொன்ற': N(11), 'பன்னிரண்ட': N(12),
  'பதிமூன்ற': N(13), 'பதினான்க': N(14), 'பதினைந்த': N(15), 'பதினாற': N(16), 'பதினேழ': N(17), 'பதினெட்ட': N(18),
  'பத்தொன்பத': N(19), 'இருபத': N(20), 'முப்பத': N(30), 'நாற்பத': N(40), 'ஐம்பத': N(50), 'அம்பத': N(50),
  'அறுபத': N(60), 'எழுபத': N(70), 'எண்பத': N(80), 'தொண்ணூற': N(90),
  'நூற': { k: 'h' }, 'இருநூற': N(200), 'முந்நூற': N(300), 'முன்னூற': N(300), 'நானூற': N(400), 'ஐநூற': N(500),
  'அஞ்ஞூற': N(500), 'அறுநூற': N(600), 'எழுநூற': N(700), 'எண்ணூற': N(800), 'தொள்ளாயிர': N(900),
  'ஆயிர': { k: 'k' }, 'இரண்டாயிர': N(2000), 'ரெண்டாயிர': N(2000), 'மூவாயிர': N(3000), 'நாலாயிர': N(4000),
  'ஐயாயிர': N(5000), 'அஞ்சாயிர': N(5000), 'ஆறாயிர': N(6000), 'ஏழாயிர': N(7000), 'எட்டாயிர': N(8000),
  'ஒன்பதாயிர': N(9000), 'பத்தாயிர': N(10000), 'கோடி': { k: 'c' },
};
const STEM_KEYS = Object.keys(STEMS).sort((a, b) => b.length - a.length);

function numberToken(tok) {
  if (/^\d+(\.\d+)?$/.test(tok)) return N(Number(tok));
  if (EXACT[tok]) return EXACT[tok];
  if (isStemScript(tok)) {
    const stem = STEM_KEYS.find((s) => tok.startsWith(s));
    if (stem) return STEMS[stem];
  }
  return null;
}

/** Spoken or typed amount → number (rupees), or null if no number was said. */
export function parseSpokenAmount(text) {
  let total = 0;
  let current = 0;
  let found = false;
  let add = 0;
  let prev = null;
  for (const tok of tokens(text)) {
    const t = numberToken(tok);
    if (!t) { prev = null; continue; }
    found = true;
    if (t.k === 'add') { add += t.v; prev = t; continue; }
    if (t.k === 'n') {
      const v = t.v + (add && t.v < 100 ? add : 0);
      add = 0;
      // "two fifty" / "do pachaas" / "രണ്ട് അമ്പത്" = 250
      if (prev?.k === 'n' && current > 0 && current < 10 && v >= 10 && v < 100) current = current * 100 + v;
      else current += v;
    } else if (t.k === 'h') current = (current || 1) * 100;
    else if (t.k === 'k') { total += (current || 1) * 1000; current = 0; }
    else if (t.k === 'l') { total += (current || 1) * 1e5; current = 0; }
    else if (t.k === 'c') { total += (current || 1) * 1e7; current = 0; }
    prev = t;
  }
  if (!found) return null;
  const n = Math.round((total + current) * 100) / 100;
  return n > 0 ? n : null;
}

/** First amount any of the recogniser's guesses contains. */
export function amountFrom(alternatives) {
  for (const a of [].concat(alternatives || [])) {
    const n = parseSpokenAmount(a);
    if (n) return n;
  }
  return null;
}

// ---------- Phrase matching ----------
function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function tokenMatches(tok, kw) {
  if (tok === kw) return true;
  if (isStemScript(kw) && kw.length >= 3 && tok.startsWith(kw)) return true;
  if (/^[a-z]{5,}$/.test(kw) && /^[a-z]+$/.test(tok) && Math.abs(tok.length - kw.length) <= 1 && lev(tok, kw) <= 1) return true;
  return false;
}

/** Does the phrase (one or more words) appear in the token list? Returns its length in characters, or 0. */
export function phraseScore(toks, phrase) {
  const p = normalise(phrase).split(' ');
  for (let i = 0; i + p.length <= toks.length; i++) {
    if (p.every((w, j) => tokenMatches(toks[i + j], w))) return phrase.length;
  }
  return 0;
}

/** Best-scoring key of {key: [phrases]} for the text, or null. Longer phrases win ("go back home" → home). */
export function bestMatch(text, table) {
  const toks = tokens(text);
  if (!toks.length) return null;
  let best = null;
  let bestScore = 0;
  for (const [key, phrases] of Object.entries(table)) {
    for (const ph of phrases) {
      const s = phraseScore(toks, ph);
      if (s > bestScore) { best = key; bestScore = s; }
    }
  }
  return best;
}

// ---------- Yes / no ----------
export const YES_NO = {
  no: ['no', 'nope', 'not', 'dont', 'don\'t', 'do not', 'stop', 'cancel', 'wait', 'wrong',
    'ഇല്ല', 'വേണ്ട', 'നിർത്ത', 'അരുത', 'ചെയ്യരുത', 'അയക്കരുത', 'റദ്ദാക്ക', 'തെറ്റ', 'വേണ്ടാ', 'നോ',
    'नहीं', 'नही', 'ना', 'मत', 'रुको', 'रुकिए', 'कैंसल', 'गलत', 'नो',
    'இல்லை', 'இல்ல', 'வேண்டாம்', 'செய்யாத', 'அனுப்பாத', 'வேணாம்', 'நிறுத்து', 'கேன்சல்', 'தவறு', 'நோ',
    'nahi', 'nahin', 'mat', 'venda', 'illa', 'vendam'],
  yes: ['yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'correct', 'right', 'pay', 'go ahead', 'confirm', 'do it', 'proceed',
    'അതെ', 'ശരി', 'ഉവ്വ്', 'ഉം', 'ഓക്കെ', 'ഓക്കേ', 'വേണം', 'ചെയ്യൂ', 'ചെയ്യ', 'അയക്കൂ', 'അയക്ക', 'യെസ്',
    'हाँ', 'हां', 'हा', 'जी', 'ठीक', 'ओके', 'बिल्कुल', 'सही', 'करो', 'कर दो', 'भेजो', 'यस',
    'ஆம்', 'ஆமா', 'ஆமாம்', 'சரி', 'ஓகே', 'செய்', 'அனுப்பு', 'எஸ்',
    'haan', 'han', 'ha', 'theek', 'thik', 'sari', 'shari', 'athe', 'aama', 'seri'],
};

/** 'yes' | 'no' | null. "No" wins over "yes" ("no, don't pay"). Accepts one string or a list of guesses. */
export function yesNo(alternatives) {
  for (const a of [].concat(alternatives || [])) {
    const toks = tokens(a);
    if (!toks.length) continue;
    if (YES_NO.no.some((w) => phraseScore(toks, w))) return 'no';
    if (YES_NO.yes.some((w) => phraseScore(toks, w))) return 'yes';
  }
  return null;
}

// ---------- Digits said one by one (approval codes, phone numbers) ----------
const DIGIT_WORDS = { oh: 0, o: 0, zero: 0, one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  'शून्य': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9,
  'പൂജ്യം': 0, 'ഒന്ന്': 1, 'രണ്ട്': 2, 'മൂന്ന്': 3, 'നാല്': 4, 'അഞ്ച്': 5, 'ആറ്': 6, 'ഏഴ്': 7, 'എട്ട്': 8, 'ഒമ്പത്': 9, 'ഒൻപത്': 9,
  'பூஜ்யம்': 0, 'சைபர்': 0, 'ஒன்று': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'நாலு': 4, 'ஐந்து': 5, 'அஞ்சு': 5, 'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9 };

/** "4 8 2 9 1 0", "four eight two…", "482 910" → "482910". Only digits and digit words count. */
export function spokenDigits(alternatives) {
  let best = '';
  for (const a of [].concat(alternatives || [])) {
    let out = '';
    for (const tok of tokens(a)) {
      if (/^\d+$/.test(tok)) out += tok;
      else if (tok in DIGIT_WORDS) out += String(DIGIT_WORDS[tok]);
    }
    if (out.length > best.length) best = out;
  }
  return best;
}

// ---------- Shop names across scripts ----------
// The recogniser writes "Lakshmi Bakery" as ലക്ഷ്മി ബേക്കറി, लक्ष्मी बेकरी or லட்சுமி பேக்கரி. Both sides are
// reduced to a consonant skeleton (Tamil has one letter for k/g, t/d, p/b, so those are folded together).
const SCRIPT = {
  // Devanagari
  'क': 'k', 'ख': 'k', 'ग': 'k', 'घ': 'k', 'ङ': 'n', 'च': 's', 'छ': 's', 'ज': 's', 'झ': 's', 'ञ': 'n', 'ट': 't', 'ठ': 't', 'ड': 't', 'ढ': 't', 'ण': 'n',
  'त': 't', 'थ': 't', 'द': 't', 'ध': 't', 'न': 'n', 'प': 'p', 'फ': 'p', 'ब': 'p', 'भ': 'p', 'म': 'm', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v', 'श': 's', 'ष': 's', 'स': 's', 'ं': 'n', 'ज़': 's', 'फ़': 'p',
  // Malayalam
  'ക': 'k', 'ഖ': 'k', 'ഗ': 'k', 'ഘ': 'k', 'ങ': 'n', 'ച': 's', 'ഛ': 's', 'ജ': 's', 'ഝ': 's', 'ഞ': 'n', 'ട': 't', 'ഠ': 't', 'ഡ': 't', 'ഢ': 't', 'ണ': 'n',
  'ത': 't', 'ഥ': 't', 'ദ': 't', 'ധ': 't', 'ന': 'n', 'പ': 'p', 'ഫ': 'p', 'ബ': 'p', 'ഭ': 'p', 'മ': 'm', 'ര': 'r', 'റ': 'r', 'ല': 'l', 'ള': 'l', 'ഴ': 'l', 'വ': 'v',
  'ശ': 's', 'ഷ': 's', 'സ': 's', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൺ': 'n', 'ം': 'm',
  // Tamil
  'க': 'k', 'ங': 'n', 'ச': 's', 'ஞ': 'n', 'ட': 't', 'ண': 'n', 'த': 't', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ர': 'r', 'ற': 'r', 'ல': 'l', 'ள': 'l', 'ழ': 'l', 'வ': 'v',
  'ன': 'n', 'ஜ': 's', 'ஷ': 's', 'ஸ': 's',
};

export function skeleton(word) {
  let w = String(word || '').toLowerCase().normalize('NFC');
  if (/[a-z]/.test(w)) {
    w = w.replace(/[^a-z]/g, '')
      .replace(/ch/g, 's').replace(/sh/g, 's').replace(/ph/g, 'p').replace(/x/g, 'ks')
      .replace(/[cq]/g, 'k').replace(/[gk]h/g, 'k').replace(/[td]h/g, 't').replace(/bh/g, 'p')
      .replace(/g/g, 'k').replace(/d/g, 't').replace(/b/g, 'p').replace(/[jz]/g, 's').replace(/f/g, 'p').replace(/w/g, 'v')
      .replace(/[aeiouyh]/g, '');
  } else {
    w = [...w].map((ch) => SCRIPT[ch] ?? '').join('');
  }
  return w.replace(/(.)\1+/g, '$1');
}

const near = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && Math.abs(a.length - b.length) <= 1 && lev(a, b) <= 1);

/** The saved shop the user named, in any of the four scripts, or null. */
export function findShopBySpeech(alternatives, shops) {
  let best = null;
  let bestScore = 0;
  for (const a of [].concat(alternatives || [])) {
    const said = tokens(a).map(skeleton).filter(Boolean);
    const joined = said.join('');
    for (const shop of shops || []) {
      const words = shop.name.split(/\s+/).map(skeleton).filter((w) => w.length >= 2);
      if (!words.length) continue;
      const hits = words.filter((w) => said.some((s) => near(s, w)) || (w.length >= 3 && joined.includes(w))).length;
      const score = hits / words.length;
      const enough = words.length === 1 ? hits === 1 && words[0].length >= 3 : score >= 0.67;
      if (enough && score > bestScore) { best = shop; bestScore = score; }
    }
  }
  return best;
}
