import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseUpiQr, buildUpiLink, looksPersonalVpa } from '../src/upi.js';
import { nameSimilarity, namesMatch, vpaMentions } from '../src/match.js';
import { checkPayee, checkAmount, pauseSeconds, LEVEL } from '../src/safety.js';
import { rupeesInWords, formatRupees } from '../src/amount.js';
import { parseAnnouncement } from '../src/soundbox.js';
import { createTapFilter, applyKey } from '../src/keypad.js';
import { guidanceScore } from '../src/scanner.js';
import { hasAllKeys, t } from '../src/i18n.js';
import { DEMO_QRS } from '../src/demo-codes.js';

const codes = (r) => r.findings.map((f) => f.code);

test('parses a merchant UPI QR', () => {
  const q = parseUpiQr('upi://pay?pa=sharmamedicals@okaxis&pn=Sharma%20Medicals&am=250&mc=5912&cu=INR');
  assert.equal(q.ok, true);
  assert.equal(q.payeeVpa, 'sharmamedicals@okaxis');
  assert.equal(q.payeeName, 'Sharma Medicals');
  assert.equal(q.amount, 250);
  assert.equal(q.isMerchant, true);
});

test('rejects non-UPI and malformed codes', () => {
  assert.equal(parseUpiQr('https://example.com').reason, 'web_link');
  assert.equal(parseUpiQr('hello').reason, 'not_upi');
  assert.equal(parseUpiQr('upi://pay?pn=NoId').reason, 'no_payee');
  assert.equal(parseUpiQr('').reason, 'empty');
});

test('builds a UPI hand-off link without a PIN or secrets', () => {
  const link = buildUpiLink({ payeeVpa: 'a@okaxis', payeeName: 'Sharma Medicals', amount: 500 });
  assert.match(link, /^upi:\/\/pay\?/);
  assert.match(link, /pa=a%40okaxis/);
  assert.match(link, /am=500\.00/);
  assert.match(link, /pn=Sharma%20Medicals/);
});

test('personal VPA heuristic', () => {
  assert.equal(looksPersonalVpa('9876543210@ybl'), true);
  assert.equal(looksPersonalVpa('rahulk1998@ybl'), true);
  assert.equal(looksPersonalVpa('sharmamedicals.62748@hdfcbank'), false);
});

test('name matching tolerates spelling and suffixes, rejects other names', () => {
  assert.ok(namesMatch('Sharma Medical', 'SHARMA MEDICALS PVT LTD'));
  assert.ok(namesMatch('sharma medicals', 'Sharma Medicals'));
  assert.ok(!namesMatch('Sharma Medicals', 'Rahul K'));
  assert.ok(nameSimilarity('Sharma Medicals', 'Rahul K') < 0.5);
  assert.ok(vpaMentions('Sharma Medicals', 'sharmamedicals@okaxis'));
});

test('fake QR sticker is flagged as danger', () => {
  const qr = parseUpiQr(DEMO_QRS[1].text);
  const r = checkPayee(qr, { expectedPayee: 'Sharma Medicals' });
  assert.equal(r.level, LEVEL.DANGER);
  assert.ok(codes(r).includes('name_mismatch'));
});

test('real shop QR passes', () => {
  const qr = parseUpiQr(DEMO_QRS[0].text);
  const r = checkPayee(qr, { expectedPayee: 'Sharma Medicals' });
  assert.equal(r.level, LEVEL.OK);
});

test('"scan to receive money" trick is flagged', () => {
  const qr = parseUpiQr(DEMO_QRS[2].text);
  const r = checkPayee(qr, {});
  assert.equal(r.level, LEVEL.DANGER);
  assert.ok(codes(r).includes('receive_money_trick'));
});

test('non-pay UPI actions (mandates/collect) are flagged', () => {
  const qr = parseUpiQr('upi://mandate?pa=x@ybl&pn=X');
  assert.ok(codes(checkPayee(qr, {})).includes('not_a_payment_qr'));
});

test('first-time payee and personal account cautions', () => {
  const qr = parseUpiQr(DEMO_QRS[3].text);
  const r = checkPayee(qr, { expectedPayee: 'Kumar Tea Stall', knownPayees: [{ vpa: 'other@okaxis', name: 'Other' }] });
  assert.equal(r.level, LEVEL.CAUTION);
  assert.ok(codes(r).includes('first_time_payee'));
  assert.ok(codes(r).includes('personal_account_for_shop'));
});

test('extra zero is caught', () => {
  const r = checkAmount(5000, { usualAmount: 500 });
  assert.equal(r.level, LEVEL.DANGER);
  assert.ok(codes(r).includes('extra_zero'));
  assert.equal(checkAmount(450, { usualAmount: 500 }).level, LEVEL.OK);
  assert.equal(checkAmount(0).level, LEVEL.DANGER);
  assert.ok(codes(checkAmount(2500)).includes('large_amount'));
});

test('risky payments get a pause', () => {
  assert.equal(pauseSeconds(LEVEL.DANGER), 10);
  assert.equal(pauseSeconds(LEVEL.CAUTION), 3);
  assert.equal(pauseSeconds(LEVEL.OK), 0);
});

test('amounts in Indian words', () => {
  assert.equal(rupeesInWords(500), 'five hundred rupees');
  assert.equal(rupeesInWords(5000), 'five thousand rupees');
  assert.equal(rupeesInWords(125000), 'one lakh twenty five thousand rupees');
  assert.equal(rupeesInWords(1), 'one rupee');
  assert.equal(rupeesInWords(10.5), 'ten rupees and fifty paise');
  assert.equal(formatRupees(125000), '₹1,25,000');
});

test('soundbox announcements become captions', () => {
  assert.deepEqual(parseAnnouncement('Received 500 rupees from Anil on Paytm'), { amount: 500, from: 'Anil' });
  assert.equal(parseAnnouncement('PhonePe par 250 rupaye prapt hue').amount, 250);
  assert.equal(parseAnnouncement('payment of rupees five hundred received').amount, 500);
  assert.equal(parseAnnouncement('hello how are you'), null);
});

test('tremor filter ignores double taps and brushes', () => {
  const accept = createTapFilter({ debounceMs: 600, minHoldMs: 60 });
  assert.equal(accept({ downAt: 0, upAt: 100, key: '5' }), true);
  assert.equal(accept({ downAt: 150, upAt: 260, key: '5' }), false); // tremor double tap
  assert.equal(accept({ downAt: 900, upAt: 920, key: '0' }), false); // 20 ms brush
  assert.equal(accept({ downAt: 1000, upAt: 1100, key: null }), false); // lifted off the keypad
  assert.equal(accept({ downAt: 1000, upAt: 1100, key: '0' }), true);
});

test('keypad editing', () => {
  assert.equal(applyKey('', '0'), '');
  assert.equal(applyKey('5', '0'), '50');
  assert.equal(applyKey('50', 'back'), '5');
  assert.equal(applyKey('50', 'clear'), '');
  assert.equal(applyKey('1234567', '8'), '1234567');
});

test('vibration guidance grows as the QR gets bigger and centred', () => {
  const far = guidanceScore({ x: 0, y: 0, width: 60, height: 60 }, 1280, 720);
  const close = guidanceScore({ x: 440, y: 160, width: 400, height: 400 }, 1280, 720);
  assert.ok(close > far);
  assert.ok(close > 0.8);
});

test('Malayalam and English have every string', () => {
  assert.ok(hasAllKeys());
  assert.match(t('ml', 'pays', { name: 'Rahul K' }), /Rahul K/);
  assert.equal(t('xx', 'scan_pay'), 'Scan & Pay');
});
