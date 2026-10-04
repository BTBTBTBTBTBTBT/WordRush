# W puppet pilot (10-04)

Open `preview.html` (self-contained). W idles with a soft breathing squash, blinks every 3 to 5 s and waves twice
every 6 s. His cape sways and ripples, and tapping him makes him hop and laugh. Light and dark stages are side by
side. With reduced motion he holds still, and a tap only switches him to the laughing face.

## How it is built (founder rule: animate the real approved art)
- `rig.py` cuts the layers out of `cast/hero/w.png` with masks. The cape flap, the body and the hip arm are all
  hero pixels. Where a hidden area has to be filled, the fill is code-cloned from the neighboring hero pixels:
  - The body edge behind the hip arm continues the hero's own edge curve (cubic fit), and the edge band is cloned
    from the rows just above and below it.
  - The cape continues under the body with each row's own edge color.
- Blink and laugh are code-painted over his real face:
  - eye and mouth areas filled with a quadratic color surface fitted to the face ring around them;
  - closed-lid arcs and ^ ^ arcs drawn in his own eye ink;
  - half-blink = his real eyes squashed to 45 % height;
  - laugh mouth = his real mouth stretched 1.55x down from the top lip.
- **One part is not hero art: the raised waving hand.** The hero has no raised arm, and the w-wave pose is only
  311 px wide, so it would be blurry at this size. The hand comes from a ChatGPT parts sheet
  (`raw/chatgpt-parts-sheet.webp`; the body ChatGPT redrew on that sheet is NOT used). It is color-matched in Lab to
  the hero's own hip arm, and its shoulder end hides behind the body edge. Swap it for an approved arm whenever one
  exists.
- `build.py` writes `preview.html` and `embed.html`: canvas plus about 120 lines of JS, with the layers as WebP data
  URIs (215 KB in total). The cape ripple is drawn in 1 px rows on an offscreen canvas at native resolution and then
  composited once, so it has no slice seams.
- `rig.json` holds the pivots and offsets in hero pixels:
  - arm pivot (858, 520), base -42 deg, +/-25 deg;
  - cape pivot (330, 470), sway 3.5 deg, ripple 6 px at the hem;
  - breathing origin at the feet.

## Accuracy check
Composited at rest (cape + body + rest arm), the layers reproduce `cast/hero/w.png` with:
- mean abs difference 0.014/255 in RGB and 0.028/255 in alpha, over 474,891 character pixels (target < 2/255);
- `diff.png` = |difference| x 8. The only visible traces are single anti-aliased pixels on the cape outline.
`rig.py` prints the numbers and stores them in `rig.json`.

## Honest read
- **Smooth and on-model:**
  - Breathing, blink and the 2-wave loop are smooth and on-model, because the face, letter and body are the real
    pixels.
  - The arm meets the body with no seam (it is behind the edge).
  - The cape stays crisp. The sway plus the hem ripple reads as cloth at this amplitude. Anything larger looked
    flappy, so ripple stays at 6 px or less. A sway alone (`rippleAmpPx: 0`) also reads fine and is the safe fallback
    for small sizes, where the ripple is invisible anyway.
- **Weakest moment:** the arm swap (hip pose to raised pose) at the start and end of the wave. It is a 50 ms
  crossfade hidden inside a fast swing. In motion it reads as a snap up, but a paused frame shows two arms.
- **Second weakest:** the raised hand is a hair more saturated than the hero up close.

## Per-character gestures (same method: cut from the hero, fill hidden areas in code, add only missing limbs)
| gesture | layers | notes |
|---|---|---|
| wave | body minus one arm, rest arm, raised arm (pivot at the shoulder, behind the body) | done for W |
| point | body, rest arm, pointing arm | one rotation ease-out plus a little overshoot; the arm needs a pointing hand |
| cheer | body, both arms raised (or O-amber's four arms as 2 pairs) | bounce the body on beat; arms are new art for everyone except S (who already pumps an arm) |
| nod | head = the whole tile | rotate the tile +/-6 deg about the feet line, with the legs as a separate layer so they stay planted; easy, no new art |
| yawn (R) | body, mouth patch (his real mouth stretched tall), eyes squashed, nightcap tip as its own layer | the nightcap tip droops with a slow sway like W's cape; no new art |
| blink | face patch over each eye (fitted fill + lid arc) | works for every cast member with open eyes. U's eyes are already closed, so give him a slow "breathe" instead |
| props | D's pencil, I's sprout, S's headband tails, pink O's sunglasses | each is a separate sway layer, which is great value for no new art |

## What's hard
- **Limbs the hero hides or doesn't have** (raised arms, open hands) need new art. Use the pose library if it is
  high-res, otherwise a ChatGPT limb color-matched to the hero. Never redraw the face or body.
- **Glossy 3D renders carry baked lighting.** A rotated arm keeps its highlight in the wrong place, so keep rotations
  at about +/-25 deg or less.
- **The legs are part of the tile.** Big hops look fine, but a walk cycle needs the legs cut as separate layers.
- **O-amber's four arms and pom-poms, and C's mouth (the C itself)** need careful masks. C's mouth can't open
  without new art.
- **Shipping:** on iOS and Android this rig maps directly to SwiftUI/Compose (layers plus rotation/scale
  animations). Lottie isn't needed.
