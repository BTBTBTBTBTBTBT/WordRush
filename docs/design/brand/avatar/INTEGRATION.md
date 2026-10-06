# Making accessories part of the mascot (10-04)

Founder: "some of them don't work and are completely bolt on like the back pack… I want an answer for how we
do things like the back pack better." This is that answer: the rules, the technique, and what changed.
Code: `integration/` (rig.py, pieces.py, fitcheck.py, build.py). Gallery: `options.html`.

## Why parts look bolt-on today
Today the shipped layout places every part as ONE flat sticker on ONE layer at an anchor point
(`avatar-layout.ts`). Nothing knows about the arms, the face or the letter. The audit (`integration/audit-*.png`,
every part on 4 bodies) shows five failure types:

| failure | parts |
|---|---|
| no contact: hovers beside the body, nobody holds it | bubble tea, guitar (a headstock poking out from behind) |
| wrong scale and layer: the whole thing is behind, bigger than the body, with no straps | **backpack** (a white slab behind the mascot) |
| covers the letter, ignores the body's shape | scarf, chain, medal on tall bodies |
| hidden, so it reads as a smudge | white supercape (it hangs from above the eyes and is mostly covered) |
| not attached: no clasp or tie in front | cape, supercape |

Hats, glasses and face parts mostly pass. They sit on top of the head and on the face, so a single layer is
honest for them.

## The rules
1. **Split the front and the back.** Anything worn on the body has two pieces. The bulk goes BEHIND the body
   (the pack, the cape, a tail). What wraps the body goes IN FRONT (the straps, a cord and clasp, a scarf band).
   Back pieces are clipped to outside the silhouette.
2. **Hands hold things.** The body's own hands are cut from the body art and drawn again ON TOP (the hand-over
   layer). Straps then tuck under the arms, and held items sit in the fist. A held item is never just placed
   next to the hand.
3. **Wraps follow the body.** Scarves, cords, chains and belts are warped along the body's wrap line. On a
   letter tile that is the gap between the mouth and the letter: the wrap is thinner where the face and letter
   are and fuller at the sides. A cylinder shade darkens it as it turns away, and it overhangs the silhouette by
   a hair, so it goes AROUND the body, not on top of it.
4. **Never cover the face or the letter.** Eyes, mouth and the initial are a hard mask. A part that would
   touch them moves out of the way (the `avoid()` nudge). It is never cut by the mask. A body with no room
   doesn't get that part (the chain on `wide` and `mini`).
5. **Every body gets its own fit.** Anchor and scale come from that body's measurements: shoulder line, hand
   ellipses, wrap line, floor. They never come from one global offset. A backpack never hangs below the
   hands, and a guitar is as tall as hand-to-floor.
6. **Contact shadow and occlusion are baked in.** Front pieces cast a soft shadow down-right onto the body.
   Back pieces darken where they disappear behind the body (ambient occlusion).
7. **Match the light.** The bodies are lit from the top-left (gloss at the top-left). Every piece is re-lit to
   the same gradient, and drawn pieces (straps, cords) put their highlight on the top-left edge.
8. **Fit-check every piece on every body** (`integration/fitcheck.py`; see the thresholds below) before it
   goes in the gallery.

## The backpack, specifically
- The pack sits behind the body. Its top and handle peek 0.17 above the shoulders, and it is sized so it
  never hangs below the hands.
- Two padded straps are drawn per body. Each comes over the shoulder edge, hugs the side and disappears under
  the hand.
- The straps have stitching and a slider buckle, carry the top-left highlight, and are tinted with the
  accessory color.
- On narrow bodies (tall, bean, pear) the straps slide outward and get thinner, so they never touch the eyes.
- The body casts a shadow on the pack, and the straps cast a contact shadow on the body.

## Shipped (10-05, manifest v3)
Founder 10-05: "make sure the new items … are inclusive in the new build so long as they don't look bolted on."
`integration/ship-integrated.py` builds every rebuilt + new part on all 12 bodies with this rig, fit-checks it, and
bakes everything the rules need into PER-BODY LAYER ART, so the three renderers only draw rects:
- `avatar-parts.json` v3: `items[key].pieces[body] = [[layer, x, y, w, h], …]` → art
  `art-av-<kind>-<id>-<body>-<layer>`; a body missing from the map has no room (the chain on wide + mini) and draws
  nothing. `bodies.<id>` carry `hands`, `shoulderY`, `wrap`, `floor`; eyes carry `inkTop` (brows clear tall eyes).
- Layers: `back` (clipped outside the silhouette, AO baked) · body · pattern · `under` (apron / belt on short
  bodies, + contact shadow) · LETTER (`AvatarLayout.letterIndex`) · cheeks · eyes · `brows` · nose · mouth · face ·
  `wrap` (straps, scarves, cords, collars + shadow, face/letter guarded) · `held` (+ shadow) · head · neckFront ·
  `feet` · `pet` · `extra`.
