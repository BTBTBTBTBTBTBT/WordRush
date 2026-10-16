# Thanksgiving art review vs the shipped Halloween set (2026-10-16)

Founder bar: "the Thanksgiving themes should be just as strong [as Halloween's polish] and redesigned if need be."

Contact sheets (Halloween left / Thanksgiving right, mid-grey ground so both light halos and dark fringes show):
- `sheet-titles.jpg` (29 title pairs), `sheet-cast.jpg` (Halloween | hero | Thanksgiving | -alt1), `sheet-props-pieces.jpg`.

Scope: everything in `titles/`, `cast/`, `props/`, `pieces/`. Skipped: `walls/` (being redrawn) and the four titles that
landed mid-review (`game-callit`, `game-passthepuzzle`, `game-rockpaperscissors`, `game-tictactile`, the NEW-1016 batch;
NEW-1016.md itself does not exist yet). There is no Thanksgiving `header/`.

## Totals

| Group | KEEP | REDO |
|---|---|---|
| Titles (29) | 12 | 17 (7 lettering, 10 garnish-only) |
| Cast (20) | 3 | 17 (9 are duplicate-piece alts that can simply be dropped) |
| Props (10) | 10 | 0 |
| Pieces (12) | 12 | 0 |
| **All (71)** | **37** | **34** |

## Set-wide findings (read before the table)

1. **Cast is the big gap.** Every Thanksgiving cast file is `method: layered` = the hero with ONE hat bolted on (or one back
   piece). Halloween shipped full costumes (vampire cape + collar + medallion, wizard robe, astronaut suit, mummy wraps,
   skeleton suit, scarecrow clothes, ghost sheet). Only three composites earn their keep (o1 turkey-tail cheerleader,
   c acorn cap, u beanie). Nine of the ten `-alt1` files just reuse another member's piece (three beanies, three toques,
   two pilgrim hats, two turkey tails) and add nothing. Fix = new FRONT pieces that fit each body (collar, apron, bib,
   wrap, crust rim), composited by `layer-costume.py` per the 10-04 layered rule; full redraws only where the silhouette
   changes (o3 pie, r blanket), each with the face-region check. The existing pieces are all good and stay.
