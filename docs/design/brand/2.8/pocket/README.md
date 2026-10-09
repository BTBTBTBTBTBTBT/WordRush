# Pocket games art (FRIDAY-QUEUE item 9d)

Props drawn by the free ChatGPT in the keycap family, magenta/cyan keyed (`raw/` -> `out/`):
- Tic-Tac-Tile: `ttt-x` (purple tile, white X), `ttt-o` (gold tile, white O), `ttt-board` (3x3 tray), `ttt-strike` (gold win bar,
  stretch it; a pale green fringe is the glow, tint in code if needed), `turn-marker`, `yourturn-flag`.
- Rock Paper Scissors: `rps-rock`, `rps-paper`, `rps-scissors` (white mitten hands, same clay as the cast mittens), `rps-hidden`
  (fist + purple ? badge), `clash-burst`, `arena-plate`.
- Call It: `coin-blank`, `coin-crest` (shield with a W, = TAILS `coin-tails-crest`), `coin-heads-w` (HEADS: the canonical hero W with
  his cape composited unaltered onto the blank coin by `compose-coin.py`), `coin-edge` / `coin-tilt` (flip frames: face -> tilt -> edge ->
  tilt -> face), `coin-shadow`, `coin-sparkle-ring`.
- Word Chain / Ghost / Pass the Puzzle: `tile-white|purple|gold` (blank word tiles, letters live), `ghost-marker` (faceless frosted ghost),
  `chain-links` (gold chain), `puzzle-piece`.
- NOT usable yet: `raw/boards-sheet-NEEDS-REDO-white-bg.png` (stages for RPS / Call It / Word Chain / Ghost / Pass the Puzzle). ChatGPT
  drew them on a soft white/lavender background (it ignored the cyan key and the result was still blurring in), so they cannot be keyed.
  Re-prompt with a darker key (green) or one board per image. The Tic-Tac-Tile result podium came back as a gold button, also redo.
Win/lose moments and result badges: reuse the shared W/L badges (`badges/`) and `streaks/` sparkles; the "O" cast variant for the coin
tails is parked (the W crest is the pick).
