# Landmark fitting — prototype report (10-06)

STEP ONE of `../NEXT-ROUND-INK-AND-BLING.md`: measure every body once, then let every item place itself from those
measurements by one rule, instead of being hand-fitted per body. This is a pipeline, a prototype and this report.
**Nothing in the apps changed**: no app code, no shipped art, no manifest, no version numbers. Everything lives in
`docs/design/brand/avatar/integration/`, and the sheets are under `out/landmarks/`.

Body ids: the code still uses `blob` / `pear` / `chunky` for the bodies the maker calls round / cone / block.

## What was built

| piece | file | output |
|---|---|---|
| landmark extraction | `landmarks.py` | `landmarks.json`, `out/landmarks/overlay-<body>.jpg`, `overlays.jpg` |
| attachment rules + rule-driven renderer | `rules.py` | `rule-pieces.json` (+ per-layer art in the git-ignored `out/landmarks/_layers/`) |
| guards | `audit.py --guards [shipped\|rule]`, `--hoop-regression` | pass / fail per item × body |
| today's fit, loaded the way the apps draw it | `fits.py` | (the core layout through `dump-layout.ts`, the shipped per-body art) |
| comparison | `compare.py` (`--table`) | `out/landmarks/compare-01…11.jpg`, `compare.json`, the table below |
| sizes | `sizes.py` | `landmarks-sizes.json`, `out/landmarks/sizes-*.jpg`, `sizes.json` |
| clothing | `garments.py` | `out/landmarks/garments-*.jpg`, `garments.json` |

Run order: `landmarks.py` → `compare.py` → `sizes.py` → `rules.py` → `garments.py`. Python deps are Pillow, numpy,
scipy and opencv. The one-art items go through the real core layout via `npx tsx`. `rig.py` now falls back to the
app's own Nunito when macOS Arial Black is missing.

## 1. Landmarks — what works

Measured from each body's art plus its face and letter anchors (the body's design), in body units:

- **Outline:** the contour.
- **Head:** the head-top curve, plus the head band 30% of the way from the top to the eyes. Head width = the band
  width, but never less than 0.85 × the face width.
- **Face and letter:** the face box (default face, plus the union of every eyes and mouth part), the letter box and
  the W/M ink box.
- **Shoulders:** the shoulder line and points (where the arms hang from), plus the shoulder tops (where straps come
  over).
- **Arms:** start and end notches, the tip, and the hand ellipse.
- **Neck band:** the arm-free band between the mouth and the letter, inside the arms.
- **Lower body:** the waist line and its room, the hip line and crotch, the feet boxes (cut at the ankle on star), the
  floor, and the torso span every 0.01 with the arms excluded.

**Arms come from the outline alone.** Each mitten sits between two concave notches: the thumb notch above and the
armpit below. The hand ellipse runs from the outward tip to 40% of the protrusion inside the torso edge. Against
today's hand-fit `HANDS`, the mean error is **0.011 body units**. The largest gaps are bean-R (0.044) and star
(0.02). Those were checked on the overlays, and the measured ellipse is the one that sits on the mitten.

