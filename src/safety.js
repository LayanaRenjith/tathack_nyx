// The safety engine: every rule SafeScan checks before money moves.
// Pure functions, no network, so the whole check works offline.

import { looksPersonalVpa } from './upi.js';
import { nameSimilarity, namesMatch, vpaMentions } from './match.js';

export const LEVEL = { OK: 'ok', CAUTION: 'caution', DANGER: 'danger' };

const RECEIVE_WORDS = /\b(receive|refund|cashback|prize|reward|lottery|won|claim|credit to you|get money)\b/i;

/**
 * Check a parsed QR before payment.
 * @param {object} qr        result of parseUpiQr (ok: true)
 * @param {object} ctx
 * @param {string} [ctx.expectedPayee]  shop/person the user says they are paying
 * @param {Array}  [ctx.knownPayees]    [{ vpa, name, usualAmount }] saved by the user
 * @returns {{ level, findings: Array<{ code, level }> , similarity }}
 */
export function checkPayee(qr, ctx = {}) {
  const findings = [];
  const known = (ctx.knownPayees || []).find((k) => k.vpa.toLowerCase() === qr.payeeVpa.toLowerCase());
  let similarity = null;

  if (qr.action && qr.action !== 'pay') {
    findings.push({ code: 'not_a_payment_qr', level: LEVEL.DANGER });
  }

  if (RECEIVE_WORDS.test(`${qr.note} ${qr.payeeName}`)) {
    findings.push({ code: 'receive_money_trick', level: LEVEL.DANGER });
  }

  if (ctx.expectedPayee) {
    similarity = nameSimilarity(ctx.expectedPayee, qr.payeeName);
    const matched = namesMatch(ctx.expectedPayee, qr.payeeName) || vpaMentions(ctx.expectedPayee, qr.payeeVpa);
    if (!qr.payeeName) {
      findings.push({ code: 'no_name_in_qr', level: LEVEL.CAUTION });
    } else if (!matched) {
      findings.push({ code: 'name_mismatch', level: LEVEL.DANGER });
    }
  }

  // A QR the user expects to be a shop, that pays what looks like a personal account.
  if (ctx.expectedPayee && !qr.isMerchant && looksPersonalVpa(qr.payeeVpa) && !known) {
    findings.push({ code: 'personal_account_for_shop', level: LEVEL.CAUTION });
  }

  if (!known && (ctx.knownPayees || []).length > 0) {
    findings.push({ code: 'first_time_payee', level: LEVEL.CAUTION });
  }

  return { level: worst(findings), findings, similarity, known: known || null };
}

/**
 * Check the amount the user is about to pay.
 * Catches the extra-zero mistake (500 -> 5000) and unusually large payments.
 */
export function checkAmount(amount, ctx = {}) {
  const findings = [];
  const usual = ctx.usualAmount || null;
  const largeLimit = ctx.largeLimit ?? 2000;

  if (!Number.isFinite(amount) || amount <= 0) {
    findings.push({ code: 'amount_invalid', level: LEVEL.DANGER });
    return { level: LEVEL.DANGER, findings };
  }
  if (usual && amount >= usual * 8) {
    findings.push({ code: 'extra_zero', level: LEVEL.DANGER, usual });
  } else if (usual && amount >= usual * 3) {
    findings.push({ code: 'more_than_usual', level: LEVEL.CAUTION, usual });
  }
  if (amount >= largeLimit) {
    findings.push({ code: 'large_amount', level: LEVEL.CAUTION });
  }
  if (ctx.qrAmount != null && Math.abs(ctx.qrAmount - amount) > 0.009) {
    findings.push({ code: 'amount_differs_from_qr', level: LEVEL.CAUTION });
  }
  return { level: worst(findings), findings };
}

/** How long to hold the Pay button disabled, so a risky payment gets a pause. */
export function pauseSeconds(level) {
  return level === LEVEL.DANGER ? 10 : level === LEVEL.CAUTION ? 3 : 0;
}

function worst(findings) {
  if (findings.some((f) => f.level === LEVEL.DANGER)) return LEVEL.DANGER;
  if (findings.some((f) => f.level === LEVEL.CAUTION)) return LEVEL.CAUTION;
  return LEVEL.OK;
}
