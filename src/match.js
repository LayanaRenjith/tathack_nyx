// Name matching and intent parsing. Dependency-free so it runs offline.
// Names inside QR codes can be faked, so name matching is only ever used to FIND a saved shop
// or as a soft hint, never to decide that a payment is genuine.

const STOP_WORDS = new Set([
  'shop', 'store', 'stores', 'and', 'the', 'pvt', 'ltd', 'private', 'limited', 'co', 'company',
  'enterprises', 'traders', 'trading', 'agency', 'agencies', 'centre', 'center', 'mart', 'sons',
  'mr', 'mrs', 'ms', 'sri', 'shri', 'smt',
]);

export function normaliseName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function tokenSimilarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

/** Similarity 0..1: each word of `expected` matched to its closest word in `actual`. */
export function nameSimilarity(expected, actual) {
  const e = normaliseName(expected);
  const a = normaliseName(actual);
  if (!e.length || !a.length) return 0;
  const scores = e.map((ew) => Math.max(...a.map((aw) => tokenSimilarity(ew, aw))));
  return scores.reduce((s, x) => s + x, 0) / scores.length;
}

export const MATCH_THRESHOLD = 0.72;

export function namesMatch(expected, actual) {
  return nameSimilarity(expected, actual) >= MATCH_THRESHOLD;
}

/** Find the saved shop the user means by name (best match above the threshold). */
export function findShop(savedShops, name) {
  if (!name || !savedShops?.length) return null;
  let best = null;
  let bestScore = 0;
  for (const s of savedShops) {
    const score = Math.min(nameSimilarity(name, s.name), nameSimilarity(s.name, name));
    if (score > bestScore) { best = s; bestScore = score; }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "five hundred" -> 500, "two thousand five hundred" -> 2500. Returns null when no number words. */
export function wordsToNumber(text) {
  let total = 0;
  let current = 0;
  let found = false;
  for (const w of (text || '').toLowerCase().split(/[\s-]+/)) {
    if (w in NUMBER_WORDS) { current += NUMBER_WORDS[w]; found = true; }
    else if (w === 'hundred') { current = (current || 1) * 100; found = true; }
    else if (w === 'thousand') { total += (current || 1) * 1000; current = 0; found = true; }
    else if (w === 'lakh' || w === 'lakhs') { total += (current || 1) * 100000; current = 0; found = true; }
  }
  return found ? total + current : null;
}

/**
 * Parse a spoken or typed intent such as "Pay Lakshmi Bakery 250" or "Lakshmi Bakery ₹250"
 * into { shop, amount }. Either can be missing.
 */
export function parseIntent(text) {
  let t = (text || '').replace(/,/g, '').trim();
  if (!t) return { shop: '', amount: null };
  let amount = null;
  const digits = t.match(/(?:₹|rs\.?|rupees?)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs)?/i);
  if (digits) {
    amount = Number(digits[1]);
    t = t.replace(digits[0], ' ');
  } else {
    const n = wordsToNumber(t);
    if (n) {
      amount = n;
      t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakhs?|and)\b/gi, ' ');
    }
  }
  const shop = t
    .replace(/^\s*(please\s+)?(pay|send|give)\s+(to\s+)?/i, '')
    .replace(/\b(rupees?|rs\.?|₹)\b/gi, ' ')
    .replace(/\s+(to|for)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { shop, amount };
}