- The hand-over layer is baked: a held item / strap is cut away inside the hand ellipse, so the body's own hand
  (with its color and pattern) shows on top: the fist covers the handle, straps tuck under the arms.
- New config fields `held`, `wrap`, `feet`, `pet`, `brows`, `extra` (missing = none; only worn ones are written).
  The 7 rebuilt parts keep their ids (backpack, scarf, chain, bubbletea, guitar, cape, supercape).
- Gate: fit-check passes on every body; contact sheets of the SHIPPED art (`integration/contact-integrated.py`,
  `integration/out/shipped/`) were reviewed. Dropped: the necktie (no room for the blade: a knot behind the letter or
  a sideways second bow tie) and the sash (the face guard pushes it onto the letter band: a stripe across the
  letter). Fixed: sneakers (the upper + laces, not white soles), boots (wider), the shoe keying fringe, sleepy
  brows (relaxed, never slanting in like angry brows).

## The necklace drape + hoop check (10-05)
Founder: the chain "went around his arms like a hula hoop". The fit check only measured the face and the letter, so
straight bands at the wrap line passed while running edge to edge over both arms. These are head-bodies with no neck,
so everything worn at the neck now hangs on ONE path, `pieces.drape_path(body)`: a soft U whose ends tuck BEHIND the
silhouette at about cheek height (above + inside the arms, `pieces.arm_mask`), whose bottom sits in the gap between
the mouth and the letter, darkening and thinning toward the ends (`_tuck`, perspective).
- chain: links stamped along the drape, smaller + darker toward the ends (`drape_chain`); still no room on wide/mini.
- cape, supercape, vampire collar: the straight front cord is gone; a thin cord on the drape (`drape_cord`) + a small
  clasp at the bottom of the U (`fit_clasp`: the biggest size that clears the face + letter).
- scarf, bandana, lei: the band follows the drape (`drape_band` / `drape_wrap`); the scarf tail hangs in the gap
  between the left arm and the letter; the bandana knot sits just inside the arm.
- `integration/audit.py --wraps` (also run by plain `audit.py`): every shipped wrap-line layer FAILS when it sits on
  the arms or covers ≥ 70% of the body's width on a row at arm height (a hoop). Waist garments (apron, belt) are
  exempt: they go around the body under the hands by design. It flagged 76 layers on the 10-05 art, 0 after the fix.

## How it ships (the 10-04 proposal, superseded by the section above)
The data needs four additions to `avatar-parts.json`, sketched in `new/proposal-avatar-parts.json`:
1. `bodies.<id>.hands`: the L/R ellipses (`integration/rig.py` `HANDS`).
2. `bodies.<id>.wrap`: the wrap line (y plus thickness per x sample).
3. Per item, `pieces: [{art, layer: back|front|held, anchor, w, ...}]` in place of one art file.
4. Two new layers in `layerOrder`: `wrap` (after mouth) and `handOver` (last). `handOver` re-draws the body
   art through a hand mask.

Every renderer already draws the body art, so `handOver` is the same image drawn twice with a mask. The
renderers still need these:
- clipping a back layer to outside the body (the alpha "destination-out" of the body);
- a multiply pass for the contact shadow, which can be pre-baked per body into a shadow PNG;
- the wrap warp. Pre-render the wrap per body (12 PNGs per wrap item) instead of warping on device, which keeps
  the apps simple and in parity across iOS, Android and web.

## Fit-check thresholds (integration/fitcheck.py)
| check | threshold |
|---|---|
| face covered | ≤ 1% of eye + mouth pixels |
| letter covered | ≤ 1% of letter pixels |
| seat: front pieces on the body | ≥ 55% (a hanging tail ≥ 25%) |
| grip: the hand covers a held item | 2–50%, and the item touches the hand |
| back piece hidden behind the body | ≥ 25% |
| back piece visible | 4–65% of the body area |
| frame: body scale | ≥ 0.5 |

Result: the 7 rebuilt parts × 12 bodies give 0 failures. The chain is withheld on `wide` and `mini`, which
have no neck room.

## Landmark fitting (10-06 prototype — STEP ONE of NEXT-ROUND-INK-AND-BLING.md)
Not shipped yet: the apps still draw the 10-05 art. Report + item-by-item table: `integration/REPORT-LANDMARKS.md`.
- `integration/landmarks.py` measures every body from its art (+ its face / letter anchors) → `landmarks.json` and a
  debug overlay per body (`out/landmarks/overlay-<body>.jpg`, all on `overlays.jpg`): outline, head-top curve + head
  band, face box, letter box, shoulder line + points, shoulder tops, arms (start / end notches, hand ellipses), the
  arm-free neck band, waist, hips, feet, floor, torso width per row. Hands come from the outline's notches (each mitten
  sits between two concave notches) — within 0.011 body units of today's hand-fit `HANDS` on average.
