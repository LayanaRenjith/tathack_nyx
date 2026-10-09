# SafeScan: safe UPI payments for everyone

> **Track 5: Accessibility & Inclusion.** Every UPI safety tip says *"check the payee's name before you pay."* Blind, elderly, low-literacy and non-English-speaking users can't. SafeScan checks it for them, by voice, vibration and big text, in Malayalam, even offline.

## Problem

UPI is how India pays, from city shops to village markets. Its one safety step, verifying the payee name before paying, assumes the user can see, read English, hear and tap precisely.

- **Blind / low-vision users** can't see the payee name or spot a fake QR sticker pasted over the real one.
- **Elderly users** struggle with small text and confuse ₹500 with ₹5000.
- **People with hand tremors** mistype amounts or tap Pay twice.
- **Deaf shopkeepers** can't hear the soundbox confirm a payment.
- **Rural and Malayalam-only users** get names and warnings in English they can't read.

So they hand their phone, and their trust, to shopkeepers or strangers, which is exactly what QR-swap and "scan to receive money" scams exploit.

## Solution

SafeScan is an **accessibility and safety layer that sits in front of any UPI app**. The user scans a QR code; SafeScan reads the payee name and UPI ID stored inside it, checks it against the shop the user names, flags scam patterns and confirms the amount, in the way that user can perceive it. It then opens the user's own UPI app (Google Pay, PhonePe, BHIM) with everything pre-filled. **The user enters their PIN there; SafeScan never touches money or PINs.**

We don't replace UPI apps. We make every one of them usable and safe for the people they leave out.

### How it differs from what exists

| Existing | What it does | Gap SafeScan fills |
|---|---|---|
| NPCI **Hello! UPI** | Voice commands to *make* payments (Hindi/English) | No pre-payment check that the QR belongs to the shop you're at |
| **PayU Accessible Checkout** | Screen-reader friendly *online* checkout | Doesn't cover scanning shop QR codes |
| QR security scanners | Show payee details visually | Not built for blind, elderly or tremor users; no voice match |

## Features

**Core safety engine (all modes, works offline)**
- Reads payee name + UPI ID from the QR and announces it before any money moves
- **Shop name match**: warns if the QR pays someone other than the shop you named (fake sticker detection)
- Scam rules: name mismatch, shop QR paying a personal account, "scan to receive money" tricks, non-payment UPI actions (mandates), first-time payee, unusually large amount
- **Extra-zero check** against what you usually pay that shop
- Forced pause (3–10 s) before risky payments
- Hand-off to any UPI app through a standard `upi://pay` link

**Modes**
| Mode | For | What changes |
|---|---|---|
| 👁️ Blind | Blind / low vision | Everything spoken; **vibration guides the camera to the QR** (faster ticks = closer); high-contrast black/yellow; hold-to-pay |
| 🔠 Elderly | Elderly / low literacy | Bigger text, amount spoken in words, extra-zero warning, hold-to-pay |
| ✋ Tremor | Parkinson's, essential tremor | **Tremor-tolerant keypad** (counts the key where the finger lifts, ignores double taps and brushes), larger spacing, 1.2 s hold-to-pay |
| 👂 Deaf (shop owner) | Deaf merchants | **Soundbox captions**: "₹500 received from Anil" flashed full-screen with vibration |
| 📱 Standard | Everyone else | Same safety checks, normal UI |

**Language:** Malayalam (primary) and English, for both voice and text.

## Run it

No build step and no dependencies.

```bash
npm start        # http://localhost:5173
npm test         # 18 unit tests for the safety engine, keypad, soundbox parser
npm run vendor   # optional: download jsQR into vendor/ for fully offline QR decoding
```

**On a phone:** the camera needs HTTPS. Deploy the folder to Vercel or Netlify (drag and drop works), open the link in **Chrome on Android**, and tap *Add to Home screen*. iPhones don't handle `upi://` links or vibration well, so demo on Android.

**Without a camera:** open the "Paste a QR text (for testing)" box on the scan screen and use the demo codes.

**Printable demo QR codes:** open `tools/print-qrs.html` through `npm start` (http://localhost:5173/tools/print-qrs.html) and print.

## Project structure

```
index.html            App shell
styles.css            High-contrast, mode-aware styles
sw.js                 Service worker (offline)
manifest.webmanifest  PWA manifest
src/
  app.js              Screens and flow: onboarding → payee → scan → check → amount → confirm → UPI
  upi.js              Parse UPI QR strings, build the hand-off link
  safety.js           The safety engine (payee + amount rules)
  match.js            Offline fuzzy name matching
  amount.js           Rupees in words (lakh/crore), formatting
  keypad.js           Tremor-tolerant keypad
  scanner.js          Camera QR scanning + vibration guidance
  speech.js           Text-to-speech, speech recognition, vibration patterns
  soundbox.js         Soundbox announcement parser (deaf merchant mode)
  i18n.js             Malayalam + English strings
  store.js            Settings, saved shops, history (on-device only)
  demo-codes.js       Demo QR payloads
tests/                Node test runner tests
tools/print-qrs.html  Printable demo QR sheet
docs/                 Problem statement, pitch and team plan
```

## Privacy and safety

- No backend. Settings, saved shops and history stay on the phone (localStorage).
- SafeScan never sees or stores a UPI PIN and never moves money. The user's own UPI app does.
- All demo UPI IDs are fictional.

## Measuring impact

- Fake QR codes caught out of 20 test codes
- Amount-entry errors: normal keypad vs tremor-tolerant keypad
- Share of payments completed without help by blindfolded and "elderly" testers

## Team

Built in 20 hours by a team of 3 for Track 5. See `docs/PLAN.md` for roles and timeline.

## License

MIT
