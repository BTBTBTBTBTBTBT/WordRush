# 2.8 inventory — in-game status messages (overlay toast vs inline layout)

Date: 2026-10-09. Read-only grep audit, no builds or tests. Paths relative to `apps/web/components/` and `apps/web/lib/` (web), `apps/ios/Wordocious/Sources/` (iOS), `apps/android/app/src/main/kotlin/com/wordocious/app/ui/game/` (Android) unless shown.

**Display primitives.**
- Web: `FeedbackToast` (`components/game/feedback-toast.tsx:153`) is `absolute`, `pointer-events-none`, centred over its `position: relative` anchor. It does not shift the layout. Games set text with `flash()` (sets message, clears after 1400 ms) or `setError()`/`setMessage()`, rendered as `<FeedbackToast message={…} />`.
- iOS: `.gameFeedbackToast(vm.toast, alignment: .top)` (overlay; `FeedbackToastKit.swift`). Clears after 1.4 s.
- Android: `GameFeedbackToast(session.toast, fallbackTop = …)` (overlay; `ui/game/FeedbackToast.kt`). Clears after 1.5 s.
- **Inline (layout) messages** are plain text rows that take space, so they shift the screen. Found in one web game (PvP) and in the result/invite panels, listed in section 4.

Messages are almost identical across the three platforms. Known differences: ProperNoundle says "Need N letters" on web and "Not enough letters" on iOS; the Hubbub pangram line is checked on web and iOS only (Android rank line confirmed, pangram not checked). Spyglass copy matches on all three.

## 1. Single-player and puzzle games (overlay toast)

