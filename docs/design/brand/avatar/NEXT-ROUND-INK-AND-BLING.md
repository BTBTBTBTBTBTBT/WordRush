# Mascot maker — next round: "Ink & Bling" (candidates, founder picks first)

Planned for 2.7.2 (after the 10-09 usage reset; fitting/processing on cloud credits). Founder ticks the ones he
wants; only picked items get drawn (free ChatGPT, browser) and fitted on all 12 bodies with a LOOKED-AT "worn,
not bolted" check (see the 10-05 chain lesson). Everything stays cute / all-ages.

## STEP ONE — landmark fitting system (founder 10-05 idea: "measure things like the shoulders, hips, leg
## locations and make it so the items can populate accordingly")
Build this BEFORE new bodies / hair / bling so everything uses it.
1. **Auto landmark map per body** (script, from the silhouette + existing rig data): head-top curve, face box,
   letter box, shoulder line + shoulder points, arm regions (start/end, hands/fists), waist + hip line, feet + floor
   line, outline contour. Measured once when a body (or size) is added; stored with avatar-parts.json.
2. **Attachment rules per item** instead of per-body hand fits: anchor(s), scale rule, front/back split, and for
   deformable items a curve to follow (necklace = U between shoulder points under the mouth inside the arm-free band;
   belt = waist line; hair = head-top curve; tattoo = chosen zone minus letter/face; capes = behind, peek at sides).
   The renderer/ship script places, scales and mesh-warps each item to that body's landmarks.
3. **Automatic guards** (audit.py): fail anything crossing an arm region, extending past the torso width at its
   height, leaving the silhouette, or covering face/letter beyond limits — the 10-05 hula-hoop chain fails here.
4. **One looked-at contact sheet per new body/size** (the "worn, not bolted" judgment stays human).
Result: new bodies/sizes = measure once + one glance; new items = one rule that works on every body.

## LETTER STYLE — font options for the mascot's letter (founder 10-05)
Today every mascot's letter is Nunito Black, white. Add a "Letter" control (in the Body or Color tab) with:
- **Fonts** (all bundled, OFL-licensed, chunky enough to read at avatar size; same 3 platforms + widget + share
  images): Nunito Black (default), a rounded bubble (e.g. Fredoka / Baloo), a playful marker/handwritten
  (e.g. Chewy / Bubblegum Sans), a bold slab/varsity (e.g. Bungee / Alfa Slab-style), a pixel/arcade
  (e.g. Press Start-style), a serif storybook, and the cast's own puffy ChatGPT lettering for A–Z (26 glyph
  images, drawn once — the premium option, maybe Pro).
- **Letter color + finish**: white (default), cream, gold, outline-only, two-tone; optional soft 3D/glossy finish
  to match the bodies.
- Rules: the letter stays centered in the measured letter box (landmark system), auto-sized per font so every
  font fills the same box; contrast guard vs the body color (auto-switch to a dark letter on light bodies);
  saved in the avatar config and drawn identically everywhere (parity tests).
- Cost: low for the bundled fonts (code only); the 26-glyph ChatGPT alphabet is one short drawing session.

## PLAYER ADJUSTMENTS (founder 10-05: "making the items bigger and smaller… move the items up and down on the
## body, or on a different arm")
Builds on the landmark system (step one), which is what makes this safe.
- **Size:** per item, a small slider (e.g. 80%–125%) around the fitted size.
- **Position:** nudge up/down (and a little left/right where it makes sense) inside the item's ALLOWED zone from
  the landmarks — e.g. a tattoo can slide along its zone, a hat can sit higher/lower on the head, a necklace can
  hang a bit lower — but never onto the eyes/letter or across the arms (the automatic guards clamp it).
- **Side:** swap left/right for held items, wrist items, buddies, tattoos and one-sided pieces (mirror the art;
  items with lettering or a light direction get a proper mirrored variant).
- **UI:** in the Dressing Room, tap an item on the Stage (or a small "Adjust" chip on its tile) → a compact
  adjust strip: size slider, ▲▼ nudge, ⇄ side, Reset. Live on the Stage mascot; Undo works.
- **Data:** saved per item in the avatar config (scale, offset, side), validated + clamped in core so every
  platform, widget, share image and leaderboard draws the same mascot (parity tests).
- **Cost note:** cheap once landmarks exist (one transform + clamp per item); expensive without them — so do it
  after step one.

