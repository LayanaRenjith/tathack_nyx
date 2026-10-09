import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseUpiQr, buildUpiLink, appLink, looksPersonalVpa } from '../src/upi.js';
import { namesMatch, findShop, parseIntent, wordsToNumber } from '../src/match.js';
import { checkPayment, checkAmount, pauseSeconds, combine, LEVEL, STATUS } from '../src/safety.js';
import { rupeesInWords, formatRupees } from '../src/amount.js';
import { createTapFilter, applyKey } from '../src/keypad.js';
import { guidanceScore } from '../src/scanner.js';
import { missingKeys, t, yesNo } from '../src/i18n.js';
import { deriveProfile, normaliseProfile, activeSettings, speaks, DEFAULT_PROFILE } from '../src/profile.js';
import { hashCode, checkCode, newSalt } from '../src/auth.js';
import { normalisePhone, whatsappLink, smsLink, overLimit, spentToday } from '../src/family.js';
import { createTapWatcher } from '../src/adapt.js';
import { parseCommand } from '../src/commands.js';
import { DEMO_QRS, SAMPLE_SHOPS } from '../src/demo-codes.js';

const codes = (r) => r.findings.map((f) => f.code);
const qr = (i) => parseUpiQr(DEMO_QRS[i].text);
const savedShops = SAMPLE_SHOPS;

// ---------- UPI ----------
test('parses a merchant UPI QR', () => {
  const q = parseUpiQr('upi://pay?pa=lakshmibakery@okaxis&pn=Lakshmi%20Bakery&am=250&mc=5462&cu=INR');
  assert.equal(q.ok, true);
  assert.equal(q.payeeVpa, 'lakshmibakery@okaxis');
  assert.equal(q.payeeName, 'Lakshmi Bakery');
  assert.equal(q.amount, 250);
});

test('rejects non-UPI and malformed codes', () => {
  assert.equal(parseUpiQr('https://example.com').reason, 'web_link');
  assert.equal(parseUpiQr('hello').reason, 'not_upi');
  assert.equal(parseUpiQr('upi://pay?pn=NoId').reason, 'no_payee');
});

