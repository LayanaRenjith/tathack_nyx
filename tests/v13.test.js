import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scanOutcome, feedbackPlan, createFeedbackGate, blocks, OUTCOME, PATTERNS } from '../src/feedback.js';
import { newApproval, stateOf, markSent, receiveCode, receivePin, receiveDecline, REQ, REQUEST_TTL_MS } from '../src/approval-state.js';
import { makeGuardian, approvalCode } from '../src/guardian.js';
import { suggestFromComfort, changesFrom } from '../src/comfort.js';
import { isSwipe } from '../src/keypad.js';
import { parseUpiQr, buildUpiLink } from '../src/upi.js';
import { checkPayment } from '../src/safety.js';
import { DEFAULT_PROFILE, speaks, voiceDriven, normaliseProfile } from '../src/profile.js';
import { DEMO_QRS, SAMPLE_SHOPS } from '../src/demo-codes.js';
import en from '../src/lang/en.js';
import ml from '../src/lang/ml.js';
import hi from '../src/lang/hi.js';
import ta from '../src/lang/ta.js';

const scan = (i) => { const qr = parseUpiQr(DEMO_QRS[i].text); return { qr, check: qr.ok ? checkPayment(qr, { savedShops: SAMPLE_SHOPS }) : null }; };

// ---------- Scan feedback ----------
test('each kind of QR gets its own outcome', () => {
  const o = (i) => { const { qr, check } = scan(i); return scanOutcome(qr, check); };
  assert.equal(o(0), OUTCOME.SAVED);       // Lakshmi Bakery, saved account
  assert.equal(o(1), OUTCOME.MISMATCH);    // Lakshmi Bakery name, other account
  assert.equal(o(2), OUTCOME.NEW);         // unknown account
  assert.equal(o(4), OUTCOME.SUSPICIOUS);  // "scan to receive refund"
  assert.equal(o(5), OUTCOME.UNSUPPORTED); // website
  assert.equal(scanOutcome(parseUpiQr('upi://pay?pn=NoId'), null), OUTCOME.UNREADABLE);
});

test('patterns are distinct, and saved/new never block', () => {
  assert.notDeepEqual(PATTERNS.saved, PATTERNS.new);
  assert.notDeepEqual(PATTERNS.new, PATTERNS.mismatch);
  assert.notDeepEqual(PATTERNS.mismatch, PATTERNS.unsupported);
  assert.equal(blocks(OUTCOME.SAVED), false);
  assert.equal(blocks(OUTCOME.NEW), false);
  for (const x of [OUTCOME.MISMATCH, OUTCOME.SUSPICIOUS, OUTCOME.UNSUPPORTED, OUTCOME.UNREADABLE]) assert.equal(blocks(x), true);
});

test('vibration off or unsupported: no buzz, but the visual result always stays', () => {
  const off = feedbackPlan(OUTCOME.MISMATCH, { haptics: false });
  assert.equal(off.vibrate, null);
  assert.equal(off.visual, true);
  const unsupported = feedbackPlan(OUTCOME.MISMATCH, {}, { vibrate: false });
  assert.equal(unsupported.vibrate, null);
  assert.equal(unsupported.visual, true);
  assert.deepEqual(feedbackPlan(OUTCOME.SAVED, {}).vibrate, PATTERNS.saved);
});

test('every combination of sound, vibration and visual alerts keeps the visual result', () => {
  for (const sounds of [true, false]) for (const haptics of [true, false]) for (const visualAlerts of [true, false]) for (const silent of [true, false]) {
    const plan = feedbackPlan(OUTCOME.MISMATCH, { sounds, haptics, visualAlerts, silent }, { vibrate: true });
    assert.equal(plan.visual, true);
    assert.equal(Boolean(plan.sound), sounds && !silent);
    assert.equal(Boolean(plan.vibrate), haptics);
    assert.equal(plan.flash, visualAlerts);
  }
});

test('the same QR seen again within the cooldown gives no second buzz', () => {
  const gate = createFeedbackGate({ cooldownMs: 4000 });
  assert.equal(gate('a@x', 1000), true);
  assert.equal(gate('a@x', 1500), false);
  assert.equal(gate('a@x', 3900), false);
  assert.equal(gate('b@x', 4000), true, 'a different code is new feedback');
  assert.equal(gate('b@x', 9000), true, 'after the cooldown it is a fresh scan');
});

// ---------- Keypad scrolling ----------
test('a swipe over the keypad is a scroll, not a key press; tremor drift still counts as a tap', () => {
  assert.equal(isSwipe({ x: 100, y: 300 }, { clientX: 104, clientY: 306 }), false);
  assert.equal(isSwipe({ x: 100, y: 300 }, { clientX: 100, clientY: 220 }), true);
});

// ---------- Helper approval states ----------
const pay = { vpa: 'chhotu.t99@ybl', amount: 250 };

