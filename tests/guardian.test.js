import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeGuardian, approvalCode, checkApproval, checkGuardianPin, guardianKey, pinLooksRight, requestLink, parseRequestLink, newRequestId } from '../src/guardian.js';
import { spokenDigits, findShopBySpeech, skeleton } from '../src/spoken.js';

const req = { id: 'ab12cd', vpa: 'greentea@ybl', amount: 250 };

test('guardian code made on the guardian\'s phone is accepted on the elder\'s phone', async () => {
  const g = await makeGuardian('4821');
  assert.equal(g.key.includes('4821'), false, 'the PIN itself is never stored');
  const code = await approvalCode(await guardianKey('4821', g.salt), req);
  assert.match(code, /^\d{6}$/);
  assert.equal(await checkApproval(code, g, req), true);
});

test('a code cannot be reused for another account, a bigger amount or another request', async () => {
  const g = await makeGuardian('4821');
  const code = await approvalCode(g.key, req);
  assert.equal(await checkApproval(code, g, { ...req, vpa: 'scammer@ybl' }), false);
  assert.equal(await checkApproval(code, g, { ...req, amount: 2500 }), false);
  assert.equal(await checkApproval(code, g, { ...req, id: newRequestId() }), false);
  assert.equal(await checkApproval('000000', g, req), code === '000000');
});

test('wrong guardian PIN gives a wrong code, and is caught early on the guardian\'s phone', async () => {
  const g = await makeGuardian('4821');
  assert.equal(await checkApproval(await approvalCode(await guardianKey('1111', g.salt), req), g, req), false);
  assert.equal(await pinLooksRight('4821', g.salt, g.check), true);
  assert.equal(await checkGuardianPin('4821', g), true);
  assert.equal(await checkGuardianPin('1234', g), false);
});

test('request link round-trips and carries nothing secret', async () => {
  const g = await makeGuardian('4821');
  const link = requestLink('https://sahaaya.app/', { ...req, name: 'Green Tea Stall', user: 'Amma', phone: '9895011111', lang: 'ml', reason: 'new', channel: 'sahaaya_abc123' }, g);
  assert.equal(link.includes(g.key), false);
  const r = parseRequestLink(new URL(link).hash);
  assert.deepEqual({ id: r.id, vpa: r.vpa, amount: r.amount, name: r.name, lang: r.lang }, { id: 'ab12cd', vpa: 'greentea@ybl', amount: 250, name: 'Green Tea Stall', lang: 'ml' });
  assert.equal(r.channel, 'sahaaya_abc123');
  assert.equal(parseRequestLink('#approve?id=x'), null);
});

test('codes and numbers said digit by digit', () => {
  assert.equal(spokenDigits('four eight two 9 1 0'), '482910');
  assert.equal(spokenDigits('482 910'), '482910');
  assert.equal(spokenDigits('നാല് എട്ട് രണ്ട് ഒമ്പത് ഒന്ന് പൂജ്യം'), '482910');
  assert.equal(spokenDigits(['hmm', 'चार आठ दो नौ एक शून्य']), '482910');
});

test('a saved shop is recognised when said in any script', () => {
  const shops = [{ name: 'Lakshmi Bakery' }, { name: 'Sharma Medicals' }, { name: 'Milma Booth' }];
  for (const said of ['pay lakshmi bakery 250', 'ലക്ഷ്മി ബേക്കറിക്ക് 250 രൂപ', 'लक्ष्मी बेकरी को 250', 'லட்சுமி பேக்கரிக்கு 250']) {
    assert.equal(findShopBySpeech(said, shops)?.name, 'Lakshmi Bakery', said);
  }
  assert.equal(findShopBySpeech('ശർമ മെഡിക്കൽസ്', shops)?.name, 'Sharma Medicals');
  assert.equal(findShopBySpeech('pay 250', shops), null);
  assert.equal(findShopBySpeech('green tea', shops), null);
  assert.equal(skeleton('Bakery'), skeleton('ബേക്കറി'));
});
