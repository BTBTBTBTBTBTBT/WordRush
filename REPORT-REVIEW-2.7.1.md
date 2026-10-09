# 2.7.1 review + regression tests

Branch `cloud/review-2-7-1`, based on `claude/wordocious-store-text-audit-f32609` at `e31cd7e0`.
Scope: the 151 commits from `c1ed2fd3` ("Release 2.7") to `e31cd7e0`, covering iOS, Android, web and core.
No version numbers were changed.

## Summary

- **Five regression tests**, one for each of tonight's bugs.
  - Web, core and Android tests run here, and each was shown to **fail on the pre-fix code or art** before passing on HEAD.
  - The Swift tests could not be run here. Each one's logic was checked against the current source.
- **Two low-risk fixes** (Android), each with a test that fails without the fix:
  - Locked game cards painted as "finished" under Haunted glass.
  - Deep links re-run on every activity recreation, which throws the player back to Home after a rotation or dark-mode switch once the small widget had opened the app.
- **42 other findings**, listed below with severity and a suggested fix.
  - None is a new crash on a common path.
  - The most important are M1–M6: season changes not applied while the app stays alive; the iOS host showing W when nothing is cached; an Android snapshot-write crash path; iOS remote sign-out cleanup; the Android MORE chip always wrapping to its own line; Randomize saving conflicting looks.

## Findings

Severity: **H** = high, **M** = medium, **L** = low. All line numbers are at this branch's HEAD.

### Fixed in this branch

| # | Sev | File:line | Issue | Status |
|---|---|---|---|---|
| F1 | M | `apps/android/app/src/main/kotlin/com/wordocious/app/ui/ModeCardView.kt:285` | Under a dark season, a free player's **locked**, already-played card got the finished glass (`SeasonDone.WASH` of its game color), so it read as a finished game. 370ee6e6 says locked cards keep their locked look; iOS passes the lock gray with `done && !locked`, and web returns its gray wash first. | **Fixed.** Now `gameCardBg(if (isLocked) lockGray else accent, isDone && !isLocked)`, matching iOS. Test: `LockedCardSeasonTest`. |
| F2 | M | `apps/android/app/src/main/kotlin/com/wordocious/app/MainActivity.kt:142` | `DeepLinkRouter.handle(intent.data)` and `handlePushUrl` ran in **every** `onCreate`. After a small-widget launch (`wordocious://home`, f00cbf47), any recreation set `homeRequest` again and jumped to Home: rotation, dark mode, font scale, or restore after process death. That undid 93413361's "tab kept across rotation". A `wordocious://daily/X` launch also reopened that daily. | **Fixed.** Handled only when `savedInstanceState == null`; warm taps still arrive through `onNewIntent`. Test: `DeepLinkRecreateTest`. |

### Open: medium