test('request goes idle → pending → approved only with a valid code for this payment', async () => {
  const g = await makeGuardian('4821');
  let r = newApproval(0, 'req001');
  assert.equal(stateOf(r, 0), REQ.IDLE);
  r = markSent(r, 1000);
  assert.equal(stateOf(r, 2000), REQ.PENDING);
  const wrong = await receiveCode(r, '123456', g, pay, 3000);
  assert.equal(wrong.result, 'invalid');
  assert.equal(stateOf(wrong.request, 3000), REQ.PENDING, 'a wrong code never approves');
  const code = await approvalCode(g.key, { id: 'req001', ...pay });
  const other = await receiveCode(r, code, g, { ...pay, amount: 2500 }, 3000);
  assert.equal(other.result, 'invalid', 'a code for ₹250 does not unlock ₹2,500');
  const ok = await receiveCode(r, code, g, pay, 3000);
  assert.equal(ok.result, 'approved');
  assert.equal(stateOf(ok.request, 3000), REQ.APPROVED);
});

test('a request expires after 15 minutes and then accepts no code', async () => {
  const g = await makeGuardian('4821');
  const r = markSent(newApproval(0, 'req002'), 0);
  const code = await approvalCode(g.key, { id: 'req002', ...pay });
  assert.equal(stateOf(r, REQUEST_TTL_MS + 1), REQ.EXPIRED);
  const late = await receiveCode(r, code, g, pay, REQUEST_TTL_MS + 1);
  assert.equal(late.result, 'expired');
});

test('"don\'t pay" from the helper blocks, even after an approval on this screen', async () => {
  const g = await makeGuardian('4821');
  let r = markSent(newApproval(0, 'req003'), 0);
  r = (await receiveCode(r, await approvalCode(g.key, { id: 'req003', ...pay }), g, pay, 10)).request;
  r = receiveDecline(r);
  assert.equal(stateOf(r, 20), REQ.REJECTED);
  assert.equal((await receivePin(r, '4821', g, 30)).result, 'rejected');
});

test('helper at the phone: their PIN approves, a wrong PIN does not', async () => {
  const g = await makeGuardian('4821');
  const r = newApproval(0, 'req004');
  assert.equal((await receivePin(r, '1111', g)).result, 'invalid');
  assert.equal((await receivePin(r, '4821', g)).result, 'approved');
});

// ---------- Silent mode ----------
test('silent mode silences speech without touching any other setting', () => {
  const before = normaliseProfile({ ...DEFAULT_PROFILE, voice: true, voiceOnly: true, lang: 'ta', textScale: 1.45, contrast: true });
  const after = { ...before, silent: true };
  assert.equal(speaks(before), true);
  assert.equal(speaks(after), false);
  assert.equal(voiceDriven(after), false);
  for (const k of ['lang', 'textScale', 'contrast', 'voice', 'voiceOnly', 'bigTargets']) assert.equal(after[k], before[k]);
  assert.equal(normaliseProfile(JSON.parse(JSON.stringify(after))).silent, true, 'persists through storage');
});

// ---------- Comfort try-out ----------
test('skipping everything changes nothing', () => {
  const base = { ...DEFAULT_PROFILE };
  assert.deepEqual(changesFrom(suggestFromComfort({}, base), base), []);
});

test('choices map onto existing settings', () => {
  const base = { ...DEFAULT_PROFILE };
  const s = suggestFromComfort({ button: 'xlarge', text: 1.6, contrast: true, guidance: 'visual', alerts: ['vibration', 'visual'], misses: 3 }, base);
  assert.equal(s.bigTargets, true);
  assert.equal(s.textScale, 1.6);
  assert.equal(s.contrast, true);
  assert.equal(s.silent, true);
  assert.equal(s.voice, false);
  assert.equal(s.sounds, false);
  assert.equal(s.haptics, true);
  assert.equal(s.visualAlerts, true);
  assert.equal(s.tremorSafe, true, 'missed taps offer steadier controls');
  assert.ok(changesFrom(s, base).includes('textScale'));
});

// ---------- Payment flow promises ----------
test('the UPI link carries no PIN and Sahaaya never asks for one', () => {
  const link = buildUpiLink({ payeeVpa: 'a@okaxis', payeeName: 'Lakshmi Bakery', amount: 250 });
  assert.equal(/pin/i.test(link), false);
  assert.match(link, /am=250\.00/, 'the exact amount is carried through');
});

test('no language claims a payment succeeded; the hand-off says the UPI app shows the result', () => {
  for (const [code, L] of Object.entries({ en, ml, hi, ta })) {
    assert.ok(L.result_in_app, `${code}.result_in_app`);
    assert.ok(L.pin_note, `${code}.pin_note`);
  }
  assert.equal(Object.values(en).some((v) => /payment (was )?successful|payment complete/i.test(v)), false);
});
