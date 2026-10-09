import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseUpiQr, buildUpiLink, looksPersonalVpa } from '../src/upi.js';
import { namesMatch, findShop, parseIntent, wordsToNumber } from '../src/match.js';
import { checkPayment, checkAmount, pauseSeconds, LEVEL, STATUS } from '../src/safety.js';
import { rupeesInWords, formatRupees } from '../src/amount.js';
import { createTapFilter, applyKey } from '../src/keypad.js';
import { guidanceScore } from '../src/scanner.js';
import { missingKeys, t } from '../src/i18n.js';
import { deriveProfile, normaliseProfile, activeSettings, DEFAULT_PROFILE } from '../src/profile.js';
import { parseCommand } from '../src/commands.js';
import { DEMO_QRS, SAMPLE_SHOPS } from '../src/demo-codes.js';

const codes = (r) => r.findings.map((f) => f.code);
const qr = (i) => parseUpiQr(DEMO_QRS[i].text);
const saved = SAMPLE_SHOPS;

// ---------- UPI parsing ----------
test('parses a merchant UPI QR', () => {
  const q = parseUpiQr('upi://pay?pa=lakshmibakery@okaxis&pn=Lakshmi%20Bakery&am=250&mc=5462&cu=INR');
  assert.equal(q.ok, true);
  assert.equal(q.payeeVpa, 'lakshmibakery@okaxis');
  assert.equal(q.payeeName, 'Lakshmi Bakery');
  assert.equal(q.amount, 250);
  assert.equal(q.isMerchant, true);
});

test('rejects non-UPI and malformed codes', () => {
  assert.equal(parseUpiQr('https://example.com').reason, 'web_link');
  assert.equal(parseUpiQr('hello').reason, 'not_upi');
  assert.equal(parseUpiQr('upi://pay?pn=NoId').reason, 'no_payee');
  assert.equal(parseUpiQr('').reason, 'empty');
});

test('builds a UPI hand-off link', () => {
  const link = buildUpiLink({ payeeVpa: 'a@okaxis', payeeName: 'Lakshmi Bakery', amount: 250 });
  assert.match(link, /^upi:\/\/pay\?/);
  assert.match(link, /pa=a%40okaxis/);
  assert.match(link, /am=250\.00/);
  assert.match(link, /pn=Lakshmi%20Bakery/);
});

test('personal VPA heuristic', () => {
  assert.equal(looksPersonalVpa('9876543210@ybl'), true);
  assert.equal(looksPersonalVpa('sharmamedicals.62748@hdfcbank'), false);
});

// ---------- SafeScan: decisions are made on the account, not the QR's name ----------
test('A: same account as the saved shop', () => {
  const r = checkPayment(qr(0), { intendedShop: 'Lakshmi Bakery', savedShops: saved });
  assert.equal(r.status, STATUS.SAME);
  assert.equal(r.level, LEVEL.OK);
});

test('B: swapped sticker with the right name is still a different account', () => {
  const r = checkPayment(qr(1), { intendedShop: 'Lakshmi Bakery', savedShops: saved });
  assert.equal(r.status, STATUS.DIFFERENT);
  assert.equal(r.level, LEVEL.DANGER);
  assert.ok(codes(r).includes('different_account'));
  assert.ok(codes(r).includes('name_looks_right'));
});

test('C: QR amount differs from the planned amount', () => {
  const r = checkPayment(qr(2), { intendedShop: 'Lakshmi Bakery', intendedAmount: 250, savedShops: saved });
  assert.equal(r.status, STATUS.SAME);
  assert.equal(r.level, LEVEL.DANGER);
  assert.ok(codes(r).includes('amount_differs'));
});

test('D: an unsaved shop is "new, not checked", never safe', () => {
  const r = checkPayment(qr(3), { intendedShop: 'Green Tea Stall', savedShops: saved });
  assert.equal(r.status, STATUS.NEW);
  assert.equal(r.level, LEVEL.CAUTION);
  assert.ok(codes(r).includes('new_account'));
});

