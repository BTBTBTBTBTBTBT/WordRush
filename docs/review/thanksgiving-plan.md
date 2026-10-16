# Thanksgiving 2026 plan (code side done 10-16; art + ship steps pending founder approval)

Window (founder 10-16): **Nov 14 – Nov 29, 2026**, in code on all three platforms. Thanksgiving Day is Thu Nov 26.
Companion: `docs/review/thanksgiving-readiness.md` (the 10-16 review this plan answers).

## What is done (this worktree, uncommitted)

**1. The window + the ready gate (core x3, parity-pinned).**
- `packages/core/src/level-season.ts` `SEASON_WINDOWS`: `thanksgiving 11-14 -> 11-29`, every row now carries `ready`
  (halloween `true`, thanksgiving **`false`**). `currentSeason(date)` = READY windows only (the public);
  new `calendarSeason(date)` = any window (admin calendars); `seasonReady(id)`; `SEASON_IDS` lists every window.
- Ports: `apps/ios/Sources/Core/LevelSeason.swift` (`case thanksgiving`, `Season.calendar`, `.ready`),
  `apps/android/core/.../Season.kt` (`THANKSGIVING`, `calendarSeason`, `Season.isReady`).
- `level-season-fixtures.json` regenerated (`days[].season` + `days[].calendar`, `windows[].ready`); clock tests x3
  (Nov 13 none / Nov 14, 26, 29 thanksgiving by the calendar / Nov 30 none; Oct 31 halloween / Nov 1 none).
- **Not-ready never activates** tests x3: core `level-season.test.ts`, iOS `LevelSeasonTests`, Android `SeasonTest`,
  plus web `season-registry.test.ts` (`resolveSeason('2026-11-20', null)` is null).
- **Admin preview still lists it** x3 (founder 10-16): the preview path bypasses the calendar on every platform (web
  `resolveSeason(override)`, iOS `CastSkin.resolve` reads `debug-season` as `Season(rawValue:)`, Android
  `SeasonSkins.pick` validates against `Season.ids`), tested in the same files. Settings > Season preview shows
  "Thanksgiving" on all three as soon as this ships; with no bundled art it renders the harvest surfaces + normal art.
- Every public path is gated by the ONE function (`currentSeason`): cast, walls, titles, surfaces, intro/notes, push
  accent, achievement moments, widgets (iOS widget reads `Season.current` from core), theme Seasonal row.
  `season_halloween` flag semantics unchanged (still the kill switch for whatever season is on).

**2. Registry entries (byte-identical x3).**
- `season-registry.json`: `thanksgiving` entry: harvest palette (accent `#F0824A` burnt orange, buttonTint `#D62A4A`
  cranberry, quietTint `#7E2A5B` plum, wheat/cream light stops, plum-brown dark stops), slots `cast art-thanksgiving-{id}`
  (castSize 320, **castTrim measured at ship time**), 24 titles, 5 walls (`art-wall-thanksgiving-*`), 4 props
  (`turkey-platter`, `pumpkin-pie`, `leaf-maple`, `acorn`), `banner art-scene-banner-thanksgiving`,
  `stage art-celebration-stage-thanksgiving`, extras for the costumed celebration scenes. Every slot falls back to
  the normal art while its file is missing.
- `surfaces` (dark tone, harvest glass): card `#2A1419` @0.92, hero `#26121A` @0.92, raised `#3E2029`, cap
  wheat/burnt orange/maple, text cream `#FFF4E8` / `#F1DCC6` / `#D9BFA7`, headline wheat -> burnt orange -> maple, name
  gold -> cranberry; no cobweb. Passes the WCAG gate (`season-contrast.test.ts` + web/iOS ports run green; Android `SeasonContrastTest` is an app
  unit test, not run here): buttonTint 3.5:1 on the card, white label 4.9:1 (6.3:1 pressed), inks 8–10:1.
