# JP 45-day post images: the one series system

Founder 10-14: "the images should all be cohesive", "always fit the seasonality themes", "posts should always seem fresh".
Every image is the same template plus content: `compose.py` -> `build(fmt, season, slot, headline, sub, content, cast)`.
Nothing is hand-placed per post. Change a rule in `LAYOUT` / `SERIES_COLORS` and every post follows.
Run `python3 docs/design/brand/social/jp45/compose.py` to rebuild every post, `manifest.json` and `contact-sheet.png`.

## Pipeline (current)
1. **Whole scenes from ChatGPT (preferred, newest)**: the runner drops full-resolution scenes (background + lettering + 1-3 mascots, drawn together) into `incoming/full/<date>-<slot>-<n>.png`. Each candidate gets the strict check below, then the REAL wordmark and footer are overlaid in code and the final is written. Rejected candidates are deleted and logged in `manifest.json`.
2. **Composite fallback (what exists today for every post)**: ChatGPT lettering (flat green sheets, `lettering/`, cut by `extract-lettering.py`) recolored per series in code, real hero art composited in code, kit sky or the shipped seasonal wall. A post keeps its composite only until an accepted full scene replaces it; then the composite, its unused lettering captures and rejected candidates are deleted.

### Strict check for any ChatGPT scene (all must pass)
- Every mascot cropped next to `cast/hero/<id>.png` (Halloween / Thanksgiving costume art in season) and saved as `raw/compare-*.png`: letter shape, colors, eyes, mouth and teeth, brows, limbs, proportions. W is always friendly.
- Headline spelled exactly; no stray text, no emoji, no puzzle answers; series color and season right; American spelling.
- Never upscale a scene by more than about 1.1x. Sizes: landscape 1600x900 (from 3:2), portrait 1080x1350 and pin 1000x1500 (from 2:3).
- Log `mascot_check` ("pass (checked vs hero)" / "pass (hero composite)" / "rejected: why") and `aesthetic_check` per image.

## Formats
| fmt | size | used for |
|---|---|---|
| landscape | 1600x900 | X |
| portrait | 1080x1350 | Instagram / Facebook feed |
| pin | 1000x1500 | Pinterest |

## The template (top to bottom, centered and symmetric)
1. **Wordmark spot**: the real WORDOCIOUS wordmark, top center, 430 / 520 / 520 px wide, with a soft white halo and dark shadow so it reads on every background. Same spot, same size, every format.
2. **Headline**: ChatGPT house bubble lettering in the same zone every post (landscape y 108-380, portrait y 166-556, pin y 188-650), centered, max width 980 / 900 / 860.
3. **Sub line**: one line under the headline, either gold-to-orange house lettering (BRING YOUR FAMILY., THE CROWN IS OPEN., CAPTION THIS.) or Nunito Black white text with a stroke tinted to the series. Never both.
4. **Content slot** (optional, centered): glossy tiles (purple / gold / grey family, accent tinted to the series, no rim), a soft glass card, or a cartoon in a white paper frame. One thing only. The slot varies from week to week (tile rows, grids, cards, cartoons).
5. **Cast**: real art only, feet on one baseline (landscape y 824, portrait y 1262, pin y 1392). Never redrawn.
6. **Footer**: `@handle . wordocious.com`, Nunito ExtraBold, same y. X `@wordocious`, IG/TikTok/Threads `@playwordocious`, Facebook `facebook.com/wordocious`, Pinterest `wordocious.com`.

Safe margin 48 / 54 / 50 px from every edge. Floating tiles only at the edges, never under content.

## Backgrounds by season (same structure)
| Season | Dates | Background | Cast art |
|---|---|---|---|
| Standard | Oct 15-16, Nov 1-13 | kit lilac-to-pink sky, bokeh, edge tiles | `cast/hero` + `poses/` |
| Halloween | Oct 17-31 | shipped Halloween home wall, glow tinted to the series, orange/purple edge tiles | `seasons/halloween/cast` (+ alt costumes) |
| Thanksgiving | Nov 14-29 | shipped Thanksgiving home wall, glow tinted to the series, harvest edge tiles | `seasons/thanksgiving/cast` (+ alt costumes) |

