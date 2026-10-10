# Sahaaya

![Sahaaya: check before you pay](icons/cover.png)

**Check who you are paying, before you pay.** An accessibility companion for UPI payments, in Malayalam, English, Hindi and Tamil, for people who can't read the payment screen: blind and low-vision users, elderly people, people with hand tremors or colour blindness, and first-time smartphone users.

## The problem

Since June 2025, UPI apps show the bank-verified name of the person being paid, just before the PIN. Reading that name is the main way people catch a fake QR sticker pasted over a shop's real one. In Khajuraho in January 2025, a fake-QR scam across more than a dozen shops was caught only because a customer read the wrong name on screen.

That check is visual. People who can't read the screen either pay blind or hand their phone to a stranger, which is exactly what QR-swap scams rely on.

## How it works in real life

**Once, with family (about 5 minutes).** A son, daughter or neighbour opens Sahaaya, which starts large and spoken. They pick the language, enter the user's name, tick what helps (hard to see, uses TalkBack, hands shake, hard to hear, new to smartphones…), choose the payment app, check the preview, set the app lock, add themselves as the trusted person with payment limits, and then **scan the QR of each regular shop once, at the shop**. Sahaaya remembers each shop's real account.

**Every day (4 steps).**
1. Open Sahaaya (fingerprint, face or code) and tap **Scan & pay safely**. For low-vision and TalkBack users the scanner opens straight away.
2. Scan the shop's QR. The phone vibrates faster as the code gets closer.
3. Hear the result, then say or type the amount.
4. **Final check:** one screen shows the amount, the shop and its account. The user taps "Yes, pay", says "yes", or says the amount again. If the amount said doesn't match ("2500" for a ₹250 payment), the payment is cancelled. Then Google Pay (or PhonePe, Paytm, BHIM) opens with everything filled in; the PIN is entered there.

| What the QR is | What Sahaaya says |
|---|---|
| A saved shop's account | ✓ "Lakshmi Bakery. Same account as always." |
| Claims a saved shop's name but pays another account | ✕ "Stop. Not Lakshmi Bakery's account. The sticker may have been replaced." Payment stays hidden until the user confirms they checked with the shop, then waits 10 seconds. |
| Any other account | ! "Not one of your shops. This QR pays Chhotu Tiwari. Not checked." |

Also caught: an extra zero compared with what this shop usually costs, an amount different from the one printed in the QR, "scan to receive money" tricks, and non-payment UPI requests.

The decision is always made on the **UPI ID**, never on the name written inside the QR, because anyone can type any name there. Sahaaya never says "safe".

## Built for different needs

| Need ticked at setup | What changes |
|---|---|
| Can't see the screen | **Full voice control:** Sahaaya speaks every screen and then listens. No buttons needed. Tap anywhere (or double-tap) to talk |
| Hard to see | Larger text, black-and-yellow contrast, everything spoken, vibration guides the camera, scanner opens on start, hands-free mode |
| Uses TalkBack | Sahaaya stays quiet and lets TalkBack read everything; hands-free mode on |
| Reading is hard | **OpenDyslexic** font (or Atkinson Hyperlegible), wider spacing and line height, words highlighted as they are read aloud. Malayalam, Hindi and Tamil keep their own script font with the extra spacing |
| Hard to tell colours apart | Blue / orange / magenta palette; meaning always shown with icons and words too |
| Hands shake | Big buttons, keypad that ignores double taps and brushes, hold-to-pay |
| Hard to hear | Flashing and vibrating warnings; no speech needed |
| New to smartphones | Simple screens, slower speech, a pointer on the next step |

