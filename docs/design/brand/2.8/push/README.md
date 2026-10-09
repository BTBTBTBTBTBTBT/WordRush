# Push notification visuals (FRIDAY-QUEUE item 34)

- `frames/`: `card-frame` / `avatar-ring` (badge notch lower right for the app-icon badge) / `thumb-frame`, each normal + `-halloween`
  (black-violet with glossy orange rim + tiny bats). Empty inside: the long-press content extension fills them (mascot avatar from the
  real resolver, game thumbnail = the game's icon art).
- `status/`: monochrome W silhouette from the canonical hero W outline (letter cut out, white on transparent, alpha only) for the Android
  status bar small icon (`status-w-mdpi..xxxhdpi`, 24..96 px, `status-w-master`) and the web badge, + Halloween witch-hat variant.
  `status-icons-preview.png` shows them on a dark status bar. Android requires alpha-only art: do not tint.
- The collapsed notification text is system-drawn (copy rules are in the item).
