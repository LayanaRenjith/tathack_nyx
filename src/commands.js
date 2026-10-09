// Voice commands in Malayalam, English, Hindi and Tamil, including the English loan words people
// actually say ("scan", "back") as each recogniser spells them. Longest match wins.

import { bestMatch, tokens } from './spoken.js';

export const COMMANDS = {
  pay: ['pay', 'scan', 'scan qr', 'make payment', 'send money', 'qr',
    'പണം അയക്ക', 'പണം കൊടുക്ക', 'പണം', 'അയക്ക', 'സ്കാൻ', 'സ്കാന', 'പേ', 'പെയ്മെന്റ', 'ക്യുആർ',
    'भुगतान', 'पेमेंट', 'पैसे भेज', 'पैसे', 'स्कैन', 'पे', 'पे करो', 'क्यूआर',
    'பணம் அனுப்பு', 'பணம்', 'செலுத்து', 'அனுப்பு', 'ஸ்கேன்', 'பே', 'பேமெண்ட்', 'க்யூஆர்',
    'paisa bhejo', 'bhugtan', 'panam'],
  read: ['read', 'read again', 'repeat', 'again', 'say again', 'what is this', 'what is on screen', 'where am i',
    'വായിക്ക', 'വീണ്ടും', 'ഒന്നുകൂടി', 'ഇതെന്താണ', 'എവിടെ',
    'पढ़ो', 'पढ़', 'पढ़िए', 'दोबारा', 'फिर से', 'क्या है', 'कहाँ हूँ',
    'படி', 'படிக்க', 'மீண்டும்', 'திரும்ப சொல்', 'இது என்ன', 'எங்கே'],
  help: ['help', 'what can i say', 'options', 'commands',
    'സഹായ', 'ഹെൽപ്', 'എന്ത് പറയണം',
    'मदद', 'सहायता', 'हेल्प', 'क्या बोलूं',
    'உதவி', 'ஹெல்ப்', 'என்ன சொல்ல'],
  bigger: ['bigger', 'larger', 'zoom in', 'big text', 'increase', 'വലുതാക്ക', 'വലുത', 'बड़ा', 'बड़े', 'बड़ा करो', 'பெரிதாக்கு', 'பெரிது', 'பெரிசா'],
  smaller: ['smaller', 'zoom out', 'decrease', 'ചെറുതാക്ക', 'ചെറുത', 'छोटा', 'छोटा करो', 'சிறிதாக்கு', 'சிறிது', 'சின்னதா'],
  slower: ['slower', 'slow', 'slowly', 'slow down', 'പതുക്കെ', 'സാവധാനം', 'धीरे', 'धीमे', 'மெதுவாக', 'மெதுவா', 'மெல்ல'],
  faster: ['faster', 'fast', 'quick', 'speed up', 'വേഗം', 'വേഗത്തിൽ', 'तेज़', 'तेज', 'जल्दी', 'வேகமாக', 'வேகமா', 'சீக்கிரம்'],
  louder: ['louder', 'volume up', 'ഉറക്കെ', 'जोर से', 'ज़ोर से', 'சத்தமாக'],
  back: ['back', 'go back', 'previous', 'return',
    'തിരികെ', 'പിന്നോട്ട', 'ബാക്ക', 'മുമ്പത്തെ',
    'पीछे', 'वापस', 'बैक', 'पिछला',
    'பின்செல்', 'பின்னால்', 'பின்னாடி', 'பேக்', 'திரும்பு'],
  home: ['home', 'main', 'main menu', 'start', 'go home', 'ഹോം', 'തുടക്ക', 'പ്രധാന', 'होम', 'मुख्य', 'शुरू', 'முகப்பு', 'ஹோம்', 'முதல்'],
  history: ['history', 'payments', 'past payments', 'transactions', 'recent',
    'ചരിത്രം', 'ഹിസ്റ്ററി', 'പേയ്മെന്റുകൾ', 'ഇടപാട',
    'इतिहास', 'हिस्ट्री', 'पेमेंट्स', 'लेनदेन', 'लेन देन',
    'வரலாறு', 'ஹிஸ்டரி', 'பரிவர்த்தனை'],
  report: ['report', 'monthly report', 'month', 'summary',
    'റിപ്പോർട്ട', 'മാസ', 'കണക്ക',
    'रिपोर्ट', 'महीने', 'महीना', 'हिसाब',
    'அறிக்கை', 'ரிப்போர்ட்', 'மாத', 'கணக்கு'],
  spent: ['how much did i spend', 'how much spent', 'spent', 'spend', 'total', 'expense',
    'എത്ര ചെലവ', 'ചെലവ', 'ആകെ', 'എത്ര രൂപ',
    'कितना खर्च', 'खर्च', 'कुल', 'कितना',
    'எவ்வளவு செலவு', 'செலவு', 'மொத்தம்', 'எவ்வளவு'],
  family: ['family', 'trusted', 'trusted people', 'my son', 'my daughter',
    'കുടുംബ', 'മകൻ', 'മകള', 'വിശ്വസ്ത',
    'परिवार', 'बेटा', 'बेटी', 'भरोसेमंद',
    'குடும்ப', 'மகன்', 'மகள்', 'நம்பிக்கை'],
  call: ['call', 'phone', 'ring', 'call family', 'call my son', 'call my daughter',
    'വിളിക്ക', 'ഫോൺ ചെയ്യ', 'കോൾ',
    'कॉल', 'फोन करो', 'फ़ोन करो', 'बुलाओ',
    'அழை', 'கூப்பிடு', 'கால்', 'போன் பண்ணு'],
  who: ['who', 'who is it', 'which shop', 'who am i paying', 'whose account', 'ആർക്ക്', 'ആരാണ്', 'ഏത് കട', 'किसको', 'कौन', 'किसे', 'कौन सी दुकान', 'யாருக்கு', 'யார்', 'எந்த கடை'],
  limit: ['limit', 'my limit', 'what is my limit', 'പരിധി', 'ലിമിറ്റ', 'सीमा', 'लिमिट', 'வரம்பு', 'லிமிட்'],
  settings: ['settings', 'setting', 'easy settings', 'ക്രമീകരണ', 'സെറ്റിംഗ', 'सेटिंग', 'सेटिंग्स', 'அமைப்பு', 'செட்டிங்'],
  profile: ['profile', 'my profile', 'account', 'പ്രൊഫൈൽ', 'प्रोफ़ाइल', 'प्रोफाइल', 'சுயவிவரம்', 'ப்ரொஃபைல்'],
  shops: ['my shops', 'shops', 'shop list', 'കടകൾ', 'കട', 'दुकान', 'दुकानें', 'கடை', 'கடைகள்'],
  voiceOn: ['voice control on', 'voice mode on', 'full voice', 'വോയ്സ് ഓൺ', 'आवाज़ नियंत्रण चालू', 'वॉइस चालू', 'குரல் கட்டுப்பாடு ஆன்'],
  voiceOff: ['voice control off', 'voice mode off', 'stop listening', 'വോയ്സ് ഓഫ്', 'वॉइस बंद', 'सुनना बंद', 'குரல் கட்டுப்பாடு ஆஃப்'],
  stop: ['stop', 'quiet', 'silence', 'shut up', 'be quiet', 'നിർത്ത', 'മതി', 'മിണ്ടാതെ', 'रुको', 'बस', 'चुप', 'நிறுத்து', 'போதும்', 'அமைதி'],
  // used on some screens only
  again: ['scan again', 'try again', 'new qr', 'വീണ്ടും സ്കാൻ', 'വീണ്ടും സ്കാന', 'फिर से स्कैन', 'दोबारा स्कैन', 'மீண்டும் ஸ்கேன்'],
  tell: ['ask', 'ask family', 'tell family', 'tell', 'ചോദിക്ക', 'पूछो', 'पूछें', 'पूछ लो', 'கேள்', 'கேளு', 'alert', 'warn', 'inform', 'അറിയിക്ക', 'പറയ', 'बताओ', 'बताएं', 'सूचित', 'சொல்லு', 'தெரிவி'],
  continue: ['continue', 'go on', 'next', 'proceed anyway', 'തുടര', 'അടുത്ത', 'जारी', 'आगे', 'தொடர', 'அடுத்து'],
  send: ['send', 'share', 'whatsapp', 'അയക്ക', 'വാട്സാപ്പ', 'भेजो', 'भेजें', 'व्हाट्सएप', 'அனுப்பு', 'வாட்ஸ்அப்'],
};

/**
 * Command for a transcript (or the recogniser's list of guesses), or null.
 * @param {string|string[]} alternatives
 * @param {string[]} [only] limit to these commands (screen-specific)
 */
export function parseCommand(alternatives, only = null) {
  const table = only ? Object.fromEntries(only.map((k) => [k, COMMANDS[k]])) : COMMANDS;
  for (const a of [].concat(alternatives || [])) {
    if (!tokens(a).length) continue;
    const hit = bestMatch(a, table);
    if (hit) return hit;
  }
  return null;
}