**Full voice control (for blind users):** setup can be done entirely by voice ("Set up by voice": language, name, a family member's number). After that every screen is spoken and Sahaaya listens for what to do next: "pay", "report", "how much did I spend", "call my son", "read", "help", "back". A payment is: "pay" → scan (beeps rise in pitch as the QR comes into view, with spoken tips) → hear the result → say the amount → "right?" → final check → the UPI app opens. On a swapped QR it says "scan again, tell family, or continue".

**Listening built for older voices:** Sahaaya keeps listening through pauses ("two hundred… fifty") and stops after a quiet gap, which is longer for slow speakers. You can also hold the mic button while speaking and let go when done. It never listens while it is still talking, so it doesn't hear itself. If it doesn't understand in Malayalam, Hindi or Tamil, it tries once more in Indian English, which handles commands, numbers and Indian names well. A blocked microphone, no internet or a busy mic is explained out loud instead of failing silently.

**Voice that's easier to live with:** long sentences are spoken one at a time (some Android voices cut off long speech), the most natural installed voice is picked and can be changed in Easy settings, what you say appears on screen as you speak, and "what you can say here" is always shown in the voice bar. "Cancel" works anywhere. **Practise voice** walks through pay, an amount, yes and help without paying anything.

**Understanding speech in four languages, offline:** amounts in digits of any script and in words, including Indian forms: "two fifty", "dhai sau", "साढ़े तीन सौ", "ഇരുന്നൂറ്റി അമ്പത്", "இருநூற்று ஐம்பது". Commands and yes/no match on word stems (Malayalam and Tamil word endings change), allow small English typos, include the English words people mix in ("scan", "report"), and are checked against all of the recogniser's guesses. Screen-specific words are tried before app-wide ones. Rising and falling beeps say when Sahaaya is listening, a short buzz confirms it understood, and what it heard is shown on screen.

**Pay a saved shop by name, no QR needed:** "Lakshmi Bakery 250" (or ലക്ഷ്മി ബേക്കറി 250, लक्ष्मी बेकरी 250, லட்சுமி பேக்கரி 250) goes straight to the check. Names are matched across scripts using a consonant skeleton, and the payment goes to the account saved for that shop. Also: "who am I paying", "what is my limit", and shake the phone to talk.

**Learns as you use it:** if taps keep missing buttons or repeating, Sahaaya offers bigger buttons. Voice commands work on every screen.

## Feedback you can feel, hear and see

Each scan gives **one** signal, from the checked result, never from camera frames. The same code seen again within a few seconds doesn't buzz twice.

| Result | Vibration | Sound | Screen |
|---|---|---|---|
| Saved shop (a match with your saved shop, not a bank check) | one short buzz | rising chime | green card |
| New shop, not checked | two medium | two even notes | amber card, helper or safety check required |
| Name matches a saved shop, account doesn't | three long | low firm tone | red card that stays until you act; no way to the UPI app without the helper's approval or the safety questions |
| Website or other non-payment code / damaged code | five quick | two even notes | "Not a payment" / "damaged code" card |

Vibration, sounds, spoken guidance and screen flashes are separate switches in Easy settings. **Silent mode** turns off speech and sounds without touching any other setting, and shows what would have been said as one line of text. Warnings are always on screen, whatever is switched off.

## Practice without consequences

**Practice mode** (from the welcome screen, home, Profile or Easy settings) runs the whole app on pretend data:
- pretend shops and pretend QR codes: saved shop, fake sticker, new shops, refund trick, website;
- a pretend helper you can play yourself (Accept / Refuse), plus pretend history for the monthly report.

Nothing can leave the phone. No payment app opens; the last step says "Practice: nothing was paid", and WhatsApp, SMS and call links are stopped with a note. The real shops, helper, history and settings are not read or written until you exit, and the app always starts in real mode. An amber "Practice · no real money" bar stays on every screen with an Exit button.

## Find what feels comfortable (optional)

A short try-out, offered at setup and in Easy settings: pick the easiest button and text size, how you want to be guided (shown, spoken or both), which alerts you want (try sound, vibration and flash first, only when you tap), and a few sample taps. It suggests settings, shows a summary you can edit, and changes nothing until you confirm. It never diagnoses anything or says pass or fail. The quick setup is still there.

## No helper? Sahaaya still protects

For people with no family member to add:
- **Quick safety check** before paying a new shop, read aloud and answered by voice or with big Yes/No buttons: "Are you at this shop, paying for something you bought?", "Did someone call or message you asking you to pay?", "This QR pays Chhotu Tiwari. Is that the shop in front of you?" A wrong answer stops the payment and shows a one-tap call to **1930**, India's cyber-fraud helpline.
- **Time to think:** a big payment to a new shop, or one over their own limit, pauses for 30 seconds with a spoken reminder.
- All the other checks (swapped QR, receive-money trick, extra zero) work the same.

## Family and limits

**New shops need the guardian's OK.** At setup the trusted person picks a 4-digit Guardian PIN (only a salted hash is stored). When the user scans a QR that isn't one of their saved shops, payment is held:
1. "Ask Ravi to check" sends Ravi a WhatsApp alert with the shop, account and amount.
2. The link opens Sahaaya on Ravi's phone (no setup needed there). He checks, or calls, enters his Guardian PIN and taps **Accept** or **Don't pay**.
3. The user sees the request's state: waiting, approved, "Ravi said: don't pay", or expired after 15 minutes (ask again). The screen reminds them to tap Send in WhatsApp, and offers SMS or copy-the-message if WhatsApp isn't there. Cancel is always available. The user's phone unlocks by itself the moment Ravi accepts, or shows "Ravi said: don't pay". The answer travels through ntfy.sh, a free open-source relay, on a random one-time channel. Only the 6-digit approval code goes through it, and that code is checked against the Guardian PIN and only works for this request, this account and this amount. Instant replies can be switched off in Easy settings. If the relay is off or can't be reached, Ravi sends the code on WhatsApp and the user types or says it. The user never learns the PIN, and the shop is saved for next time.
If Ravi is sitting next to them, he can type his PIN on the user's phone instead. Payments over the limit use the same approval.


Limits: a trusted person (son, daughter, neighbour) is added at setup with their WhatsApp number, plus a per-payment and a daily limit. A payment over a limit is held until the user sends the prepared WhatsApp or SMS ("Ammini wants to pay ₹3,000 to Lakshmi Bakery. Is this OK?"). A swapped QR offers "Tell Raju about this QR". Messages go through the user's own WhatsApp/SMS, so no server is needed.

## Monthly report

The Report tab shows the month's total, the last six months as a bar chart, where the money went (shop by shop), and how many fake QR codes were stopped. "Send to Ravi" shares it on WhatsApp. At the start of a month, the home screen reminds the user to send last month's report.

## App lock

Sahaaya can be locked with the phone's own fingerprint or face (WebAuthn, needs HTTPS) or a 4-digit code stored only as a salted hash. This protects Sahaaya; the UPI PIN stays inside the UPI app, where banks that support it let users approve with fingerprint or face instead.

## Languages

Malayalam, English, Hindi and Tamil, for text and voice. Translations should be reviewed by native speakers.

## No bank or GPay integration needed

Sahaaya uses NPCI's standard UPI payment link (`upi://pay`), the same one every "Pay with any UPI app" button uses. On Android it can open a specific app directly. Money and PINs stay inside the user's UPI app; Sahaaya never sees them and never claims a payment succeeded.

Before relying on it, test on a real phone: Settings → "Test that your payment app opens" pays ₹1 to a UPI ID you choose. Some UPI apps limit link payments to personal accounts.

## Run it

No build step and no dependencies.

```bash
npm start                    # http://localhost:5173
python -m http.server 5173   # alternative without Node
npm test                     # 30 unit tests
npm run vendor               # optional: offline QR decoding for phones without BarcodeDetector
```

On a phone the camera needs HTTPS: deploy the folder to any static host (Netlify, Vercel, GitHub Pages) and open it in Chrome on Android.

**Trying it without a shop:** during setup, at "Add the shops you pay often", scan "Lakshmi Bakery (real)" from the Test QR codes panel to save it. Then from the home screen, try "Lakshmi Bakery (swapped sticker)". Printable codes: `/tools/print-qrs.html`.

## Project structure

```
index.html, styles.css   App shell and design system (profile applied via CSS variables)
src/app.js               Start-up, lock, voice commands, Android back button
src/onboarding.js        First-run setup (on screen or entirely by voice): name, needs, payment app, preview, lock, trusted person, shops
src/home.js              Lock screen, dashboard, history by month, shops, trusted people, profile, accessibility
src/pay.js               Scan → Check → Amount → Final check → Pay, voice payments, family limits; add a shop
src/report.js            Monthly totals, per-shop breakdown, six-month trend
src/report-screen.js     Report screen and WhatsApp sharing
src/guardian.js          Guardian PIN, approval codes tied to account and amount, request links
src/approve.js           The guardian's approval page (opens from the WhatsApp link)
src/relay.js             Instant Accept / Don't pay answers through ntfy.sh (code still verified on the phone)
src/voice-practice.js    Practise voice commands without paying
src/feedback.js          One feedback decision per scan (vibration, sound, flash) with cooldown
src/approval-state.js    Helper request states: pending, approved, rejected, expired
src/comfort.js, comfort-screen.js  "Find what feels comfortable" try-out
src/practice.js, practice-core.js  Practice mode: pretend shops and helper, nothing paid or sent
src/spoken.js            Amounts, yes/no and phrase matching in Malayalam, English, Hindi, Tamil
src/commands.js          Voice commands in four languages
src/auth.js              Fingerprint/face (WebAuthn) and 4-digit code lock
src/family.js            Trusted people, WhatsApp/SMS alerts, payment limits
src/lang/                English, Malayalam, Hindi, Tamil
src/icons.js             Line icons
src/safety.js            Payment check (account comparison, swap detection, amount rules)
src/profile.js           Needs → settings; applies them to the page
src/adapt.js             Offers bigger buttons after missed or repeated taps
src/upi.js               UPI QR parsing, standard and app-specific payment links
src/scanner.js           Camera QR scanning with vibration guidance
src/speech.js            Speech out/in, word highlighting, vibration
src/keypad.js            Tremor-tolerant keypad
src/match.js, amount.js, i18n.js, store.js, ui.js, demo-codes.js, adapt.js
tests/                   Node test runner
```

## Privacy

No backend and no account. Profile, settings, trusted people, saved shops and history stay on the phone.

## License

MIT