| game | web file:line (message) | iOS file:line | Android file:line | display | note |
|---|---|---|---|---|---|
| Hubbub | `hub/hub-game.tsx:284` "Four letters or more"; `:253` "Pangram! +N" / "+N"; `:273` "Rank up: {name}"; keys `:71` "Must use the center letter", `:73` "Already found", `:74` "Not a word we know" | `HubView.swift:143` "Four letters or more"; `:184` "Rank up:"; `:170` "Must use the center letter"; `:172` "Already found" | `HubScreen.kt:260` "Four letters or more"; `:287` rejects ("Only the seven letters", "Already found", "Not a word we know", "Must use the center letter"); `:296` "Rank up:" | overlay (`FeedbackToast` :444 web; `gameFeedbackToast` iOS; `GameFeedbackToast` Android) | No "not in today's letters" string exists; the letters rule is "Only the seven letters" (Android `HubScreen.kt:287`). "Already found" is the same on all three |
| Letter Ladder | `ladder/ladder-game.tsx:228` "Five letters, please"; `:64` "Not in word list" | `LadderView.swift:140` "Five letters, please" | `LadderScreen.kt:212` "Five letters, please" | overlay | |
| Crosswordocious | `crossword/crossword-game.tsx:199` "N wrong letter(s) cleared"; `:200` "Everything filled is right"; `:281` "That letter is locked"; `:290` "Fill in some letters first"; `:295` "Tap again to reveal the whole puzzle (records a loss)" | `CrosswordView.swift:203, 204, 213, 240, 249` (same strings) | `CrosswordScreen.kt:352, 386, 389, 390, 406` (same strings) | overlay | "records a loss" is a double-tap confirm line |
| Codebreaker | `cryptogram/cryptogram-game.tsx:168` "X used for two code letters"; `:175` "N wrong letter(s) cleared"; `:176` "Everything penciled is right"; `:215, :222` "That letter is locked"; `:232` "Pencil some letters first" | `CodebreakerView.swift:182, 183, 192, 199, 205, 236` | `CodebreakerScreen.kt:259, 268, 284, 287, 288, 351` | overlay | same copy on all three |
| Kindred | `groups/groups-game.tsx:162` "One away…"; `:163` "Not a group"; `:164` "Already tried that set"; `:165` "Pick four words"; `:204` "Every category is already named"; `:205` "Every group already has a pair shown" | `KindredView.swift:161-164, 183, 187` | `KindredScreen.kt:291-304` | overlay | |
| Muddle | `scramble/muddle-game.tsx:168` "Not the punchline" / "Not that word"; `:210` "Solve the four words first" | `MuddleView.swift:196, 203, 210`; `:428` toast "under the board, never over the title art" | `MuddleScreen.kt:377, 386, 393` | overlay | the toast is under the board on iOS |
| Spyglass | `wordsearch/spyglass-game.tsx:164` "{near} fits the theme, but it's not one of today's 10" (2600 ms); `:166` "Not one of the words"; `:204` "Words shown — finds from here count like misses"; `:206` "Reveal unlocks at M:00" | `SpyglassView.swift:129, 134, 137, 139` | `SpyglassScreen.kt:234-240` | overlay | the longest message in the set; 2.6 s on web |
| Sudocious | `sudoku/sudoku-game.tsx:203` "Tap a cell first" | `SudokuView.swift:110` | `SudokuScreen.kt:226` | overlay (`FeedbackToast` :329) | |
| Starsweep | `regions/regions-game.tsx` (no flash/setMessage string found in this pass) | `RegionsView.swift` (`onShare` only; messages not traced) | `RegionsScreen.kt` (not traced) | overlay (iOS and Android use the shared toast) | needs a closer read before 2.8 copy changes |
| Quadword | `quordle/quordle-game.tsx:134` "Word must be 5 letters"; `:135` "Not in word list"; `:136` "Already guessed" (`setError`) | (shared multi-board path, to confirm) | (shared multi-board path, to confirm) | overlay (`FeedbackToast` :232) | |
| Octoword | `octordle/octordle-game.tsx:129-131` (same three); `setTimeout 1500` clear | (shared multi-board) | (shared) | to confirm | |
| Succession | `sequence/sequence-game.tsx:174, 182, 190` (same three) | (shared) | (shared) | to confirm | |
| Deliverance | `rescue/rescue-game.tsx:135-137` (same three) | (shared) | (shared) | to confirm | |
| Practice (Classic, Six, Seven) | `practice/practice-game.tsx:254` "Not enough letters"; `:261` "Not in word list"; `:268` "Already guessed"; vowel/consonant hint pills `:535-543` ("No vowel left", "Vowel: X") | (classic path) | (classic path) | overlay (`FeedbackToast` :441); hint pills are inline chips | |
| Gauntlet | `gauntlet/gauntlet-game.tsx:285` "Not enough letters"; `:293` "Not in word list"; `:301` "Already guessed"; `:390` "STOLEN GUESS! Opponent cleared a stage first!" | (`GauntletCompletedView.swift`; live game on `GameScreen.swift`) | `ui/game/GauntletFinish.kt` / `GameScreen.kt` | overlay (web uses an overlay; "STOLEN GUESS!" is the longest) | the "STOLEN GUESS" line is a race message, shouted caps |
| ProperNoundle | `propernoundle/propernoundle-game.tsx:538` "Need N letters"; `:546` "Already guessed"; `:557` "Not allowed" | `ProperNoundleView.swift:185` "Not enough letters"; `:190` "Not allowed" | (not located in `ui/game/`) | overlay (`FeedbackToast`) | web says "Need N letters", native says "Not enough letters": wording differs |
| Classic VS-style toasts (VS, in the game) | `vs/vs-game.tsx:986` "Opponent left the match"; `:1713` "Invite link copied"; `:1751` "Link copied"; `:1783`, `:1903` "Copied to clipboard!"; `VsToast` `:177` | `VSGameView.swift` (`gameFeedbackToast`) | `ui/vs/VS*.kt` | overlay (`VsToast`, bottom-8) | "Opponent left the match" is a status line, not a fail |
| VS guess rejects | `vs/vs-classic.tsx:137-138` "Not enough letters" / "Not in word list"; `vs-succession.tsx:109`; `vs-deliverance.tsx:81`; `vs-octoword.tsx:81`; `vs-quadword.tsx:81`; `vs-gauntlet.tsx:181-182`; `vs-propernoundle.tsx:186` "Not allowed" | `VSGameView.swift` | `ui/vs/*` | overlay (reject → toast) | same wording as single-player |

## 2. Pocket games (6 titles)

