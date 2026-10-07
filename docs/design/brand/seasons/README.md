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
    pieces/<name>.png      # costume PIECES (hats, wings, capes) that layer-costume.py puts onto the hero art
    layered.json           # per layered costume: pieces used + face/letter region diff vs the hero
    walls/                 # code-drawn full-res wallpapers (script + output), never ChatGPT upscales
    extras/                # buttons, badges, tile themes, share cards, widget accents
    raw/                   # untouched ChatGPT captures (keep for re-cuts)
    gallery.png            # contact sheet for founder review
```
Status per asset in manifest.json: `draft` → `approved` (founder) → `shipped` (×3; see "How to add a season" for the names).

## Seasons (in order of upcoming dates) and windows
| season | window (local date) | costume ideas |
|---|---|---|
| halloween | Oct 17 – Nov 1 (live in the registry) | vampire, pumpkin, ghost, wizard, witch, alien, scarecrow, mummy, fairy, skeleton |
| thanksgiving | Nov 16 – 27 (US, 4th Thu) | pilgrim hats, turkey, pie chef, harvest scarf, corn |
| winter-holidays | Dec 1 – 26 | Christmas + Hanukkah + a sprinkle of Kwanzaa (founder 10-05, see below): Santa hat, elf, reindeer, snowman, gingerbread, ugly sweater, Hanukkah sweater, dreidel, gelt, latkes, menorah glow, kinara glow |
| new-year | Dec 27 – Jan 2 | party hats, confetti, noisemakers, disco ball, countdown |
| valentines | Feb 7 – 14 | hearts, cupid, love letters, roses |
| st-patricks | Mar 10 – 17 | leprechaun hat, clover, rainbow, pot of gold |
| spring-easter | Easter −7 days → Easter | bunny ears, eggs, chicks, flowers |
| fourth-of-july | Jun 28 – Jul 4 | stars & stripes, fireworks, picnic |
| back-to-school | Aug 15 – Sep 5 | backpacks, pencils, glasses |

## Winter holidays are inclusive (founder 10-05)
"I want the season theme to have Hanukkah elements in it, as well, not just Christmas. Even a few Kwanzaa elements
sprinkled in." Every winter-holidays batch (cast, titles, props, walls, extras, social posts) mixes all three:
- **Christmas:** Santa hats, elves, reindeer, stockings, gingerbread, ugly sweaters, trees, ornaments.
- **Hanukkah (a real share, not a token):** a menorah/hanukkiah with nine branches (the raised center shamash) and the
  right candle count for the night shown, dreidels with correct Hebrew letters (nun, gimel, hei, shin), chocolate gelt,
  latkes, sufganiyot (jelly doughnuts), blue + white + silver palettes, a Star of David only as a quiet decoration.
  Dates move every year (Kislev 25 for 8 nights; 2026 starts the evening of Dec 4; check each year).
- **Kwanzaa (sprinkled in):** the kinara with seven candles (three red on the left, one black in the center, three green
  on the right), the mkeka mat, ears of corn (muhindi), the unity cup (kikombe cha umoja), red + black + green accents,
  kente-inspired patterns as trim. Kwanzaa runs Dec 26 – Jan 1, so it also gets a light touch in the new-year window.
- **Respect rules:** objects, food, light and color, never religious garments as mascot costumes (no kippah, tallit,
  etc. on the cast); no caricature; candles and letters drawn correctly (ask ChatGPT for accuracy and check every
  sheet); greetings like "Happy Hanukkah" / "Happy Kwanzaa" / "Happy Holidays" alongside "Merry Christmas".

## Costumes are LAYERED (founder 10-04)
The cast member is always the canonical approved pixels (`cast/hero/<id>.png`). ChatGPT draws only the costume
pieces on flat cyan. `layer-costume.py split` keys and splits a sheet, and `layer-costume.py build <season>`
composites the pieces at anchors measured from the hero (head line + head width, center, feet):
- back pieces are clipped outside the hero silhouette, so they never show through soft eyes;
- a hero feature on top (I's sprout) can be put back in front of a hat;
- the face/letter region diff is recorded.
Specs live in `layer-costume.py` (Halloween) and `<season>/specs.json`. Use a full ChatGPT redraw only when the
costume changes the silhouette (onesie, full bandages, ghost sheet), and then run a face-region check before
accepting it. The manifest notes `method: layered` + `faceRegionDiff`, or `redrawn`.

## Rules (all seasons)
- Cast accuracy is the hard rule: attach `cast/hero/<id>.png` + `refs/<id>.png` (+ `poses/`) to every prompt;
  costume ON the character, never changing face, mouth/teeth, eyes, friendly brows, letter, body color/shape.
  Side-by-side check; reject drift. W never angry.
- ChatGPT = costume pieces, lettering, small props. Wallpapers drawn in code at full resolution
  (`halloween/walls/make-halloween-walls.py` is the engine; `thanksgiving/walls/` reuses it with a harvest palette).
- Animation (see `../animation/w-wave/NOTES.md`): animate the real approved art, never a redrawn character.
- American spelling, no emoji, no bordered boxes, backgrounds never distract, inclusive holiday framing.
- Nothing ships until the founder approves from the gallery.

## Work order
Next upcoming season first (Halloween now; see HALLOWEEN-2026-PLAN.md), then the following ones in date
order, so each season is ready ≥ 3 weeks before its window opens.

## How to add a season (the season preview workflow, 10-05)

**Every season ships the full kit (founder 10-07)** — a season isn't done until each of these exists and passes:
- [ ] Surfaces + walls + titles + cast skins + banner + props (steps below)
- [ ] Its own palette/aesthetic (Halloween = black + orange), readable: the readability gate passes (WCAG AA vs pixels)
- [ ] Living background: the season's subtle ambient animation (`ambient` registry slot — e.g. bats, witch fly-by)
- [ ] Seasonal opening animation: the costumed cast in the launch/intro animation (on-model, layered costumes)
- [ ] Seasonal widgets (iOS + Android, every size): season palette, costumed cast, the ambient art (frame-swapped
      on the widget timeline — widgets can't run continuous animation)
- [ ] Settings → Theme has the "Seasonal — <season>" row (preset on in the window; picking Default/Dark/Ocean/
      Forest opts out for this season only; season end returns everyone to their previous theme)
- [ ] Mascot-maker seasonal items (step 8), voices/moods if any seasonal voice
- [ ] Smoothness gate ON vs OFF on every listed screen
- [ ] Seasonal app icon (same icon, season palette) in the season's build; normal icon restored in the next build
- [ ] Seasonal store listing: screenshots + captions of the current pages/widgets, store text; reverted to normal
      right after the season (iOS needs a version for both → small 2.x.y; Play listing anytime)
One registry drives all three apps; a new season is ART + DATA, no code. Halloween is the worked example.
1. **Art.** Make it here: `<season>/titles/` (one per game / screen key), `<season>/walls/` (code-drawn with the
   Halloween engine: `wall-<page>.webp` night + `wall-<page>-light.webp` light twin, `-wide` for desktop; pages are
   home, leaderboard, stats, friends, games), cast skins (`header/<id>.png` or layered), props, a Home banner (code
   composite like `../scenes/compose-halloween-banner.py`).
2. **Ship list.** `<season>/ship.json` maps keys to files: `titles` (key = a game mode id like `quordle` or a page key:
   dailies, puzzles, friends, leaderboard, stats, wotd), `walls` (page -> `walls/wall-<page>`), `banner`.
3. **Ship.** `python3 docs/design/brand/ship-art.py --seasons` writes web WebP, Android drawable-nodpi WebP and iOS
   image sets (walls in Wallpapers.xcassets as JPEG): `art-title-<season>-<key>`, `art-wall-<season>-<page>[-light]`,
   `art-scene-banner-<season>`, and refreshes `apps/web/lib/season-art.generated.json` (the web's size table).
   Cast skins / props ship with the main run (`art-<season>-<id>`, `art-<season>-prop-<name>`).
4. **Registry entry.** Add the season to `packages/core/src/season-registry.json` (id, title, palette: accent,
   buttonTint (helper pills), quietTint (quiet pills), wallLight / wallDark fallback stops; slots: `cast` pattern +
   `castSize` / `castTrim` alpha boxes, `titles` and `walls` = NORMAL art name -> seasonal name (`art-wall-game-*`
   prefix allowed), `props`, `banner`). Copy the file byte for byte to `apps/ios/Wordocious/Resources/` and
   `apps/android/app/src/main/assets/` (apps/web/lib/season-registry.test.ts fails otherwise). Add the date window row
   to core `SEASON_WINDOWS` (level-season.ts) and its Swift (LevelSeason.swift) + Kotlin (Season.kt) twins, then
   regenerate the parity fixtures (`apps/server/node_modules/.bin/tsx packages/core/scripts/gen-parity-fixtures.ts`).
   Any slot you leave out, or art that doesn't ship, falls back to the normal art: a partial season never leaves a hole.
5. **Mark it live.** Append each wired piece to `apps/web/lib/admin/season-preview-wired.json`, keyed by the Art
   Library asset id (`seasons/<season>/titles/<file>`), with a plain-English `where`; in the art repo set
   `shippedAs` + note on those manifest entries and `node sync.mjs`.
6. **Preview on a phone.** Admins: Settings > Season preview > <Season> (iOS, Android, web; flips live, no restart;
   web also takes `?season=<id>`). Founder + JP look at every screen and leave feedback in admin > Art Library.
7. **Approve** in the Art Library (both reviewers). The season then switches on by itself on its window's first
   local day; Off (by date) in the picker returns to the calendar.
8. **Mascot-maker items (10-05, optional).** Seasonal Dressing Room parts are ART + DATA too:
   - Art: costume pieces on transparent PNGs in `<season>/extras/av-*.png`, `<season>/pieces/` or `<season>/props/`
     (hats, back pieces, wraps, held items, buddies). No new ChatGPT work is needed when the season already has them.
   - Data: add a row per item to `SEASONAL` in `../avatar/integration/ship-seasonal.py` (field: head / neck / wrap /
     held / pet; the source file; a builder: hat spec, `back_wings`, `tail`, `collar`, `held_item`, `buddy`), add the
     season's pill hue to `TAG_HUE`, and append the ids to their catalogs in `packages/core/src/avatar-config.ts`
     (`AVATAR_HEADS` / `AVATAR_NECKS` / `AVATAR_WRAPS` / `AVATAR_HELD` / `AVATAR_PETS`; ids are global across `acc:`
     parts) and the Swift (`AvatarConfig.swift`) + Kotlin (`AvatarConfig.kt`) twins, plus web labels (`avatar-render.ts`
     LABELS).
   - Ship: `python3 docs/design/brand/avatar/integration/ship-seasonal.py` bakes every non-hat item PER BODY through the
     integration rig (front/back split, contact shadow, hand-over, face + letter guards, fit check: a body that fails
     gets no pieces), writes `season: "<id>"` on each item in the three avatar-parts.json copies, the tile icons, the
     shelf tag `art-dress-tag-<season>` (web / Android / iOS) and `fit-seasonal.json`.
   - Look: render every item on all 12 bodies through the core layout (`dump-layout.ts` + `avatar_draw.render`, as
     audit.py does) and drop anything that reads pasted on (add it to `DROPPED` with the reason; rerun).
   - Then `apps/server/node_modules/.bin/tsx packages/core/scripts/gen-parity-fixtures.ts` and the tests (core vitest,
     web vitest, iOS `swift test`, Android `:core:test` + `testDebugUnitTest`; catalog-size tests count the new ids).
   No app code changes: core `avatar-season.ts` (Swift `AvatarSeason`, Kotlin `AvatarSeason`) derives the shelf from the
   parts' `season` field. The shelf (first tab, the season's first hat as its icon, "<Season>" label) shows during the
   window or the admin Season preview; tiles wear the season tag; items are free; a SAVED seasonal item stays on the
   mascot (and in its tab) after the season; unsaved ones hide until next year; Randomize skips them out of season;
   Home shows "Dress up for <Season>?" once per season per year to players not already wearing one (Yes opens the
   shelf). Check it: iOS `-storeDemo -storeShot room-season -debug-season <id>` (`hostplain` for the nudge,
   `-storeDemoLook head=<id>` for a saved look); Android `--es dressDemo room-season|nudge --es dressSeason <id>|off
   --es dressLook head=<id>`; web (dev) `/?season=<id>&dressDemo=room-season|nudge&dressLook=head=<id>`.
