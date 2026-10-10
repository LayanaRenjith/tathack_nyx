// Practice data and rules, kept free of the page so they can be tested.

import { makeGuardian } from './guardian.js';
import { normaliseProfile } from './profile.js';

export const PRACTICE_HELPER = { name: 'Ravi', phone: '9000000000', relation: '' };
export const PRACTICE_PIN = '1234'; // pretend helper's Guardian PIN, used only inside practice

/** A fresh pretend world, starting from the person's own look-and-feel settings. */
export async function practiceSeed(real, { helperName = 'Ravi', youName = 'You' } = {}, now = Date.now()) {
  const day = 86400000;
  const shops = [
    { name: 'Lakshmi Bakery', vpa: 'lakshmibakery@okaxis', usualAmount: 250 },
    { name: 'Sharma Medicals', vpa: 'sharmamedicals@okaxis', usualAmount: 500 },
  ];
  const history = [
    { name: 'Lakshmi Bakery', vpa: shops[0].vpa, amount: 250, status: 'same', at: now - 2 * day },
    { name: 'Sharma Medicals', vpa: shops[1].vpa, amount: 480, status: 'same', at: now - 6 * day },
    { name: 'Lakshmi Bakery', vpa: shops[0].vpa, amount: 300, status: 'same', at: now - 33 * day },
    { name: 'Lakshmi Bakery', vpa: 'lakshmi.bakery7@ybl', amount: 900, status: 'different', at: now - 40 * day },
  ];
  return {
    setupDone: true,
    user: { name: real.user?.name || youName, phone: '', helper: false },
    lock: { type: 'none', credId: null, codeHash: null, salt: null },
    profile: normaliseProfile({ ...real.profile }),
    trusted: [{ ...PRACTICE_HELPER, name: helperName }],
    limits: { perPayment: 2000, daily: 5000, newShops: true },
    guardian: await makeGuardian(PRACTICE_PIN),
    savedShops: shops,
    history,
    largeLimit: 2000,
    reportsSent: {},
    milestones: { ...(real.milestones || {}) },
  };
}

/** In practice nothing may leave the phone: links to WhatsApp, SMS, calls and UPI apps are stopped. */
export function linkKind(href = '') {
  if (/^https:\/\/wa\.me\//.test(href)) return 'px_whatsapp';
  if (/^sms:/.test(href)) return 'px_sms';
  if (/^tel:/.test(href)) return 'px_phone';
  if (/^(upi|intent|tez|phonepe|paytmmp):/i.test(href)) return 'px_upi';
  return null;
}

