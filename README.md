# Sahaaya: technology that adapts

Most apps make every user adapt to them. **Sahaaya adapts to the user.** It tests how a person reads, sees colour, taps and hears, reshapes itself in Malayalam, and then helps with the task where mistakes cost most: checking who you are paying before a UPI payment.

## Problem

Since June 2025, UPI apps show the bank-verified payee name before the PIN. That on-screen name is the main defence against fake QR stickers pasted over a shop's real QR. But it is a **visual task**: blind and low-vision users can't read it, elderly users miss it, colour-blind users can't rely on red and green warnings, people with tremors mistype amounts, and Malayalam-only users get it in English. So they hand their phone to someone else.

## Solution

**1. Accessible setup (tests, not forms).** Starts large, spoken, with one big button. Every step can be skipped or answered by voice; a family member can set it up instead. Nothing asks for a diagnosis.

| Test | What it turns on |
|---|---|
| Reading: tap the smallest line you can read | Text size; contrast, big buttons and voice for low vision |
| Colour: tap the red circle | Colour-blind palette (meaning always carried by icons and words too) |
| Touch: tap three circles | Tremor protection (keypad ignores double taps, hold-to-pay) and big buttons |
| Hearing: did you hear the sound? | Flash + vibration alerts |
| Preferences | Easy-reading text with word highlighting, simple screens with "tap here" pointers, read-aloud |

**2. Adaptive profile.** Needs combine (large text + Malayalam voice + tremor protection at once). The profile changes the real layout and task flow everywhere, and every setting can be changed in Settings at any time.

**3. SafeScan payment check.** Say your intent ("Pay Lakshmi Bakery 250"), scan the QR, and Sahaaya compares the QR's **UPI ID** with the account you saved for that shop. It never trusts the name written inside a QR, because anyone can type any name there.

| Result | Meaning |
|---|---|
| ✓ Same account as before | Matches the account saved for this shop. Not a guarantee: still listen for the name in your UPI app. |
| ✕ Different account | The QR pays a different account, even if its name looks right. Stop and check. |
| ! New account, not checked | Nothing saved to compare with. Shown as unverified, never as safe. |

Also checked: amount different from what you planned, extra zero, "scan to receive money" tricks, non-payment UPI actions (mandates), missing or malformed QR data. Risky results add a 3–10 second pause. Then Sahaaya opens the user's own UPI app (GPay, PhonePe, BHIM) with the details filled in; the PIN is entered there. After a payment you trust, save the shop so the next visit can be compared.

**4. Voice commands** on every screen (Malayalam and English): pay, read, bigger, smaller, slower, faster, back, home, settings, my shops, stop.

### How it differs

| Existing | What it does | What Sahaaya adds |
|---|---|---|
| Phone accessibility settings | Font size, screen reader, in menus | Guided Malayalam setup with tests; changes task flows, not only looks |
| UPI verified-name screen | Shows the bank name before the PIN | A check people who can't read that screen can use |
| NPCI Hello! UPI | Voice commands to *make* payments | Checking the QR against the shop's saved account |
| QR security scanners | Show payee details visually | Voice, vibration, large text, Malayalam, saved-account memory |

## Run it

No build step and no dependencies.

```bash
npm start        # http://localhost:5173   (or: python -m http.server 5173)
npm test         # unit tests: safety engine, profile, intent and command parsing, keypad
npm run vendor   # optional: download jsQR into vendor/ for offline QR decoding without BarcodeDetector
```

**On a phone:** the camera needs HTTPS, so deploy to any static host (Netlify, Vercel, GitHub Pages) and open it in Chrome on Android. Android is needed for the `upi://` hand-off and vibration.

**Trying the payment check:** Settings → "Add sample shops", then Pay safely → Lakshmi Bakery, ₹250 → open "Test QR codes" on the scan screen. Printable codes: `/tools/print-qrs.html`.

## Project structure

```
index.html, styles.css     App shell; styles read the profile (CSS variables + data attributes)
sw.js, manifest.webmanifest Offline PWA
src/
  app.js        Home, My shops, Settings, voice commands, start-up
  setup.js      Accessible setup tests and preview
  pay.js        SafeScan flow: intent → scan → result → amount → confirm → UPI app → save shop
  profile.js    Setup answers → profile; applies it to the page
  safety.js     Payment checks (account comparison, amount, scam rules)
  match.js      Saved-shop lookup, spoken-intent parsing
  commands.js   Voice command parsing
  upi.js        UPI QR parsing and hand-off link
  scanner.js    Camera QR scanning with vibration guidance
  speech.js     Speech out/in, word highlighting, test tone, vibration
  keypad.js     Tremor-tolerant keypad
  amount.js     Rupees in words (lakh/crore)
  i18n.js       Malayalam + English strings
  store.js      Profile, saved shops, history (on the phone only)
  ui.js         Routing and shared UI helpers
  demo-codes.js Sample shops and QR payloads (fictional UPI IDs)
tests/          Node test runner
tools/          Printable sample QR sheet
```

## Privacy and safety

- No backend: profile, saved shops and history stay on the phone.
- Never asks for, sees or stores a UPI PIN; never moves money; never claims a payment succeeded.
- Never says "safe": only same account, different account, or new account not checked.
- Warnings never rely on colour, sound or vibration alone.

## License

MIT