| # | Sev | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| M1 | M | Android `ui/SeasonSkins.kt:172-176`, `ui/MainScreen.kt:381-389`; iOS `WordociousApp.swift:57-58`, `ThemeManager.swift:65-74` | **A season change never applies while the app stays alive.** Android `rememberSeason()` is `remember(preview)`, and `applySurfaces` runs only on theme load or a preview pick. iOS has no foreground or day-change refresh, and `.preferredColorScheme` / `.id` key on the theme only. An app resumed on Oct 17 (or Nov 2) ends up in a mixed state: the night glass with a light system color scheme on iOS, and the old season until the process dies on Android. Flipping the iOS admin preview also never updates the color scheme. Web is fine (`useSeason` re-reads on `visibilitychange`). | Android: in the MainScreen day-change branch, call `SeasonKit.applySurfaces` and bump a `SeasonSkins.day` state used as a `remember` key. iOS: on `.NSCalendarDayChanged` / `willEnterForeground` and on a preview pick, call `CastSkin.invalidate()` and `ThemeManager.objectWillChange.send()`, and add the season id to the root `.id`. |
| M2 | M | `apps/ios/Wordocious/Sources/AvatarDirectory.swift:248` | `case .unknown: return .w`. When nothing is cached (the first launch after updating to 2.7.1, a fresh sign-in, a reinstall), iOS forces W until both own-look fetches finish, even when the profile row already shows a custom look, then pops. That is worse than before 32488111. Android draws the live look (`HomeHostLookCache.kt:77`); web hides the host. | In `.unknown`, return `liveHostChoice()` when it isn't `.w`, otherwise hide the host (opacity 0), as web does. Needs a small pure `hostChoice(source:live:)` in Core so it can be tested. |
| M3 | M | `apps/android/.../ui/HomeHost.kt:273` → `data/PlayerAvatars.kt:225` | `writeLookCache` reads `PlayerAvatars.ownFields()` inside `snapshotFlow`. `ownFields()` **writes** `ownPatch.value = null` when the patch belongs to another account, and writing state in a read-only snapshot throws `IllegalStateException`. That throw is uncaught in `HomeHostPrewarm`'s scope, so the app crashes. Path: A edits their look, signs out, and B signs in within the same process. | Clear `ownPatch` / `patchOwner` in `AuthService.clearSignedInState`; make `ownFields()` ignore a foreign patch without writing; add `.catch {}` around the writer. |
| M4 | M | `apps/ios/Wordocious/Sources/AuthService.swift:239-250` | The listener's `.signedOut` branch (revoked token, "sign out everywhere", account deleted) blanks the profile but doesn't clear `HostLookCache`, `hadPersistedSession` or the profile cache. (a) While the next account's row loads, `HostLookRules.source` trusts the stored entry, so B can briefly see A's host. (b) A later "Play without an account" isn't restored on the next cold launch. | Run the same local cleanup as `signOut()` in that branch. |
| M5 | M | `apps/android/.../ui/game/FinishedScreen.kt:457,516`, `ui/CastButton.kt:388`, `ui/FamilyButtons.kt:311` | The 3a04d181 fix stops the crash, but the MORE chip's width now falls back to the full row, so it **always takes its own line** on every finished screen (Ladder, Sudoku, Codebreaker, Hub, Regions, Crossword, Gauntlet and others). iOS keeps it inline. The chip that has no intrinsics is the `QuietButton` MORE chip (`FamLabel` is a `BoxWithConstraints`, since 2a5bd3c4), not `CandyLabel`. Every finished screen with `more` was crashing, not only the guest Gauntlet. | Lowest risk: give `MoreChip` its own plain label. Family-wide: make `FamLabel` / `CandyLabel` report a natural width and scale down with a layout modifier (like `shrinkToSlot()`) instead of using `BoxWithConstraints`. |
| M6 | M | web `lib/avatar-render.ts:1218-1246`, iOS `MascotBuilder.swift:865-895`, Android `MascotBuilderLogic.kt:216-241` | **Randomize can save conflicting looks.** It picks a new neck and head but keeps held / wrap / feet / pet / brows / extra, and only checks face conflicts. Examples: a random neck guitar with a kept mug, or a random chain with a kept lei. The layout silently hides the loser, but it stays in the saved config and reappears when the neck is cleared. | After building the random look, apply `applyAvatarPick(next, 'neck', …)` and the same for head, on all three. Test: a seeded rng with 500 runs asserting `avatarPickConflict` is null for every worn field. |
| M7 | M | `packages/core/src/avatar-layout.ts:231-238` (+ Swift :242, Kotlin :220) | **Hats hide the new brows.** Hats rise to clear only the eyes and glasses. In 47 of 444 body×hat combinations the brows are more than 80% covered (beanie on classic or wide: 100%), so picking brows changes nothing. | Include the brows' ink top in `faceTop` when brows are worn (give brows an `inkTop`), or add a `head:[…]` vs `brows:*` conflict. Changes the fixtures on all three platforms. |
| M8 | M | iOS `HubView.swift:131-135,153`; Android `HubScreen.kt:247-251,272`; web `hub-game.tsx:253` | A pangram that crosses the win threshold plays the **pangram 1-up and the win jingle together**. Pangrams score highly, so they are the most likely words to cross it. | Skip or delay the pangram when this submit moved the status from playing to won. |
| M9 | M | web `components/ui/cast-puppets.ts:238`, iOS `AppHeaderView.swift:448`, Android `CastHeader.kt:165` | Re-tapping a hero mid-hop restarts the tap curve at t=0: the figure snaps to the ground and the laugh face flickers off. The giggle is debounced (700 ms) but the visual isn't. | A pure `acceptTap(prevStart, now)` in `cast-rig.ts` / `CastRig.swift` / `CastRig.kt` that ignores visual re-taps within about 0.7 s, plus a unit test on each platform. |