Overlay review fixes:
- Star's feet first included the star's lower points, so feet are now cut at the ankle.
- The tall body's neck band ran outside the silhouette, so it's clipped.
- With sizes: on 4 of 72 variants the arm search picked the wrong notches (the feet, or the star's upper points). The
  variant builder now passes where it attached each mitten as a prior. The overlay sheet is what caught it, which is
  the "one glance" gate working.

**One body-level override.** The cloud's head band lands on its small top puff (0.29 wide), so every hat came out
tiny. The hand fit seats hats over the puff onto the two lumps (0.62). `landmarks.LANDMARK_OVERRIDES` keeps the
hand-placed head band for cloud, with that reason.

**Finding: the letter the guards protected was ~20% too small.** The integration rig drew the guard letter at the
letter box height × 1.05 in Arial Black. The apps draw Nunito 900 at `min(h / 0.74, w / 0.9) × 0.94`. Everything
here uses the app's letter (`rig.LETTER_MODE = 'app'`). The 10-05 ship scripts keep the old default until someone
re-ships with it on.

## 2. Rules — every item is on one

99 items: 93 `acc:*` and 6 `brows:*`. `python3 integration/rules.py --table` prints each rule's anchor, scale,
split, zone and curve.

| kind | items | anchor → scale | split | zone / curve |
|---|---|---|---|---|
| hat | 37 | the opening rests on the head-top curve at the head center → head width × item w × 0.95 | head | above the eye line − 0.012. Headphones: cups clamp the head just above the eyes |
| face | 9 | face center + eye / mustache / cheek line → face width × w | face | identical to today: the face anchors are the face |
| pendant | bow tie, medal | the drape bottom → the biggest of 100–60% that clears the face + letter. The medal may slide along the drape | neckFront, else under the letter | the arm-free band |
| necklace | chain | U between the shoulder points under the mouth → link height | wrap | drape; withheld where it can't clear the face + letter |
| drape | scarf, bandana, lei | the drape → band thickness | wrap | inside the arm-free band (tail / knot beside the arm) |
| cape | cape, supercape, cape-drape, vampire collar | the neck line + floor → body width × 1.28 (peeks out at the sides) | back + wrap (cord on the drape, clasp) | behind; front parts dropped when there's no room (wide) |
| backpack | backpack | shoulder tops + both hands → body width at the eyes | back + wrap straps | straps keep 0.035 clear of the face |
| wings | wings, fairy wings, bat wings | torso center at the eye line → width at the eyes × k | back | peeks out both sides |
| tail | cat tail | inside the torso edge above the hip line → body height × 0.62 | back | behind |
| belt | belt | the waist line → its room | wrap, or under the letter | waist garment |
| apron | apron | the drape bottom + hips → torso width × 0.82 | under + wrap | waist garment |
| shoes | 4 | each foot box → foot width × 1.25 | feet | on the feet, below the torso |
| held | 16 | the hand center (the art's grip point) → hand diameter × k | held + hand-over | off the face + letter. Tall items go to the hand with more room (the bean case is now a rule, not a body check) |
| buddy | 7 | floor + right foot / head-top curve / shoulder top / beside the head → k × √(body height) | pet | beside the body |
| brows, extras | 10 | the eye boxes | brows / extra | by the face |

The renderer is `rules.render(key, body)`. It reads only `rules.LMS[body]`; `landmarks.install()` swaps the rig's
hand-fit `HANDS` and feet line for the measured ones, so the 10-05 drawing helpers (drape, straps, warps, shadows,
AO, the hand-over cut) run on measurements. Output is the same per-body layers `ship-integrated.py` ships (`pieces`)
and goes through the same `ship_layers`. One-art items get a per-body rect.

**Override:** `acc:bowtie` keeps today's fit (`rules.OVERRIDES`; reason in the table).

## 3. Guards — `audit.py --guards`

An item FAILS on a body when it:
- crosses an arm region (front layers over a mitten or arm bulge > 0.0006 U²);
- is wider than the torso at its height on ≥ 6 rows (waist garments exempt; backpack straps exempt above the
  shoulder tops, where they come over from behind);
- leaves the outline (> 3% outside the silhouette + 0.012);
- covers the face or the letter > 1% (face items exempt from the face check);
- floats off its anchor, judged per kind: the hat touches the head curve (the halo may float), a held item touches a
  hand, shoes sit on the feet, floor buddies stand on the floor, back pieces touch the outline, front pieces sit ≥ 50%
  on the body.

**Hula-hoop regression.** `audit.py --hoop-regression` runs the guards on the neck items exactly as shipped before
the drape fix (`c08582d^`):
- The **chain fails on 9 of its 10 bodies** (arm + torso).
- The straight cape, supercape and vampire-collar cords fail on 11/12.
- The scarf, bandana and lei bands fail on 12/12.

The old face/letter-only check passed all of them.

**Today's shipped fits under the guards: 84 of 1,186 item × body fits fail.**
- 70 letter, 21 face, 6 arm, 5 outline, 3 torso.
- Most letter failures come from the bigger app letter. On the bodies with the tightest mouth-to-letter gap (wide,
  cloud, mini, chunky, hex, star) the 10-05 neck items cover the top of a W or M.
- The headphone cups cover the eyes on 7 bodies.
- The bow tie and medal cover the mouth and letter on 10–12 bodies.
- The apron and backpack straps run over the arms on classic, bean and chunky.

**Rule fits: 12 of 1,176 fail.**
- 10 are the bow-tie override (known).
- 2 are backpack straps on tall and bean, the two narrowest bodies, where the straps ride on the outline (today's
  fails on tall too).

## 4. Item-by-item: today's fit vs the rule fit

Sheets: `out/landmarks/compare-01…11.jpg`. Each pair is LEFT shipped today, RIGHT rule-based; a red frame means a
guard fails. Verdicts are from looking at the sheets, and an item whose look is equal but which stops failing guards
counts as better. "Withheld" means the rule found no room on that body, where today draws it anyway. Counts: **86
equal, 12 better, 1 worse (kept as an override).**

| item | rule | verdict | guard fails today → rule (of 12) | withheld by the rule | note |
|---|---|---|---|---|---|
| heart-glasses | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| starglasses | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| roundglasses | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| mask | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| eyepatch | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| monocle | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| mustache | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| curlymustache | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| facepaint | face | equal | 0 → 0 | — | identical: the face anchors ARE the body's face |
| crown | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| party | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| beanie | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| sprout | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| nightcap | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| headphones | hat | better | 7 → 0 | — | cups clamp the head above the eyes; today's cups cover the eyes on 7 bodies |
| bow | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| wizard | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| pirate | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| cowboy | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| chef | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| grad | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| halo | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| flower | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| tophat | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| propeller | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| catears | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| bunnyears | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| tiara | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| viking | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| sweatband | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| cap | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| beret | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| minicrown | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| flowercrown | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| bucket | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| santa | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| witch | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| astronaut | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| bigbow | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| pombeanie | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| bearears | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| mohawk | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| brows:happy | brows | equal | 0 → 0 | — | identical (eye boxes) |
| brows:worried | brows | equal | 0 → 0 | — | identical (eye boxes) |
| brows:determined | brows | equal | 0 → 0 | — | identical (eye boxes) |
| brows:surprised | brows | equal | 0 → 0 | — | identical (eye boxes) |
| brows:cheeky | brows | equal | 0 → 0 | — | identical (eye boxes) |
| brows:sleepy | brows | equal | 0 → 0 | — | identical (eye boxes) |
| pumpkinhat | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| candycornhat | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| witchnight | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| batears | hat | equal | 0 → 0 | — | same seat on the head-top curve; within ~10% of today's size (a touch bigger on box heads) |
| bowtie | pendant | worse → override | 10 → 10 | — | no room for a readable bow tie between the mouth and the letter on 10 bodies: the rule tucks it under the letter (it disappears). Today's fit is kept (rules.OVERRIDES); it still overlaps the mouth + letter — needs flatter art |
| medal | pendant | better | 12 → 0 | wide, cloud | today's ribbon covers the mouth on every body; the rule hangs a smaller medal off the face + letter (slides beside the letter on drop/pear), withheld on wide + cloud |
| chain | necklace | better | 2 → 0 | wide, cloud, mini | same drape; withheld on wide, mini (as today) and cloud (today's covers the letter there) |
| scarf | drape | better | 8 → 0 | wide, cloud | looks the same, but no longer covers the face / letter / arms on 8 bodies; same drape; withheld where it would cover the app-size letter (wide; cloud for scarf/bandana) — today's covers the letter there |
| bandana | drape | better | 8 → 0 | wide, cloud | looks the same, but no longer covers the face / letter / arms on 8 bodies; same drape; withheld where it would cover the app-size letter (wide; cloud for scarf/bandana) — today's covers the letter there |
| lei | drape | better | 8 → 0 | wide | looks the same, but no longer covers the face / letter / arms on 8 bodies; same drape; withheld where it would cover the app-size letter (wide; cloud for scarf/bandana) — today's covers the letter there |
| cape | cape | better | 2 → 0 | — | looks the same, but no longer covers the face / letter / arms on 2 bodies; same cape; on wide (vampire collar: wide + cloud) the front cord + clasp are dropped: no room between the mouth and the letter |
| supercape | cape | better | 2 → 0 | — | looks the same, but no longer covers the face / letter / arms on 2 bodies; same cape; on wide (vampire collar: wide + cloud) the front cord + clasp are dropped: no room between the mouth and the letter |
| cape-drape | cape | better | 5 → 0 | — | looks the same, but no longer covers the face / letter / arms on 5 bodies; same cape; on wide (vampire collar: wide + cloud) the front cord + clasp are dropped: no room between the mouth and the letter |
| vampirecollar | cape | better | 7 → 0 | — | looks the same, but no longer covers the face / letter / arms on 7 bodies; same cape; on wide (vampire collar: wide + cloud) the front cord + clasp are dropped: no room between the mouth and the letter |
| backpack | backpack | better | 4 → 2 | — | looks the same, but no longer covers the face / letter / arms on 2 bodies; same pack + straps (from measured hands) |
| wings | wings | equal | 0 → 0 | — | same; a little bigger on the narrow bodies (0.95 min width) — reads fine |
| fairywings | wings | equal | 0 → 0 | — | same; a little bigger on the narrow bodies (0.95 min width) — reads fine |
| batwings | wings | equal | 0 → 0 | — | identical rule (it was already measured) |
| cattail | tail | equal | 0 → 0 | — | same tail; its base now anchors inside the torso edge above the measured hip line |
| belt | belt | equal | 0 → 0 | — | same waist line; star's belt drops under the letter (no room above the legs) |
| apron | apron | better | 9 → 0 | wide, cloud | torso-wide (not arm-to-arm): no longer over the arms on classic/bean/chunky; neck strap on the drape; withheld on wide + cloud (no room) |
| sneakers | shoes | equal | 0 → 0 | — | same; shoe height now from the visible foot (crotch → floor) |
| boots | shoes | equal | 0 → 0 | — | same; shoe height now from the visible foot (crotch → floor) |
| slippers | shoes | equal | 0 → 0 | — | same; shoe height now from the visible foot (crotch → floor) |
| skates | shoes | equal | 0 → 0 | — | same; shoe height now from the visible foot (crotch → floor) |
| mug | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| book | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| pencil-big | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| balloon | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| trophy | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| magnifier | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| flashlight | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| umbrella | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| icecream | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| spatula | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| mic | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| wand-star | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| candypail | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| bubbletea | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| guitar | held | equal | 0 → 0 | — | same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit) |
| bird | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| snail | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| kitten | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| puppy | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| blackcat | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| bat | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| ghost | buddy | equal | 0 → 0 | — | same spots; scaled by √(body height), so mini's pets are a little smaller |
| sweat | extra | equal | 0 → 0 | — | identical (eye boxes) |
| tear | extra | equal | 0 → 0 | — | identical (eye boxes) |
| steam | extra | equal | 0 → 0 | — | identical (eye boxes) |
| heart | extra | equal | 0 → 0 | — | identical (eye boxes) |

## 5. Sizes (prototype, not shipped)

Built by `sizes.py` from each of the 12 bodies' art:

| size | torso scale (wide × tall) |
|---|---|
| XS / S / L / XL | 0.8 / 0.9 / 1.12 / 1.25 |
| chunky | 1.28 × 1.0 |
| lanky | 0.94 × 1.3 |

How a variant is made:
- The torso (mittens inpainted out) is scaled about the hips.
- The mittens and feet keep their size and re-attach at the scaled torso edge.
- Eyes, mouth and letter move with the torso; the face scales by (sx·sy)^¼ and the letter box by min(sx, sy).
- Everything is normalized back into the body square.

Hands and feet keep their size, so XL reads as a bigger body and XS as a kid version.

Sheets: `sizes-bodies.jpg` (every variant), `sizes-overlays.jpg` (their landmarks) and
`sizes-<size>-{hats,face-neck-back,held-feet-buddies}.jpg`, every item × 12 bodies. All were looked at.

**Results: 72 variant bodies × 99 items = 7,128 fits.**
- **Measurement:** landmarks were measured on all 72. Auto arm detection first failed on 4 (star@XS, star@L,
  star@lanky, bean@L); the construction prior fixed them (see §1).
- **Fitting:** 7,033 drawn; 95 withheld for lack of room. The withheld ones are chain, medal, scarf, bandana, apron
  and lei on the narrow-neck variants (wide, cloud, mini, chunky-wide); batwings and cat tail on some chunky, lanky and
  mini variants; and shoes on mini@L / XL / chunky and cloud@L, where the letter reaches the feet.
- **Guards:** 74 fail. 60 are the bow-tie override, 12 are backpack straps on tall/bean/pear variants (as on the base
  bodies), and the other two are curly mustache (wide@XS) and steam (drop@XS) once each.
- **Visually:** everything follows the new proportions with no new code per size.

Two things to know:
- On pointed tops (drop, star, pear) at XL / chunky / lanky, hats sit on the tip at a face-relative size and read
  small. That's the rule doing what it says. If art direction wants bigger hats there, make the hat floor a fraction
  of the body width; it's a one-line rule change.
- Tall/lanky tiles look small because each tile frames the whole, now taller, body.

**Prototype limits:**
- The derived art has a faint seam where the scaled torso meets the feet on a few variants.
- The face-scaling exponent is a guess.
- Shipping sizes needs an artist pass on the 72 bodies (or a chosen subset).

## 6. Clothing that conforms to the body

`garments.py` adds the **garment** rule type, a garment shaped BY the body (see `../INTEGRATION.md` "How to add
clothing").

**Pieces:**
- **Tops:** the silhouette below the neckline (the necklace drape: under the mouth, up to the shoulder points) down to
  the waist (tee) or hip (hoodie, jerseys), inset a hair. They're cut away where the mittens cross the torso, so the
  arms and hands stay on top.
- **Sleeves:** separate pieces cut from each arm region. Short = the arm root, long = all but the hand tip, none =
  a tank with arm holes.
- **Bottoms:** from 30% of the torso above the hips (the letter prints over them) to just above the feet (pants), to
  the crotch (shorts), or a trapezoid flaring to 1.12 × the hip width (skirt; the flare may pass the outline).
- **Hood:** a band behind the head (back layer).

**Shading:** the body art's own luminance × flat zone fills, plus a soft hem shadow on the body below the hem. That
gives the top-left highlight, darker edges and darker bottom, so the garment reads as fabric on a round body.

**Team jerseys** are zone maps with a primary, a secondary/trim and an optional accent zone (`garments-jerseys.jpg`):

| template | zones |
|---|---|
| basketball | tank with arm-hole trim + side panels |
| baseball | button placket + pinstripes; the number takes the trim colour on light fabric |
| football | shoulder pads in the trim colour + a big number (letter box × 1.15) |
| hockey | two hem stripes + a lace collar |
| soccer | V-neck + sleeve bands |

**Letter on clothing:** with a top on, the letter is drawn ON it (the number or chest print) in the measured letter
box and takes the garment's lighting.

**Garment guards** (`garments.guard`):
- never past the outline (skirt flare and hood allowed);
- never over the face;
- both shoulder tops covered symmetrically (≥ 50% each, within 20%);
- sleeves inside their arm;
- top and bottom overlap at the waist;
- arms and sleeves cover ≤ 1% of the letter.

The guard caught the first basketball tank: its arm holes ate both shoulders on every body. Smaller holes fixed it.

**Sheets:** `garments-{tshirt,jersey,hoodie,shorts,pants,skirt,jersey+pants}.jpg` cover every test garment on all
12 bodies × base + 6 sizes, plus the 5 templates. All were looked at.

**Results:** 8 of 648 outfit × body × size checks fail, all the same case. On bean@XS and bean@S the right mitten
crosses more than 1% of the letter whatever the top, so it's a property of those two variants. Fix it in the variant
(nudge the mitten out) or accept it.

**Notes from looking:**
- The fit holds on every body and size: necklines clear the face, sleeves sit on the mittens, the top overlaps the
  pants, the skirt flares.
- Pants and shorts look alike, because these bodies' "legs" are their feet. Long pants need a decision: cover the
  feet tops (cuffs) or not.
- The hood is just a band. Real hood art (a back panel with a rim) is needed.
- All zones are flat procedural fills; the ChatGPT art replaces them zone by zone.

## 7. Failures and open items

- **Bow tie (override):** no room for a readable bow tie between the mouth and the letter on 10 of 12 bodies. Today's
  fit is kept and still overlaps the mouth + letter (the guards flag it). Fix: flatter or smaller bow-tie art, then
  delete the override.
- **Backpack straps on tall and bean** (and their size variants) ride on the outline, so they fail the torso check.
  Today's fail the same way on tall. Either thinner straps on narrow bodies or accept it.
- **Withheld on wide (and partly cloud):** chain, medal, scarf, bandana, lei, apron. With the real (app) letter there
  is no gap between the mouth and the letter. Today's versions draw there and cover the letter. Product call: withhold
  (rule) or allow a 1–2% letter overlap on those two bodies.
- **The letter guard gap:** the 10-05 ship scripts guard a letter ~20% smaller than the apps draw. 70 shipped fits
  cover the real letter by more than 1%. Re-shipping with `LETTER_MODE = 'app'` fixes the class.
- **Automatic arm detection** needs a prior when the outline has extra notches (star points, some variants). New
  hand-drawn bodies should get an overlay look (the documented gate); if one fails, pass a rough hand prior in its
  manifest entry (`handsPrior`).
- **Cloud head band:** a landmark override (hand-placed). A smarter head finder (the widest stable row above the eyes)
  could remove it.
- **Hats on pointed tops at the large sizes** read small (see §5).
- **Prototype only:** sizes and garments are not in the apps or the config, and the size art has seams (see §5–6).
- **Not done here:** hair, tattoos and mesh-warping items to the body. The rules place and scale; warps only exist
  where the 10-05 code already had them (drapes, bands).

## 8. What it would take to ship this into the apps

Three steps. Each can ship on its own, and none needs a renderer change until step 3.

**Step 1: re-ship today's items fitted by rule (12 bodies). The renderers don't change.**
1. Turn on the app letter in the ship scripts (`rig.LETTER_MODE = 'app'`) so every guard protects the letter
   players actually see.
2. Point `ship-integrated.py` / `ship-seasonal.py` at `rules.build()` instead of their per-item builders, and run
   `landmarks.install()` first. The output format is identical (`pieces` + per-layer art × web, iOS, Android). Add
   `audit.py --guards rule` to the ship gate, next to the fit check and `--wraps`.
3. One-art items stay one art. Their rule rects become `bodies.<id>.overrides[key] = {dx, dy, scale}`, which the
   core layout already applies. Hats and headphones need nothing else.
4. The pendants need one small core change. A medal or bow tie that drops under the letter changes layer per body
   (`neckFront` → `under`), so add an optional per-body `layer` to `overrides` (avatar-layout.ts plus its Swift and
   Kotlin twins), or ship those two as per-body `pieces`.
5. Product calls before re-shipping:
   - The rule withholds chain, scarf, bandana, lei, apron and medal on wide (and some on cloud). Today they're drawn
     there but cover the letter.
   - Accept the bow-tie override until there's flatter art.
6. Regenerate `art-av-pieces.ts`, the parity fixtures and the iOS/Android copies the usual way. Cost: a re-run, the
   sheets and a review; roughly 1–2 days.

**Step 2: new bodies and new items become routine.** That's the "how to" in `../INTEGRATION.md`: drop the art in,
run `landmarks.py <id>`, look at its overlay plus its column on the comparison sheets, then ship. A new item is one
rule. Store the measured landmarks in `avatar-parts.json` (`bodies.<id>.landmarks`) only if a renderer ever needs
them; the baked-art approach doesn't.

**Step 3: sizes and clothing (bigger).**
- **Sizes:**
  - A new config field `size` (XS…XL, chunky, lanky): validated, defaulted, and pinned in the parity fixtures.
  - 72 more body arts × 3 platforms.
  - Per-body `pieces` for every body × size: about 72 × 55 items × 1.5 layers ≈ 6,000 more layer images per
    platform. That's too many to bundle. Either restrict sizes to a few bodies, ship the size art as on-demand
    downloads, or move the layer bake on device. The bake is pure image work, but then iOS, Android and web must
    match pixel for pixel (parity risk).
  - The derived torso warp also needs an artist pass. Thin seams show where the scaled torso meets the feet on
    some variants.
- **Clothing:**
  - The garments themselves fit the rule model (per body × size baked layers).
  - Team colors need per-ZONE tinting: ship each zone as a white, body-lit layer and tint it in code with the
    config's primary / secondary / accent colors. That's the existing accessory tint recipe applied to three layers
    instead of one, plus three new config colors.
  - The letter must draw on the garment (between the garment and the sleeves), which `letterIndex` already allows,
    because garments ship as `under` layers. The sleeves need a new layer after the arms.
  - The final zone art comes from ChatGPT. The procedural zones here prove the fit only.
