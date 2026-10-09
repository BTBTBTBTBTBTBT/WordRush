# 2.8 inventory — outdated or inconsistent user-facing copy

Date: 2026-10-09. Read-only grep audit, no builds or tests. Paths relative to `apps/web/` (web), `apps/ios/Wordocious/Sources/` (iOS), `apps/android/app/src/main/kotlin/com/wordocious/app/` (Android), `docs/store/` (store text). Admin pages excluded.

**Current facts the copy must match (from code, not memory).**
- The home row is **Puzzles** (`app/page.tsx:474` label "Puzzles"; `lib/more-games.ts:99-100` "PUZZLES SWEEP!" / "PUZZLES FLAWLESS!"). "More Games" survives only as the old tile/sheet name.
- The Daily Sweep is the **eight word games** on the home grid. The ten Puzzles titles are outside it, but the Puzzles titles **do have their own sweep and flawless** (Stats "Puzzles Sweeps", `components/stats/your-records.tsx:240-241`; share title `lib/share-page-copy.ts:17`; sweep celebration `components/effects/sweep-celebration.tsx:42`).
- Ten Puzzles titles: ProperNoundle, Sudocious, Starsweep, Letter Ladder, Spyglass, Hubbub, Codebreaker, Kindred, Crosswordocious, Muddle.
- Pocket games: six, from `lib/friends-play.ts:61` and `apps/android/.../data/FriendlyGamesService.kt:24`: Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the Puzzle, Ghost, Word Chain.

Counts below are rows, not unique strings.

## 1. "More Games" where the name is now "Puzzles"

| platform | file:line | current text | note |
|---|---|---|---|
| web | app/layout.tsx:52, 84, 92 | meta description "Eight daily word games and ten More Games: …" | SEO copy; say "ten Puzzles" |
| web | app/about/page.tsx:9 | "…and ten More Games…" | About page |
| web | app/how-to-play/page.tsx:16 | meta "…and the ten More Games dailies" | meta |
| web | app/guides/page.tsx:10, 36, 59 | "…and the ten More Games dailies"; "More Games adds a fifth"; "More Games is the tile on the home screen…" | guides index, the tile name |
| web | app/pro/page.tsx:377-379 | "More Games dailies, from ProperNoundle and Sudocious…" | Go Pro benefits copy |
| web | components/auth/landing.tsx:100 | FAQ "What is More Games?" | FAQ question on signed-out home |
| web | components/auth/landing.tsx:141, 168, 171, 172 | "ten More Games dailies"; section heading "More Games"; "Ten extra dailies behind one tile"; "none of them counts toward the Daily Sweep" | landing body; the last one is the stale sweep claim (section 3) |
| web | components/auth/daily-landing.tsx:87, 116 | "The ten More Games titles behind the home tile…"; "More Games results never count here." | signed-out daily landing |
| web | components/modals/welcome-modal.tsx:202 | "Daily Puzzles" / "Eight daily word games and ten More Games, new every day" | welcome modal (name clash: header says Puzzles, body says More Games) |
| web | lib/how-to-play-content.ts:119 | heading "More Games — Ten Extra Dailies" | How to Play section title |
| web | lib/content/static-content.ts:26, 96 | FAQ "What is More Games?" (two copies, one per FAQ list) | duplicate FAQ entries |
| web | lib/content/static-content.ts:72 | tile desc "10 extra dailies behind one tile … never the Daily Sweep." | "never the Daily Sweep" is still true, but the tile name is wrong and no sweep is named |
| web | lib/content/static-content.ts:105 | "ten More Games dailies from sudoku to cryptograms" | intro/about copy |
| web | lib/content/static-content.ts:123, 125 | heading "More Games — Ten Extra Dailies"; body "The More Games tile…" | How to Play copy (duplicate of how-to-play-content.ts:119) |
| web | lib/guide-content.ts (10 guide blocks: 379, 429, 485, 540, 596, 654, 711, 767, 823, 881) | Daily Sweep row "Not counted — More Games are extra" (+ the `lives under More Games` sentence on lines 379, 435, 491, 546, 602, 660, 717, 773, 829, 887) | each guide's stats row; see section 3 |
| web | components/effects/sweep-celebration.tsx:74 | `'More Games puzzles'` noun on the Puzzles celebration | visible text; should read "Puzzles" |
| web | components/effects/sweep-celebration.tsx:114 | label `more ? 'Puzzles' : 'Daily'` | already correct; keep |
| web | lib/share-look.test.ts:48-49 | test expects `MORE GAMES SWEEP` in the share info line | the test pins the old headline; `lib/share-image.ts:314` comment says the card reads "MORE GAMES SWEEP". Confirm what is drawn before changing |
| iOS | MoreGamesSheet.swift:14 | `MenuScaffold("More Games", art: .moregames)` | the sheet title shown to players |
| iOS | ModeCatalog.generated.swift:54 | title "More Games", shortTitle "More", shareLabel "More Games" | generated from the mode source; fix the source, not the file |
| iOS | WelcomeView.swift:40 | pillar "Daily Puzzles" / "Eight daily word games and ten More Games, new every day" | same clash as web welcome modal |
| iOS | SweepCelebrationView.swift:79-80 | "All N More Games puzzles won today" / "completed today" | visible share/celebration text |
| Android | WelcomeScreen.kt:100 | sub "Eight daily word games and ten More Games, new every day" | same as iOS |
| Android | ModeCatalog.generated.kt:58 | "More Games" title, shareLabel "More Games" | generated |
| Android | data/ModeCoverage.kt:54-55 | "$who — Flawless More Games, all N won" / "$who — More Games Sweep, all N played" | visible share line; should read Puzzles Flawless / Puzzles Sweep (matches `more-games.ts:99-100`) |
| Android | ui/MoreGamesSheet.kt (sheet title) | "More Games" | confirm the rendered title string before editing |
| store | docs/store/listing-2.7.md:12, 17, 30 | "PUZZLES" section lists 4 of 10 titles (ProperNoundle, Sudocious, Muddle, Hubbub); "19 fresh puzzles every day" | store text is 2.7 copy |
| store | docs/store/whats-new-2.7.txt | "Pick a friend for pocket games" (no names); Halloween "Oct 24 to Nov 1" | 2.7 text; Halloween dates are for the 2.7 release |

