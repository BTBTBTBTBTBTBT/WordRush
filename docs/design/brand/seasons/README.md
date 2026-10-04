# Seasonal cast library (founder 10-03)

Founder: "I want to make a database with all the characters for all holidays that we can always reuse and add to
before all major upcoming holidays. Continue this exercise whenever ChatGPT lets you."

One reusable, growing library of holiday art. Made in ChatGPT (free, browser) whenever its image limit allows,
reviewed by the founder in a gallery, then shipped behind `currentSeason(date)`.

## Layout
```
seasons/
  manifest.json            # every season + every asset: id, kind, cast id, file, status, approved date
  build-gallery.py         # refreshes manifest.json, <season>/gallery.png and gallery.html (run after adding art)
  gallery.html             # one self-contained review page (WebP data URIs), each costume next to its hero
  LAST-SESSION.md          # 5-line summary of the latest art night for the founder
  <season>/
    cast/<id>[-alt<n>].png # costumed cast member, transparent, same framing as cast/hero
    titles/<slug>.png      # seasonal title lettering (games, DAILIES, PUZZLES, greetings)
    props/<name>.png       # small motifs for code-drawn wallpapers, banners, badges
    walls/                 # code-drawn full-res wallpapers (script + output), never ChatGPT upscales
    extras/                # buttons, badges, tile themes, share cards, widget accents
    raw/                   # untouched ChatGPT captures (keep for re-cuts)
    gallery.png            # contact sheet for founder review
```
Status per asset in manifest.json: `draft` → `approved` (founder) → `shipped` (art-season-<season>-* ×3).

## Seasons (in order of upcoming dates) and windows
| season | window (local date) | costume ideas |
|---|---|---|
| halloween | Oct 17 – Nov 1 | vampire, pumpkin, ghost, wizard, witch, alien, scarecrow, mummy, fairy, skeleton |
| thanksgiving | Nov 16 – 27 (US, 4th Thu) | pilgrim hats, turkey, pie chef, harvest scarf, corn |
| winter-holidays | Dec 1 – 26 | Santa hat, elf, reindeer, snowman, gingerbread, ugly sweater, menorah-friendly winter (keep inclusive) |
| new-year | Dec 27 – Jan 2 | party hats, confetti, noisemakers, disco ball, countdown |
| valentines | Feb 7 – 14 | hearts, cupid, love letters, roses |
| st-patricks | Mar 10 – 17 | leprechaun hat, clover, rainbow, pot of gold |
| spring-easter | Easter −7 days → Easter | bunny ears, eggs, chicks, flowers |
| fourth-of-july | Jun 28 – Jul 4 | stars & stripes, fireworks, picnic |
| back-to-school | Aug 15 – Sep 5 | backpacks, pencils, glasses |

## Rules (all seasons)
- Cast accuracy is the hard rule: attach `cast/hero/<id>.png` + `refs/<id>.png` (+ `poses/`) to every prompt;
  costume ON the character, never changing face, mouth/teeth, eyes, friendly brows, letter, body color/shape.
  Side-by-side check; reject drift. W never angry.
- ChatGPT = characters, lettering, small props. Wallpapers drawn in code at full resolution.
- American spelling, no emoji, no bordered boxes, backgrounds never distract, inclusive holiday framing.
- Nothing ships until the founder approves from the gallery.

## Work order
Next upcoming season first (Halloween now; see HALLOWEEN-2026-PLAN.md), then the following ones in date
order, so each season is ready ≥ 3 weeks before its window opens.
