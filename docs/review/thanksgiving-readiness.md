# Thanksgiving 2026 readiness review (read-only, 2026-10-16)

Scope: the in-app Thanksgiving season, the Nov 1 Halloween end, the answer-swap cutover, and JP's social plan for
Nov 14-29. Checked on iOS (`apps/ios`), Android (`apps/android`), web (`apps/web`) and core (`packages/core`).
No code, builds, simulators, database writes or commits were made for this review.

## Verdict in one line

The **social side is ready**; the **in-app Thanksgiving season does not exist yet in code or shipped art** on any
platform. The art is drawn (draft, unreviewed), nothing is shipped, there is no registry entry and no date window, so
on Nov 14 (or 16) every player simply stays on the standard look. Nothing breaks; it just never turns on.

## The window: three different answers, none in code

| Source | Window |
|---|---|
| `packages/core/src/level-season.ts` `SEASON_WINDOWS` (+ `LevelSeason.swift`, `Season.kt`) | **no Thanksgiving row at all** (Halloween Oct 9-31 only) |
| `docs/design/brand/seasons/README.md` + `seasons/manifest.json` | Nov 16-27 |
| JP's social plan (`docs/design/brand/social/jp45/STYLE.md`, Bible §386) | Nov 14-29 (harvest hues + "Thanksgiving kit") |
| Thanksgiving Day 2026 | Thu **Nov 26** (`apps/web/data/holiday-days.json`: 11-25 eve + 11-26, correct) |

**Decision needed (founder):** pick one window. Nov 14-29 matches the social plan (Sat-Sun, two full weekends, Day 45
wrap on the 29th); Nov 16-27 matches the seasons README. The social reveal post on **Nov 16** is titled "move to the
ship date", so the real deadline is the store builds, not the calendar.

## Checklist

### A. Season switching and the Nov 1 Halloween end

