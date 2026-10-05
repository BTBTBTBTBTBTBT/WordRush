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

## How it ships (proposal, not applied)
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
