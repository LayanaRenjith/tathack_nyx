// Trusted people and payment limits. Alerts go out through the user's own WhatsApp or SMS
// (a prepared message the user sends with one tap), so no server, account or API is needed.

/** Normalise an Indian mobile number to digits with country code, e.g. "98470 12345" -> "919847012345". */
export function normalisePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`;
  return d.length >= 10 ? d : '';
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${normalisePhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function smsLink(phone, text) {
  return `sms:+${normalisePhone(phone)}?body=${encodeURIComponent(text)}`;
}

/** Sum of today's payments (local day). */
export function spentToday(history, now = Date.now()) {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return (history || []).filter((h) => h.at >= start && h.at <= now).reduce((s, h) => s + (h.amount || 0), 0);
}

/**
 * Does this payment need the trusted person's OK?
 * @returns {null | {reason: 'payment'|'daily', limit: number}}
 */
export function overLimit(amount, { perPayment = null, daily = null } = {}, history = [], now = Date.now()) {
  if (!amount) return null;
  if (perPayment && amount > perPayment) return { reason: 'payment', limit: perPayment };
  if (daily && spentToday(history, now) + amount > daily) return { reason: 'daily', limit: daily };
  return null;
}
