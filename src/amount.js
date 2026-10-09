// Amounts in words, the Indian way (thousand, lakh, crore), so "5000" is heard as
// "five thousand rupees" and the extra-zero mistake is obvious.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function belowThousand(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return belowHundred(r);
  return r ? `${ONES[h]} hundred ${belowHundred(r)}` : `${ONES[h]} hundred`;
}

export function rupeesInWords(amount) {
  if (!Number.isFinite(amount) || amount < 0) return '';
  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'zero rupees';

  const parts = [];
  const crore = Math.floor(rupees / 1e7); rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5); rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3); rupees %= 1e3;
  if (crore) parts.push(`${belowThousand(crore)} crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (rupees) parts.push(belowThousand(rupees));

  let words = parts.length ? `${parts.join(' ')} rupee${Math.floor(amount) === 1 ? '' : 's'}` : '';
  if (paise) words += `${words ? ' and ' : ''}${belowHundred(paise)} paise`;
  return words;
}

/** "₹5,000" with Indian digit grouping. */
export function formatRupees(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
