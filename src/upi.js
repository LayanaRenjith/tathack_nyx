// UPI QR parsing and hand-off links.
// A UPI QR code holds a URI like:
//   upi://pay?pa=sharmamedicals@okaxis&pn=Sharma%20Medicals&am=250&cu=INR&mc=5912
// pa = payee address (UPI ID), pn = payee name, am = amount, mc = merchant category code,
// tn = transaction note, cu = currency.

const PERSONAL_HANDLE_HINTS = /^\d{10}@|^[a-z]+\.?[a-z]*\d*@(ybl|ibl|axl|okicici|oksbi|okhdfcbank|okaxis|paytm|upi)$/i;

/**
 * Parse a scanned QR string into a UPI payment object.
 * Returns { ok: false, reason } when the text is not a UPI payment QR.
 */
export function parseUpiQr(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, reason: 'empty' };
  }
  const raw = text.trim();
  if (!/^upi:\/\//i.test(raw)) {
    return { ok: false, reason: /^https?:\/\//i.test(raw) ? 'web_link' : 'not_upi', raw };
  }

  let url;
  try {
    // URL can't parse the custom scheme's host on every engine, so normalise it.
    url = new URL(raw.replace(/^upi:\/\//i, 'https://upi.local/'));
  } catch {
    return { ok: false, reason: 'malformed', raw };
  }

  const action = url.pathname.replace(/^\//, '').toLowerCase(); // "pay", "mandate", "collect"...
  const p = url.searchParams;
  const pa = (p.get('pa') || '').trim();
  const pn = (p.get('pn') || '').trim();
  const amRaw = (p.get('am') || '').trim();
  const am = amRaw === '' ? null : Number(amRaw);

  if (!pa || !pa.includes('@')) {
    return { ok: false, reason: 'no_payee', raw };
  }

  const mc = (p.get('mc') || '').trim();
  return {
    ok: true,
    raw,
    action,
    payeeVpa: pa,
    payeeName: pn,
    amount: Number.isFinite(am) ? am : null,
    note: (p.get('tn') || '').trim(),
    merchantCode: mc,
    isMerchant: Boolean(mc && mc !== '0000'),
    currency: (p.get('cu') || 'INR').toUpperCase(),
  };
}

/** Heuristic: does the UPI ID look like a personal account rather than a business one? */
export function looksPersonalVpa(vpa) {
  return PERSONAL_HANDLE_HINTS.test(vpa || '');
}

/** UPI apps Sahaaya can open directly (Android package names). 'any' shows the phone's app chooser. */
export const PAY_APPS = {
  any: { label: 'Any UPI app', package: null },
  gpay: { label: 'Google Pay', package: 'com.google.android.apps.nbu.paisa.user' },
  phonepe: { label: 'PhonePe', package: 'com.phonepe.app' },
  paytm: { label: 'Paytm', package: 'net.one97.paytm' },
  bhim: { label: 'BHIM', package: 'in.org.npci.upiapp' },
};

/**
 * Turn a upi://pay link into one that opens a specific app on Android Chrome
 * (an intent: URL naming the package). 'any' keeps the standard link, so the phone asks which app.
 */
export function appLink(upiLink, app = 'any') {
  const pkg = PAY_APPS[app]?.package;
  if (!pkg) return upiLink;
  const rest = upiLink.replace(/^upi:\/\//i, '');
  return `intent://${rest}#Intent;scheme=upi;package=${pkg};end`;
}

/**
 * Build the upi://pay link that hands the checked payment to the user's own UPI app
 * (Google Pay, PhonePe, BHIM...). The user enters their PIN there; SafeScan never sees it.
 */
export function buildUpiLink({ payeeVpa, payeeName, amount, note }) {
  const params = new URLSearchParams();
  params.set('pa', payeeVpa);
  if (payeeName) params.set('pn', payeeName);
  if (amount != null && amount > 0) params.set('am', Number(amount).toFixed(2));
  params.set('cu', 'INR');
  params.set('tn', note || 'Checked with Sahaaya');
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}