### Open: low

| # | Sev | File:line | Issue | Suggested fix |
|---|---|---|---|---|
| L1 | L | `apps/android/.../ui/FriendsPanel.kt:819-873` | The friend long-press menu sits in an unkeyed row list sorted by online status. A presence change reorders the rows and rebuilds the menu's dialog, and an action picked during the close animation is lost. | `key(f.id) { … }` around each row, or render the menu after the list (as web and iOS do). |
| L2 | L | core `avatar-season.ts:87-90` (+ Swift `AvatarSeason.swift:73`, Kotlin port), web `lib/admin/studio.ts:388-400` | The season nudge key uses the calendar year, so a window that crosses New Year (the planned New Year season) nudges twice and the Studio band splits at Dec 31. `inWindow`'s wrap branch has no fixture. | Key by the year the window started; add a wrapping window and a Jan 1 case to the shared fixtures. |
| L3 | L | iOS `CastSkin.swift:40`, `SettingsView.swift:26`; Android `SeasonSkins.kt:63-80` | The admin season preview survives sign-out, so a non-admin who signs in later is stuck in it. It also makes seasonal parts free out of season. Web keeps the preview per session only. | Clear it on sign-out or when a non-admin profile loads. |
| L4 | L | iOS / Android Settings season picker | No "none" preview natively (web has `?season=none`), so admins can't preview the normal look on device during Halloween. | Add a "None" tile that stores `"none"`. |
| L5 | L | `apps/ios/Wordocious/Sources/ThemeManager.swift:67-68` | In season, every `Theme.*` read builds a new palette, taking two locks and a `Date()`, in every view body. | Cache the combined palette, keyed by season id and dark/light. |
| L6 | L | core / Swift / Kotlin season date parsers | The ports disagree on malformed dates: `"2026-10-17T05:00Z"` is only accepted on Android, and `"2026-10-32"` only on web and iOS. Every caller passes clean `yyyy-MM-dd` today. | Add malformed cases to `level-season-fixtures.json`. |
| L7 | L | `apps/web/components/ui/family-action-menu.tsx:71-74` | `setTimeout` inside a state updater, so StrictMode (development only) calls `onClose` twice. | Guard with a `closingRef`. |
| L8 | L | web `friends-panel.tsx:954`, Android `FriendsPanel.kt:872` | The menu closes without `onClose` if a refresh drops that friend; `menuFor` stays set and the menu re-pops if they come back. | Clear `menuFor` when the friend isn't found. |
| L9 | L | `apps/android/.../ui/CastButton.kt:383-404` | Latent: with unbounded width, the failed-intrinsics fallback width (`Int.MAX_VALUE/4`) would throw in `Constraints` / `layout`. Both callers are bounded today. | Clamp the fallback to the constraints' maximum. |
| L10 | L | `apps/android/.../ui/CastButton.kt:388` | `runCatching` catches every `Throwable`, hiding any other measurement failure. | Catch `IllegalStateException` only, and log it in debug builds. |
| L11 | L | `apps/ios/Wordocious/Sources/BoardView.swift:771-777,922` | Performance only: `builtBoards` never shrinks, and overlapping staging chains can run. Correctness is fine: Gauntlet counts only grow (now tested), and a finished game resets `@State`. | `onChange`: `builtBoards = min(builtBoards, vm.boardCount)` before `stageBoards()`, plus a generation token. |
| L12 | L | `apps/web/lib/game-transition.ts:42` | Since the freeze fix, opening a mode whose dictionary isn't warm animates into the loading screen, then the game pops in. | Warm the tapped mode's word lengths before `startViewTransition`. |
| L13 | L | `apps/web/components/home/mode-card.tsx:242-280` | `FitDesc` interleaves reads and writes, forcing up to about 4 layouts per card on Home mount. | Read all widths first, then write. |
| L14 | L | web `sudoku-game.tsx`, `regions-game.tsx` (2a5bd3c4) | The new `CandySegment` pickers dropped the radio-group semantics (`aria-pressed` instead of `aria-checked`). | Give `CandySegment` a radio mode. |
| L16 | L | `apps/web/components/ui/cast-puppets.ts:164,205-206,236-243` | A tap while the rig loads, followed by a failed load, leaves a gesture that is never cleared, so a 60 fps animation loop runs while the header is visible. | In the load `catch`, clear `S.gesture` / `S.tap`; only accept taps on loaded puppets. |
| L17 | L | `apps/android/.../ui/CastHeader.kt:130,285-290` | All ten puppet layers redraw on every tick (shared clock), contrary to the code comment. | A tick state per figure. |
| L18 | L | `apps/android/.../ui/CastHeader.kt:171-192` | The move loop restarts on every scroll, tab or motion change, so a move fires about 1.2 s after each scroll stops (breaking the 6–10 s rest). | Keep `last` / `nextMoveAt` in `remember` and resume the remaining wait. |
| L19 | L | `apps/android/.../ui/CastHeader.kt:290` | `ambient = false` also freezes idle sways and S's speed lines **during** a move; iOS and web animate them. | Product call. |
| L20 | L | `apps/android/.../ui/GameMotion.kt:102-104,226-229` | The "open" sound and animation replay when the activity is recreated mid-game. | A `rememberSaveable` "already opened" flag. |
| L21 | L | web `cast-puppets.ts:21` (2600 ms) vs iOS `FinishLayout.swift:216` / Android `CastMoves.kt:154` (1200 ms) | The first signature move comes at a different time on web. | Pick one value. |
| L22 | L | iOS `SoundManager.swift` | The sound rules (Classic scope, giggle gap, intro quiet) live in the app target with no unit test; web (`sound-map.test.ts`) and Android (`FeedbackMapTest`) test the same tables. | Move them into a pure type in WordociousCore and mirror the tests. |
| L23 | L | `apps/web/components/avatar/mascot-builder.tsx:87,284` | Web Randomize can pick a saved-only, out-of-season seasonal part (iOS and Android exclude saved-only parts). | Pass a date/season-only `available` to `randomAvatar`. |
| L24 | L | `apps/android/.../MascotBuilder.kt:112` | The Android onboarding builder never sets `MascotLogic.season` / `.saved` (globals set only by the Dressing Room). It hides Halloween parts during the season and can carry another account's saved part. | Pass the season and saved look as parameters. |
| L25 | L | `acc:chain` pieces (no `wide` / `mini`) | The chain draws nothing on wide and mini but is still offered, including in the Rockstar bundle. | Disable the tile when `pieces[body]` is missing. |
| L26 | L | manifest conflicts | Neck cape/supercape with wrap bandana/lei: both drapes now share one path, so the cape cord sits under the band. | Add a conflict, or accept it. |
| L27 | L | `acc:scarf` (`perBody`, layer `neckFront`) | The scarf is the only drape drawn after held items and hats. | Move it to `wrap` / pieces. |
| L28 | L | `apps/android/core/src/test/.../AvatarLayoutFixtureTest.kt:47-49` | Doesn't assert each layer's name (iOS does). | Add `assertEquals(w["layer"], g.layer)`. |
| L29 | L | iOS `RootTabView.swift:400` | A widget `homeRequest` sets `tab` but not `router.current`, so celebrations wait (`CalmMoment.isCalm`). | Set `router.current = .home` too. |
| L30 | L | host bubble rules ×3 | "Make me yours!" while the cached look shows: web hides it, iOS and Android show it. Unknown look: web hides the host, native draws W. | Choose one rule and add a cross-platform test (see M2). |
| L31 | L | `apps/web/lib/home-host-cache.ts:99-104` | The cached config isn't validated (Android runs `validateAvatar`). | `validateAvatar` on read. |
| L32 | L | iOS `MascotLooks.swift:124-129`, `AvatarCast.swift` | The own look can stay unsettled for the rest of a launch after a quick sign-out and back in, so the cache and widget never refresh. | Reset `fetchedOwn` / `fetchedFor` when the profile goes nil. |
| L33 | L | iOS `AuthService.swift:525` | Android's 56a8db6a rule (a restored guest keeps its saves) isn't ported; `discardUnattributedSaves()` wipes a guest without an owner claim (e.g. via PerfTour). | Port `savesOnSignedOutLaunch`. |
| L34 | L | cape-drape vs `batwings` | Not in conflict (wings and fairywings are). | Product call. |

