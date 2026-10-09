// Name matching between the shop the user says they are at and the payee name in the QR.
// Kept dependency-free so it runs offline.

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
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

function tokenSimilarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

/**
 * Similarity between two names, 0..1.
 * Each word the user said is matched to its closest word in the payee name,
 * so "Sharma Medical" vs "SHARMA MEDICALS PVT LTD" scores high, "Rahul K" scores low.
 */
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

/** Also check the UPI ID itself, e.g. "sharmamedicals@okaxis" contains "sharma" + "medicals". */
export function vpaMentions(expected, vpa) {
  const handle = (vpa || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const words = normaliseName(expected).filter((w) => w.length >= 3);
  return words.length > 0 && words.every((w) => handle.includes(w));
}
