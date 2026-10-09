// Deaf merchant mode: turn a soundbox announcement (heard by speech recognition) into
// big on-screen text. Handles the common English/Hindi phrasing of Paytm/PhonePe/BharatPe boxes.

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000 };

export function wordsToNumber(text) {
  let total = 0;
  let current = 0;
  let found = false;
  for (const w of text.toLowerCase().split(/[\s-]+/)) {
    if (w in NUMBER_WORDS) { current += NUMBER_WORDS[w]; found = true; }
    else if (w === 'hundred') { current = (current || 1) * 100; found = true; }
    else if (w in SCALES) { total += (current || 1) * SCALES[w]; current = 0; found = true; }
    else if (found && w !== 'and') break;
  }
  return found ? total + current : null;
}

/**
 * Parse an announcement like "Received 500 rupees on Paytm" / "PhonePe par 250 rupaye
 * prapt hue" / "payment of rupees five hundred received from Anil".
 * Returns { amount, from } or null if it isn't a payment announcement.
 */
export function parseAnnouncement(transcript) {
  const t = (transcript || '').replace(/,/g, '').trim();
  if (!t) return null;
  const isPayment = /(receiv|recieved|prapt|mile|credited|payment)/i.test(t);
  if (!isPayment) return null;

  let amount = null;
  const digits = t.match(/(?:₹|rs\.?|rupees?|rupaye)?\s*(\d+(?:\.\d{1,2})?)/i);
  if (digits) amount = Number(digits[1]);
  if (amount == null) {
    const afterRupees = t.match(/(?:rupees?|rupaye|rs)\s+([a-z\s-]+)/i);
    const beforeRupees = t.match(/([a-z\s-]+?)\s+(?:rupees?|rupaye)/i);
    amount = wordsToNumber(afterRupees?.[1] || '') ?? wordsToNumber(beforeRupees?.[1] || '');
  }
  if (amount == null) return null;

  const from = t.match(/from\s+([a-z][a-z\s.]{1,30}?)(?:\s+(?:on|via|through)\b|$)/i);
  return { amount, from: from ? from[1].trim() : null };
}
