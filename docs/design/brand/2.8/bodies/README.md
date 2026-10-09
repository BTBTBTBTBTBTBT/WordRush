# New body shapes (FRIDAY-QUEUE item 50)

18 new white glossy bodies on the existing body template (soft-3D clay, mittens at the sides, two feet, NO face / letter),
drawn by the free ChatGPT with the 12 shipped bodies attached as the reference. Three 3 x 2 sheets in `raw/`, keyed and
split into `out/<id>.png`:
- Sheet A: `heart`, `moon` (fat crescent), `egg`, `bell`, `triangle`, `diamond`
- Sheet B: `shield`, `burst` (8-point star-burst), `flower`, `gumdrop`, `can`, `potato` (blob variant)
- Sheet C: `catear`, `bunnyear`, `pumpkin` and `ghost` (Halloween, free in season then buy/Pro/earn), `cone` (witch-hat body), `bat`
  Already shipped and NOT redrawn: classic, star, bean, cloud, drop, hex, mini, pear, tall, wide, chunky, blob (capsule ~ tall,
  squircle ~ chunky). `contact-sheet.png` shows all 18.

**Resolution caveat:** pieces are only 240-320 px (pane capture of a 6-up sheet). `make-1024.py` writes DRAFT 1024 x 1024
files to `draft1024/art-av-body-<id>.png` (Lanczos x3-4, feet at y = 988, height <= 890) so
`integration/landmarks.py`, `compare.py` and `rig-body.py` (INTEGRATION.md "How to add a new body") can be run to judge fit.
Regenerate each body the founder keeps ONE PER IMAGE (~870 px) before shipping. The manifest face/letter anchors
(`face`, `eyeY`, `mouthY`, `cheekY`, `mustacheY`, `letterBox`) are not set yet: that is the design step per body.
Known nits: the ghost hem has a faint cyan fringe between the feet; the moon leaves less face room than the others (letter
box should sit in the fat lobe).
