# Code review — 2026-10-16 (committed changes since 2.8.4, `357ca8f3b..HEAD`, apps + packages)

Read-only review, 28-minute time box. Scope: night share cards ×3, Thanksgiving season code + celebration scene
slots, parity fixes, ShareSpoilers / ShareSheet core + Swift / Kotlin ports, Home stage slot, Friends cards. Docs,
art and uncommitted working-tree changes ignored. Only defects verified by reading the code are listed; no style nits.

## Verified OK (the things the brief asked me to prove)

- **Season gating.** `currentSeason` is `ready`-gated on all three ports (`packages/core/src/level-season.ts:68`,
  `apps/ios/Sources/Core/LevelSeason.swift:49`, `apps/android/core/.../Season.kt:37`); Thanksgiving is `ready: false`
  everywhere. The admin preview bypasses the calendar: iOS `CastSkin.resolve` reads `debugKey` before the calendar
  (`CastSkin.swift:44`), Android `SeasonSkins.seasonFor(date, preview) = preview ?: currentSeason(date)`
  (`SeasonSkins.kt:88`), web/admin content calendar uses `calendarSeason` on purpose (`admin/studio.ts:425`). The
  Halloween-only consumers were narrowed correctly (`push/rich.ts:70`, widget `WordociousWidget.swift:184`,
  `AchievementService.swift:238`). Optional `ambient` is handled on all three (`ThemeKit.kt:263`,
  `LivingWallpaper.swift:143`, `theme-wall.tsx:65`).
- **Spoilers.** `clean` never carries answer fields in core (`share-spoilers.ts`: every answer field goes through
  `only(variant, …)`; `caption` is gated on `variant === 'full'`). Swift and Kotlin ports are 1:1 and are *more*
  defensive than TS on short inputs (`i < mask.count`, `getOrNull`), so no index crash on a malformed save. The
  fixture tests assert the right thing: byte-equal JSON for both variants plus "clean JSON contains no answer string"
  (`ShareSpoilersFixtureTests.swift:39`, `ShareSpoilersFixtureTest.kt`).
- **Card height.** All three renderers clamp to 1350–1440: web `clampShareHeight` inside `planShareCard`
  (`share-fit.ts:224`, the new `maxH` ceiling is itself clamped to the frame), iOS `ShareCardPlan.swift:103`,
  Android `ShareCard.kt:192` (`coerceIn(MIN_H, MAX_H)`).
- **Main-thread decoding.** `MascotArtCache.inkTop` no longer decodes in a layout body (returns 0 + async measure;
  `exact: true` only on the one-shot share render) — `MascotAvatar.swift:86`.
- No new force unwraps / `try!` / `as!` in app code on iOS; Kotlin `!!` additions are confined to tests and one
  guarded `row.dots!!` (`hasDots` check).

## Findings, ranked

### 1. Medium — Android leaderboard share decodes the full-size stage art per render, uncached and never recycled
`apps/android/app/src/main/kotlin/com/wordocious/app/data/LeaderboardShare.kt` — `drawStageFeathered`
(`BitmapFactory.decodeResource(context.resources, PodiumArt.STAGE_RES)`, no `inSampleSize`, no `recycle()`).
*Scenario:* every leaderboard card render (and each re-share / look swatch tap) allocates the full
`art_podium_stage.webp` ARGB bitmap (~6 MB at 1586×992) on top of the 1080×1440 card (6 MB) + mascots, then drops it
for the GC. On a 2–3 GB device after a few shares this is a visible jank / OOM-risk spike; the in-app podium already
solved this with `ArtBitmaps.get(context, STAGE_RES, bucketPx(...))` (`BoardPodium.kt:135`).
*Fix:* decode through `ArtBitmaps.get` with the `dst` width as the bucket (sized + cached), or set
`BitmapFactory.Options.inSampleSize` from `dst.width()` and `recycle()` after the draw.

### 2. Low — Web sweep celebration: season floats are positioned off the BASE scene's width, not the drawn scene
`apps/web/components/effects/sweep-celebration.tsx:143` — `artW = (ART_H * aw) / ah` uses `ART_SIZE[look.art]` (base
scene) while the `<Image>` at `:214` draws `seasonScene` when it ships. Halloween's sweep scene is 900×744
(`season-art.generated.json:378`) vs the base 900×807, i.e. ~9.5 % of `ART_H` wider; the bat float's right edge is
placed 4 px inside the base edge (`marginLeft: -(artW/2 + 74)`, width 78), so in season it overlaps the costumed
broom scene by ~10–14 px — the exact "float on the mascot" bug this commit set out to fix (iOS/Android push by a
fixed amount past the frame instead and are unaffected). The `width={aw} height={ah}` passed to `next/image` are also
the base scene's dimensions for the season file (harmless with `height: ART_H; width: auto`, but wrong metadata).
*Fix:* `const [aw, ah] = seasonScene ? SEASON_ART_SIZE[seasonScene] ?? ART_SIZE[look.art] : ART_SIZE[look.art]`.

### 3. Low — Android `PageBackground` keeps the 24 fps ambient clock running for a season with no ambient
`apps/android/app/src/main/kotlin/com/wordocious/app/ui/PageBackground.kt:273` —
`moving = ambientOn && (season != null || themeAmbientCount > 0)`. With `ambient` now optional (Thanksgiving ships
none, `ThemeKit.kt:263` falls through to the base theme), `season != null` alone keeps `rememberClock` ticking even
when the base theme has zero sprites: wasted frames on every page for the whole season. Dormant until Thanksgiving is
`ready`, but it will ship with it.
*Fix:* `moving = ambientOn && ((seasonal?.ambient != null) || themeAmbientCount > 0)`.

### 4. Low — Cross-platform layout constant drift in the night leaderboard title slot
Web `NIGHT_DAY_H = 190` (`share-fit.ts:40`) vs Android `DAY_MAX_H = 210f` (`ShareCard.kt:53`). Not a logic-parity
break (cards are rendered per platform, no shared fixture), but the same day-title art will sit 20 px taller on
Android and the board gets correspondingly less room. Align to one number (iOS `ShareCardPlan` to be checked when
its day slot lands).

## Not defects, noted
- `apps/web/lib/theme-registry.test.ts:49` pins `seasonalEntry('thanksgiving')?.ambient` to `undefined`; it will
  (intentionally) fail the day the Thanksgiving ambient ships — flip it with the art.
- `HomeView.swift:1199` drops the `.accessibilityHint` on the close button; the new visible label
  ("Come back tomorrow") carries the same meaning, so VoiceOver loses nothing.