| title | web | iOS | Android | display | note |
|---|---|---|---|---|---|
| Ghost, Word Chain, Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the Puzzle | `components/friends/game-screen.tsx:110, 130` (server `r.error` shown as-is); `:122` "Could not resign. Try again." (`setError`) | `FriendlyGameScreen.swift:809` "Tap a letter" (inline prompt) | `ui/friends/FriendlyGameScreen.kt` (no status string matched in this pass) | web error line: to confirm (overlay or inline) | pocket status copy is thin. The in-board labels ("No flip yet", "No letter yet") are inline (`components/friends/friendly-boards.tsx:311, 580`) and are not toasts |

Pocket games do not use `FeedbackToast` on web (their own `game-screen.tsx` error line). A 2.8 pass should give them one toast path, like the single-player games.

## 3. Shared copy that appears on more than one platform (keep identical)

| message | web | iOS | Android |
|---|---|---|---|
| "Not in word list" | quordle, sequence, rescue, octordle, practice, gauntlet, pvp, VS | `GameScreen` family | GameScreen family |
| "Already guessed" | same set | same | same |
| "Not enough letters" / "Word must be 5 letters" | same set (two spellings: "Not enough letters" for ≥N, "Word must be 5 letters" in the 5-letter games) | same | same |
| "Solve the four words first" | muddle | MuddleView | MuddleScreen |
| "Five letters, please" | ladder | LadderView | LadderScreen |
| "Tap a cell first" | sudoku | SudokuView | SudokuScreen |

## 4. Inline (layout) messages — these shift the screen

| file:line | text | why it is inline | note |
|---|---|---|---|
| `components/pvp/pvp-game.tsx:251-253` | `{message && <div className="text-center text-red-500 …">{message}</div>}` (messages: "Invalid guess" or server reason, "Opponent left the match", "Word must be 5 letters", "Already guessed", "Not in word list") | the only game that renders its status in the flow, not as `FeedbackToast` | the one web game that shifts layout when a message appears; move to `FeedbackToast` |
| `components/vs/challenge-result.tsx:201` | `{error ?? challengeSentSub(mode, run)}` | inline subline under the result | intentional subline, but error and sub share one slot |
| `components/invites/invite-modal.tsx:315`; `components/referrals/invite-panel.tsx:259` | `FeedbackPill` in `role="alert"` row | inline pill row | inline by design (form feedback) |
| `components/pro/go-pro-popup.tsx:169` | `{error && <p …>{error}</p>}` | inline error text in the Pro sheet | form feedback, fine |
| `components/friends/friendly-boards.tsx:311, 580` | "No flip yet", "No letter yet" | in-board empty labels | inline by design, but they are plain text (see plain-surfaces.md section 3) |
| `components/practice/practice-game.tsx:535-543` | hint pills "No vowel left", "Vowel: X", "No consonant left", "Consonant: X" | chips in the hint row | inline chips, intentional |
| iOS `FriendlyGameScreen.swift:809` | "Tap a letter" | inline prompt | to confirm placement |

## 5. Counts

- Single-player and puzzle games with a status toast: 17 of 18 web game components use `FeedbackToast` (overlay; the exception is `pvp-game.tsx`, see section 4); iOS overlay in 12 views (`gameFeedbackToast`: Ladder, Sudoku, Hub, Codebreaker, Spyglass, GameScreen, Kindred, Muddle, Crossword, ProperNoundle, Regions, VSGameView) plus the shared `FeedbackToastKit.swift`; Android overlay in 10 game screens (`GameFeedbackToast` files: CrosswordScreen, GameScreen, RegionsScreen, SpyglassScreen, MuddleScreen, CodebreakerScreen, SudokuScreen, HubScreen, KindredScreen, LadderScreen) plus the definition in `FeedbackToast.kt` and a use in `PiecesKit.kt`.
- Distinct in-game message strings across the games (web `flash`/`setError`/`setMessage`, grep): about 60, of which about 35 are the same text on all three platforms.
- Inline (layout-shifting) messages in a game: 1 (pvp-game.tsx). Other inline messages are form feedback or empty labels (section 4).
- Pocket games: 1 web error path, 1 iOS prompt, 0 Android status strings found (pocket copy not fully traced).
- Games not fully traced in this pass (display or string not confirmed): Starsweep (web/iOS/Android), Octoword, Succession, Deliverance (iOS and Android), ProperNoundle Android, pocket Android.
