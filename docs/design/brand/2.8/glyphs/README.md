# Bubble glyph alphabet (FRIDAY-QUEUE item 6)

48 glyphs drawn by the free ChatGPT in the DAILIES/PUZZLES style: neutral white-grey shaded bubble body, dark inner
line, yellow rim. `raw/sheet1..4` are the keyed-magenta capture sheets (4 x 3 grids); `slice-glyphs.py` keys + splits
them into `out/<name>.png` (transparent, all scaled to ONE cap height, 218 px) + `out/atlas.json`.

- Letters `A.png`..`Z.png`, digits `0.png`..`9.png`; symbols by name: `star` (★), `excl`, `quest`, `comma`, `apos` (' and ’),
  `dot` (·), `hyphen`, `amp`, `period`, `colon`, `plus`, `percent`.
- `atlas.json`: per glyph `w`, `h`, `baseline` (px from the glyph top to the text baseline) and `align`
  (`baseline`, `mid`, `top`, `comma`). Cap height 218 px. Rows were drawn on a common baseline.
- `bubble_text.py` = the reference renderer the iOS / Android / web ports follow (spacing -4.5% cap, space 38% cap,
  vertical gradient tint across the whole word, per-platform cache). Tint rule: body (low saturation) is multiplied by the
  tint, highlights stay white; the dark brown inner line becomes a deep version of the tint; the yellow rim stays (or takes
  the season rim color).
- `acceptance.png` (`make-acceptance.py`): DAILIES purple-to-pink and PUZZLES teal composed from the atlas next to today's
  title art, plus live-headline samples. Same shape, puffiness, gloss and rim family.
- Notes: `0` is a narrower O look-alike (the hole is the same size), fine at headline sizes. Source glyphs are ~220 px cap
  height: use at up to ~70 pt cap on 3x screens; larger headline needs the code-drawn fallback.
- Not drawn (falls back to the live font): `“ ” / ( ) # @ _ = ; "` and non-Latin letters.
