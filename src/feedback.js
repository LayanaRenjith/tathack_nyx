// What the user feels, hears and sees after a scan. One decision per scan, from the final result,
// never from camera frames. Every outcome is always shown on screen; vibration and sound are extras
// that follow the user's settings and the phone's support, and never decide whether a payment can go ahead.

export const OUTCOME = {
  SAVED: 'saved',           // the account of a saved shop (a match, not an independent verification)
  NEW: 'new',               // an account Sahaaya has not seen: not checked
  MISMATCH: 'mismatch',     // claims a saved shop's name, pays a different account
  SUSPICIOUS: 'suspicious', // receive-money trick, mandate or other non-payment request
  UNSUPPORTED: 'unsupported', // a website or another kind of code: not a UPI payment
  UNREADABLE: 'unreadable', // damaged or incomplete payment code
};

/** Distinct patterns: one short buzz, two medium, three long, five quick. */
export const PATTERNS = {
  saved: [70],
  new: [180, 120, 180],
  mismatch: [500, 180, 500, 180, 500],
  suspicious: [500, 180, 500, 180, 500],
  unsupported: [60, 60, 60, 60, 60],
  unreadable: [60, 60, 60, 60, 60],
};

const SOUNDS = { saved: 'ok', new: 'caution', mismatch: 'danger', suspicious: 'danger', unsupported: 'caution', unreadable: 'caution' };

/** Classify a parsed QR and its check into one outcome. */
export function scanOutcome(qr, check) {
  if (!qr?.ok) return qr?.reason === 'no_payee' ? OUTCOME.UNREADABLE : OUTCOME.UNSUPPORTED;
  if (check?.status === 'different') return OUTCOME.MISMATCH;
  if (check?.level === 'danger') return OUTCOME.SUSPICIOUS;
  if (check?.status === 'same') return OUTCOME.SAVED;
  return OUTCOME.NEW;
}

/** True for outcomes that must stop the flow until the user acknowledges them. */
export const blocks = (outcome) => [OUTCOME.MISMATCH, OUTCOME.SUSPICIOUS, OUTCOME.UNSUPPORTED, OUTCOME.UNREADABLE].includes(outcome);

/**
 * What to do for an outcome, given the user's settings and what the phone supports.
 * @returns {{ visual: true, vibrate: number[]|null, sound: string|null, flash: boolean }}
 */
export function feedbackPlan(outcome, prefs = {}, support = {}) {
  const canVibrate = support.vibrate !== false;
  const quiet = Boolean(prefs.silent);
  return {
    visual: true, // never optional: the on-screen result is the source of truth
    vibrate: prefs.haptics !== false && canVibrate ? PATTERNS[outcome] || null : null,
    sound: prefs.sounds !== false && !quiet && support.audio !== false ? SOUNDS[outcome] || null : null,
    flash: Boolean(prefs.visualAlerts) && blocks(outcome),
  };
}

/**
 * Plays feedback for a scanned code once: the same code seen again within `cooldownMs`
 * (camera still pointing at it, a quick re-scan) gives no second buzz.
 */
export function createFeedbackGate({ cooldownMs = 4000 } = {}) {
  let last = null;
  let lastAt = -Infinity;
  return (text, now = Date.now()) => {
    if (text === last && now - lastAt < cooldownMs) return false;
    last = text;
    lastAt = now;
    return true;
  };
}