| | Item | Status | Evidence |
|---|---|---|---|
| A1 | Halloween ends Oct 31 by the clock on all three platforms, no build needed | ✅ | core `SEASON_WINDOWS` `[10,9]-[10,31]`; `apps/ios/Sources/Core/LevelSeason.swift:32`; `apps/android/core/.../Season.kt:19`; parity fixtures `level-season-fixtures.json` |
| A2 | Nov 1-13 = standard look, previous theme restored, Seasonal row hidden | ✅ | `packages/core/src/theme-choice.ts` (base theme never overwritten; row hidden outside a window); Bible §354 clock tests ×3 |
| A3 | Thanksgiving window in code | ❌ | no row in `SEASON_WINDOWS`, `Season` (Swift enum has only `.halloween`), `Season.kt`; `season-registry.json` has one season (`halloween`) in all three byte-identical copies |
| A4 | Static launch/splash color still Halloween night (#0E091B) | ⚠️ | `apps/ios/.../LaunchBackground.colorset` = 0E091B; `apps/android/.../values/colors.xml:6 splash_lilac=#0E091B`. From Nov 1 the splash is a near-black flash in front of a lilac standard app until a build ships. README revert values: `LaunchBackground` → #F1D7F6, `splash_lilac` → #ECE0FB |
| A5 | App icon is the Halloween icon in the binary | ⚠️ | commit e1afb0e75 (option A primary icon ×3, `make-icons.py --restore` exists). Decided plan (§353/§354, FRIDAY-QUEUE 604/668): normal icon + normal screenshots/store text in a ~Nov 1 2.8.x; the Thanksgiving build then needs its own icon per the README "full kit" |
| A6 | `season_halloween` feature flag gates EVERY season | ⚠️ | `packages/core/src/feature-switches.ts:26`; iOS `CastSkin.calendarSeason` guard `switchOn`; web `season.ts:162`; Android `WidgetBridge.kt:157`, `DailyWidgetProvider.kt:385`; push `apps/web/lib/push/rich.ts:66-73`. Risk: if an admin flips `season_halloween` OFF on Nov 1 "to end Halloween", Thanksgiving (and every later season) stays off. Leave the flag ON; the clock ends Halloween by itself |
| A7 | Store listing on Nov 1 still says "Happy Halloween" | ⚠️ | `docs/store/release-2.8.md` What's New (Halloween copy) is what 2.8.4 shipped with; needs the ~Nov 1 2.8.x listing swap (Play same day; iOS only with a version) |
| A8 | `spooky_season` achievement, Halloween push accent, share-hero orange glow | ✅ | all date/flag-gated and stop at Oct 31 (`achievement-rules.ts:260`, `push-rich.ts:65`, `share-hero.ts:37`); nothing Thanksgiving-shaped expected here |
| A9 | Holiday-day puzzles (crossword, cryptogram, groups, scramble, WOTD, Propernoundle) for Nov 25-26 | ✅ | `holiday-days.json` 2026-11-25/26 → thanksgiving, mirrored in `apps/ios/Wordocious/Resources/` and `apps/android/core/src/main/resources/data/`; `h-thanksgiving-*` banks in `apps/web/public/banks/*` and bundled puzzle JSONs on both apps; Diwali 11-08 and Veterans 11-11 also present |

### B. Thanksgiving assets per platform (shipped = `art-*-thanksgiving-*` / `art-thanksgiving-*` exists)

| | Item | Web | iOS | Android | Source art | Evidence |
|---|---|---|---|---|---|---|
| B1 | Title art `art-title-thanksgiving-*` (24 keys) | ❌ | ❌ | ❌ | ✅ drawn (29 PNGs incl. HAPPY THANKSGIVING ×2, GIVE THANKS, GOBBLE GOBBLE labels) | `apps/web/public/art` has 0 thanksgiving files; `seasons/thanksgiving/titles/` |
| B2 | Walls `art-wall-thanksgiving-{home,leaderboard,stats,friends,games}[-wide]` | ❌ | ❌ | ❌ | ✅ 10 WebPs code-drawn (`walls/make-thanksgiving-walls.py`) | no `-light` twins (Halloween ships none either) |
| B3 | Cast costume skins `art-thanksgiving-{w..s}` (header row, stats, podium, widgets) | ❌ | ❌ | ❌ | ✅ 10 layered costumes + 10 alts, face diff 0.0 (`layered.json`, `specs.json`) | ship-art.py only ships `seasons/halloween/header/` (`ship-art.py:188`, hardcoded); Thanksgiving has `cast/`, no `header/` |
| B4 | Props `art-thanksgiving-prop-*` (day-title decorations) | ❌ | ❌ | ❌ | ✅ 10 props (acorn, apple, corn, cornucopia, leaves, pie, turkey platter, wheat) | registry `props` slot drives iOS `CastSkin.props` and Android `HalloweenPropSlot` generically |
| B5 | Home banner `art-scene-banner-thanksgiving` (idle Home card art when no celebration) | ❌ | ❌ | ❌ | ❌ not composed | `docs/design/brand/scenes/` has banner-halloween/sweep/flawless only; needs `compose-thanksgiving-banner.py` from the cast + props (code, no new ChatGPT) |
| B6 | Home curtain stage (the Halloween `art-celebration-stage-halloween` card) | n/a | n/a | n/a | — | Halloween-only on all three: web `home-banner.tsx:277 stage = season === 'halloween'`, iOS `HomeBannerView.swift:255`, Android `HomeBannerView.kt:194`. Outside Halloween the card is "exactly as before" (pre-2.8 headline card + trio); in Thanksgiving it would show the plain card plus the registry banner (B5) if one ships. Acceptable fallback, no hole; a harvest stage is optional art |
| B7 | Celebration extras (`celebrate-*` swaps: burst, streamers, crown, seal, floats) | ❌ | ❌ | ❌ | ❌ none drawn (Halloween has 23 extras) | registry `extras` slot is optional; falls back to the normal confetti/gold. OK to skip |
| B8 | Surfaces palette (card/hero/cap/text/headline inks) | ❌ | ❌ | ❌ | — | registry `surfaces` + `palette`; Halloween's is the only worked example. Needs a harvest palette (cranberry / wheat / burnt orange / sage / plum per STYLE.md) with the WCAG readability gate |
| B9 | Settings → Season preview lists Thanksgiving | ❌ | ❌ | ❌ | — | registry-driven everywhere (web `SEASON_IDS`, iOS `SeasonKit.registry`, Android `SeasonKit` entries): appears automatically once A3 lands |
| B10 | Settings → Theme "Seasonal — Thanksgiving" row | ❌ | ❌ | ❌ | — | `packages/core/src/theme-registry.json` `seasonal` has only `halloween` (copies in iOS Resources + Android assets, byte-identical); add a `thanksgiving` entry (title, subtitle, previewWall, previewTiles, ambient) |
| B11 | Ambient animation (living background) | ❌ | ❌ | ❌ | — | web `theme-kit.ts SeasonalAmbient.kind: 'halloween'` (bats/witch/fog/stars) is Halloween-specific code; a Thanksgiving ambient (falling leaves) is new code ×3, or ship with no ambient (README says the full kit wants one) |
| B12 | Widgets (iOS + Android) | ❌ | ❌ | ❌ | — | iOS `WidgetStats.asset()` returns `art-halloween-<id>` only when `== .halloween` (`WidgetStats.swift:127`); Android widget uses `SeasonSkins.current()` + registry (generic). iOS needs a one-line generalization to the registry `cast` pattern |
| B13 | Sounds (`intro-thanksgiving`, `note-t-*`) | ❌ | ❌ | ❌ | ❌ | registry `sounds` slot optional; `MusicalCast` seasonal notes are Halloween-only (`seasonNotePrefix`); falls back to normal. Skip unless wanted |
| B14 | Mascot-maker seasonal parts (pilgrim hat, turkey hat, pie hat, acorn cap, shawl, plaid cape, turkey tail…) | ❌ | ❌ | ❌ | ✅ 12 pieces drawn in `seasons/thanksgiving/pieces/` | `avatar-parts.json` carries only `halloween` (11 items + 4 bodies); `ship-seasonal.py` `SEASONAL` table has Halloween rows only. Data + catalog ids ×3 + fixtures per README step 8; optional |
| B15 | Podium / header cast / leaderboard share in season | ✅ generic | ✅ generic | ✅ generic | — | all read the registry `cast` + `castTrim` (Android `SeasonSkins.skin()`, iOS `SeasonKit.cast`, web `castArt`); need `castSize`/`castTrim` alpha boxes measured for the Thanksgiving skins at ship time |
| B16 | Seasonal app icon + store screenshots/text for the Thanksgiving build | ❌ | ❌ | ❌ | ❌ | README full-kit items; `make-icons.py` recolor path exists from Halloween |
| B17 | Art Library / founder approval | ❌ | | | | every Thanksgiving asset in `seasons/manifest.json` is `status: draft` (20 cast, 12 pieces, 10 props, 29 titles, 10 walls); nothing approved; `season-preview-wired.json` has 0 thanksgiving rows; "Nothing ships until the founder approves from the gallery" |

### C. Answer-swap cutovers

| | Item | Status | Evidence |
|---|---|---|---|
| C1 | Batch 2 (profanity out of Six/Seven) | ✅ already live | `SOLUTION_SWAP_2_CUTOVER_DATE = '2026-10-10'` in core, `SolutionSwaps.swift:68`, `SolutionSwaps.kt:70` (moved from 11-16 by the founder on 10-10; the memory note "2026-11-16" is stale). The server (`apps/server`) imports core's `generateSolutionsFromSeedForLength`, so all four runtimes agree |
| C2 | **Batch 3 (British spellings: COLOUR, CENTRE, LITRE… → PECAN, SORBET, EGGNOG…)** | ✅ wired, dated **2026-11-16** | `SOLUTION_SWAP_3_CUTOVER_DATE = '2026-11-16'` ×3 (`solution-swaps.ts:110`, `SolutionSwaps.swift:106`, `SolutionSwaps.kt:108`), pinned by `solution-swaps.test.ts:209` and `SolutionSwapTest.kt:146`; dailies `daily-2026-11-16-DUEL_7` fixture ×3. Every build since the 10-09 release carries the table. Requirement: 2.8.4 (iOS 264 / Play 229, submitted 10-15) or any later build must be the store version well before Nov 16 — already true |
| C3 | Batch 4 | ✅ live | `SOLUTION_SWAP_4_CUTOVER_DATE = '2026-10-13'` |
| C4 | Engineering Portal copy | ⚠️ cosmetic | `apps/web/lib/portal-html.ts:200` says "the next answer-swap batch takes effect 2026-11-16" — true for batch 3; fine |

### D. JP 45-day social plan, Nov 14-29

| | Item | Status | Evidence |
|---|---|---|---|
| D1 | Designed images for every Nov 14-29 post | ✅ | `docs/design/brand/social/jp45/manifest.json`: 33 entries covering all 16 dates, every one `season: thanksgiving`, `mascot_check: pass (checked vs hero)`, `aesthetic_check: pass`; every referenced file present on this Mac (0 missing; images are git-ignored and live in the Art Library + social-media bucket) |
| D2 | Rejects resolved | ✅ | `incoming/rejects.json`: 28 entries, all `done (accepted …)` or `superseded`; 0 open. The Nov 16/18/29 S-costume and Nov 21 SMACK TALK spelling redraws were accepted in rounds 3-4 |
| D3 | Thanksgiving greeting post (Nov 26, 7 AM CT) | ✅ | `docs/sql/20261015-holiday-greetings.sql:79` (post 95fe3bfd…, X/Threads/IG/FB captions); manifest `2026-11-26-holiday` has both portrait + landscape, pass; also Veterans 11-11 and Diwali 11-08 greetings. Caveat: the SQL post title still reads "(image coming)"; confirm the media was attached (Bible §392 says 127/127 posts carry media) |
| D4 | Studio posts exist for the window | ✅ | `apps/web/lib/admin/jp45-posts.json`: 40 posts Nov 14-29 (x/fb/feed/pin/video) |
| D5 | Videos for Nov 14-29 | ⚠️ | `video/manifest.json` lists 11 clips for the window, all titled `[Needs capture]` (Bible §389: 11/26 videos made, 15 left). Nov 14 Opal and Nov 28 Umi cast videos note "thanksgiving costume art" |
| D6 | Nov 16 "Thanksgiving build reveal" + Nov 21 "Cast Saturday: Thanksgiving costumes" | ⚠️ | both depend on the Thanksgiving build being live; the post title says "move to the ship date". If the build slips, move these two posts (and the reveal video) in Studio |
| D7 | Nov 13 / Nov 29 posts need real numbers | ⚠️ | "Player of the Week (needs a real player post)", "Day 45 wrap (fill the numbers)" — JP's own tasks, not readiness blockers |
| D8 | Extras (IG story backgrounds, UGC frame) | ✅ | `extra/manifest.json`: 11-13 UGC frame, 11-22 and 11-23 harvest stories pass vs Thanksgiving art |
| D9 | Posting itself | ⚠️ | Studio "Pause all posting" is ON and X/Pinterest/Meta/TikTok connections are half done (Bible §389) — a launch-week issue, not a Thanksgiving one |

## Gaps ordered by deadline, with the smallest fix

**By ~Nov 1 (the 2.8.x "back to normal" build, decided §353/§354)** — code, no art:
1. Revert `LaunchBackground.colorset` → #F1D7F6 and `splash_lilac` → #ECE0FB (A4).
2. `make-icons.py --restore` for the normal icon ×3 (A5); normal screenshots + What's New / description (A7; iOS needs the version, Play listing same day).
3. Do NOT turn `season_halloween` off; the clock ends Halloween (A6). Consider renaming the flag copy to "Seasons (all)" later.
4. Optional: rename `SOLUTION_SWAP` comments — nothing to ship.

**By ~Nov 7-10 (Thanksgiving build submitted so it is live for Nov 14/16)** — the whole season, roughly one focused day plus review:
5. **Decide the window** (Nov 14-29 vs 16-27) — founder.
6. **Founder review + approve** the 81 draft Thanksgiving assets in the gallery / Art Library (B17) — the hard gate.
7. **Ship list** `seasons/thanksgiving/ship.json` mirroring Halloween's (titles → 24 keys, walls → 5 pages, banner) — data.
8. **Cast skins**: generalize `ship-art.py:188` from `seasons/halloween/header/` to every `seasons/<id>/header|cast/` and measure `castTrim` boxes — code (script) + run.
9. **Home banner** `art-scene-banner-thanksgiving` — code composite (`compose-thanksgiving-banner.py` from cast + props); no new ChatGPT needed (B5).
10. **Registry entry** in `season-registry.json` (palette, slots, surfaces with a harvest palette passing the readability gate) copied byte-for-byte ×3; **window row** in `SEASON_WINDOWS` + `LevelSeason.swift` (`case thanksgiving`) + `Season.kt`; regenerate parity fixtures; `theme-registry.json` `seasonal.thanksgiving` ×3 (B8, B10, A3) — data + ~10 lines of code.
11. iOS widget: `WidgetStats.asset()` → registry cast pattern instead of `== .halloween` (B12) — code.
12. Mark wired in `season-preview-wired.json`, preview on phones via Settings → Season preview (B9 is automatic).
13. Seasonal icon + store screenshots/text for the Thanksgiving build, then the post-season revert (B16) — art (icon recolor is scripted) + store work.
14. Perf/smoothness gate ON vs OFF and the WCAG gate, per `perf-gate-before-builds` — required before any build.

**Nice to have (can land in a later 2.8.x / 2.9):**
15. Ambient falling leaves (B11, code ×3) or ship with no ambient.
16. Mascot-maker Thanksgiving parts from the 12 drawn pieces (B14, data + catalog ids ×3).
17. Celebration extras and a harvest curtain stage (B6/B7, ChatGPT art) — the plain card is a clean fallback.
18. `intro-thanksgiving` sound (B13).

**Social (JP):** nothing blocks; move the Nov 16 reveal + Nov 21 costume posts to the real ship date, capture the 11 videos, fill the Nov 13 / Nov 29 numbers.

## Things that will behave differently on Nov 1 (checked, low risk)
- Season flips at local midnight per player; widgets re-resolve by timeline day (`WidgetStats.asset`), Android re-checks on foreground.
- Theme returns to each player's base theme; `seasonOptOut` keys are per season+year so a Halloween opt-out does not carry into Thanksgiving.
- Launch splash stays #0E091B until the revert build (cosmetic flash only).
- Push accent / `spooky_season` / share-hero glow return to normal by date.
- `whats-new.ts` still points at `art-halloween-prop-pumpkin` for the 2.8 entry — static, fine.
- Holiday puzzles: Oct 30-31 Halloween, Nov 8 Diwali, Nov 11 Veterans, Nov 25-26 Thanksgiving; no Nov 1-2 in-app holiday (the Día de los Muertos greeting is social-only).