2. **Titles: finish is a true family** (glossy bubble letters, chocolate-brown cookie rim, consistent highlights, clean
   edges, no key leftovers, zero halos; spelling all correct). Two weaknesses: (a) long titles were drawn as thin wide
   strips (crosswordocious 1306x153, letterladder 1303x167, wordoftheday 1286x157, thanksgiving 1258x169, gobble 1285x170,
   happy-thanksgiving-alt1 1316x155 vs Halloween's ~830x200): shipped at width 1080 they come out ~30% shorter than their
   Halloween counterparts and read light. (b) The seasonal cue is the brown rim + a leaf/acorn garnish, and 10 of 29
   titles have no garnish at all, so they are not identifiably Thanksgiving (Halloween's drips do that job on every title).
   Garnish is also a coin flip (leaf / acorn / none); pick leaf = page titles + odd games, acorn = even games, or just
   alternate, but every title gets exactly one.
3. **Rim contrast on the wall (`z-titles-on-wall` check).** On the current `walls/wall-home.webp` (dark plum/brown) the
   brown rim disappears and the letters float rimless; Halloween's black rim stays crisp on its purple wall. Since the
   walls are being redrawn now, the wall team must keep the title band light enough (or warm-tan, not brown) for a
   chocolate rim to separate, OR all titles get a darker rim later. Do not change the rim on the 17 redos alone (family
   mismatch); keep the exact rim of the attached KEEP titles.
4. **Cut-outs are clean** across all 71 files (no cyan/magenta leftovers, no white semi-transparent halos, tight crops).
   The 1-px alpha specks in o1/w/r composites and in `props/wheat.png` are inherited from the hero pixels / grain tips; harmless.
5. Palette is consistent (burnt orange / wheat gold / cranberry / warm brown) and game identity colors are kept like
   Halloween did. `pieces/maple-leaf.png` == `props/leaf-maple.png` and `pieces/pumpkin-pie.png` == `props/pumpkin-pie.png`
   (byte-identical reuse; fine, just know it).

## Prompt conventions (used by every REDO prompt below)

- Key: whole subject on flat `#00FFFF`; `#FF00FF` when the subject is teal/blue/green (marked per prompt).
- Family refs for titles: attach `thanksgiving/titles/game-gauntlet.png` (acorn) + `thanksgiving/titles/game-kindred.png`
  (oak leaf) for the exact rim, gloss and garnish scale, plus the Halloween counterpart for composition/height.
- Cast refs: `docs/design/brand/cast/hero/<id>.png` (on-model; never redraw the face, letter, body color or shape; W always
  friendly) + `halloween/cast/<id>.png` (how much costume Halloween carried) + the existing Thanksgiving piece.
- Title height rule: letters at least as tall as the Halloween counterpart's at the same width; two words may stack.
- "garnish-only" redos can be batched 4-6 per ChatGPT sheet; the lettering is already right.

## Titles

| Asset | Verdict | Reason |
|---|---|---|
| dailies.png | REDO (garnish) | Clean, bold, but plain red with no harvest cue; Halloween had the web. Also shift red toward cranberry. |
| game-classic.png | KEEP | Magenta + rimmed maple leaf; good weight; the family reference for "leaf". |
| game-classicseven.png | REDO (lettering) | Lightest title in the set: thin wide strip (1109x159), small letters, no garnish. |
| game-classicsix.png | KEEP | Good weight, leaf garnish, clean. |
| game-codebreaker.png | REDO (garnish) | Good lettering, no seasonal cue. |
| game-crosswordocious.png | REDO (lettering) | 1306x153 strip; at 1080 wide it is a sliver; grey-blue reads cold next to the set. |
| game-deliverance.png | KEEP | Acorn garnish, green on palette; weight acceptable. |
| game-gauntlet.png | KEEP | Best of set; the family reference for "acorn". |
| game-hubbub.png | KEEP (garnish optional) | Strong, chunky, counts as KEEP; add a leaf only if batching anyway. |
| game-kindred.png | KEEP | Oak leaf, cranberry red; family reference. |
| game-letterladder.png | REDO (lettering) | 1303x167 strip, letters half Halloween's height; acorn fine. |
| game-muddle.png | KEEP | Leaf, good weight. |
| game-octoword.png | KEEP | Acorn, good weight. |
| game-propernoundle.png | REDO (garnish) | Lettering OK (Halloween swapped the O for a pumpkin; do the same with an acorn). |
| game-quadword.png | REDO (garnish) | No cue. |
| game-spyglass.png | REDO (garnish) | No cue; olive is fine as autumn. |
| game-starsweep.png | KEEP | Gold star is the game's own mark; weight good. |
| game-succession.png | REDO (garnish) | No cue (Halloween had the pumpkin O). |
| game-sudocious.png | REDO (garnish) | No cue. |
| happy-thanksgiving.png | KEEP | Two-line stack, strong, matches happy-halloween weight. |
| happy-thanksgiving-alt1.png | REDO (lettering) | 1316x155 single-line sliver; redundant with the stacked version unless redrawn tall. |
| label-give-thanks.png | KEEP | Gold, leaf, reads as label; fine at label size. |
| label-gobble-gobble.png | REDO (lettering) | Plain red strip; Halloween's BOO! had eyes in the O's. Needs the same wit (turkey). |
| page-friends.png | REDO (garnish) | No cue; red is also the same as dailies/kindred; shift to cranberry + leaf. |
| page-leaderboard.png | KEEP | Acorn, gold, good. |
| page-stats.png | REDO (garnish) | Big and glossy, no cue. |
| page-wordoftheday.png | REDO (lettering) | 1286x157 sliver, letters tiny; four stray components means letters were split by the key. |
| puzzles.png | KEEP | Oak leaf, chunky, good. |
| thanksgiving.png | REDO (lettering) | 1258x169 sliver; the season's own name must be the tallest, boldest title. |

### Title prompts

**Lettering redos** (one prompt each; attach the Halloween counterpart + gauntlet + kindred):

- `game-classicseven.png` (key #00FFFF): "Glossy 3D bubble letters reading exactly CLASSIC SEVEN in lime green
  (#8FD14F), rounded puffy inflated letterforms with a strong top highlight, each letter wrapped in a smooth chocolate-brown
  rim (#5A2A10) like the attached GAUNTLET and KINDRED titles, no drips. Letters at least as tall as in the attached
  Halloween CLASSIC SEVEN; stack CLASSIC above SEVEN if needed to keep them tall. One small glossy acorn with a crosshatched
  cap tucked against the last letter, same brown rim. Whole subject on a flat #00FFFF background, nothing else, no shadow
  on the background."
- `game-crosswordocious.png` (key #FF00FF, subject is grey-blue): same template, "reading exactly CROSSWORDOCIOUS in
  warm slate (#8FA3B5) ... letters tall and chunky, not a thin strip: allow slight arc or two lines CROSSWOR / DOCIOUS only
  if a single line cannot be as tall as the attached Halloween version. One small rimmed oak leaf (burnt orange) against
  the final S. Flat #FF00FF background."
- `game-letterladder.png` (key #FF00FF, blue): "reading exactly LETTER LADDER in royal blue (#2F5BFF), LETTER stacked
  above LADDER, letters as tall as the attached Halloween LETTER LADDER, chocolate rim, no drips, one rimmed acorn at the
  lower right. Flat #FF00FF."
- `page-wordoftheday.png` (key #FF00FF, olive green): "reading exactly WORD OF THE DAY in olive green (#A4B23A), WORD OF
  THE on the first line and DAY on the second (or one tall line), letters as tall as the attached Halloween version, each
  word one connected piece (no gaps that split letters), chocolate rim, one rimmed maple leaf (red-orange gradient) by DAY.
  Flat #FF00FF."
- `happy-thanksgiving-alt1.png` (key #00FFFF): "reading exactly HAPPY THANKSGIVING on ONE line but with tall chunky
  letters (height like the attached HAPPY HALLOWEEN alt), burnt orange (#F07A1A) with the chocolate rim, a rimmed maple
  leaf replacing the dot-less space between the words, no drips. Flat #00FFFF."
- `thanksgiving.png` (key #00FFFF): "reading exactly THANKSGIVING, the tallest and boldest word in the set: letters at
  least as tall as the attached HAPPY HALLOWEEN, wheat gold to burnt orange vertical gradient (#FFC23A top to #E8641A
  bottom), chocolate rim, a small rimmed acorn hanging off the G and a small rimmed oak leaf under the final G, no drips.
  Flat #00FFFF."
- `label-gobble-gobble.png` (key #00FFFF): "reading exactly GOBBLE GOBBLE! in cranberry red (#D8262E), chocolate rim,
  letters as tall as the attached BOO! label; the two O's are small glossy turkey faces (brown head, orange beak, red
  wattle) with the eyes looking at each other, playful, like BOO!'s eyes; a fan of five short tail feathers (cranberry,
  burnt orange, wheat gold, brown) rises behind the exclamation mark. Flat #00FFFF."

**Garnish-only redos** (batch 4-6 per sheet; attach the current Thanksgiving file of each title + gauntlet + kindred;
key #00FFFF unless noted): "Reproduce the attached title exactly (same word, same letterforms, same color, same
chocolate-brown rim and gloss, same height) and add ONE small harvest garnish with the same brown rim, sized about one
letter tall, tucked against the first or last letter: [per title]. Whole subject on a flat [key] background."
- `dailies.png`: shift letters to cranberry (#D8262E); garnish = rimmed oak leaf at the upper left of the D.
- `game-codebreaker.png`: acorn hanging from the K.
- `game-propernoundle.png`: replace the first O with a glossy acorn (cap on top) the way Halloween used a pumpkin.
- `game-quadword.png`: maple leaf tucked after the D.
- `game-spyglass.png` (key #FF00FF): acorn at lower right.
- `game-succession.png` (key #FF00FF): replace the O with a round orange pumpkin pie seen from above (cream dollop) like
  Halloween's pumpkin O.
- `game-sudocious.png` (key #FF00FF): maple leaf after the S.
- `page-friends.png`: letters to cranberry (#D8262E), oak leaf after the S.
- `page-stats.png`: wheat sprig (two gold heads) leaning on the final S.
- (optional) `game-hubbub.png`: maple leaf over the first B.

## Cast

| Asset | Verdict | Reason |
|---|---|---|
| w.png | REDO | Pilgrim hat only; Halloween W had cape + collar + medallion. Needs collar/buckle front pieces. Face/pose on-model. |
| w-alt1.png | REDO (drop) | Same beanie as u; third beanie in the set. |
| d.png | REDO | Toque bolted on, pie floats at his feet at prop scale; no chef body. Needs apron + mitt holding the pie. |
| d-alt1.png | REDO (drop) | Duplicate pilgrim hat. |
| c.png | KEEP | Acorn cap sized to the head; the one hat that makes the whole character read as the thing (an acorn). |
| c-alt1.png | REDO (drop) | Duplicate toque. |
| o3.png | REDO | Pie slice perched like a hat; Halloween o3 was fully wrapped. Make o3 the pie. |
| o3-alt1.png | REDO (drop) | Duplicate toque + pie. |
| u.png | KEEP | Cozy beanie fits U's sleepy calm; right scale, on palette. |
| u-alt1.png | REDO | Shawl is behind only, and a maple leaf floats detached above the head (defect). |
| s.png | REDO | Toy-sized turkey hat on a sprinting athlete; Halloween S had a full skeleton suit. Turkey Trot runner. |
| s-alt1.png | REDO (drop) | Tail fan fights the running pose and motion lines; o1 owns the tail. |
| i.png | REDO | Husk behind only; concept is right (ear of corn), execution is a backdrop. Needs husk wrapping from the front. |
| i-alt1.png | REDO (drop) | Scarf bolt-on, same scarf as o2. |
| o1.png | KEEP | Turkey cheerleader: tail fan + pom-poms genuinely composes; strongest Thanksgiving cast file. |
| o1-alt1.png | REDO (drop) | Duplicate beanie. |
| r.png | REDO | Blanket behind only, leaf floats above the nightcap; Halloween R was under a full ghost sheet. Wrap him. |
| r-alt1.png | REDO (drop) | Pie at feet, floating leaf; nothing new. |
| o2.png | REDO | Scarf bolt-on on the glam one; Halloween o2 had hat + cape. |
| o2-alt1.png | REDO (drop) | Duplicate turkey tail. |

### Cast prompts (pieces on flat key for `layer-costume.py`; one sheet per character)

Template header for all: "Draw ONLY costume pieces for the attached character, not the character. Match the attached
Thanksgiving pieces' material: glossy soft-3D toy plastic/knit, clean edges, no outlines, soft contact shadow baked only
where the piece touches the body. Lay the pieces out separately on a flat [key] background, each piece complete and
non-overlapping, front pieces and back pieces as separate items, labeled FRONT / BACK in small plain text under each."

- **w** (key #00FFFF; attach hero/w.png, halloween/cast/w.png, pieces/pilgrim-hat.png): "Pieces: (1) the attached pilgrim
  hat unchanged; (2) FRONT: a crisp white square pilgrim collar with a brown bow at the throat, shaped to sit on the top
  edge of a rounded-square body about as wide as the attached W's shoulders; (3) FRONT: a brown belt with a square gold
  buckle, curved to wrap the lower third of that body; (4) FRONT: two small black buckle shoes sized to W's feet. Keep
  W's magenta cape (do not draw a cape)."
- **d** (key #00FFFF; attach hero/d.png, halloween/cast/d.png, pieces/chef-toque.png, props/pumpkin-pie.png): "Pieces:
  (1) the attached toque unchanged; (2) FRONT: a cranberry-red bib apron with a wheat-gold pocket, shaped to a tall
  rounded-square body, straps ending at the top edge, no text; (3) FRONT: a cream oven mitt on a hand holding the
  attached pumpkin pie at chest height, pie tilted toward the viewer, scaled so the pie is about 60% of the body width."
- **o3** (full redraw allowed, silhouette changes; key #00FFFF; attach hero/o3.png, halloween/cast/o3.png,
  pieces/pie-hat.png): "The attached orange one-eyed character as a whole pumpkin pie: a fluted golden pie-crust rim wraps
  the top edge and both sides of the body like a collar, a big whipped-cream swirl sits on top as the hat, face, eye,
  tongue, body color, arms and legs exactly as attached, same tilt and pose. No other props." Run the face-region check.
- **u-alt1** (key #00FFFF; attach hero/u.png, pieces/autumn-shawl.png, pieces/knit-beanie.png): "Pieces: (1) FRONT: the
  attached knit shawl redrawn as a front wrap: it drapes over both shoulders and crosses at the chest, tassels hanging at
  the sides, shaped to U's rounded body width; (2) BACK: the shawl's back panel; (3) FRONT: a small cream mug of cocoa with
  two mini marshmallows, held in a hand. No leaf."
- **s** (key #00FFFF; attach hero/s.png, halloween/cast/s.png, pieces/turkey-hat.png, pieces/turkey-tail.png): "Pieces:
  (1) FRONT: a white paper race bib with a safety pin at each corner and a big orange turkey silhouette on it, no numbers
  or words, sized to the chest of the attached sprinting S; (2) BACK: a compact fan of turkey tail feathers (cranberry,
  burnt orange, gold, brown) angled to trail behind a running body leaning right, about the body's width; (3) the attached
  turkey hat unchanged, smaller headband-mount version that sits on top of S's own headband."
- **i** (key #FF00FF, husk is green; attach hero/i.png, halloween/cast/i.png, pieces/corn-husk.png): "Pieces: (1) BACK:
  the attached open husk unchanged; (2) FRONT: two husk leaves that wrap the lower two-thirds of a tall slim rounded body
  from the sides toward the front, leaving the letter and face uncovered, pale green fading to wheat at the tips, soft
  3D; (3) FRONT: a thin row of small glossy golden kernels peeking above the front husk at the waist line."
- **r** (full redraw allowed; key #00FFFF; attach hero/r.png, halloween/cast/r.png, pieces/plaid-cape.png): "The attached
  sleepy grey R wrapped in the attached red-and-orange plaid blanket: it covers the back and both shoulders and closes at
  the front below the letter, tassels at the hem, the nightcap stays, the small maple leaf is tucked INTO the nightcap's
  fur brim (not floating), one grey hand holds a cream mug of cocoa. Face, letter, eyes and pose exactly as attached."
  Run the face-region check.
- **o2** (key #00FFFF; attach hero/o2.png, halloween/cast/o2.png, pieces/autumn-shawl.png): "Pieces: (1) FRONT: a
  cranberry knit cardigan with wheat-gold cuffs and three small acorn buttons, open at the front so the letter O shows,
  shaped to the attached hands-on-hips pose (sleeves end at the wrists); (2) FRONT: a thin gold leaf-shaped pendant on a
  short chain at the top edge; (3) FRONT: two small acorn earrings. Keep the heart sunglasses (do not draw them)."
- **Drops** (w-alt1, d-alt1, c-alt1, o3-alt1, s-alt1, i-alt1, o1-alt1, r-alt1, o2-alt1): delete from the gallery unless a
  genuinely different alt is wanted; if so, one idea each: c-alt1 = C as a wheat sheaf (gold stalks fanning behind the head,
  brown ribbon at the waist); o1-alt1 = o1 holding the turkey platter overhead with both pom-pom hands; i-alt1 = I as a
  candle (small flame piece on the sprout, cream wax drip collar).

## Props

| Asset | Verdict | Reason |
|---|---|---|
| acorn.png | KEEP | Glossy, crosshatched cap, clean edge, matches Halloween candy-corn finish. |
| apple.png | KEEP | Clean; red is on the cranberry side of the palette. |
| corn.png | KEEP | Kernels and husk read at icon size. |
| cornucopia.png | KEEP | Dense but clean; the one prop with purple (grapes), acceptable as the horn's fill. |
| leaf-maple.png | KEEP | Richer than Halloween's flat orange leaf; clean points. |
| leaf-oak.png | KEEP | Good depth, clean. |
| pie-slice.png | KEEP | Clean; whipped cream reads. |
| pumpkin-pie.png | KEEP | Same file as pieces/pumpkin-pie.png. |
| turkey-platter.png | KEEP | Clean cut, garnish on palette. |
| wheat.png | KEEP | Clean; 1-px specks at grain tips are harmless. |

## Pieces

| Asset | Verdict | Reason |
|---|---|---|
| acorn-cap.png | KEEP | Good; used well on c. |
| autumn-shawl.png | KEEP | Good knit material; only ever used as a back piece (see u-alt1/o2 prompts for front versions). |
| chef-toque.png | KEEP | Good; used four times, keep it to d only. |
| corn-husk.png | KEEP | Good back piece; needs the front counterpart (i prompt). |
| knit-beanie.png | KEEP | Good; used four times, keep it to u only. |
| maple-leaf.png | KEEP | Same file as props/leaf-maple.png. |
| pie-hat.png | KEEP | Good as an object; the o3 concept is what changes. |
| pilgrim-hat.png | KEEP | Good; keep to w only. |
| plaid-cape.png | KEEP | Good material; needs the front wrap (r prompt). |
| pumpkin-pie.png | KEEP | Good; stop placing it at feet at prop scale. |
| turkey-hat.png | KEEP | Good object, just too small on s as the only costume. |
| turkey-tail.png | KEEP | Good; o1 owns it. |
