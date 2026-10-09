// SafeScan engine: compares a scanned QR with what the user intends to pay.
//
// Key idea: the name written inside a UPI QR can be anything, and UPI apps ignore it in favour of
// the bank-verified name. So SafeScan decides on the UPI ID (account), compared with the account the
// user saved for that shop. Results are never "safe": only same / different / new (not checked).
// Pure functions, no network: works offline.

import { findShop, namesMatch } from './match.js';

export const LEVEL = { OK: 'ok', CAUTION: 'caution', DANGER: 'danger' };
export const STATUS = { SAME: 'same', DIFFERENT: 'different', NEW: 'new' };

const RECEIVE_WORDS = /\b(receive|refund|cashback|prize|reward|lottery|won|claim|credit to you|get money)\b/i;
const sameVpa = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/**
 * Check a parsed QR (from parseUpiQr, ok: true) against the user's intent.
 * @param {object} qr
 * @param {object} ctx
 * @param {string} [ctx.intendedShop]   the shop the user said they are paying
 * @param {number} [ctx.intendedAmount] the amount the user planned to pay
 * @param {Array}  [ctx.savedShops]     [{ name, vpa, usualAmount }]
 * @returns {{ status, level, findings: Array<{code, level, vars?}>, shop }}
 */
export function checkPayment(qr, ctx = {}) {
  const saved = ctx.savedShops || [];
  const findings = [];
  const named = findShop(saved, ctx.intendedShop);
  const byVpa = saved.find((s) => sameVpa(s.vpa, qr.payeeVpa)) || null;
  const shopName = named?.name || ctx.intendedShop || byVpa?.name || qr.payeeName || '';

  let status;
  if (named) {
    status = sameVpa(named.vpa, qr.payeeVpa) ? STATUS.SAME : STATUS.DIFFERENT;
  } else if (byVpa && !ctx.intendedShop) {
    status = STATUS.SAME; // paying a saved shop without naming it first
  } else {
    status = STATUS.NEW;
  }

  if (status === STATUS.DIFFERENT) {
    findings.push({ code: 'different_account', level: LEVEL.DANGER, vars: { shop: named.name } });
    if (qr.payeeName && namesMatch(named.name, qr.payeeName)) {
      // The swapped-sticker case: the QR claims the right name but pays another account.
      findings.push({ code: 'name_looks_right', level: LEVEL.DANGER });
    }
    if (byVpa && byVpa !== named) {
      findings.push({ code: 'belongs_to', level: LEVEL.CAUTION, vars: { other: byVpa.name } });
    }
  } else if (status === STATUS.NEW) {
    findings.push({ code: 'new_account', level: LEVEL.CAUTION });
    if (ctx.intendedShop && qr.payeeName && !namesMatch(ctx.intendedShop, qr.payeeName)) {
      findings.push({ code: 'name_differs', level: LEVEL.CAUTION, vars: { name: qr.payeeName, shop: ctx.intendedShop } });
    }
    if (!qr.payeeName) findings.push({ code: 'no_name_in_qr', level: LEVEL.CAUTION });
  }

  if (qr.action && qr.action !== 'pay') {
    findings.push({ code: 'not_a_payment_qr', level: LEVEL.DANGER });
  }
  if (RECEIVE_WORDS.test(`${qr.note || ''} ${qr.payeeName || ''}`)) {
    findings.push({ code: 'receive_money_trick', level: LEVEL.DANGER });
  }
  if (qr.amount != null && ctx.intendedAmount && Math.abs(qr.amount - ctx.intendedAmount) > 0.009) {
    findings.push({ code: 'amount_differs', level: LEVEL.DANGER, vars: { qr: qr.amount, planned: ctx.intendedAmount } });
  }

  return { status, level: worst(findings, status), findings, shop: named || byVpa || null, shopName };
}

/**
 * Check the amount the user is about to pay (after the keypad).
 * Catches the extra-zero mistake and amounts different from the plan.
 */
export function checkAmount(amount, ctx = {}) {
  const findings = [];
  const largeLimit = ctx.largeLimit ?? 2000;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { level: LEVEL.DANGER, findings: [{ code: 'amount_invalid', level: LEVEL.DANGER }] };
  }
  const ref = ctx.intendedAmount || ctx.usualAmount || null;
  if (ref && amount >= ref * 8) {
    findings.push({ code: 'extra_zero', level: LEVEL.DANGER, vars: { usual: ref } });
  } else if (ctx.intendedAmount && amount > ctx.intendedAmount + 0.009) {
    findings.push({ code: 'more_than_planned', level: LEVEL.CAUTION, vars: { planned: ctx.intendedAmount } });
  } else if (ctx.usualAmount && amount >= ctx.usualAmount * 3) {
    findings.push({ code: 'more_than_usual', level: LEVEL.CAUTION, vars: { usual: ctx.usualAmount } });
  }
  if (amount >= largeLimit) findings.push({ code: 'large_amount', level: LEVEL.CAUTION });
  return { level: worst(findings), findings };
}

/** Seconds the Pay button stays locked, so a risky payment gets a pause. */
export function pauseSeconds(level) {
  return level === LEVEL.DANGER ? 10 : level === LEVEL.CAUTION ? 3 : 0;
}

function worst(findings, status) {
  if (findings.some((f) => f.level === LEVEL.DANGER)) return LEVEL.DANGER;
  if (findings.some((f) => f.level === LEVEL.CAUTION) || status === STATUS.NEW) return LEVEL.CAUTION;
  return LEVEL.OK;
}