**Product questions (not bugs):**

- **Widget tap mid-game:** a widget tap while a game is open switches the tab but leaves the game open, on both iOS and Android.
- **Intro jingle on skip:** tapping to skip the intro doesn't stop the jingle.
- **Guest results on sign-up:** a guest who signs up loses today's local results, because isolation is by design.

## Regression tests added

Each test was shown to fail on the code or art from before tonight's fix (or before this branch's fix), except the Swift tests, which couldn't be run here.

### 1. iOS Gauntlet stage 5 drew 4 of 8 boards (6f2cf42a)

- **`packages/core/src/reducer.test.ts`: "walks a full run with board counts 1, 4, 4, 4, 8 (never shrinking), every board present".**
  - Plays a whole Gauntlet through the reducer and asserts each stage's board count.
  - Also asserts counts never shrink, and that OctoWord has 8 real boards.
  - This is the contract `BoardLayout` staging must follow.
- **`apps/ios/Tests/GauntletStagingTests.swift` (new).**
  - `BoardLayout` lives in the app target, which the package tests can't import, so like `NoEmojiInUITests` it reads `BoardView.swift`.
  - It pins two things: staging targets the live `vm.boardCount`, and `.onChange(of: vm.boardCount)` re-runs `stageBoards()`.
  - Its regexes were checked against the current source: they match, and they fail when the fix is removed.
  - The sizing half is already covered by 6f2cf42a's `testOctoWordInPlayIsTwoRowsOfFourFillingTheBand`.
