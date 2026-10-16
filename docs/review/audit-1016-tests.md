# Final audit test pass, 2026-10-16 (pre store build)

Working tree only, nothing committed or stashed.

## Suites

| Suite | Result |
|---|---|
| packages/core `vitest run` | 801 / 801 pass (64 files) |
| apps/web `tsc --noEmit` | clean |
| apps/web `vitest run` | 1977 pass, 1 fail (art.test.ts, see Open) after fixes |
| apps/web `content:check` (CI step) | 48 / 48 pass |
| apps/web `test:scoring` (CI step) | 200 fixtures pass |
| apps/server `typecheck` (CI step) | clean |
| eslint | not run: CI does not lint (ci.yml runs tsc, server typecheck, core vitest, content:check, web vitest, test:scoring) |
| apps/ios `swift test` | 532 XCTest pass, 0 failures |
| Android `:core:test` | 301 / 301 pass |
| Android `:app:testDebugUnitTest` | 598 / 598 pass |
| Android `:app:compileDebugKotlin` | OK (deprecation warnings only) |
| Parity fixtures regen (`gen-parity-fixtures.ts`) | "already up to date", the generator rewrote nothing. The fixture files show as modified in `git status` only because today's work is uncommitted. |
| `ios-asset-compression.py --check` | ok, every raster imageset declares compression-type (3526 lossy, 58 lossless) |

The friend-cards "Call It" vs "Coin" failure and the web art.test.ts empty-webp failures seen earlier no longer reproduce.

## Fixed

1. `apps/web/scripts/button-family-baseline.json`: ran `UPDATE_BUTTON_BASELINE=1`. Added ShareSheetV2.swift 3, ShareSheetV2.kt 2 and TimeOfDayAdmin.kt 1. These are the new share-sheet carousel and channel tiles and the time-of-day admin radio chips, which are intentional. The diff is exactly those three lines.
2. `apps/android/app/src/test/kotlin/com/wordocious/app/ui/StreakSummaryTest.kt`: expected "SOLVED IN 4 GUESSES" changed to "SOLVED IN 4". The strip headline was deliberately shortened in `FinishedScreen.kt` `stripHeadline` and matches iOS `PostGameViews.swift` and web `finished-kit.tsx`. The test had not been updated.

## Open (needs a decision)

- `apps/web/lib/art.test.ts:100` ("lists every art-* file in public/art") fails on 33 untracked webps with no size registered. None is referenced from code or registries.
  - `art-title-{dailies,faq,friends,gopro,guides,howto,leaderboard,menu,moregames,privacy,puzzles,records,settings,stats,strategy,terms,vsbattle,welcome,words,wotd}.webp` (20 files). Written 14:03-14:04 today. These look like an accidental re-run of `docs/design/brand/ship-art.py` ("page titles -> art-title-<name>"). The legacy set was replaced by `art-titlecast-*` in commit 8cf1c18a8.
  - `art-av-acc-scarf-{bean,blob,chunky,classic,cloud,drop,hex,mini,pear,star,tall,wide}.webp` (12 files). Written 14:29. Per-body scarves from `ship-scarf.py`, which is marked superseded. The shipped scarf pieces are the `-wrap` files.
  - `art-av-acc-goth-lace-choker.webp` (1 file). Written 14:28. It is in `new-items-plan.json` but not in `avatar-parts.json` or `art-av-pieces.ts`.
  - The same files also exist untracked as iOS imagesets (`apps/ios/Wordocious/Resources/Assets.xcassets/<name>.imageset`) and Android drawables (`apps/android/app/src/main/res/drawable-nodpi/<name_with_underscores>.webp`). They add app bundle size.
  - Recommended: remove the 33 files from all three platforms, which restores the HEAD state. I tried to move them out to scratch (recoverable), but the permission classifier denied it and I stopped. The alternative is to register sizes if the choker should actually ship, which also needs wiring in `avatar-parts.json`.
- Also untracked and unwired: modified `Contents.json` (adds `compression-type: lossy`) for the scarf `-wrap` imagesets. This is just the compression flag and is fine.