test('builds the standard UPI link and app-specific links', () => {
  const link = buildUpiLink({ payeeVpa: 'a@okaxis', payeeName: 'Lakshmi Bakery', amount: 250 });
  assert.match(link, /^upi:\/\/pay\?pa=a%40okaxis/);
  assert.match(link, /am=250\.00/);
  assert.equal(appLink(link, 'any'), link);
  const g = appLink(link, 'gpay');
  assert.match(g, /^intent:\/\/pay\?pa=a%40okaxis/);
  assert.match(g, /#Intent;scheme=upi;package=com\.google\.android\.apps\.nbu\.paisa\.user;end$/);
  assert.match(appLink(link, 'phonepe'), /package=com\.phonepe\.app/);
});

test('personal VPA heuristic', () => {
  assert.equal(looksPersonalVpa('9876543210@ybl'), true);
  assert.equal(looksPersonalVpa('sharmamedicals.62748@hdfcbank'), false);
});

// ---------- The payment check: decided on the account, never on the QR's name ----------
test('a saved shop is recognised from its account', () => {
  const r = checkPayment(qr(0), { savedShops });
  assert.equal(r.status, STATUS.SAME);
  assert.equal(r.level, LEVEL.OK);
  assert.equal(r.shopName, 'Lakshmi Bakery');
});

test('a swapped sticker using the saved shop\'s name is caught', () => {
  const r = checkPayment(qr(1), { savedShops });
  assert.equal(r.status, STATUS.DIFFERENT);
  assert.equal(r.level, LEVEL.DANGER);
  assert.deepEqual(codes(r), ['swapped']);
  assert.equal(r.shopName, 'Lakshmi Bakery');
});

test('a swapped sticker with another name is "not one of your shops"', () => {
  const r = checkPayment(qr(2), { savedShops });
  assert.equal(r.status, STATUS.NEW);
  assert.equal(r.level, LEVEL.CAUTION);
  assert.ok(codes(r).includes('not_saved'));
});

test('an unsaved shop is never called safe', () => {
  const r = checkPayment(qr(3), { savedShops });
  assert.equal(r.status, STATUS.NEW);
  assert.notEqual(r.level, LEVEL.OK);
});

test('with nothing saved, everything is new', () => {
  assert.equal(checkPayment(qr(0), { savedShops: [] }).status, STATUS.NEW);
});

test('account comparison ignores case and spaces', () => {
  const q = parseUpiQr('upi://pay?pa=LakshmiBakery@OKAXIS&pn=LB');
  assert.equal(checkPayment(q, { savedShops }).status, STATUS.SAME);
});

test('"scan to receive money", mandates and nameless QRs', () => {
  assert.ok(codes(checkPayment(qr(4), {})).includes('receive_money_trick'));
  assert.equal(checkPayment(qr(4), {}).level, LEVEL.DANGER);
  assert.ok(codes(checkPayment(parseUpiQr('upi://mandate?pa=x@ybl&pn=X'), {})).includes('not_a_payment_qr'));
  assert.ok(codes(checkPayment(parseUpiQr('upi://pay?pa=someone@okaxis'), {})).includes('no_name_in_qr'));
});

test('amount checks', () => {
  assert.ok(codes(checkAmount(2500, { usualAmount: 250 })).includes('extra_zero'));
  assert.equal(checkAmount(2500, { usualAmount: 250 }).level, LEVEL.DANGER);
  assert.ok(codes(checkAmount(800, { usualAmount: 250 })).includes('more_than_usual'));
  assert.equal(checkAmount(260, { usualAmount: 250 }).level, LEVEL.OK);
  assert.ok(codes(checkAmount(300, { qrAmount: 250 })).includes('amount_differs_from_qr'));
  assert.ok(codes(checkAmount(2500)).includes('large_amount'));
  assert.equal(checkAmount(0).level, LEVEL.DANGER);
});

test('pause only on danger; levels combine', () => {
  assert.equal(pauseSeconds(LEVEL.DANGER), 10);
  assert.equal(pauseSeconds(LEVEL.CAUTION), 0);
  assert.equal(combine(LEVEL.OK, LEVEL.CAUTION), LEVEL.CAUTION);
  assert.equal(combine(LEVEL.CAUTION, LEVEL.DANGER), LEVEL.DANGER);
});

// ---------- Profile: needs ticked by the user or family ----------
test('needs combine into one profile', () => {
  const p = deriveProfile({ needs: ['seeing', 'hands', 'colour'], payApp: 'gpay' });
  assert.equal(p.contrast, true);
  assert.equal(p.voice, true);
  assert.equal(p.tremorSafe, true);
  assert.equal(p.colourSafe, true);
  assert.equal(p.payApp, 'gpay');
  assert.ok(p.textScale >= 1.5);
  assert.equal(p.handsFree, true);
});

test('simple mode slows speech and protects taps', () => {
  const p = deriveProfile({ needs: ['simple'] });
  assert.equal(p.simple, true);
  assert.equal(p.tremorSafe, true);
  assert.ok(p.speechRate < 1);
});

test('hearing need uses visual alerts instead of voice', () => {
  const p = deriveProfile({ needs: ['hearing'] });
  assert.equal(p.visualAlerts, true);
  assert.equal(p.voice, false);
  assert.equal(deriveProfile({ needs: ['hearing', 'seeing'] }).voice, true);
});

test('no needs gives standard settings; stored profiles gain defaults', () => {
  assert.deepEqual(activeSettings(deriveProfile({ needs: [] })), []);
  const p = normaliseProfile({ lang: 'en', junk: 1 });
  assert.equal(p.lang, 'en');
  assert.equal(p.payApp, DEFAULT_PROFILE.payApp);
  assert.equal('junk' in p, false);
});

// ---------- Learns as you use ----------
test('offers bigger buttons after repeated missed taps, once', () => {
  const w = createTapWatcher({ missLimit: 3 });
  assert.equal(w.tap(null, 0), false);
  assert.equal(w.tap(null, 100), false);
  assert.equal(w.tap(null, 200), true);
  w.markOffered();
  assert.equal(w.tap(null, 300), false);
});

test('offers bigger buttons after tremor double taps', () => {
  const w = createTapWatcher({ doubleLimit: 2, doubleMs: 450 });
  const b = {};
  w.tap(b, 0); w.tap(b, 200); w.tap(b, 1000);
  assert.equal(w.tap(b, 1200), true);
  assert.deepEqual(w.stats(), { misses: 0, doubles: 2 });
});

// ---------- Matching, commands, helpers ----------
test('saved shop lookup and spoken numbers', () => {
  assert.equal(findShop(savedShops, 'lakshmi bakery')?.vpa, 'lakshmibakery@okaxis');
  assert.equal(findShop(savedShops, 'Ravi Stores'), null);
  assert.ok(namesMatch('Sharma Medical', 'SHARMA MEDICALS PVT LTD'));
  assert.equal(wordsToNumber('two thousand five hundred'), 2500);
  assert.deepEqual(parseIntent('Pay Lakshmi Bakery 250'), { shop: 'Lakshmi Bakery', amount: 250 });
});

test('voice commands in English and Malayalam', () => {
  assert.equal(parseCommand('please read this'), 'read');
  assert.equal(parseCommand('make it bigger'), 'bigger');
  assert.equal(parseCommand('go back'), 'back');
  assert.equal(parseCommand('വലുതാക്കൂ'), 'bigger');
  assert.equal(parseCommand('പതുക്കെ'), 'slower');
  assert.equal(parseCommand('എന്റെ കടകൾ'), 'shops');
  assert.equal(parseCommand('पीछे जाओ'), 'back');
  assert.equal(parseCommand('बड़ा करो'), 'bigger');
  assert.equal(parseCommand('வரலாறு'), 'history');
  assert.equal(parseCommand('மெதுவாக'), 'slower');
  assert.equal(parseCommand('banana'), null);
});

test('amounts in Indian words', () => {
  assert.equal(rupeesInWords(250), 'two hundred fifty rupees');
  assert.equal(rupeesInWords(125000), 'one lakh twenty five thousand rupees');
  assert.equal(formatRupees(125000), '₹1,25,000');
});

test('tremor-tolerant keypad', () => {
  const accept = createTapFilter({ debounceMs: 600, minHoldMs: 60 });
  assert.equal(accept({ downAt: 0, upAt: 100, key: '5' }), true);
  assert.equal(accept({ downAt: 150, upAt: 260, key: '5' }), false);
  assert.equal(accept({ downAt: 900, upAt: 920, key: '0' }), false);
  assert.equal(accept({ downAt: 1000, upAt: 1100, key: '0' }), true);
  assert.equal(applyKey('50', 'back'), '5');
});

test('camera guidance grows as the QR gets bigger and centred', () => {
  const far = guidanceScore({ x: 0, y: 0, width: 60, height: 60 }, 1280, 720);
  const close = guidanceScore({ x: 440, y: 160, width: 400, height: 400 }, 1280, 720);
  assert.ok(close > far && close > 0.8);
});

test('all four languages have every string', () => {
  assert.deepEqual(missingKeys(), []);
  for (const l of ['ml', 'en', 'hi', 'ta']) assert.match(t(l, 'r_swapped', { shop: 'Lakshmi Bakery' }), /Lakshmi Bakery/);
});

test('hands-free yes / no in four languages', () => {
  assert.equal(yesNo('yes'), 'yes');
  assert.equal(yesNo('ok pay it'), 'yes');
  assert.equal(yesNo('അതെ'), 'yes');
  assert.equal(yesNo('हाँ भेजो'), 'yes');
  assert.equal(yesNo('ஆம்'), 'yes');
  assert.equal(yesNo('no wait'), 'no');
  assert.equal(yesNo('വേണ്ട'), 'no');
  assert.equal(yesNo('नहीं'), 'no');
  assert.equal(yesNo('nothing here'), null);
});

test('screen reader users: Sahaaya stays quiet', () => {
  const p = deriveProfile({ needs: ['screenreader'] });
  assert.equal(p.screenReader, true);
  assert.equal(speaks(p), false);
  assert.equal(p.handsFree, true);
  assert.equal(speaks(deriveProfile({ needs: ['seeing'] })), true);
});

test('app lock code is stored only as a salted hash', async () => {
  const salt = newSalt();
  const codeHash = await hashCode('2580', salt);
  assert.notEqual(codeHash, '2580');
  assert.equal(await checkCode('2580', { codeHash, salt }), true);
  assert.equal(await checkCode('0000', { codeHash, salt }), false);
  assert.equal(await checkCode('25', { codeHash, salt }), false);
});

test('family alert links', () => {
  assert.equal(normalisePhone('98470 12345'), '919847012345');
  assert.equal(normalisePhone('+91 98470-12345'), '919847012345');
  assert.equal(normalisePhone('09847012345'), '919847012345');
  assert.match(whatsappLink('9847012345', 'Is this OK?'), /^https:\/\/wa\.me\/919847012345\?text=Is%20this%20OK%3F$/);
  assert.match(smsLink('9847012345', 'hi'), /^sms:\+919847012345\?body=hi$/);
});

test('payment limits: per payment and per day', () => {
  const now = new Date(2026, 9, 9, 18, 0).getTime();
  const history = [{ amount: 3000, at: now - 3600e3 }, { amount: 9999, at: now - 2 * 864e5 }];
  assert.equal(spentToday(history, now), 3000);
  assert.deepEqual(overLimit(2500, { perPayment: 2000 }, [], now), { reason: 'payment', limit: 2000 });
  assert.deepEqual(overLimit(2500, { perPayment: 5000, daily: 5000 }, history, now), { reason: 'daily', limit: 5000 });
  assert.equal(overLimit(1500, { perPayment: 2000, daily: 5000 }, history, now), null);
  assert.equal(overLimit(500, {}, history, now), null);
});