- `integration/rules.py` holds ONE rule per item (anchor, scale, split, zone, curve; `python3 integration/rules.py
  --table`) and renders it from the landmarks only → `rule-pieces.json` (the `pieces` format ship-integrated.py
  writes, + per-body rects for the one-art items). `OVERRIDES` keeps today's fit where it is clearly better (the bow
  tie); `landmarks.LANDMARK_OVERRIDES` keeps a hand-placed landmark (the cloud's head band).
- `integration/audit.py --guards [shipped|rule]` fails an item that crosses an arm, is wider than the torso at its
  height (waist garments exempt), leaves the outline, covers the face / letter beyond 1%, or floats off its anchor.
  `--hoop-regression` runs them on the 10-05 "hula hoop" art (c08582d^): the chain fails on 9 of its 10 bodies.
- The letter the guards protect is the one the APPS draw (Nunito 900 at min(h / 0.74, w / 0.9) × 0.94 of the
  letter box: `rig.LETTER_MODE = 'app'`), ~20% bigger than the rig's own letter that ship-integrated.py guarded.

### How to add a new body
Goal: drop the art in, run one script, look at one sheet.
1. Drop `parts/art-av-body-<id>.png` (1024², white glossy body, mittens + feet like the others) and give it a manifest
   entry with its FACE + LETTER anchors only (`face`, `eyeY`, `mouthY`, `cheekY`, `mustacheY`, `letterBox`) — that is
   the body's design; everything else is measured.
2. `python3 integration/landmarks.py <id>` → its landmarks + `out/landmarks/overlay-<id>.jpg`. Look at the overlay: the
   hand ellipses on the mittens, the feet boxes on the feet, the neck band between the mouth and the letter, the
   head band across the head. If a measurement is wrong for a reason the art can't fix (the cloud's top puff), add a
   `LANDMARK_OVERRIDES` entry with the reason.
3. `python3 integration/compare.py` (or `audit.py --guards rule <id>`) → every item fitted by its rule on the new body
   with the guards; look at its column on the sheets. Items the rule can't fit are withheld on that body (no room),
   never drawn badly.

### How to add a new item
Write one rule. In `rules.build_rules()` add `rules['acc:<id>'] = R(kind, anchor, scale, split, zone, curve, **params)`
with an existing kind (hat, face, pendant, necklace, drape, cape, backpack, wings, tail, held, belt, apron, shoes,
buddy, brows, extra) — a hat is just `HAT()` (its art's `anchor`/`w` in the manifest), a held item `HELD()` + its grip
point in `new_pieces.HELD`. Run `compare.py` / `audit.py --guards rule`; the guards + one look at its row are the gate.
A new kind is a function `(body) → layers` that reads `rules.LMS[body]` (never a body id).

### Sizes
`integration/sizes.py` derives XS / S / L / XL (torso × 0.8 / 0.9 / 1.12 / 1.25), chunky (1.28 wide) and lanky
(1.3 tall, 0.94 wide) from each of the 12 bodies: the torso is scaled, the mittens + feet keep their size and
re-attach (the face scales by (sx·sy)^¼), then the body is normalized back into the square. The landmarks are
re-measured (`landmarks-sizes.json`), every item is re-fitted by its rule and the guards run: contact sheets
`out/landmarks/sizes-<size>-<group>.jpg`, bodies + overlays `sizes-bodies.jpg` / `sizes-overlays.jpg`. Prototype only:
a size is not a config field yet (see REPORT-LANDMARKS.md "Shipping").

### How to add clothing
`integration/garments.py` — the "garment" rule type: shaped BY the body's landmarks, not pinned to a point.
1. A garment is a dict: `top` (hem: waist | hip, sleeves: short | long | none, template, hood, pocket, number),
   `bottom` (kind: shorts | pants | skirt) or both (a dress / overalls), and `colors` (p primary, s secondary trim,
   a accent).
2. Tops = the silhouette below the neckline (the necklace drape: under the mouth, up to the shoulder points) down to
   the hem, inset a hair, cut away under the mittens (the arms + hands stay on top); sleeves are separate pieces cut
   from each arm region (root / all but the hand tip). Bottoms = the silhouette from 30% of the torso above the hips
   (the letter prints over them) to just above the feet (pants), the crotch (shorts), or a trapezoid flaring to
   1.12 × the hip width (skirt). Hoods = a band behind the head (a back layer).
3. Shading = the body art's own luminance × flat zone fills, + a soft hem shadow. Team jerseys are zone maps
   (`zone_map`: collar, V-neck, placket + pinstripes, shoulder pads, lace collar, hem stripes, side panels, arm-hole
   trim, sleeve bands) — procedural here; final art (ChatGPT) replaces the flat fills zone by zone.
4. The letter is drawn ON the top (the jersey number / chest print) in the measured letter box, taking the garment's
   lighting (trim colour on light fabric; football × 1.15).
5. Guards (`garments.guard`): never past the outline (skirt flare + hood allowed), never over the face, both shoulder
   tops covered symmetrically, sleeves inside their arm, top + bottom overlap at the waist, the arms + sleeves cover
   ≤ 1% of the letter. `python3 integration/garments.py` → `out/landmarks/garments-*.jpg` on every body × size.