Notes: `…ArtKit.swift` / `ArtKit.kt` `MOREGAMES` art keys and `art-titlecast-moregames` are asset names, not player text, so they are left alone. Comments that say "More Games" (about 150 across code) are developer notes; leave them.

## 2. Game counts that disagree

| platform | file:line | current text | correct count / note |
|---|---|---|---|
| store | docs/store/listing-2.7.md:8 | "19 daily word games, puzzles and VS battles" | 8 daily word games + 10 Puzzles = 18 dailies; 19 only if VS is counted. Reword |
| store | docs/store/listing-2.7.md:12, 17 | "Play 19 fresh puzzles every day" | 18 dailies (8 + 10). VS is a live mode, not a daily. |
| web | components/auth/landing.tsx:97 and lib/content/static-content.ts (About / FAQ) | "nineteen ways to play" | consistent: 8 dailies + 10 Puzzles + VS = 19. OK, keep |
| web | lib/strategy-content.ts:951 | "it sits alongside your eight-mode Daily Sweep" | legacy "eight-mode" wording; the sweep is eight **word** games |
| web | components/modals/welcome-modal.tsx:202, iOS WelcomeView.swift:40, Android WelcomeScreen.kt:100 | "Eight daily word games and ten More Games" | counts right, name wrong (section 1) |

No other count mismatch found in app copy. The 18 Puzzles/daily count is consistent in `lib/how-to-play-content.ts:119` ("ten extra daily puzzles"), `components/auth/landing.tsx:171`, and `static-content.ts:72`.

## 3. "Puzzles don't count toward a sweep" claims that are now stale

Puzzles has its own Puzzles Sweep and Puzzles Flawless (see the current facts above), so copy that says the Puzzles titles "never count", or that a sweep celebration never applies to them, is wrong or incomplete.