## New tab: INK (flat "tattoo" art wrapped onto the body — cheapest)
1. Heart (classic, with a tiny banner reading "WORD")
2. Star cluster (three little stars)
3. Lightning bolt
4. Anchor
5. Tiny "W" crest
6. Flower (daisy) vine
7. Rainbow
8. Paw print
9. Swallow (little bird)
10. Crossword grid (3×3, a nod to the games)
11. Pencil
12. Game-icon flash sheet (skull for Gauntlet, crown for ProperNoundle, hex for Hubbub — opt-in fan ink)
Placement options: cheek, forehead, arm, belly-side (never over the letter or eyes).

## New tab: BLING (piercings + jewelry, pinned to face anchors)
13. Nose ring (gold / silver)
14. Nose stud (gem)
15. Eyebrow ring
16. Lip ring
17. Cheek gem
18. Hoop earrings hanging from hats/ear pieces (only with ear-ish hats: cat/bat ears, beanie)
19. Grill (gold tooth) — only with open-mouth expressions
20. Gold tooth star

## FACE FUN (stickers / paint)
21. Freckles
22. Glitter cheeks
23. Face paint stripes (sporty)
24. Bandage (cute plaster)
25. Heart under the eye
26. Star sticker on cheek
27. Blush hearts
28. Tear-drop (sparkle) under the eye

## OTHER FUN (things we're missing)
29. Sweatband (wrist)
30. Watch
31. Friendship bracelet
32. Rings (on a fist)
33. Headphones around the neck
34. Lanyard with a "VS" badge
35. Balloon (held)
36. Ice-cream cone (held) — already have one; a sundae variant
37. Skateboard (feet)
38. Roller skates (feet)
39. Flippers (feet)
40. Pet goldfish in a bowl (buddy)
41. Duckling (buddy)
42. Robot buddy

## HAIR — new tab with a color picker (founder 10-05: "that would be fun, with a color option")
Today the only hair-like part is the rainbow mohawk in Hats. Hair would be its own slot (so a hat can sit on it or
replace it — hats that cover the head hide the hair; small hats like the party hat sit on top).
Drawn ONCE per style in neutral light grey with shading, then tinted in code with the chosen color (the same
tint + light-map approach as the button family), so every style × every color costs one drawing.
Styles:
59. Short spiky
60. Messy bed-head
61. Side swoop / fringe
62. Bangs (straight)
63. Curly top
64. Afro puff
65. Two space buns
66. Pigtails
67. Ponytail (high)
68. Long straight
69. Wavy bob
70. Top knot / man bun
71. Mohawk (in the hair tab, colorable; the rainbow one stays a Hat)
72. Buzz cut (subtle texture)
73. Braids
74. Tiny sprout curl (one cute curl on top)
Colors: black, dark brown, brown, auburn, ginger, blonde, platinum, grey, white + fun: pink, purple, blue, teal,
green, rainbow (Pro?), two-tone tips. Same color swatch UI as the body Color tab.
Fit note: hair is per-body like hats (12 bodies + any new ones), so do it AFTER the new body set is final.

## MORE BODY SHAPES AND SIZES (founder 10-05: "a lot more body type shapes and sizes next time")
Today: 12 bodies (A square, W tall, M wide, R round, S bean, O star, B drop, K cone, E cloud, Q block, Z mini, H hex).
Candidates — new silhouettes:
43. Heart
44. Pear (wide bottom)
45. Peanut / figure-8
46. Egg (tall oval)
47. Triangle (point up) and 48. Triangle (point down)
49. Diamond / gem
50. Moon (crescent)
51. Bubble (perfect circle, bouncy)
52. Pill / capsule (horizontal)
53. Ghosty (wavy bottom)
54. Blob (soft asymmetric)
55. Flower (5 soft petals)
56. Shield
57. Speech bubble (a nod to words)
58. Puzzle piece (a nod to the games)
And SIZES — a size slider or presets applied to any body: XS, S, M (today), L, XL, plus "chunky" (wider) and
"lanky" (taller) proportions.

**Cost note:** every new body has to be measured and every existing part (~100 now, incl. seasonal) re-fitted and
LOOKED AT on it — bodies are the most expensive addition (parts × bodies). Sizes are cheaper if parts scale with
the body's measured anchors; still needs the full contact-sheet look on each size. Do the bodies FIRST in the
next round, then the new items, so items are fitted once against the final body set.

Pricing idea (founder's call): INK + FACE FUN free; a few BLING / rare items Pro (PRO tag already exists).
