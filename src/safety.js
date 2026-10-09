// Sahaaya payment check. Pure functions, no network: works offline.
//
// The name written inside a UPI QR can be anything, and UPI apps ignore it in favour of the
// bank-verified name. So the decision is made on the UPI ID (the account):
//   SAME      the QR pays an account the family saved for a regular shop
//   DIFFERENT the QR claims a saved shop's name but pays another account (swapped sticker)
//   NEW       an account that isn't saved: not checked, never called safe

import { namesMatch } from './match.js';

export const LEVEL = { OK: 'ok', CAUTION: 'caution', DANGER: 'danger' };
export const STATUS = { SAME: 'same', DIFFERENT: 'different', NEW: 'new' };

const RECEIVE_WORDS = /\b(receive|refund|cashback|prize|reward|lottery|won|claim|credit to you|get money|kyc)\b/i;
export const sameVpa = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * @param {object} qr  parsed QR (parseUpiQr, ok: true)
 * @param {object} ctx { savedShops: [{ name, vpa, usualAmount }] }
 * @returns {{ status, level, findings: Array<{code, level, vars?}>, shop, shopName }}
 */
export function checkPayment(qr, ctx = {}) {
  const saved = ctx.savedShops || [];
  const findings = [];
  const byVpa = saved.find((s) => sameVpa(s.vpa, qr.payeeVpa)) || null;
  const claimed = !byVpa && qr.payeeName ? saved.find((s) => namesMatch(s.name, qr.payeeName)) || null : null;

  let status;
  if (byVpa) status = STATUS.SAME;
  else if (claimed) status = STATUS.DIFFERENT;
  else status = STATUS.NEW;

  if (status === STATUS.DIFFERENT) {
    findings.push({ code: 'swapped', level: LEVEL.DANGER, vars: { shop: claimed.name } });
  } else if (status === STATUS.NEW) {
    findings.push({ code: qr.payeeName ? 'not_saved' : 'no_name_in_qr', level: LEVEL.CAUTION, vars: { name: qr.payeeName } });
  }
  if (qr.action && qr.action !== 'pay') findings.push({ code: 'not_a_payment_qr', level: LEVEL.DANGER });
  if (RECEIVE_WORDS.test(`${qr.note || ''} ${qr.payeeName || ''}`)) findings.push({ code: 'receive_money_trick', level: LEVEL.DANGER });

  const shop = byVpa || claimed;
  return {
    status,
    level: worst(findings),
    findings,
    shop: byVpa,
    shopName: shop?.name || qr.payeeName || qr.payeeVpa,
  };
}

/**
 * Check an amount while it is being entered.
 * Catches the extra-zero mistake against the shop's usual amount or the amount printed in the QR.
 */
export function checkAmount(amount, ctx = {}) {
  const findings = [];
  const largeLimit = ctx.largeLimit ?? 2000;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { level: LEVEL.DANGER, findings: [{ code: 'amount_invalid', level: LEVEL.DANGER }] };
  }
  const usual = ctx.usualAmount || null;
  if (usual && amount >= usual * 8) findings.push({ code: 'extra_zero', level: LEVEL.DANGER, vars: { usual } });
  else if (usual && amount >= usual * 3) findings.push({ code: 'more_than_usual', level: LEVEL.CAUTION, vars: { usual } });
  if (ctx.qrAmount != null && Math.abs(ctx.qrAmount - amount) > 0.009) {
    findings.push({ code: 'amount_differs_from_qr', level: LEVEL.CAUTION, vars: { qr: ctx.qrAmount } });
  }
  if (amount >= largeLimit) findings.push({ code: 'large_amount', level: LEVEL.CAUTION });
  return { level: worst(findings), findings };
}

/** Seconds the Pay button stays locked, so a risky payment gets a pause. */
export function pauseSeconds(level) {
  return level === LEVEL.DANGER ? 10 : 0;
}

export function combine(...levels) {
  if (levels.includes(LEVEL.DANGER)) return LEVEL.DANGER;
  if (levels.includes(LEVEL.CAUTION)) return LEVEL.CAUTION;
  return LEVEL.OK;
}

function worst(findings) {
  return combine(...findings.map((f) => f.level));
}
