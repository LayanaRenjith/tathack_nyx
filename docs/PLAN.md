# Build plan (20 hours, 3 people)

## Status of the first push

Done and tested:
- Safety engine: QR parsing, name match, scam rules, extra-zero check, risk pause (`npm test`)
- Full flow: onboarding → who are you paying → scan → check → amount → confirm → UPI app
- Modes: Blind, Elderly, Tremor, Deaf (soundbox captions), Standard
- Malayalam + English, voice output and input
- Offline service worker, PWA manifest, demo QR codes

## Roles

| Person | Owns |
|---|---|
| A, engine | `scanner.js`, `upi.js`, `safety.js`, hand-off testing on real phones, offline |
| B, voice and language | `speech.js`, `i18n.js` (Malayalam review), name capture, Blind and Elderly modes |
| C, UI and modes | `styles.css`, `keypad.js`, `soundbox.js`, onboarding polish, slides, demo |

## Timeline

| Hours | Goal |
|---|---|
| 0–1 | Deploy to Vercel/Netlify, test `upi://` hand-off with GPay and PhonePe (pay ₹1 to a teammate), check Malayalam TTS voice on demo phones |
| 1–5 | Camera scanning on real phones, tune vibration guidance |
| 5–9 | Blind mode end to end blindfolded, Malayalam review of every string |
| 9–12 | Elderly + tremor: keypad error test (normal vs tolerant) |
| 12–14 | Deaf soundbox mode with a real soundbox clip |
| 14–16 | Recorded Malayalam audio fallback for key warnings, TalkBack pass |
| 16–18 | Metrics: 20 test QR codes, keypad errors, unaided completion |
| 18–20 | Slides, backup demo video, rehearse ×3 |

## Next tasks (pick from here)

- [ ] Pre-recorded Malayalam MP3s for the 5 key warnings (offline + phones without a Malayalam voice)
- [ ] Malayalam → Latin transliteration so shop names can be spoken in Malayalam
- [ ] Family alert for payments above a limit (elderly mode)
- [ ] Error-rate test page: normal keypad vs tremor keypad, log taps
- [ ] Capacitor wrapper for an APK (optional, last hour)

## Demo script (90 s)

1. Blindfolded teammate says "Sharma Medicals", scans the shop QR with the **fake sticker** on top → Malayalam warning + danger vibration.
2. Peel off the sticker, scan the real QR → name matches → enters 5000 instead of 500 → extra-zero warning.
3. Fix to 500 → hold to pay → GPay opens pre-filled → ₹1 sent live.
4. Switch to deaf shop-owner mode, play a soundbox clip → "₹500 received" flashes.
