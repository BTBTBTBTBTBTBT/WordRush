# JP 45-day post images: the one series system (founder 10-14: "the images should all be cohesive")

Every image is the same template plus content: `compose.py` -> `build(fmt, season, slot, headline, sub, content, cast)`.
Nothing is hand-placed per post. Change a rule in `LAYOUT` and every post follows.

## Formats
| fmt | size | used for |
|---|---|---|
| landscape | 1600x900 | X, Facebook link posts |
| portrait | 1080x1350 | Instagram / Facebook feed |
| pin | 1000x1500 | Pinterest |

## The template (top to bottom, always centered and symmetric)
1. **Wordmark spot** - the WORDOCIOUS wordmark, top center, same width per format (320 / 400 / 400 px), 34-60 px from the top.
2. **Headline** - ChatGPT house bubble lettering (`lettering/*.png`), purple-to-pink gradient with deeper purple rim, ALWAYS in the same zone
   (landscape y 108-380, portrait y 166-556, pin y 188-650), centered, max width 980 / 900 / 860. Soft purple shadow.
3. **Sub line** - one line directly under the headline: either gold-to-orange house lettering (the "answer" line: BRING YOUR FAMILY., THE CROWN IS OPEN., CAPTION THIS.)
   or Nunito Black white text with a purple stroke (the app's tagline style). Never both.
4. **Content slot** (optional, centered under the sub line) - glossy tiles (kit.py ART_SPEC section 20 tile: purple/gold/grey family, no rim), a soft glass card, or a cartoon in a white paper frame. One thing only.
5. **Cast** - real hero art from `cast/hero` (Halloween: `seasons/halloween/cast`), composited in code, feet on one baseline
   (landscape y 824, portrait y 1262, pin y 1392). Ten = one row (landscape) or two rows of five (portrait/pin). Featured = 1-3, same height, centered. Never redrawn.
6. **Footer** - `@handle  .  wordocious.com`, Nunito ExtraBold, centered at the same y. Handles: X `@wordocious`, IG/TikTok/Threads `@playwordocious`, Facebook `facebook.com/wordocious`, Pinterest just `wordocious.com`.

Safe margin: 48 px landscape / 54 px portrait / 50 px pin from every edge for text and cast. Floating tiles only live at the edges, never under content.

## Backgrounds (two variants, same structure)
- **Standard** (Oct 15-16 and any non-Halloween day): the kit lilac-to-pink sky (`kit.sky`, seed 7) with soft bokeh and a few glossy letter tiles at the edges (seed 7, kept clear of content).
- **Halloween** (Oct 17-31 only): the shipped Halloween home wall (`seasons/halloween/walls/wall-home-wide`) with a soft purple glow behind the headline, orange/purple edge tiles, costumed cast from `seasons/halloween/cast`, light footer text.

## Lettering rules
- One ChatGPT lettering family (free ChatGPT, flat #00FF00 sheets, zoom-captured 2x, keyed by `extract-lettering.py`).
- Headlines purple-to-pink, sub lines gold-to-orange, Halloween headline (THE APP GOT DRESSED.) purple with slime drips and a cobweb (same kit as the shipped DAILIES Halloween title). No other colors, no other fonts.
- No emoji, no puzzle answers, American spelling, no competitor names.

## Checks logged per image in `manifest.json`
- `mascot_check`: hero composite = pass; every cast instance is compared in `raw/compare-<fmt>.png` (real hero left, instance cropped from the final right).
- `aesthetic_check`: house lettering, purple/gold/grey glossy tiles with no rim, calm background, compact symmetric layout.
