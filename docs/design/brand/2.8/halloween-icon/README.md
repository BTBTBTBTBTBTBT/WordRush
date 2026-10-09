# Halloween app icon (FRIDAY-QUEUE item 26)

Source: `apps/ios/Wordocious/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` (W on purple-pink).
- **A (recommended): `AppIcon-Halloween-1024.png`** from `raw/chatgpt-halloween-icon.png`: same composition and pose, black
  to pumpkin-orange background, orange cape, W stays purple (on-model, W is a purple character). Face-region check:
  `compare-original-vs-halloween.png` (dot eyes with shine, open smile with pink tongue, white W all match; the mouth is a
  hair narrower). ChatGPT redrew the whole icon, so Brian/Opus should eyeball it once more; fallback is a code recolor.
  ChatGPT output is 870 px, upscaled to 1024 with Lanczos (x1.18).
- B (alternative): `raw/chatgpt-halloween-icon-b-orange-body.png`, W recolored orange with a black cape. Reads more
  "Halloween" but the character is no longer purple, so it breaks the cast color rule.
No rounded corners or border: full-bleed square, iOS/Android masks apply.
