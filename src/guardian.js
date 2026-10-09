// Guardian approval for payments Sahaaya cannot vouch for (a shop not yet saved, or a payment over
// the limit). Works with no server:
//   1. At setup the guardian chooses a 4-digit Guardian PIN on the elder's phone. Only a salted hash is kept.
//   2. A new shop: the elder sends the guardian a WhatsApp link with the shop, account and amount.
//   3. The link opens Sahaaya on the guardian's phone. They check the account (or call), enter their PIN,
//      and get a 6-digit approval code, which they send back.
//   4. The elder's phone checks the code. It is tied to this request, this account and this amount, so it
//      cannot be reused for another shop or a bigger amount, and the elder never learns the PIN.
// If the guardian is sitting next to the elder, they can type the PIN on the elder's phone instead.

import { hashCode, newSalt } from './auth.js';

const hex = async (text) => {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** Make the stored guardian record from the PIN the guardian chose. */
export async function makeGuardian(pin) {
  const salt = newSalt();
  const key = await hashCode(pin, salt);
  return { salt, key, check: (await hex(`${key}|check`)).slice(0, 3) };
}

export async function guardianKey(pin, salt) { return hashCode(pin, salt); }

/** Is this PIN the guardian's? (guardian typing on the elder's phone) */
export async function checkGuardianPin(pin, guardian) {
  if (!guardian?.key || !/^\d{4}$/.test(pin || '')) return false;
  return (await hashCode(pin, guardian.salt)) === guardian.key;
}

/** Quick check on the guardian's phone that they typed their PIN right (1 in 4096 chance of a false pass). */
export async function pinLooksRight(pin, salt, check) {
  if (!check) return true;
  return (await hex(`${await hashCode(pin, salt)}|check`)).slice(0, 3) === check;
}

const canonical = ({ id, vpa, amount }) => `${id}|${String(vpa || '').trim().toLowerCase()}|${Number(amount || 0).toFixed(2)}`;

/** 6-digit approval code for one request. */
export async function approvalCode(key, request) {
  const h = await hex(`${key}|${canonical(request)}`);
  return String(parseInt(h.slice(0, 10), 16) % 1e6).padStart(6, '0');
}

export async function checkApproval(code, guardian, request) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6 || !guardian?.key) return false;
  return c === (await approvalCode(guardian.key, request));
}

export function newRequestId() {
  const a = new Uint8Array(4);
  globalThis.crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 6);
}

/** Link the guardian opens. Everything needed to show the request and make the code, nothing secret. */
export function requestLink(base, { id, vpa, name, amount, user, phone, lang, reason }, guardian) {
  const q = new URLSearchParams({ id, vpa, n: name || '', a: String(amount), u: user || '', s: guardian.salt, k: guardian.check || '', l: lang || 'en', r: reason || 'new' });
  if (phone) q.set('p', phone);
  return `${base}#approve?${q.toString()}`;
}

export function parseRequestLink(hash) {
  const i = (hash || '').indexOf('approve?');
  if (i < 0) return null;
  const q = new URLSearchParams(hash.slice(i + 'approve?'.length));
  const amount = Number(q.get('a'));
  if (!q.get('id') || !q.get('vpa') || !q.get('s') || !(amount > 0)) return null;
  return { id: q.get('id'), vpa: q.get('vpa'), name: q.get('n') || '', amount, user: q.get('u') || '', salt: q.get('s'), check: q.get('k') || '', lang: q.get('l') || 'en', phone: q.get('p') || '', reason: q.get('r') || 'new' };
}