- **UI test still needed:** an XCUITest that launches the DEBUG store shot `gauntlet -gauntletStage 5` and asserts 8 board views exist. Each `BoardView` needs an accessibility identifier first.

### 2. Home showed no finished games under the Halloween dark surfaces (370ee6e6)

**`apps/web/lib/season-done.test.ts` (new):**
- For every dark season and every game accent, the finished card color sits at least 30 (sRGB distance) from the unplayed one over the night card.
- The pre-fix 16% / 8% washes peak at about 19.5, and a case asserts the old numbers fail.
- `modeCardSurface` paints done from `--season-done-pct` with the glow, and unplayed from `--season-idle-pct`. Locked cards ignore done.
- Every variable `surfaceCssVars` can set is in `SURFACE_CSS_VARS`, so leaving a season clears them all.
- The `SeasonDone` wash / idle / idleTile values are the same in the iOS and Android source.

The Android locked-card fix (F1) is covered by `apps/android/.../ui/LockedCardSeasonTest.kt`.

**UI test still needed:** a snapshot of Home with the Halloween preview and one finished daily, on each platform.

### 3. Android finished-dock crash from an intrinsic query on a BoxWithConstraints label (3a04d181)

**`apps/android/app/src/test/.../ui/CastButtonRowIntrinsicsTest.kt` (new; the app has JUnit only, no Compose UI test):**
- `CastButtonRow`'s intrinsic query is guarded.
- No unguarded child intrinsic query exists anywhere in `ui/`.
- Documents that `FamLabel` (the MORE chip's label) and `CandyLabel` are still `BoxWithConstraints`, which is why the guard matters.

Every `height(IntrinsicSize.Min)` row in the app was also traced by hand: none has a `BoxWithConstraints`, SubcomposeLayout or lazy child.

**UI test still needed:** a Compose `createComposeRule` test that composes `CastButtonRow { CastButton(…); MoreChip(…) }` and asserts it measures without throwing. This needs `androidx.compose.ui:ui-test-junit4` and Robolectric added.

### 4. Neck items drew as a band across the arms (c08582d9)

- **`apps/web/lib/avatar-wrap-hoops.test.ts` (new)**, a pixel-accurate check.
  - A TS port of `docs/design/brand/avatar/integration/audit.py --wraps`, which no test or CI ran before.
  - Decodes the shipped web art with `sharp` (already a dev dependency) and draws every wrap-line layer at its manifest rect on its body.
  - Fails on more than 0.06% coverage of the hand ellipses, or a row at arm height covered 70% or more. Runs in about 1 s.
  - Against the pre-fix art and manifest (`git archive c08582d9^`) it reports **76 failures**, the same number the fix commit quoted. On HEAD it reports 0.
- **`packages/core/src/avatar-layout.test.ts`: "wrap-line drapes (neck items)"**, a cheap rule on the rects that every platform's manifest copy shares.
  - Every wrap layer starts above the arms or sits between the hands. The pre-fix manifest fails 74 of 106; HEAD fails 0.
  - A neck drape is drawn after the letter and under held items.
  - Every item or piece layer is in `layerOrder`. An unknown layer would sort under the body and hide the letter.
- iOS and Android share the same manifest, and the existing tests check it is byte-identical. Mirroring the rect rule natively needs `hands` decoded in Swift / Kotlin, which is listed as optional.

### 5. Home host popped from the default W to the player's look at launch (32488111)

- **`apps/web/lib/home-host-cache.test.ts`: "a cold relaunch, frame by frame"**, for mascot, cast-preset and photo players.
  - Launch 1 writes the settled look to storage. Launch 2 reads storage once, then walks auth's phases: intro, user known, profile landed.
  - Asserts phases `cached → cached → live`, the same look key at every frame (never W), and no crossfade.
  - Also covers a sign-out between launches: another account's entry is ignored, and with nothing cached the host stays invisible, with no bubble.
- **`apps/ios/Tests/HostLookCacheTests.swift`: `testColdRelaunchDrawsTheOwnLookFromFrameOneWithoutACrossfade`**, the same chain in Swift.
  - The entry is decoded from stored JSON; the profile arrives with a server-cased id.
  - Asserts `[.cached, .cached, .live]`, no crossfade and no rewrite.
- The iOS no-cache case (M2) needs a small production change before it can be tested, so it is listed as a finding rather than pinned as current behavior.
- **UI test still needed:** cold-launch with a seeded cache and assert the first Home frame's host image on each platform.

### Fixes' own tests

- `apps/android/app/src/test/.../ui/LockedCardSeasonTest.kt` (F1).
- `apps/android/app/src/test/.../data/DeepLinkRecreateTest.kt` (F2).
  - Pins the `savedInstanceState == null` guard, that the guard holds the only `handle(...)` call in `onCreate`, and that `onNewIntent` still routes warm taps.
  - **Full check still needed:** an `ActivityScenario.recreate()` test that asserts the tab survives.

## Test results

| Suite | Result |
|---|---|
| core vitest (`packages/core`) | **393 / 393 pass**, 32 files (baseline 389; +4 new) |
| core `tsc --noEmit` | clean |
| web `tsc --noEmit` | clean |
| web vitest (`apps/web`) | **1608 / 1608 pass**, 151 files (baseline 1595 / 149; +13 new) |
| Android `:core` JUnit | **154 / 154 pass**, run through a JVM-only Gradle harness (see below) |
| Android `:app` JUnit, new tests only | **6 / 6 pass** (`CastButtonRowIntrinsicsTest` 3, `LockedCardSeasonTest` 1, `DeepLinkRecreateTest` 2), same harness. `LockedCardSeasonTest` and `DeepLinkRecreateTest` were shown to **fail** on the pre-fix source. |
| Swift / XCTest | **not run.** No Swift toolchain in this Linux container, and download.swift.org is blocked. The new Swift tests were checked by hand and their regexes against the source (Python). |
| Full Android Gradle build / `:app:testDebugUnitTest` | **not run.** The Android Gradle Plugin and SDK come from Google Maven / dl.google.com, which this environment's network blocks (HTTP 403). |

**About the JVM harness:** a scratch Gradle project with only the Kotlin JVM plugin 2.0.20 and kotlinx-serialization (from Maven Central). It compiles `apps/android/core` with its tests, plus the new Android `:app` tests, which are pure source checks with no Android dependencies. It ran from the scratchpad and is not committed.

**Please run** `./gradlew :app:testDebugUnitTest` and the iOS `WordociousCoreTests` on a machine with the SDKs before merging.