## Headline color by season x series (hue in degrees; recolored in code on the keyed lettering)
Each series keeps its name, lettering and layout across seasons; only the hue shifts with the season.
| Series | Standard (cast colors) | Halloween | Thanksgiving |
|---|---|---|---|
| Launch / teasers / brand one-offs | purple-pink (original) | purple-pink | purple-pink |
| MONDAY MASTERS | blue (D) 225-210 | ghostly blue-violet 250-235 | deep plum 305-325 |
| WORD OF THE DAY QUIZ (+ word pins) | teal (C) 190-175 | slime green 105-85 | sage 100-90 |
| MUDDLE WEDNESDAY (+ explainer pins) | orange / gold 45-28 | pumpkin orange 32-18 | burnt orange 25-15 |
| 7 LETTERS. ONE WORD. (Hubbub tease) | green (I) 150-135 | potion teal 175-160 | golden wheat 48-40 |
| FRIDAY'S FINEST | red-pink 350-335 | blood / candy red 358-345 | cranberry 350-340 |
| SWEEP SUNDAY | purple (original) | witch purple 285-305 | maple brown 22-15 |
| CAST SATURDAY | one color per letter, all cast colors | candy-corn yellow / orange / red-orange | harvest: cranberry, wheat, burnt orange, sage, plum |
| Holiday one-offs | DIWALI marigold-vermilion 42-8; VETERANS DAY navy blue 222-210 | HALLOWEEN EVE / HAPPY HALLOWEEN keep the slime-drip Halloween lettering | THANKSGIVING / EVE / HAPPY harvest; FAMILY LEAGUE sage |

Gold sub-line lettering stays gold in every season. Tile accent, sub-line stroke and headline glow follow the series hue.

## Rotation (always fresh)
- No fixed host per series. `pick()` chooses the lineup per post: least-used characters first, never the same lineup twice in a row on a channel, usage spread evenly (see `cast` in `manifest.json`).
- Group size rotates per card (`SIZE_OPTS`): solo, duo, trio, 4-6, full cast. Two full rows never run back to back on a channel.
- Art variants rotate too: the standard season cycles `cast/hero` and the shipped `poses/*` (inverted or seated poses skipped); Halloween and Thanksgiving cycle the shipped `-alt` costume art. Rows of seven or more always use the base hero/costume art.
- Content slots rotate by occurrence (`occ()`): tile row / grid / card, different sub lines, a different cartoon or demo word each time.

## Checks logged per image in `manifest.json`
`mascot_check`, `aesthetic_check`, `hint` (any puzzle hint shown), `cast`, `series_color`, `caption`, plus `rejected: why` entries for scenes thrown out. Every cast instance is compared against the real hero art in `raw/compare-<fmt>.png`.

### Finishing a scene (scene.py accept), options learned 10-14
- `--series <series> --y0 N --y1 N` hue-shifts the purple-pink headline for the season (y range = native scene rows of the headline only; stop above the gold sub line). `cast` is a smooth left-to-right sweep through the season's hue list (bubble letters touch, so per-letter labeling does not work); `--nl N` makes N stepped bands.
- Framing: pins use the default crop. Landscape and portrait default to `fit_scene` (scene shrunk, margins reflected + blurred); pass `--scale S --top T` so the headline top lands at about y 120 (landscape) / 150 (portrait) and the mascot feet stay above the footer. `--scale fill --top T` fits the scene to the full post width with no margins (only when feet and headline both survive the crop). Headlines that start above 8 percent of the frame must be shrunk with `--scale`, or they touch the wordmark.
- `--content "cartoon|<file>|<width px>"`, `"mystery|7"` or `"wotd|WORD|note"` plus `--at cx,cy` (fractions of the post) overlays the day's content block in code on the scene's empty center. Scenes for Muddle Wednesday, Word of the Day quiz and the 7-letters tease must leave that area empty.
- Compare sheets are JPEG q80 (`raw/compare-*.jpg`). Do not run compose.py's full build now: it regenerates every composite and overwrites accepted scene finals.
