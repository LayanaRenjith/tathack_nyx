# Sahaaya

**Check who you are paying, before you pay.** An accessibility companion for UPI payments, in Malayalam and English, for people who can't read the payment screen: blind and low-vision users, elderly people, people with hand tremors or colour blindness, and first-time smartphone users.

## The problem

Since June 2025, UPI apps show the bank-verified name of the person being paid, just before the PIN. Reading that name is the main way people catch a fake QR sticker pasted over a shop's real one. In Khajuraho in January 2025, a fake-QR scam across more than a dozen shops was caught only because a customer read the wrong name on screen.

That check is visual. People who can't read the screen either pay blind or hand their phone to a stranger, which is exactly what QR-swap scams rely on.

## How it works in real life

**Once, with family (about 5 minutes).** A son, daughter or neighbour opens Sahaaya, which starts large and spoken. They pick the language, enter the user's name, tick what helps (hard to see, uses TalkBack, hands shake, hard to hear, new to smartphones…), choose the payment app, check the preview, set the app lock, add themselves as the trusted person with payment limits, and then **scan the QR of each regular shop once, at the shop**. Sahaaya remembers each shop's real account.

**Every day (4 steps).**
1. Open Sahaaya (fingerprint, face or code) and tap **Scan & pay safely**. For low-vision and TalkBack users the scanner opens straight away.
2. Scan the shop's QR. The phone vibrates faster as the code gets closer.
3. Hear the result, then say or type the amount.
4. Hold to pay. Google Pay (or PhonePe, Paytm, BHIM) opens with everything filled in; the PIN is entered there.

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
| Hard to see | Larger text, black-and-yellow contrast, everything spoken, vibration guides the camera, scanner opens on start, hands-free mode |
| Uses TalkBack | Sahaaya stays quiet and lets TalkBack read everything; hands-free mode on |
| Reading is hard | Easy-reading font, wider spacing, words highlighted as they are read aloud |
| Hard to tell colours apart | Blue / orange / magenta palette; meaning always shown with icons and words too |
| Hands shake | Big buttons, keypad that ignores double taps and brushes, hold-to-pay |
| Hard to hear | Flashing and vibrating warnings; no speech needed |
| New to smartphones | Simple screens, slower speech, a pointer on the next step |

**Hands-free mode (for blind users):** after the scan, Sahaaya asks for the amount, the user says it, Sahaaya asks "Pay 250 to Lakshmi Bakery? Say yes", and the UPI app opens. Works in Malayalam, English, Hindi and Tamil.

**Learns as you use it:** if taps keep missing buttons or repeating, Sahaaya offers bigger buttons. Voice commands work on every screen.

## Family and limits

A trusted person (son, daughter, neighbour) is added at setup with their WhatsApp number, plus a per-payment and a daily limit. A payment over a limit is held until the user sends the prepared WhatsApp or SMS ("Ammini wants to pay ₹3,000 to Lakshmi Bakery. Is this OK?"). A swapped QR offers "Tell Raju about this QR". Messages go through the user's own WhatsApp/SMS, so no server is needed.

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
src/onboarding.js        First-run setup: name, needs, payment app, preview, lock, trusted person, shops
src/home.js              Lock screen, dashboard, history, shops, trusted people, profile, accessibility
src/pay.js               Scan → Check → Amount → Pay, hands-free voice, family limits; add a shop
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
src/match.js, amount.js, commands.js, i18n.js, store.js, ui.js, demo-codes.js, adapt.js
tests/                   Node test runner
```

## Privacy

No backend and no account. Profile, settings, trusted people, saved shops and history stay on the phone.

## License

MIT
