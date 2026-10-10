// The life of one helper approval request, kept honest: a payment is only "approved" after a code
// has been checked against the Guardian PIN for this exact request, account and amount.
//   idle      nothing sent yet
//   pending   the user opened WhatsApp to send the request (we can't know if Send was tapped)
//   approved  a valid code arrived (typed, spoken, relayed) or the helper typed their PIN here
//   rejected  the helper said "don't pay"
//   expired   no valid answer within 15 minutes: ask again (a new request, new code)

import { checkApproval, checkGuardianPin, newRequestId } from './guardian.js';

export const REQ = { IDLE: 'idle', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', EXPIRED: 'expired' };
export const REQUEST_TTL_MS = 15 * 60 * 1000;

export function newApproval(now = Date.now(), id = newRequestId()) {
  return { id, state: REQ.IDLE, createdAt: now, sentAt: null, expiresAt: now + REQUEST_TTL_MS };
}

/** The state right now (a pending or idle request turns into expired when its time is up). */
export function stateOf(r, now = Date.now()) {
  if ((r.state === REQ.PENDING || r.state === REQ.IDLE) && r.sentAt != null && now > r.expiresAt) return REQ.EXPIRED;
  return r.state;
}

/** The user opened WhatsApp/SMS with the request. */
export function markSent(r, now = Date.now()) {
  if (r.state === REQ.APPROVED || r.state === REQ.REJECTED) return r;
  return { ...r, state: REQ.PENDING, sentAt: now, expiresAt: now + REQUEST_TTL_MS };
}

/**
 * A code arrived. Returns { request, result } where result is 'approved' | 'invalid' | 'expired' | 'rejected'.
 * @param {{vpa: string, amount: number}} payment
 */
export async function receiveCode(r, code, guardian, payment, now = Date.now()) {
  const st = stateOf(r, now);
  if (st === REQ.REJECTED) return { request: r, result: 'rejected' };
  if (st === REQ.APPROVED) return { request: r, result: 'approved' };
  if (st === REQ.EXPIRED) return { request: { ...r, state: REQ.EXPIRED }, result: 'expired' };
  const ok = await checkApproval(code, guardian, { id: r.id, vpa: payment.vpa, amount: payment.amount });
  return ok ? { request: { ...r, state: REQ.APPROVED }, result: 'approved' } : { request: r, result: 'invalid' };
}

/** The helper is with the user and types their Guardian PIN on this phone. */
export async function receivePin(r, pin, guardian, now = Date.now()) {
  if (stateOf(r, now) === REQ.REJECTED) return { request: r, result: 'rejected' };
  return (await checkGuardianPin(pin, guardian)) ? { request: { ...r, state: REQ.APPROVED }, result: 'approved' } : { request: r, result: 'invalid' };
}

/** The helper said don't pay. Safety first: this wins even over an earlier approval on this screen. */
export function receiveDecline(r) {
  return { ...r, state: REQ.REJECTED };
}