test('new shop whose QR names someone else gets a name hint', () => {
  const r = checkPayment(qr(3), { intendedShop: 'Ravi Stores', savedShops: [] });
  assert.ok(codes(r).includes('name_differs'));
});

test('an account saved under another shop name is pointed out', () => {
  const sharmaQr = parseUpiQr('upi://pay?pa=sharmamedicals@okaxis&pn=Sharma%20Medicals');
  const r = checkPayment(sharmaQr, { intendedShop: 'Lakshmi Bakery', savedShops: saved });
  assert.equal(r.status, STATUS.DIFFERENT);
  assert.ok(codes(r).includes('belongs_to'));
});

test('paying a saved account without naming the shop counts as same', () => {
  const r = checkPayment(qr(0), { savedShops: saved });
  assert.equal(r.status, STATUS.SAME);
  assert.equal(r.shopName, 'Lakshmi Bakery');
});

test('"scan to receive money" and mandates are danger', () => {
  assert.ok(codes(checkPayment(qr(4), {})).includes('receive_money_trick'));
  assert.ok(codes(checkPayment(parseUpiQr('upi://mandate?pa=x@ybl&pn=X'), {})).includes('not_a_payment_qr'));
});

test('QR with no name is flagged', () => {
  const r = checkPayment(parseUpiQr('upi://pay?pa=someone@okaxis'), { intendedShop: 'Tea shop' });
  assert.ok(codes(r).includes('no_name_in_qr'));
});

test('amount checks: extra zero, more than planned, large, invalid', () => {
  assert.ok(codes(checkAmount(2500, { intendedAmount: 250 })).includes('extra_zero'));
  assert.ok(codes(checkAmount(5000, { usualAmount: 500 })).includes('extra_zero'));
  assert.ok(codes(checkAmount(300, { intendedAmount: 250 })).includes('more_than_planned'));
  assert.equal(checkAmount(200, { intendedAmount: 250 }).level, LEVEL.OK);
  assert.ok(codes(checkAmount(2500)).includes('large_amount'));
  assert.equal(checkAmount(0).level, LEVEL.DANGER);
});

test('risky payments get a pause', () => {
  assert.equal(pauseSeconds(LEVEL.DANGER), 10);
  assert.equal(pauseSeconds(LEVEL.CAUTION), 3);
  assert.equal(pauseSeconds(LEVEL.OK), 0);
});

// ---------- Matching and intent ----------
test('finds saved shops by spoken name', () => {
  assert.equal(findShop(saved, 'lakshmi bakery')?.vpa, 'lakshmibakery@okaxis');
  assert.equal(findShop(saved, 'Lakshmi Bakeries')?.vpa, 'lakshmibakery@okaxis');
  assert.equal(findShop(saved, 'Ravi Stores'), null);
  assert.ok(namesMatch('Sharma Medical', 'SHARMA MEDICALS PVT LTD'));
});

test('parses spoken intent', () => {
  assert.deepEqual(parseIntent('Pay Lakshmi Bakery 250'), { shop: 'Lakshmi Bakery', amount: 250 });
  assert.deepEqual(parseIntent('Lakshmi Bakery ₹250'), { shop: 'Lakshmi Bakery', amount: 250 });
  assert.deepEqual(parseIntent('pay two hundred fifty to Lakshmi Bakery'), { shop: 'Lakshmi Bakery', amount: 250 });
  assert.deepEqual(parseIntent('Green Tea Stall'), { shop: 'Green Tea Stall', amount: null });
  assert.equal(wordsToNumber('two thousand five hundred'), 2500);
});

// ---------- Profile: setup answers reshape the app ----------
test('large reading size turns on vision support', () => {
  const p = deriveProfile({ readingSize: 30 });
  assert.equal(p.needs.vision, true);
  assert.ok(p.textScale >= 1.8);
  assert.equal(p.contrast, true);
  assert.equal(p.voice, true);
});

