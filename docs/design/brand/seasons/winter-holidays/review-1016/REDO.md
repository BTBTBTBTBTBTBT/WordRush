# Winter-holidays draft review vs the shipped Halloween set + the Thanksgiving fixes (2026-10-16)

Bar (PLAYBOOK §5 + Thanksgiving lessons): integrated costumes, never a bolted-on hat; titles with Halloween
proportions + a seasonal garnish on every title; walls as full silhouette scenes with a title band; inclusive
(Christmas + a real share of Hanukkah + Kwanzaa sprinkled in, README "Winter holidays are inclusive").

Contact sheets (mid-grey ground so light halos and dark fringes both show):
- `sheet-titles.jpg` Halloween (shipped) | Thanksgiving (post-fix) | winter draft, 29 rows, each column scaled to the
  same shipped width so letter height is comparable.
- `sheet-cast.jpg` Halloween | hero (`cast/hero/<id>.png`) | winter | winter -alt1, 10 rows.
- `sheet-props-pieces.jpg` Halloween props / winter props / Thanksgiving props, then Halloween / winter / Thanksgiving pieces.
- `sheet-walls.jpg` Halloween | Thanksgiving v2 | winter, phone + wide for all five pages.
- `z-titles-on-wall.jpg` six titles composited on each season's home wall (rim-contrast check).

Scope: everything in `titles/` (29), `cast/` (16), `props/` (12), `pieces/` (12), `walls/` (10). The draft set is the
10-05 night batch (LAST-SESSION.md item 4): nothing is shipped or wired.

## Totals

| Group | KEEP | REDO | Note |
|---|---|---|---|
| Titles (29) | 4 | 25 (16 lettering, 9 garnish-only) | lettering = thin strips (ratio >= 1.3x Halloween's), garnish = no per-title garnish |
| Cast (16) | 0 | 16 (10 need front pieces, 6 alts are duplicate hats to drop/replace) | every file = hero + one bolted-on hat/back piece |
| Props (12) | 12 | 0 | clean, but 12/12 Christmas or generic winter |
| Pieces (12) | 12 | 0 (as objects) | clean, but 12/12 Christmas; no front pieces exist |
| Walls (10) | 0 | 10 (code) | gradient + scattered icons = Thanksgiving v1, not a scene |
| **All (79)** | **28** | **51** | |
| MISSING vs §3 | — | ~45 items | see the MISSING list |

## Set-wide findings (read before the tables)

1. **Inclusivity is at zero.** Across 79 files there is not one Hanukkah or Kwanzaa element: no hanukkiah, dreidel, gelt,
   sufganiyah, latke, blue/white/silver palette; no kinara, mkeka, muhindi, unity cup, red/black/green. The README rule
   is "every winter-holidays batch (cast, titles, props, walls, extras, social) mixes all three". Fix = new props (7),
   new pieces (5), two cast members carrying Hanukkah and two carrying Kwanzaa (objects/food/light/color only, no
   religious garments), inclusive garnish on titles, lit-window silhouettes on the walls, and the greeting labels
   "HAPPY HANUKKAH" / "HAPPY KWANZAA" / "MERRY CHRISTMAS" alongside "HAPPY HOLIDAYS". Accuracy rules for the prompts:
   hanukkiah = 9 branches, the shamash raised in the center, candle count for the night shown; dreidel letters nun (נ)
   gimel (ג) hei (ה) shin (ש); kinara = 7 candles, 3 red left, 1 black center, 3 green right. Check every sheet.
2. **Cast is the Thanksgiving first pass all over again.** All 16 files are `method: layered` = the hero with ONE hat
   (w, d, c, i, o3, all six alts) or ONE back piece (r quilt, o2 cape, u lights, s scarf) and at most a prop at the feet.
   Halloween shipped full costumes; Thanksgiving's fix was FRONT pieces fitted to each body (belt + shoes, mitt holding
   the pie, husk wrap, cardigan panels, blanket wrap). Hats, antlers, earmuffs and the back pieces are all good objects
   and stay; each character gets 2-3 front pieces (coat panels, scarf wrap, belt, mittens, held object) composited by
   `layer-costume.py`, with full redraws only for r (blanket wrap) and c (snowman coat), face-region check on both.
   Five of the six `-alt1` files reuse another member's hat (two Santa hats, two snowman top hats, two antlers, two pom
   beanies, two elf hats): drop them and replace with the four inclusivity alts below.
3. **Titles: the family is right, the proportions are not.** Snow-capped glossy bubble letters with a navy rim, one
   consistent look, spelling correct on all 29, clean cut-outs. But 16 of 29 are thin strips: width/height is 1.3-1.7x
   Halloween's (crosswordocious 975x132 vs 880x189, propernoundle 923x133 vs 850x202, leaderboard 920x158 vs 823x244,
   letterladder 961x158, codebreaker 948x155, classicseven 928x154, deliverance 898x155, starsweep 894x172). Shipped at
   width 1080 they come out 25-40% shorter than Halloween's. Same fix as Thanksgiving: stack long titles (CLASSIC /
   SEVEN, LETTER / LADDER, CROSSWOR / DOCIOUS, WORD OF THE / DAY), tall chunky letters.
