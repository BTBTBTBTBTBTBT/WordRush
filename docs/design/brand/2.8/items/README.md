# Mascot-maker item art, batch 4 (FRIDAY-QUEUE 5b subculture packs + sports + 51 gap-fill)

28 packs, ~290 pieces, drawn by the free ChatGPT in the shipped accessory style (glossy 3D toy, lit top-left, flat cyan key), keyed + split
by `slice_items.py` (data in `packs.py`). Each pack folder has `raw/sheet.png`, `out/<piece>.png` (transparent, trimmed), `contact-sheet.png`
and a `README.md` table: piece, slot (head / hair / face / neck / wrap / back / held / feet / pet / extra) and colorable parts.

| set | packs |
|---|---|
| subculture (5b) | goth, emo, punk, grunge, skater, kawaii, metal, hiphop, kpop, cottagecore, western, surfer, anime, preppy, hippie, steampunk, cyber, raver, athleisure |
| sports (jersey feature) | baseball, football, soccer, hockey, basketball-golf (basketball + golf pieces) |
| gap-fill (51) | music, gaming, pets (12 buddies), careers |

All-ages rules respected: no brands / logos / text, no weapons, drugs, alcohol, hate or political symbols (no anarchy A), no religious garments
(the punk skull is a cute plush with a bow; police cap has a plain star, no weapon). Colorable = neutral white-grey clay (hair color, primary
or team color tinted in code; sports pieces carry one grey accent for the secondary color). Fixed-color pieces are marked `no`.

Caveats / next steps (integration is NOT done here):
- Pieces are 200-400 px (12 per sheet): good for the rule fit trials; regenerate shipped ones one-per-image (~870 px) like the 18 bodies.
- Composite cells to split in code: careers `scientist-kit` (goggles + lab coat + flask), `pilot-cap-aviators`, `beret-palette`,
  `detective-cap-magnifier`; basketball-golf `headband-wristbands`.
- Not yet: the per-item rule (`integration/rules.py` kind, anchor, scale), `compare.py` fit on all bodies, `audit.py --guards`, manifest
  entries, gating (free / Pro / buy / earn) and a set-bonus item per pack.
- Missing from the brief (still to draw): punk/goth held-and-back extras are partial; "Doug" Android shots n/a.
