import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSpokenAmount, amountFrom, yesNo, normalise } from '../src/spoken.js';
import { parseCommand } from '../src/commands.js';
import { monthlyReport, lastMonths, pendingReport } from '../src/report.js';
import { deriveProfile, speaks, voiceDriven } from '../src/profile.js';

// ---------- Amounts said aloud ----------
test('amounts in digits, any script, with rupee words', () => {
  assert.equal(parseSpokenAmount('250'), 250);
  assert.equal(parseSpokenAmount('₹2,500'), 2500);
  assert.equal(parseSpokenAmount('२५० रुपये'), 250);
  assert.equal(parseSpokenAmount('൨൫൦'), 250);
  assert.equal(parseSpokenAmount('250രൂപ'), 250);
  assert.equal(parseSpokenAmount('nothing at all'), null);
});

test('English amounts, including the Indian "two fifty"', () => {
  assert.equal(parseSpokenAmount('two hundred fifty'), 250);
  assert.equal(parseSpokenAmount('two fifty'), 250);
  assert.equal(parseSpokenAmount('five thousand'), 5000);
  assert.equal(parseSpokenAmount('one lakh'), 100000);
});

test('Hindi amounts, including dhai sau and saadhe', () => {
  assert.equal(parseSpokenAmount('ढाई सौ'), 250);
  assert.equal(parseSpokenAmount('डेढ़ हजार'), 1500);
  assert.equal(parseSpokenAmount('साढ़े तीन सौ'), 350);
  assert.equal(parseSpokenAmount('2 हज़ार'), 2000);
  assert.equal(parseSpokenAmount('पांच सौ रुपये'), 500);
});

test('Malayalam amounts, with word endings that change', () => {
  assert.equal(parseSpokenAmount('ഇരുന്നൂറ്റി അമ്പത്'), 250);
  assert.equal(parseSpokenAmount('രണ്ടായിരത്തി അഞ്ഞൂറ് രൂപ'), 2500);
  assert.equal(parseSpokenAmount('അമ്പത് രൂപ'), 50);
  assert.equal(parseSpokenAmount('രണ്ട് ലക്ഷം'), 200000);
  assert.equal(parseSpokenAmount('ലക്ഷ്മി ബേക്കറി 250'), 250, 'Lakshmi is a name, not a lakh');
  assert.equal(parseSpokenAmount('லட்சுமி பேக்கரி 250'), 250);
});

test('Tamil amounts', () => {
  assert.equal(parseSpokenAmount('இருநூற்று ஐம்பது'), 250);
  assert.equal(parseSpokenAmount('ஐநூறு ரூபாய்'), 500);
  assert.equal(parseSpokenAmount('ரெண்டாயிரம்'), 2000);
});

test('tries every guess the recogniser gives', () => {
  assert.equal(amountFrom(['hello there', 'two fifty', 'to fifty']), 250);
});

// ---------- Yes / no ----------
test('yes and no in four languages; "no" wins; negative verbs are no', () => {
  for (const y of ['yes', 'ok', 'അതെ', 'ശരി', 'हाँ।', 'ठीक है', 'ஆம்', 'சரி']) assert.equal(yesNo(y), 'yes', y);
  for (const n of ['no', 'no dont pay', 'വേണ്ട', 'ചെയ്യരുത്', 'नहीं', 'मत भेजो', 'வேண்டாம்', 'செய்யாதே']) assert.equal(yesNo(n), 'no', n);
  assert.equal(yesNo('nothing'), null);
});

// ---------- Commands ----------
test('commands in four languages', () => {
  const cases = {
    'pay': 'pay', 'show my payments': 'history', 'histry': 'history', 'monthly report': 'report', 'call my son': 'call',
    'പണം അയക്കൂ': 'pay', 'റിപ്പോർട്ട് കാണിക്കൂ': 'report', 'മകനെ വിളിക്കൂ': 'call', 'ആകെ എത്ര ചെലവായി': 'spent',
    'भुगतान करो': 'pay', 'रिपोर्ट दिखाओ': 'report', 'कितना खर्च हुआ': 'spent', 'मदद': 'help',
    'பணம் அனுப்பு': 'pay', 'அறிக்கை காட்டு': 'report', 'மகனை அழைக்கவும்': 'call', 'உதவி': 'help',
  };
  for (const [said, cmd] of Object.entries(cases)) assert.equal(parseCommand(said), cmd, said);
});

test('screen commands are matched first and only among that screen\'s words', () => {
  assert.equal(parseCommand('फिर से स्कैन', ['again', 'tell', 'continue']), 'again');
  assert.equal(parseCommand('குடும்பத்திடம் சொல்லு', ['again', 'tell', 'continue']), 'tell');
  assert.equal(parseCommand('pay', ['again', 'tell']), null);
});

test('normalise handles danda, native digits and grouping', () => {
  assert.equal(normalise('हाँ।'), 'हाँ');
  assert.equal(normalise('₹१,२००'), '1200');
});

// ---------- Monthly report ----------
const at = (y, m, d) => new Date(y, m, d, 10).getTime();
const history = [
  { name: 'Lakshmi Bakery', vpa: 'a@x', amount: 250, status: 'same', at: at(2026, 8, 3) },
  { name: 'Lakshmi Bakery', vpa: 'a@x', amount: 300, status: 'same', at: at(2026, 8, 20) },
  { name: 'Green Tea Stall', vpa: 'b@x', amount: 40, status: 'new', at: at(2026, 8, 21) },
  { name: 'Lakshmi Bakery', vpa: 'c@x', amount: 900, status: 'different', at: at(2026, 8, 22) },
  { name: 'Sharma Medicals', vpa: 'd@x', amount: 600, status: 'same', at: at(2026, 9, 2) },
];

test('monthly report totals, shops and warnings', () => {
  const r = monthlyReport(history, 2026, 8);
  assert.equal(r.total, 1490);
  assert.equal(r.count, 4);
  assert.equal(r.shops[0].name, 'Lakshmi Bakery');
  assert.equal(r.shops[0].amount, 1450);
  assert.equal(r.warned, 1);
  assert.equal(r.unchecked, 1);
});

test('six-month totals end with the chosen month', () => {
  const m = lastMonths(history, 2026, 9, 6);
  assert.equal(m.length, 6);
  assert.equal(m.at(-1).total, 600);
  assert.equal(m.at(-2).total, 1490);
});

test('last month\'s report is offered until it is sent', () => {
  const now = at(2026, 9, 9);
  assert.equal(pendingReport(history, {}, now).key, '2026-09');
  assert.equal(pendingReport(history, { '2026-09': 1 }, now), null);
});

// ---------- Full voice control ----------
test('"cannot see the screen" turns on full voice control', () => {
  const p = deriveProfile({ needs: ['blind'] });
  assert.equal(voiceDriven(p), true);
  assert.equal(speaks(p), true);
  const tb = deriveProfile({ needs: ['blind', 'screenreader'] });
  assert.equal(voiceDriven(tb), false, 'TalkBack users keep TalkBack in charge');
});
