# Mascot maker: new additions queue

**Status 10-05: DRAWN AND BUILT (proposals).** Every piece below was drawn in ChatGPT on 10-05 (sheets in `raw/`,
split by `split.py` into `pieces/`), built with `../integration/new_pieces.py` + `build_new.py`, and fit-checked on
all 12 bodies (`../integration/fit-new.json`: 37 options, 0 failures). They are shown in `../options.html`,
section 3. The shipped `avatar-parts.json` is untouched. Changes from the plan below:
- The apron, necktie, sash, and the belt on short bodies are drawn UNDER the letter (a new `under` layer in
  `rig.compose`): the letter stays on top, like a print, instead of the part dodging it.
- Shoes use only the lower part of the drawn shoe (sole, toe and laces), because the stubby feet would vanish in a
  full high-top. The torso stays in front of the shoe tops.
- Brows are drawn in code in the eyes' own ink (six pairs, no angry ones), not by ChatGPT.
- The face extras (sweat, tear, steam, heart) came from the footwear sheet.
- R's ghost back panel and hood are done and in the Halloween header.

The original plan follows.

---

None of these were drawn when this was written (10-04). Each row is one ChatGPT piece, made for the integration rig
(`../INTEGRATION.md`). After drawing: key, cut, build with `integration/pieces.py`, run `integration/fitcheck.py`
on all 12 bodies, then add to `options.html`.

**Every prompt starts with this preamble:** "Single glossy 3D toy-style accessory for a chubby letter-tile
mascot, soft vinyl look, lit from the TOP-LEFT with a soft highlight, no character, no face, no outline, no
text, centered on a flat solid #00FFFF background (magenta #FF00FF if the item is teal, blue or green), front
view." Attach `art-av-body-classic.png` for scale.

**Layers:**
- held = drawn under the hand-over layer (the fist covers the handle);
- wrap = warped along the body's wrap line;
- back/front = a split pair.

## Held items (the hand grips the marked spot)
| id | prompt (after the preamble) | grip | set |
|---|---|---|---|
| mug | coffee mug with a little heart, steam curl, handle on the left side | handle | Bookworm |
| book | small closed hardcover book, spine facing us, standing upright | lower spine | Bookworm |
| balloon | round helium balloon on a curly string; draw the string ending in a small knot at the bottom | string end | Party |
| trophy | small gold trophy cup with two handles on a stubby base | base | Athlete |
| pencil-big | chunky yellow pencil, upright, eraser on top | middle | Bookworm |
| magnifier | round magnifying glass, handle pointing down | handle | Explorer |
| umbrella | closed polka-dot umbrella, hooked handle at the bottom | handle | Rainy day |
| icecream | two-scoop ice cream cone, cone pointing down | cone | Summer |
| spatula | chef spatula with a pancake on it, handle down | handle | Chef |
| mic | retro silver microphone, handle down | handle | Rock star |
| flashlight | small flashlight with a soft beam, held pointing up | barrel | Explorer |
| wand-star | star wand with a ribbon | stick | Pro: Magic |

## Wraps (drawn flat and straight; code bends them around the body)
| id | prompt | layer |
|---|---|---|
| bandana | folded bandana band, straight horizontal strip, paisley print, with a knot + two short tails as a SEPARATE piece | wrap + tail |
| sash | diagonal pageant sash strip with a gold edge, straight | wrap (diagonal) |
| belt | leather belt strip, straight, with a separate gold buckle piece | wrap + front |
| apron | short chef apron front panel, with separate neck-strap and waist-tie strips | front + wrap |
| tie | short necktie, knot on top | front (neck gap) |
| lei | flower lei as a straight strip of flowers | wrap |
| cape-drape | cape BACK panel only (hangs behind), plus a SEPARATE collar-and-clasp piece | back + front |

## Footwear (sized from the 12 bodies' feet; shoe-over layer)
| id | prompt |
|---|---|
| sneakers | pair of chunky high-top sneakers seen from the front, toes toward us, laces |
| boots | pair of rain boots, front view, toes toward us |
| slippers | pair of fuzzy bunny slippers, front view |
| skates | pair of roller skates, front view |

## Companions (tiny, never over the face)
| id | prompt | anchor |
|---|---|---|
| bird | tiny round bird sitting, facing us | head top (beside a hat) |
| kitten | tiny kitten sitting, facing us | floor, beside the feet |
| puppy | tiny puppy sitting, tongue out | floor |
| snail | tiny snail with a swirl shell | shoulder edge |

## Brows and expressions (face layer; drawn as dark-plum strokes like the eyes)
| id | prompt |
|---|---|
| brows-set | sheet of 6 pairs of small rounded eyebrows: happy, worried, determined (not angry), surprised, cheeky one-up, sleepy |
| tears-sweat | small sweat drop, single happy tear, little anger-free steam puff |

## Personality sets (bundles; the maker offers "wear the set")
| set | pieces |
|---|---|
| Bookworm | mug, book, roundglasses (have), pencil-big |
| Athlete | trophy, sweatband (have), sneakers |
| Chef | spatula, apron, chef hat (have) |
| Explorer | magnifier, flashlight, bucket hat (have), backpack (rebuilt) |
| Rock star | mic, guitar (rebuilt), star glasses (have), chain (rebuilt) |
| Rainy day | umbrella, boots |
| Pro: Magic | wand-star, wizard hat (have), supercape (rebuilt) |

## Animation-ready (only once the rig gets arm cut-outs)
These are poses. The hand ellipses in `integration/rig.py` give the cut. Rotate the arm about the shoulder:
- wave
- cheer (both arms up)
- arms crossed (needs one drawn crossed-arms piece per body family)

## Halloween header follow-up
R's ghost sheet: the night-1 sheet is mostly hidden behind him, so it reads as wisps. Queue one piece: "ghost
sheet BACK panel with ragged hem, hanging behind a square tile character, plus a separate small sheet hood
piece that drapes over the top edge" (back + front).