| platform | file:line | current text | fix |
|---|---|---|---|
| web | lib/how-to-play-content.ts:236 | "Daily Sweep: +200 XP … (the More Games titles are extra and never count)" | keep the Daily Sweep line; add "Puzzles Sweep: its own XP, separate from the Daily Sweep" (the XP rule for the Puzzles sweep must be confirmed in code first) |
| web | lib/how-to-play-content.ts:119 | "they live outside the Daily Sweep … none of them changes your sweep count or Flawless Victory" | keep "outside the Daily Sweep"; drop "never"; name Puzzles Sweep |
| web | lib/guide-content.ts:379, 429, 485, 540, 596, 654, 711, 767, 823, 881 | Daily Sweep row "Not counted — More Games are extra" | "Not in the Daily Sweep. Counts toward Puzzles Sweep." |
| web | lib/guide-content.ts:435, 491, 546, 602, 660, 717, 773, 829, 887 | "…so it never affects your Daily Sweep, Flawless Victory or the sweep celebration" | "the sweep celebration" is the Puzzles celebration now (`sweep-celebration.tsx:42`). Say "never affects the Daily Sweep or Flawless Victory; it counts toward the Puzzles Sweep" |
| web | lib/content/static-content.ts:50, 97 | FAQ "Does More Games count toward the Daily Sweep? No." | keep "No"; add "It has its own Puzzles Sweep." |
| web | components/auth/landing.tsx:172 | "none of them counts toward the Daily Sweep, which stays the eight word games above." | same fix |
| web | components/auth/daily-landing.tsx:116 | "More Games results never count here." | "Puzzles results count toward the Puzzles Sweep, not here." |
| web | lib/strategy-content.ts:139 | "they sit outside the Daily Sweep: the sweep and Flawless Victory stay the eight word games on the home grid, so a More Games result never…" | the sentence is accurate for the Daily Sweep; add the Puzzles Sweep |
| store | docs/store/listing-2.7.md:28 | "Sweep every daily for a Daily Sweep, or solve them all with no wasted guess for a Flawless Victory." | accurate, but add the Puzzles Sweep line |

## 4. Old game names

No user-visible use of the retired names (Octordle, Quordle, Wordsearch, Scramble, Cryptogram, Sudoku as a title) found in player-facing strings. Hits are identifiers, file names, and comments (`components/game/multi-board.tsx`, `components/scramble/*`, `components/cryptogram/*`, `components/wordsearch/*`, `components/sudoku/*`). The current names are used: Octoword, Quadword, Muddle, Codebreaker, Spyglass, Sudocious. Two labels to check, not errors: "Groups" as the Kindred subtitle (`components/groups/groups-board.tsx:152`, iOS `KindredView.swift:591`, Android `KindredScreen.kt:644`) and "Crossword" as `shortTitle` (`lib/modes.generated.ts:371`).

## 5. Pocket games missing from help and guides

The six pocket games are not named in any How to Play, guide, FAQ, About, or tour copy:

| surface | checked | result |
|---|---|---|
| How to Play | `lib/how-to-play-content.ts` | no pocket game entry (only the Puzzles, VS and daily sections) |
| Guides | `lib/guide-content.ts` | no pocket game guide |
| FAQ | `lib/content/static-content.ts`, `components/auth/landing.tsx` | no pocket game question |
| About | `app/about/page.tsx` | no pocket game mention |
| Onboarding / tour | `components/onboarding/*`, `lib/onboarding.ts` | no pocket game mention |
| Friends copy | `app/friends/page.tsx:44` | "play pocket games together" is the only mention |
| Store | `docs/store/listing-2.7.md:51` | "Quick pocket games: Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the Puzzle, Ghost and Word Chain" (listed) |

Suggested fix: one How to Play block "Pocket games (with a friend)" with the six names, plus the Friends help text.

## 6. British spellings

None in player-facing copy in the scanned web, iOS, Android and store text. Matches are code identifiers and comments only: `centre` (`components/hub/hub-game.tsx:353`, `HubView.swift:70`, `HubScreen.kt:173`), `finalise` (`hub-game.tsx:206`, `HubView.swift:187`, `HubScreen.kt:299`), `labelled` (comments), `uncategorised` (`MoreGamesSheet.kt:65`, `ModeCatalog.swift:116`), `colour` (none). Hub's player copy is "center" (`HubView.swift:170`, `HubScreen.kt:287`, `hub-game.tsx:71`). Keep it that way.

## 7. Push copy

`packages/core/src/push-copy.ts`, `apps/ios/Sources/Core/PushCopy.swift` and `apps/android/core/src/main/kotlin/com/wordocious/core/PushCopy.kt` contain no "More Games", "Puzzles" or "pocket" text. Nothing to change in push copy for 2.8.

## Counts

- More Games / old tile name rows (section 1): 28 table rows (web 18, iOS 4, Android 4, store 2); the web guide-content rows are grouped, so the file-line count there is 20 more lines
- Game-count mismatches: 5
- Stale "never count / Daily Sweep only" claims (section 3): 9 table rows (web 8, store 1)
- Old game names in player copy: 0 (2 labels flagged to check)
- Pocket games missing from help: 5 help surfaces, 6 games
- British spellings in player copy: 0
- Push copy issues: 0