- `theme-registry.json` `seasonal.thanksgiving` ("Seasonal — Thanksgiving", "Harvest", preview wall + WORD tiles);
  `ambient` is now OPTIONAL x3 (web type, iOS `ThemeKit.Seasonal`, Android `ThemeKit.Seasonal`) so a season with no
  living-wallpaper code keeps the base theme's ambient. Falling leaves = later (B11).
- Web `season-registry.test.ts`: the "art ships" checks run for READY seasons only, so flipping `ready` makes them bite.

**3. Halloween-only paths generalized.**
- iOS widget `WidgetStats.asset()`: `art-<season>-<id>` for any READY season (the registry cast pattern is pinned by
  convention; the widget cannot read the registry). The Halloween-only widget headline/wordmark image sets
  (`widget-headline-halloween-orange`, `WordmarkImage halloween:`) stay Halloween: Thanksgiving widget art is not drawn.
- Home curtain STAGE card is now season-driven x3 (founder 10-16 "every screen designed for Halloween needs a
  Thanksgiving version"): registry `slots.stage`, web `seasonStage()` + `StageFrame art=`, iOS `SeasonKit.stage`,
  Android `SeasonKit.stage()`; empty / unshipped slot = the plain card as before.
- Push: `apps/web/lib/push/rich.ts` orange accent + witch-hat icon are now `=== 'halloween'` (they are Halloween art).
- Admin Studio content calendar (`studio.ts seasonBands`) uses `calendarSeason` so the Thanksgiving band shows now.
- Kept Halloween-only by design: `spooky_season` achievement, Halloween melodies/notes, Android `frame()` fast path
  (the generic registry path handles Thanksgiving).

**4. Celebration kit (founder 10-16, the bolted-on witch hat / second broom).**
- Registry: the Halloween `celebrate-crown-gold -> celebrate-h-witch-hat` swap is REMOVED (the gold crown shows).
- New optional SCENE slots in `extras`: `art-scene-flawless-star` / `art-scene-sweep-broom` -> a costumed scene
  (`celebrate-h-scene-*`, `celebrate-t-scene-*`). iOS `SweepCelebrationView.artName`, web `sweep-celebration.tsx`,
  Android `SweepCelebration.kt` use it when the file ships; **when a season scene is present the crown overlay is not
  drawn**. Dropping the files in (same names) is all it takes; the registry lines are already there.
- Floats: moved BESIDE the scene (outside its drawn width) on all three; **Sweep never draws float-2** (the broom).
  NOT visually verified: the iOS build lock was held by another agent for the whole time box and the load average was
  30+, so the `-storeShot flawless` / `flawlesslost -debug-season halloween` captures are still owed (see "Owed").
- Other loose-overlay spots found: none in app UI besides these two. The Android push small icon "witch-hat variant"
  (`RichPushNotifier`) is a composed monochrome icon, not an overlay on cast art; fine.

## Founder art-approval list (Art Library, `docs/design/brand/seasons/manifest.json`, all `status: draft`)
1. **Cast costumes (20):** `thanksgiving-cast-{w,o1,r,d,o2,c,i,o3,u,s}` + `-alt1` (layered, face diff 0.0).
2. **Titles (29):** 24 registry keys (dailies, puzzles, page-friends/leaderboard/stats/wordoftheday, 18 games) +
   extras HAPPY THANKSGIVING x2, GIVE THANKS, GOBBLE GOBBLE, THANKSGIVING; the ChatGPT round is adding pocket games
   (callit, passthepuzzle, rockpaperscissors, tictactile), VS, Unlimited, dailies-alt1.
3. **Walls (10):** being REDRAWN (`walls/make-thanksgiving-walls-v2.py`, another agent) — approve the v2 set, not the
   current `wall-*.webp`.
4. **Props (10):** acorn, apple, corn, cornucopia, leaf-maple, leaf-oak, pie-slice, pumpkin-pie, turkey-platter, wheat.
5. **Pieces (12):** mascot-maker parts (optional, later).
6. **New this round (approve when they land):** `extras/celebration-stage-thanksgiving.png` (Home stage), buttons,
   badges, streak flame/shield, tile theme, podium, dress tab/tag, home hosts, `scene-flawless-star` /
   `scene-sweep-broom` for Halloween AND Thanksgiving (O2 / S in costume), Home banner composite.

## Ship-art steps (after approval; each is data + a script run, no app code)
1. `docs/design/brand/seasons/thanksgiving/ship.json` mirroring `halloween/ship.json` (24 title keys, 5 walls from the
   v2 set, `banner`). Then `python3 docs/design/brand/ship-art.py --seasons`.
2. Cast skins: generalize `ship-art.py:188` (`HALLOWEEN_DIR = seasons/halloween/header/`) to every
   `seasons/<id>/header|cast/`; it writes `art-thanksgiving-<id>` (320 px squares) x3 and prints the alpha boxes ->
   paste as `castTrim` in the registry (x3 copies). Props: `art-thanksgiving-prop-<name>` from `props/`.
3. Stage + scenes + banner: `art-celebration-stage-thanksgiving` (1586 x 992, same CELEBRATION_STAGE pools),
   `celebrate-{h,t}-scene-flawless-star` / `-sweep-broom` (same framing as the base scenes 796x914 / 900x807),
   `art-scene-banner-thanksgiving` (composite from cast + props). Web needs each name in `season-art.generated.json`
   (ship-art writes it) or `lib/art.ts` ART_SIZE.
4. Flip `ready: true` x3 (`level-season.ts`, `LevelSeason.swift`, `Season.kt`), regenerate fixtures
   (`apps/server/node_modules/.bin/tsx packages/core/scripts/gen-parity-fixtures.ts`); the web registry test now
   requires every slot's art to exist on all three platforms.
5. Mark wired in `apps/web/lib/admin/season-preview-wired.json`; founder + JP preview via Settings > Season preview.
6. Optional later: falling-leaves ambient (B11), mascot-maker parts (B14), `intro-thanksgiving` sound, seasonal app
   icon + store screenshots (B16; `make-icons.py` recolor path), launch splash color for the season build.

## Bundling the drafts for the admin preview (coordinator option b) — NOT done, next step
Running the ship scripts on the drafts (steps 1–3 above, with `ready` left `false`) puts the art in the bundles so the
admin preview shows the real skin while the public still gets nothing. Hold the walls until v2 lands. Requires the
`ship-art.py` header-dir generalization (step 2) first.

## Dated deadlines
- **~Nov 1** 2.8.x "back to normal" build: splash/icon/store revert (readiness review items 1–3).
- **Nov 6–9**: submit the Thanksgiving build (iOS + Play, auto-release) so both stores are live by **Nov 13** and
  the clock turns it on Nov 14 (store review + Play rollout can take 2–4 days). Push web the same day.
  Needs: approvals (list above), ship steps 1–5, perf gate ON vs OFF, WCAG gate, WordRush fixtures green.
- **Nov 13**: last day on standard; **Nov 14**: Thanksgiving on; **Nov 16**: JP reveal post ("move to the ship date"
  if the build slips); **Nov 26**: Thanksgiving greeting post; **Nov 29**: last day; Nov 30 back to normal by the clock.
- **Nov 16** also = answer-swap batch 3 cutover (British spellings), already in every build since 10-09.

## Owed / not in this time box
- iOS sim captures of `-storeDemo -storeShot flawless` and `-storeShot flawlesslost -debug-season halloween` to confirm
  the float / crown placement (build lock held by another agent for the whole box; load 30–100).
- Android: the build lock never freed, so `:core:test` and `testDebugUnitTest` (SeasonKitTest, SeasonContrastTest)
  were NOT run; the Kotlin edits are small and mirror the green Swift/TS ones — run them first thing.
- Bundling the draft art (above), `castTrim` boxes, the ship.json.