4. **No per-title garnish.** The snow cap is the family cue (Halloween's drips), but Halloween also had a bat / web /
   pumpkin on every title and Thanksgiving now has a leaf / acorn on every title. Winter has zero. Rotate FOUR garnishes
   so the titles themselves carry the inclusive mix: holly sprig, candy cane, dreidel (correct letters), kinara candle
   trio (red / black / green); plus a gold star for the two "star" titles. Exactly one garnish per title.
5. **Rim on the wall.** The navy rim vanishes on the draft wall's navy top band (`z-titles-on-wall.jpg`, right); only the
   snow caps keep the letters separated. Halloween's black rim sits on a lit purple band. The v2 walls must put a
   moon-lit mid-blue band (not navy) where page titles sit; keep the navy rim on all titles (family), do not change it
   on the redos alone.
6. **Walls are the Thanksgiving v1 mistake.** `make-winter-walls.py` is the old engine with a navy gradient, a cool glow
   and 4-5 props scattered in the margins; no moon, no flyers, no horizon silhouette, no per-page focal, and the bottom
   third goes pale blue (will fail the readability gate for the night UI text). Rewrite as `make-winter-walls-v2.py`
   mirroring `thanksgiving/walls/make-thanksgiving-walls-v2.py` beat for beat (spec in the Walls section).
7. **Cut-outs are clean** on all 79 files (no key leftovers, tight crops). The fringe counter flags c / w / o1 only
   because teal and magenta BODY edges match the key colors: false positives, verified on the sheets.
8. `winter.png` reads WINTER, not the season's name; fine as a page/alt label, but the season needs a tall stacked
   "HAPPY / HOLIDAYS" (have it, KEEP) plus the three greeting labels (MISSING).

## Prompt conventions (used by every prompt below)

- Key: whole subject on flat `#00FFFF`; `#FF00FF` when the subject is teal/blue/green (marked per prompt); full-bleed
  items (stage card, scenes, walls are code) keep their own background. No shadow on the background, exact words, no
  extra text.
- Title family refs: attach `winter-holidays/titles/happy-holidays.png` + `winter-holidays/titles/puzzles.png` (exact
  snow cap, gloss, navy rim) plus the Halloween counterpart for height/composition, plus the Thanksgiving counterpart
  where it was stacked. Letters at least as tall as the Halloween counterpart at the same width; two words may stack.
- Cast refs: `docs/design/brand/cast/hero/<id>.png` (on-model; never redraw the face, letter, body color or shape;
  W always friendly, S determined brows) + `halloween/cast/<id>.png` (how much costume Halloween carried) +
  `thanksgiving/cast/<id>.png` (the front-piece fix) + the existing winter piece(s).
- Pieces header (all cast prompts): "Draw ONLY costume pieces for the attached character, not the character. Match the
  attached winter pieces' material: glossy soft-3D toy plastic / knit, clean edges, no outlines, soft contact shadow baked
  only where the piece touches the body. Lay the pieces out separately on a flat [key] background, each piece complete
  and non-overlapping, FRONT and BACK pieces as separate items, labeled FRONT / BACK in small plain text under each."
- Garnish-only title redos batch 3-4 per sheet (split by rows, key with `key-capture.py ... native-all`).
- Cut with `python3 docs/design/brand/key-capture.py <raw> full cyan <out> native-all`.

## Titles

Garnish rotation (one per title, same navy rim, about one letter tall, tucked against the first or last letter):
H = holly sprig (two leaves, three red berries), C = candy cane, D = dreidel (blue-white, letters nun gimel hei shin),
K = kinara candle trio (one red, one black, one green candle, lit), S = gold star.

| Asset | Verdict | Garnish | Reason |
|---|---|---|---|
| dailies.png | REDO (garnish) | H | Good weight (ratio 0.89x Halloween), green on palette, no garnish. |
| game-classic.png | REDO (lettering) | C | 616x163, ratio 1.32x; Halloween CLASSIC is the chunkiest title in the set. |
| game-classicseven.png | REDO (lettering) | D | 928x154 strip, 1.38x; stack CLASSIC / SEVEN like Thanksgiving. |
| game-classicsix.png | REDO (garnish) | H | Proportion fine (1.07x), no garnish. |
| game-codebreaker.png | REDO (lettering) | K | 948x155, 1.51x. |
| game-crosswordocious.png | REDO (lettering) | S | 975x132, 1.59x: the thinnest title; stack CROSSWOR / DOCIOUS. |
| game-deliverance.png | REDO (lettering) | C | 898x155, 1.53x. |
| game-gauntlet.png | REDO (garnish) | D | 1.21x, borderline; garnish only. |
| game-hubbub.png | KEEP (garnish optional) | H | 1.07x, chunky; add holly only if batching. |
| game-kindred.png | REDO (garnish) | H | 1.25x, borderline; garnish only. |
| game-letterladder.png | REDO (lettering) | C | 961x158, 1.48x; stack LETTER / LADDER. |
| game-muddle.png | REDO (lettering) | K | 687x179, 1.32x; Halloween MUDDLE is 710x244. |
| game-octoword.png | REDO (lettering) | D | 859x179, 1.31x; the first O can be a glossy ornament (Halloween used a pumpkin O). |
| game-propernoundle.png | REDO (lettering) | S | 923x133, 1.65x; first O = gold star (Halloween: pumpkin O). |
| game-quadword.png | REDO (garnish) | H | 1.09x, fine; garnish. |
| game-spyglass.png | REDO (lettering) | K | 782x170, 1.32x. |
| game-starsweep.png | REDO (lettering) | S | 894x172, 1.53x; the game's own gold star as the garnish. |
| game-succession.png | REDO (garnish) | D | 1.20x; O = dreidel seen from the front (Halloween: pumpkin O). |
| game-sudocious.png | REDO (garnish) | C | 0.95x, good; garnish. |
| happy-holidays.png | KEEP | — | Two-line stack, red, tall; matches HAPPY THANKSGIVING weight. The season reference. |
| label-snow-day.png | REDO (lettering) | S | 774x187, 1.69x vs BOO!; Halloween's label had eyes in the O's: make the two O's snowballs with faces or the W a snowflake. |
| label-warm-wishes.png | REDO (lettering) | H | 966x176, 1.57x vs SPOOKY. |
| let-it-snow.png | KEEP | — | 0.86x, chunky; the snow cap is the garnish here. |
| page-friends.png | REDO (garnish) | H | 1.11x, fine; garnish. |
| page-leaderboard.png | REDO (lettering) | S | 920x158, 1.73x: the lightest page title. |
| page-stats.png | REDO (garnish) | K | 1.26x, borderline; ice-blue reads cold but on palette; garnish. |
| page-wordoftheday.png | REDO (lettering) | D | 940x151, 1.29x and the letters are small; stack WORD OF THE / DAY like Thanksgiving. |
| puzzles.png | KEEP | — | 1.07x, purple, chunky; family reference. |
| winter.png | REDO (garnish) | C | 606x173 is fine for a label; add a candy cane hooked on the W. |

### Title prompts

**Lettering redos** (one prompt each; attach happy-holidays + puzzles + the Halloween counterpart [+ the Thanksgiving
stacked counterpart where named]). Template: "Glossy 3D bubble letters reading exactly <WORDS> in <color>, rounded puffy
inflated letterforms with a strong top highlight, a smooth cap of white snow resting on top of every letter and a smooth
deep-navy rim (#101A3A) around each letter exactly like the attached HAPPY HOLIDAYS and PUZZLES titles, no drips. Letters
at least as tall as in the attached Halloween <WORDS>; <stacking rule>. <Garnish>, with the same navy rim. Whole subject on
a flat <key> background, nothing else, no shadow on the background."

- `game-classic.png` (key #00FFFF, magenta #C23BFF): one line, letters as tall and chunky as Halloween CLASSIC; garnish =
  a small candy cane hooked over the final C.
- `game-classicseven.png` (key #FF00FF, lime #8FD14F): stack CLASSIC above SEVEN (attach thanksgiving game-classicseven);
  garnish = a small blue-and-white dreidel tucked against the N, the Hebrew letter nun (נ) on its visible face.
- `game-codebreaker.png` (key #00FFFF, orange #FF8A1F): one tall line or CODE / BREAKER stacked; garnish = three small lit
  candles at the lower right, left one red, middle one black, right one green.
- `game-crosswordocious.png` (key #00FFFF, the draft's orange #FF8A1F): stack CROSSWOR above DOCIOUS (attach
  thanksgiving game-crosswordocious); garnish = a gold star on the final S.
- `game-deliverance.png` (key #FF00FF, green #39B54A): one tall line; garnish = candy cane leaning on the final E.
- `game-letterladder.png` (key #FF00FF, blue #2F5BFF): stack LETTER above LADDER (attach thanksgiving game-letterladder);
  garnish = candy cane at the lower right.
- `game-muddle.png` (key #00FFFF, orange #FF8A1F): one tall chunky line, height like Halloween MUDDLE; garnish = three lit
  candles (red, black, green) after the E.
- `game-octoword.png` (key #00FFFF, purple #B23BFF): one tall line; the first O replaced by a round glossy red ornament
  with a gold cap (Halloween used a pumpkin O); garnish = none beyond the ornament.
- `game-propernoundle.png` (key #00FFFF, red #E8262E): one tall line or PROPER / NOUNDLE stacked; the first O replaced by
  a glossy gold five-point star.
- `game-spyglass.png` (key #FF00FF, olive #A4B23A): one tall line; garnish = three lit candles (red, black, green) at the
  lower right.
- `game-starsweep.png` (key #00FFFF, gold #FFC23A): one tall chunky line; garnish = the game's own glossy gold star
  touching the final P.
- `label-snow-day.png` (key #00FFFF, ice white #EAF2FF to pale blue #BFD6FF): letters as tall as the attached BOO! label;
  the O in SNOW is a round snowball with two small black-coal eyes looking up, playful like BOO!'s eyes; a small gold
  star on the Y.
- `label-warm-wishes.png` (key #00FFFF, gold #FFC23A): stack WARM above WISHES, letters as tall as the attached SPOOKY;
  garnish = holly sprig at the upper left of the W.
- `page-leaderboard.png` (key #00FFFF, gold #FFC23A): one tall chunky line, height like Halloween LEADERBOARD; garnish =
  gold star over the final D.
- `page-wordoftheday.png` (key #FF00FF, green #39B54A): WORD OF THE on the first line, DAY on the second (attach
  thanksgiving page-wordoftheday), each word one connected piece; garnish = a small dreidel by DAY, letter gimel (ג) showing.

**Garnish-only redos** (batch 3-4 per sheet; attach the current winter file of each title + happy-holidays + puzzles;
key #00FFFF unless noted): "Reproduce the attached title exactly (same word, same letterforms, same color, same snow cap,
same navy rim and gloss, same height) and add ONE small garnish with the same navy rim, sized about one letter tall,
tucked against the first or last letter: [per title]. Whole subject on a flat [key] background."
- `dailies.png` (key #FF00FF, green): holly sprig (two leaves, three red berries) at the upper left of the D.
- `game-classicsix.png` (key #FF00FF, blue): holly sprig after the X.
- `game-gauntlet.png`: a blue-and-white dreidel after the T, letter hei (ה) on its face.
- `game-kindred.png`: holly sprig at the upper left of the K.
- `game-quadword.png`: holly sprig after the D.
- `game-succession.png` (key #FF00FF, blue): replace the O with a blue-and-white dreidel seen from the front, letter
  shin (ש) on its face (Halloween used a pumpkin O).
- `game-sudocious.png` (key #FF00FF, blue): candy cane hooked on the final S.
- `page-friends.png`: holly sprig after the S.
- `page-stats.png` (key #FF00FF, ice blue): three small lit candles (red, black, green) leaning on the final S.
- `winter.png` (key #FF00FF, blue): candy cane hooked on the W.
- (optional) `game-hubbub.png`: holly sprig over the first B.

## Cast

| Asset | Verdict | Reason |
|---|---|---|
| w.png | REDO | Santa hat only; Halloween W had cape + collar + medallion. Needs Santa coat front (fur trim, belt, buckle) + mittens. Hat stays. |
| w-alt1.png | REDO (drop) | Snowman top hat = c's hat. Replace: W holding a wrapped gift stack (MISSING alt). |
| d.png | REDO | Elf hat only. Needs elf collar + green tunic front with gold buttons + curly-toe shoes; glasses/pencil untouched. |
| d-alt1.png | REDO (drop) | Antlers = o1's. Replace: D as the Hanukkah one, holding a lit hanukkiah (see prompt). |
| c.png | REDO | Top hat only; "C as a snowman" needs the snowman body: white snow coat front (three coal buttons), red scarf wrap, stick-arm mittens. Full redraw allowed (silhouette changes), face-region check. |
| c-alt1.png | REDO (drop) | Santa hat = w's. Replace: C spinning a dreidel (blue/white scarf + mittens, gelt at feet). |
| o3.png | REDO | Pom beanie only. Needs an ugly-sweater front (red knit, white snowflake band) shaped to the tilted body; eye/tongue untouched. |
| o3-alt1.png | REDO (drop) | Elf hat = d's, gift at feet at prop scale. Replace: o3 as a gingerbread cookie (icing trim collar + gumdrop buttons, beanie kept). |
| u.png | REDO | Twinkle-light arch is charming but it is a back piece only; nothing on the body. Add a knit cowl/blanket wrap (front) and a mug in the hands. Lights stay. |
| u-alt1.png | REDO (drop) | Pom beanie = o3's. Replace: U the Kwanzaa one, cradling the kinara (7 candles) in his folded hands, red/black/green knit wrap. |
| s.png | REDO | Scarf flies behind only (bolted on). Scarf must wrap the neck from the front; add a puffer vest front panel (S visible) + mittens on the fists. Headband/sneakers kept. |
| s-alt1.png | REDO (drop) | Santa hat on the headband, fights the pose. Replace: S the Kwanzaa runner (kente-trim sash + ear of corn baton). |
| i.png | REDO | Earmuffs only (nice object, band under the sprout is right). Add a long striped scarf wrap (front) + mittens; keep earmuffs. |
| o1.png | REDO | Antlers + holly only; Halloween o1 had the pumpkin skirt. Add a red nose? NO (changes the face). Add a jingle-bell collar + reindeer-brown belly bib under the O, pom-poms kept. |
| r.png | REDO | Quilt behind only, mug at the feet at prop scale; Halloween R was under a full ghost sheet. Wrap him (full redraw like Thanksgiving r), mug in hand, nightcap is already a winter cap. |
| o2.png | REDO | Cape behind only, gift at feet. Cape needs a front closure (fur-trimmed panels + bow), a white fur muff, the gift held up; heart sunglasses kept. |

### Cast prompts (pieces on flat key for `layer-costume.py`; one sheet per character; header from the conventions)

- **w** (key #00FFFF; attach hero/w.png, halloween/cast/w.png, pieces/santa-hat.png): "Pieces: (1) the attached Santa hat
  unchanged; (2) FRONT: a red Santa coat front panel with white fluffy fur trim along the bottom hem and two fur-trimmed
  front edges, open in the middle so a big letter stays visible, shaped to a rounded-square body about as wide as the
  attached W's shoulders, a black belt with a square gold buckle across the lower third; (3) FRONT: two white fur-cuffed red
  mittens sized to W's hands; (4) FRONT: two small black boots with white fur tops sized to W's feet. Keep W's magenta
  cape (do not draw a cape)."
- **d** (key #00FFFF; attach hero/d.png, halloween/cast/d.png, pieces/elf-hat.png): "Pieces: (1) the attached elf hat
  unchanged; (2) FRONT: a green elf tunic front with a wide scalloped red collar at the top edge and three gold buttons,
  open in the middle so the letter shows, shaped to a tall rounded-square body; (3) FRONT: two red-and-white striped
  stocking cuffs ending in green curly-toe shoes with gold bells, sized to D's feet. Glasses and pencil untouched (do not
  draw them)."
- **c** (full redraw allowed, silhouette changes; key #FF00FF, teal subject; attach hero/c.png, halloween/cast/c.png,
  pieces/snowman-hat.png): "The attached teal character dressed as a snowman: a plush white snow coat covers the body
  from under the face to the feet with three black coal buttons down the front, the letter C and the face cut out and
  showing exactly as attached, a red knit scarf wrapped around the neck with one tail hanging in front, two brown stick
  arms ending in red mittens where his arms are, the attached black top hat with holly on his head. Face, eyes, mouth,
  teeth, body color where visible, pose exactly as attached. No carrot nose." Run the face-region check.
- **o3** (key #00FFFF; attach hero/o3.png, halloween/cast/o3.png, pieces/pom-beanie.png): "Pieces: (1) the attached
  snowflake pom beanie unchanged; (2) FRONT: a chunky red ugly-sweater front panel with a white knit snowflake band across
  the chest and green cuffs at the two arm holes, shaped to the attached tilted rounded body, a big round hole in the
  middle so the single eye and tongue stay fully visible; (3) FRONT: two red knit mittens sized to the raised hands."
- **u** (key #00FFFF; attach hero/u.png, pieces/twinkle-lights.png, pieces/cocoa-mug.png): "Pieces: (1) the attached
  twinkle-light arch unchanged (BACK); (2) FRONT: a chunky cream knit cowl / blanket wrap that drapes over both shoulders
  and crosses low at the front BELOW the letter, blue snowflake pattern, tassels at the hem, shaped to U's rounded body
  width; (3) FRONT: the attached cocoa mug redrawn held in two folded hands at the lower center, steam curl."
- **s** (key #00FFFF; attach hero/s.png, halloween/cast/s.png, thanksgiving/cast/s.png, pieces/scarf-flying.png): "Pieces:
  (1) FRONT: a red-and-white striped knit scarf loop that wraps around the neck of the attached sprinting character, under
  the headband, knot at the left; (2) BACK: the attached flying scarf tails unchanged, angled to trail behind a body leaning
  right; (3) FRONT: a quilted navy puffer vest front panel, open in the middle so the letter S shows, shaped to the chest
  of a running tile body; (4) FRONT: two red mittens on the fists. Headband and sneakers kept (do not draw them)."
- **i** (key #FF00FF, green subject; attach hero/i.png, halloween/cast/i.png, pieces/earmuffs.png): "Pieces: (1) the
  attached earmuffs unchanged; (2) FRONT: a long green-and-white striped knit scarf wrapped once around the neck of a
  tall slim rounded body, both tails hanging down the front to the sides of the letter, leaving the letter uncovered; (3)
  FRONT: two white knit mittens sized to the small hands held at the cheeks."
- **o1** (key #00FFFF; attach hero/o1.png, halloween/cast/o1.png, pieces/antlers.png): "Pieces: (1) the attached antler
  headband unchanged; (2) FRONT: a brown leather collar with three gold jingle bells, curved to the top edge of a rounded
  square body; (3) FRONT: a round reindeer-brown belly bib (lighter tan center) shaped to the lower half of the body with a
  hole so the letter O shows; no red nose (the face stays exactly as attached). Pom-poms untouched."
- **r** (full redraw allowed; key #00FFFF; attach hero/r.png, halloween/cast/r.png, thanksgiving/cast/r.png,
  pieces/quilt-cape.png, pieces/cocoa-mug.png): "The attached sleepy grey R wrapped in the attached patchwork quilt: it
  covers the back and both shoulders and closes at the front below the letter, fur-trimmed hem, the striped nightcap
  stays, a sprig of holly tucked into the nightcap's brim (not floating), one grey hand holds the attached red snowflake
  cocoa mug. Face, letter, eyes, mouth and pose exactly as attached." Run the face-region check.
- **o2** (key #00FFFF; attach hero/o2.png, halloween/cast/o2.png, pieces/winter-cape.png, pieces/gift-box.png): "Pieces:
  (1) BACK: the attached red fur-trimmed cape unchanged; (2) FRONT: the cape's two front panels with white fur edges
  meeting at a red bow at the top edge, open so the letter O shows, shaped to the attached hands-on-hips pose; (3) FRONT:
  a white fur muff held at the lower right; (4) FRONT: the attached gift box redrawn held up in the left hand at shoulder
  height. Keep the heart sunglasses (do not draw them)."

**Inclusivity alts (replace the six duplicate -alt1 files; full prompts, objects only, no religious garments):**
- **d-alt1 (Hanukkah)** (key #00FFFF; attach hero/d.png, props/hanukkiah.png once made): "Pieces: (1) FRONT: a silver
  hanukkiah with NINE branches in one row, the center branch raised above the other eight, all nine holding lit white
  candles with small warm flames, held in two blue mittens at chest height, about 80% of the body width; (2) FRONT: a blue
  knit scarf with white and silver stripes wrapped around the neck, tails to one side. Glasses and pencil untouched."
- **c-alt1 (Hanukkah)** (key #FF00FF; attach hero/c.png): "Pieces: (1) FRONT: a big blue-and-white dreidel held in the
  right hand, the visible face showing the Hebrew letter gimel (ג) in silver, the side face showing nun (נ); (2) FRONT: a
  blue knit scarf with silver stripes around the neck; (3) FRONT: three gold-foil chocolate gelt coins stacked at the
  feet. Draw the Hebrew letters accurately."
- **u-alt1 (Kwanzaa)** (key #00FFFF; attach hero/u.png): "Pieces: (1) FRONT: a wooden kinara holding SEVEN lit candles
  in a row: three red candles on the left, one black candle in the center, three green candles on the right, cradled in
  two folded hands at the lower center, about 70% of the body width; (2) FRONT: a knit wrap in red, black and green
  bands with a kente-inspired geometric trim, draped over both shoulders and crossing below the letter."
- **s-alt1 (Kwanzaa)** (key #00FFFF; attach hero/s.png): "Pieces: (1) FRONT: a sash in red, black and green with a
  kente-inspired geometric trim running from the right shoulder to the left hip of a running tile body, under the letter;
  (2) FRONT: an ear of corn with the husk pulled back held like a relay baton in the leading fist; (3) FRONT: a woven
  mkeka-pattern wristband on the other fist."
- **w-alt1**: W holding a stack of three wrapped gifts (red, blue-and-silver, green) with both hands at chest height,
  Santa hat kept.
- **o3-alt1**: o3 as a gingerbread cookie: white icing scallop collar around the top edge and both sides, three gumdrop
  buttons (red, green, blue) down the front beside the eye, beanie kept; eye and tongue untouched.

## Props

All 12 KEEP: candle, candy-cane, cocoa, gift, gingerbread, holly, mittens, ornament, pine-branch, snowflake, snowman, star
are clean, glossy, on the Halloween candy-corn finish, read at icon size; `gift.png` (white box, blue bow) doubles as a
Hanukkah gift. The set is 12/12 Christmas or generic winter: see MISSING for the seven inclusivity props.

## Pieces

All 12 KEEP as objects (antlers, cocoa-mug, earmuffs, elf-hat, gift-box, pom-beanie, quilt-cape, santa-hat, scarf-flying,
snowman-hat, twinkle-lights, winter-cape): clean, good material. None is a FRONT piece, which is why every cast file is
a bolt-on; the cast prompts above produce the fronts. Keep each hat to one owner (santa-hat = w, snowman-hat = c,
elf-hat = d, antlers = o1, pom-beanie = o3, earmuffs = i).

## Walls

All 10 REDO (code, `make-winter-walls-v2.py` mirroring `thanksgiving/walls/make-thanksgiving-walls-v2.py`): the draft is
a navy-to-pale-blue gradient with 4-5 small props in the margins; no scene, and the bottom third is too light for the
night UI (readability gate). Spec, beat for beat with Halloween "midnight" / Thanksgiving "harvest dusk":

- **sky** deep midnight navy -> indigo -> a cool moon-lit steel-blue band at the title line (the navy title rim must
  separate; check with `z-titles-on-wall`), soft stars top half, a few drifting snowflake specks.
- **moon** big cold white-blue moon, top right, wide silver halo (Halloween/Thanksgiving: amber moon).
- **flyers** a small flock of cardinals / a sleigh-less flight of snow geese in the top band (Halloween: bats, Thanksgiving:
  geese); keep off the stats row / cast header.
- **skyline** rolling snow-covered hills (lighter than the sky, blue-white), pine silhouettes at the outer edges (Halloween:
  bare trees, Thanksgiving: corn), a snow-capped split-rail fence, low cold mist.
- **hero focal per page** (silhouette with LIT WINDOWS, and the inclusive touch lives in the windows): home = a snowy
  village row of three houses: one window shows a lit tree silhouette, one a nine-branch hanukkiah silhouette (center
  raised), one a seven-candle kinara silhouette; games = a snowman family + a sled on the hill + a string of lights on
  the fence; leaderboard = a lit gazebo / bandstand with a star on top; stats = a big snow-laden tree with a few hanging
  ornaments; friends = a cabin with a lit window and two mugs on the porch rail, an ice rink below.
- **tone** overall darkness matching Halloween (wallTone: dark): the center and bottom stay calm navy, never pale blue.
- Both sizes per page (1290x2796, 2400x1500), props from `winter-holidays/props/` only as small silhouettes if at all.

## MISSING vs PLAYBOOK §3 (everything Thanksgiving now has)

| Group | Missing | Count |
|---|---|---|
| Titles, pocket games | game-rockpaperscissors, game-tictactile, game-callit, game-passthepuzzle, game-ghost, game-wordchain | 6 |
| Titles, modes/pages | game-vs (VS / BATTLE), page-unlimited (UNLIMITED), dailies-alt1, happy-holidays-alt1 (one line) | 4 |
| Titles, greetings | label-merry-christmas, label-happy-hanukkah, label-happy-kwanzaa (README: alongside HAPPY HOLIDAYS) | 3 |
| Props, Hanukkah | hanukkiah (9 branches, shamash raised, lit), dreidel (nun gimel hei shin), gelt, sufganiyah, latke | 5 |
| Props, Kwanzaa | kinara (3 red / 1 black / 3 green), unity cup (kikombe), mkeka mat, muhindi corn | 4 |
| Pieces | cast FRONT pieces (10 characters, prompts above), blue/silver scarf, kente-trim sash, red/black/green wrap | 13 |
| Cast | header cast row (Halloween `header/`; Thanksgiving has none either), home-host-w, home-host-o1 | 3 |
| Celebrations | celebration-stage-winter (full-bleed stage, same pool geometry), scene-flawless-star (O2 costumed), scene-sweep-broom (S costumed), floats (burst, streamers, seal) | 4 |
| Extras | btn x3 (candy-cane, cocoa, evergreen), badge-snow-day, badge-winter-streak, streak-flame-candle, streak-shield-snowflake, tile-theme-gingerbread, podium-winter, dress-tab-winter, dress-tag-winter | 11 |
| Walls | v2 scenes x5 pages x2 sizes | 10 |
| System (code, not art) | registry entry + window Dec 1-26, surfaces palette + readability gate, theme row, widgets, season icon, splash color, store shots, share-card renders in the season | — |

### MISSING prompts (ready to paste)

**Pocket / mode titles** (same lettering template as the lettering redos; attach happy-holidays + puzzles + the
Thanksgiving counterpart for composition): ROCK PAPER / SCISSORS (orange, garnish holly, key #00FFFF); TIC-TAC-TILE (pink,
candy cane, #00FFFF); CALL IT (gold, gold star, #00FFFF); PASS THE / PUZZLE (purple, dreidel with hei, #00FFFF); GHOST (ice
white, snowball O with coal eyes, #00FFFF); WORD / CHAIN (green, kinara candle trio, #FF00FF); VS / BATTLE (red, candy
cane, #00FFFF); UNLIMITED (blue, gold star, #FF00FF); DAILIES alt (green, dreidel with shin, #FF00FF); HAPPY HOLIDAYS on
ONE line, tall chunky letters like the attached HAPPY HALLOWEEN alt, red, holly between the words (#00FFFF).

**Greeting labels** (key #00FFFF unless noted, same template, letters as tall as the attached BOO!/SPOOKY labels):
- MERRY / CHRISTMAS stacked, red letters, the family navy rim (never a green rim), holly sprig on the final S.
- HAPPY / HANUKKAH stacked, royal blue (#2F5BFF, key #FF00FF) letters with silver highlights, a small blue-and-white
  dreidel after the final H showing the letter nun (נ); spell HANUKKAH exactly.
- HAPPY / KWANZAA stacked, letters in a red / black / green vertical gradient (red top, black middle, green bottom) with
  a thin kente-inspired geometric stripe in the rim band, a small lit kinara (3 red, 1 black, 3 green) after the final A.

**Inclusivity props** (one subject each, key #00FFFF unless noted, "match the attached winter props' material: glossy
soft-3D toy finish, clean edge, no outline"; attach props/star.png + props/ornament.png):
- `hanukkiah.png`: "A silver hanukkiah with NINE candle holders in one straight row on a curved base; the CENTER holder
  (the shamash) is raised higher than the other eight, which sit at equal height; nine lit white candles with small warm
  flames. Count the holders: four, one raised, four."
- `dreidel.png`: "A four-sided blue-and-white spinning dreidel with a short handle on top, tilted so two faces show, the
  left face with the Hebrew letter nun (נ) and the right face with gimel (ג) in silver, drawn accurately." (A second
  prompt for `dreidel-alt.png` with hei (ה) and shin (ש).)
- `gelt.png`: "A small stack of gold-foil chocolate coins with a six-point star embossed quietly on the top coin, one coin
  half-unwrapped showing chocolate."
- `sufganiyah.png`: "A round jelly doughnut dusted with powdered sugar, a dab of red jelly at the top."
- `latke.png`: "A golden crispy potato pancake on a small white plate with a dollop of sour cream and a spoon of applesauce."
- `kinara.png` (key #FF00FF, green candles): "A carved wooden kinara (candle holder) with SEVEN candles in a straight row,
  all lit: the three on the LEFT are red, the ONE in the CENTER is black, the three on the RIGHT are green. Count: three red,
  one black, three green."
- `unity-cup.png`: "A carved wooden goblet (the unity cup, kikombe cha umoja) with a simple geometric band in red, black and
  green around the bowl."
- `mkeka-corn.png` (key #FF00FF): "A small woven straw mat with red, black and green stripes, two ears of corn with pulled-
  back husks resting on it."

**Celebrations** (attach the Halloween + Thanksgiving counterparts for exact composition):
- `celebration-stage-winter.png` (full-bleed, keep its own background): "Same composition and pool geometry as the
  attached harvest barn stage: a snowy outdoor stage framed by two snow-laden pine trees instead of curtains, strings of
  colored lights along the top, a navy night sky with a cold moon, the stage floor a frozen pond, a lit hanukkiah
  silhouette in a cabin window at the left and a kinara in a window at the right, a decorated tree at the back. No text."
- `scene-flawless-star.png`: "The attached pink O character (on-model, heart sunglasses ON the eyes exactly as attached,
  wink) standing on the pink gem as in the attached scene, dressed in the red fur-trimmed cape closed at the front with a
  bow and a white fur muff (the winter o2 costume); no hat on the sunglasses. Same background as the attached scene with
  soft snowfall."
- `scene-sweep-broom.png`: "The attached S on one broom, tiles trailing, exactly as the attached scene, wearing the winter
  s costume: red-and-white scarf wrapped at the neck with tails flying back, navy puffer vest, red mittens; headband and
  sneakers kept; snowflakes instead of leaves in the trail."
- `home-host-w.png` / `home-host-o1.png`: same framing as `thanksgiving/extras/home-host-*.png`; W in the full Santa coat
  costume holding a stack of gifts; o1 with antlers, bell collar and belly bib, pom-poms up.

**Extras** (layout reference = the Halloween/Thanksgiving file named; key #00FFFF):
- `btn-candycane.png`, `btn-cocoa.png`, `btn-evergreen.png` (ref btn-pumpkin / btn-midnight): same button shape, candy-cane
  stripe, cocoa brown with marshmallow highlights, deep evergreen with a holly sprig.
- `badge-snow-day.png` (ref badge-trick-or-treat): snowflake emblem in a silver rim. `badge-winter-streak.png` (ref
  badge-pumpkin-streak): a lit candle trio (red, black, green) in a gold rim.
- `streak-flame-candle.png` (ref streak-flame-jack): a flame made of a single tall candle flame with a blue core.
- `streak-shield-snowflake.png` (ref streak-shield-candy): an ice-blue shield with a snowflake.
- `tile-theme-gingerbread.png` (ref tile-theme-pumpkin, 5x2 sheet): gingerbread tiles with white icing edges, top row
  S N O W Y, bottom row C O L D + two plain tiles.
- `podium-winter.png` (ref podium-halloween): three snow-capped ice blocks, empty plaques, a string of lights.
- `dress-tab-winter.png` / `dress-tag-winter.png` (ref dress-tab/tag-thanksgiving): snow-capped tab with a holly sprig
  and a small dreidel; tag = a wooden gift tag with a red ribbon.
