# Thanksgiving extras wiring, 10-16

Scope: wire every remaining Thanksgiving art piece the way Halloween's equivalent is wired, so the admin Season preview
(Settings > Season preview > Thanksgiving) shows the full season. Thanksgiving stays `ready: false`.

Finding that shaped the pass: Halloween's own extras (the six `btn-*` candy buttons, `badge-*`, `streak-*`, `tile-theme-pumpkin`,
`podium-halloween`, `home-host-*`, the alt / label / `happy-halloween` titles) were drawn as "ideas" and are NOT consumed by
any app or listed in halloween/ship.json. Only these Halloween extras are wired: the two celebration scenes, the stage, the four
day-title props, the dress tab / tag. So "same as Halloween" means: wire the props, tag and badges; ship the buttons; leave the
rest documented.

## Wired (all via ship-art.py + ship.json; iOS compression policy re-applied, `ios-asset-compression.py --check` ok)

| Piece | Where it shows | Web | iOS | Android |
|---|---|---|---|---|
| props apple, corn, cornucopia, leaf-oak, pie-slice, wheat (+ the 4 already shipped = 10) | Leaderboard day title, one prop each side, the pair rotates through all ten by day | registry `props` + `seasonProps()` (season-kit.ts); `SeasonDayProps` in leaderboard-banner.tsx (was Halloween-only `HalloweenDayProps`) | already registry-driven (`CastSkin.dayProps`); prewarm generalized (`CastSkin.prewarmPropAssets`, Halloween four unchanged) | `LeaderboardBanner.kt` now takes `SeasonKit.props` (was a fixed Halloween name list); new `SeasonPropSlot` replaces `HalloweenPropSlot` |
| `art-dress-tag-thanksgiving` (THANKSGIVING plaque, 444 wide) | Dressing Room: tag on each Thanksgiving tile | consumer already generic (`art-dress-tag-<season>`); size in dress-art.ts | MascotBuilder already generic | DressingRoom.kt already generic |
| `art-ach-harvest_feast`, `art-ach-tune_simple_gifts` (256 square, from badges/ach like spooky_season) | Achievement badge: Trophy case + unlock celebration (own art replaces the category icon) | ART_SIZE in lib/art.ts | image sets | drawables |
| accent as text: registry `surfaces.accentText` (#943F10) | Exposed as a token ×3: web CSS var `--season-accent-text` + `seasonAccentText()`; iOS `SeasonKit.Look.accentText`; Android `SeasonSurfaces.accentText` | yes | yes | yes |

The registry (`packages/core/src/season-registry.json`) props list was extended and copied byte-identically to the iOS and Android
copies. `lib/admin/season-preview-wired.json` has rows for every piece above. New test: `apps/web/lib/season-props.test.ts`.

Accent note: nothing in the apps draws the season `accent` as text today (`--season-accent` is set but unread; Halloween's and
Thanksgiving's tints are fills), so there was no caller to switch. The token is plumbed so the first text caller uses it.

## Shipped but no consumer slot yet
- Six candy button skins `art-btn-thanksgiving-{cranberry, maple, pumpkinpie, apple-cider, acorn, harvest-gold}` (640 wide, blank,
  three-slice). Halloween's six are not shipped at all. The app's buttons are color-keyed (`art-btn-<color>-<size>[-pressed][-dark]`);
  a seasonal skin needs a new button-skin slot in the registry plus the three button renderers. Note the added app size.

## Still unwired, and why
- Titles dailies-alt1, happy-thanksgiving(-alt1), label-give-thanks, label-gobble-gobble, thanksgiving: Halloween's counterparts are
  unwired too; no title key or screen asks for them (the Home greeting is code-drawn lettering). `page-unlimited`: no
  `art-titlecast-unlimited` key exists in any app.
- badge-gobble, badge-harvest-streak: no achievement key (Halloween's badge-* are also unwired). The two real moment / tune badges ship above.
- streak-flame-leaf, streak-shield-pie: the streak flame and shield are not art-swappable slots (no registry swap).
- tile-theme-pie: tile themes are code-drawn; Halloween's mockup is unwired.
- podium-thanksgiving: the podium is the one-image `art-podium-stage`; no per-season podium slot.
- home-host-o1 / home-host-w: the Home host is the mascot-maker look, not an art swap; Halloween's are mockups.

## In-flight overlap (not mine)
The registry now carries time-of-day objects for `walls` / `stage` (another agent). Web tsc and `season-registry.test.ts`
currently fail on `TimedName`, and Android `SeasonKit.parse` still reads `stage` with `jsonPrimitive` (it will throw on the object,
which `runCatching` turns into an empty registry) until that work lands its consumers.