test('cannot read any line: maximum support', () => {
  const p = deriveProfile({ readingSize: Infinity });
  assert.equal(p.textScale, 2);
  assert.equal(p.voice, true);
});

test('overlapping needs combine', () => {
  const p = deriveProfile({ colourCorrect: false, touch: { misses: 3, doubles: 1 }, readingHard: true, wantsSimple: true });
  assert.equal(p.colourSafe, true);
  assert.equal(p.tremorSafe, true);
  assert.equal(p.dyslexiaFont, true);
  assert.equal(p.simple, true);
  assert.equal(p.pointers, true);
  assert.equal(p.bigTargets, true);
  assert.ok(activeSettings(p).length >= 6);
});

test('one stray miss does not trigger tremor mode', () => {
  assert.equal(deriveProfile({ touch: { misses: 1, doubles: 0 } }).tremorSafe, false);
});

test('hearing difficulty switches to visual alerts, not voice', () => {
  const p = deriveProfile({ heard: false });
  assert.equal(p.visualAlerts, true);
  assert.equal(p.voice, false);
});

test('skipping everything gives standard settings', () => {
  const p = deriveProfile({});
  assert.deepEqual(activeSettings(p), []);
  assert.equal(p.textScale, 1);
});

test('stored profiles gain new defaults', () => {
  const p = normaliseProfile({ lang: 'en', needs: { vision: true } });
  assert.equal(p.lang, 'en');
  assert.equal(p.needs.vision, true);
  assert.equal(p.needs.hearing, false);
  assert.equal(p.speechRate, DEFAULT_PROFILE.speechRate);
});

// ---------- Voice commands ----------
test('voice commands in English and Malayalam', () => {
  assert.equal(parseCommand('pay'), 'pay');
  assert.equal(parseCommand('please read this'), 'read');
  assert.equal(parseCommand('make it bigger'), 'bigger');
  assert.equal(parseCommand('go back'), 'back');
  assert.equal(parseCommand('slower please'), 'slower');
  assert.equal(parseCommand('വലുതാക്കൂ'), 'bigger');
  assert.equal(parseCommand('പതുക്കെ'), 'slower');
  assert.equal(parseCommand('തിരികെ പോകൂ'), 'back');
  assert.equal(parseCommand('ക്രമീകരണങ്ങൾ'), 'settings');
  assert.equal(parseCommand('banana'), null);
});

// ---------- Helpers ----------
test('amounts in Indian words', () => {
  assert.equal(rupeesInWords(250), 'two hundred fifty rupees');
  assert.equal(rupeesInWords(125000), 'one lakh twenty five thousand rupees');
  assert.equal(formatRupees(125000), '₹1,25,000');
});

test('tremor filter ignores double taps and brushes', () => {
  const accept = createTapFilter({ debounceMs: 600, minHoldMs: 60 });
  assert.equal(accept({ downAt: 0, upAt: 100, key: '5' }), true);
  assert.equal(accept({ downAt: 150, upAt: 260, key: '5' }), false);
  assert.equal(accept({ downAt: 900, upAt: 920, key: '0' }), false);
  assert.equal(accept({ downAt: 1000, upAt: 1100, key: '0' }), true);
  assert.equal(applyKey('50', 'back'), '5');
});

test('vibration guidance grows as the QR gets bigger and centred', () => {
  const far = guidanceScore({ x: 0, y: 0, width: 60, height: 60 }, 1280, 720);
  const close = guidanceScore({ x: 440, y: 160, width: 400, height: 400 }, 1280, 720);
  assert.ok(close > far && close > 0.8);
});

test('Malayalam and English have every string', () => {
  assert.deepEqual(missingKeys(), []);
  assert.match(t('ml', 's_different_detail', { shop: 'Lakshmi Bakery' }), /Lakshmi Bakery/);
});
