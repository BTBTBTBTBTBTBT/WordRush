# Wordocious — Android Functional/UX Parity Spec (Build-To Reference)

*Created 2026-06-05 from a 6-agent parallel audit of the iOS SwiftUI app (`apps/ios`), the engine (`apps/ios/Sources/Core`), and the realtime server (`apps/server`). **iOS is the source of truth** (it mirrors `apps/web`). This is the build-to checklist for the native Android app — implement against it and verify each item, so we never repeat the web→iOS rework (missing functionality, games misbehaving, completed screens not rendering).*

> How to use: build each Android surface against its Part below, then check it off. The **Master Rework Hot-Spots** are the things that bit us on iOS or are easy to miss — review them before *and* after building each surface. Companion to `WORDOCIOUS_ANDROID_BUILD_PLAN.md`.

---

## ★ MASTER REWORK HOT-SPOTS (read first; verify every one)

1. **`simpleHash` is a 32-bit signed rolling hash with overflow** (`hash = ((hash<<5) - hash) + char`, wrap to i32, `abs`). Diverging here desyncs **every** puzzle from web/iOS. **Validate the Kotlin engine against the shared JSON fixtures before building any UI.**
2. **Daily reset is LOCAL midnight** (`todayLocal()` = device-local `yyyy-MM-dd`), not UTC. Every freemium gate, countdown, streak-risk check keys off it. (Exception: Word-of-the-Day uses a UTC day index.)
3. **Time units:** **milliseconds on the socket wire**, **SECONDS in `user_stats`/`matches`/`daily_results`**. Convert `round(ms/1000)`.
4. **Two-phase non-gauntlet finish:** hold the in-play board → animate the final row flip → VictoryOverlay springs in over the dimmed board (`delay = revealDuration + 0.2`) → tap-to-continue builds the heavier stats screen. A **resumed already-finished** game skips straight to stats (`revealComplete=true` on appear).
5. **Gauntlet never uses VictoryOverlay** — it renders `GauntletResultsView` immediately (win OR loss) with its own animated entrance, and must **never** show a flat board grid. Resolution chain for re-entry: local session → server `gauntlet_stages` → **deterministic replay** (`GauntletReconstruct`). The generic board branch is explicitly gated `mode != gauntlet`.
6. **`CompletedDailyCard` per-mode state reset** (`localBoards=nil; gauntlet=nil; data=nil`) on every mode switch — without it, Gauntlet's stage data leaks under Classic etc.
7. **Completed-board reconstruction:** local-session-first, else matches-row reconstruction (**SEQUENCE splits the flat guess list sequentially**; other multi modes apply shared guesses to all boards). `CompletedMiniBoardView` renders **each board's OWN guesses** (Sequence/Rescue correctness).
8. **Sequence masking is presentational only** — the engine still evaluates every board via `applyToAll`; locked future boards show `•` bullets at 0.6 opacity; keyboard colors from the **active board only**; Sequence uses the **standard** keyboard (NOT quadrant).
9. **Rescue/Deliverance: ANY single board loss = whole game LOST** (unlike Quad/Octo, which wait for all boards to resolve).
10. **Guess bonus applies to hint modes only** (Six/Seven/ProperNoundle); completion bonus = `(boardsSolved/total)*200`; hint penalties 150/150/120.
11. **Tile flip = `scaleY` squash (orthographic), not 3D rotation**; per-tile stagger; only the freshly-committed latest row flips. **Multi-board tiles are non-square in-play**; **Octo = 4 columns** (4×2). **OctoWord tap-to-zoom** = deterministic scale+offset morph from the tapped slot, stays playable.
12. **Keyboard: Delete LEFT / Enter RIGHT.** Keyboard uses darker **600-weight** colors; board tiles use **500-weight**; hint-used = gray `#D1D5DB`. **Quadrant keyboard excludes Sequence.**
13. **Login-required** (no anonymous gameplay); **banned check on every signed-in transition**; Pro gated via **`isProActive`** (expiry-aware), never raw `is_pro`.
14. **`is_pro`/`pro_expires_at` are server-written ONLY** (Play RTDN webhook) — client never self-grants. **Shields granted only on new monthly/yearly purchases (4)** — never on launch reconcile or day-pass.
15. **VS:** `presenceId = "u:<userId>"` on **both** the presence and match sockets (dedupes a person to 1); **`recordMatch` true for player1 only** (single shared `matches` row); **rematch = both emit `offer_rematch`** (no `accept_rematch`), always a **fresh random seed**, **Pro-only**; daily-VS seed uses mode string **`"DUEL_VS"`** (not `DUEL`).
16. **Best-effort writes for newer columns** (`gauntlet_stages`, `social_links`) — must no-op if the column is absent, never break the base insert.
17. **Lowercase the session UUID** for client-side compares (`winner_id == uid`) and storage paths.
18. **Copy is load-bearing** — reproduce InfoPages/Help/modal strings verbatim, including the intentional "9 modes" (Help/Pro) vs "10 modes" (About) divergence.
19. **ProperNoundle is a SEPARATE engine** (variable answer length, category round-robin daily selection w/ epoch 2024-01-01 UTC, FNV-1a 64-bit for VS seeds); it has **no** `SolvedPuzzleView` re-entry path (the leaderboard card uses the generic single-board branch).
20. **Reduced motion gates ALL animations** (flip, shake, confetti, glow, zoom, toasts, victory spring) — read both the OS setting and the app's `pref-reduced-motion`.

---

# PART 1 — Game Modes (mechanics / functional spec)

Source of truth: `apps/ios/Sources/Core/` + `apps/ios/Wordocious/Sources/`. The engine is a pure reducer (`gameReducer`) over an immutable `GameState`; all UI modes except **ProperNoundle** run through it. ProperNoundle uses a separate engine (`ProperNoundleEngine.swift`).

## Cross-cutting foundations (read first)

**Enums/types (`Types.swift`):** `GameMode` raw strings `DUEL, MULTI_DUEL, GAUNTLET, QUORDLE, OCTORDLE, SEQUENCE, RESCUE, TOURNAMENT, PROPERNOUNDLE, DUEL_6, DUEL_7` (MULTI_DUEL/TOURNAMENT exist in the engine but are NOT shipped daily modes — keep off home). `TileState: CORRECT, PRESENT, ABSENT, EMPTY, HINT_USED`. `GameStatus: PLAYING, WON, LOST, ABANDONED`. `BoardState { solution, guesses:[String], maxGuesses, status, prefilledGuesses?, hintEvaluations?:[String:GuessResult] }` (`hintEvaluations` keyed by **row-index-as-string**). `GameState { mode, seed, startTime(ms), boards, currentBoardIndex, status, gauntlet? }`.

**Evaluator (`Evaluator.swift`) — port exactly:** two-pass: (1) mark exact-position `CORRECT`, consume those solution slots; (2) for remaining tiles, first unused solution slot with same letter → `PRESENT`, else `ABSENT`. Case-insensitive. **Fatal if guess length ≠ solution length** — callers must length-gate.

**Seed/determinism (`Seed.swift`) — most parity-critical file:** `simpleHash` = JS-compatible 32-bit, `hash=(hash<<5)-hash+char` with i32 wrap then `abs`. `generateSolutionsFromSeed(seed,count)`: for i in 0..<count, key=`"{seed}-{i}"`, `index=simpleHash(key)%solutionCount`; on collision re-hash `"{seed}-{i}-{attempt}"` (max solutionCount tries); track `used`. `generateSolutionsFromSeedForLength(...)` same but length-specific dict (Six/Seven). `generateDailySeed(date,mode)`=`"daily-{date}-{mode}"` (date=local `YYYY-MM-DD`). `isDailySeed`=starts with `"daily-"`.

**Dictionary (`Dictionary.swift`):** default = 5-letter allowed (validation) + solutions (answers). Length-specific dicts for 6 and 7; `isValidWord` routes by `word.count`. Uppercased.

**Daily seed / 1-play limit:** `DailySeed.today(mode)`; puzzles reset local midnight. The 1-play/day gate is **UI/server-side, not in the engine** — a free user with a `daily_results` row for the mode today sees the card greyed. Pro = unlimited; revisiting opens the solved-puzzle review. Recording keyed `(user_id, day, game_mode, play_type='solo')`, **best-score-wins upsert** (never downgrades). Unlimited games update `user_stats`+XP+match row but write **no** `daily_results`. Unlimited seed = `"unlimited-{mode}-{epochSeconds}"`.

**Composite scoring (`DailyScoring.swift`) — identical to web `lib/daily-service.ts`:**

| Mode | maxGuesses | guessWeight | timeCap(s) | totalBoards | hintCost |
|---|---|---|---|---|---|
| DUEL | 6 | 100 | 300 | 1 | — |
| QUORDLE | 9 | 50 | 600 | 4 | — |
| OCTORDLE | 13 | 30 | 900 | 8 | — |
| SEQUENCE | 10 | 60 | 480 | 4 | — |
| RESCUE | 6 | 80 | 480 | 4 | — |
| GAUNTLET | 44 | 20 | 1800 | 21 | — |
| PROPERNOUNDLE | 6 | 100 | 300 | 1 | 120 |
| DUEL_6 | 7 | 90 | 360 | 1 | 150 |
| DUEL_7 | 8 | 80 | 420 | 1 | 150 |

Formula: `base = completed?1000:0`; `guessBonus = (completed && hasHints) ? max(0,maxGuesses-guessCount)*guessWeight : 0` (**hint modes only**); `timeBonus = completed ? max(0,timeCap-timeSeconds) : 0`; `completionBonus = (boardsSolved/max(1,totalBoards))*200`; `hintPenalty = hasHints ? hintsUsed*hintCost : 0`; `total = round2(max(0, base+guess+time+completion-hint))`. `hasHints ⇔ hintCost != nil`.

**Timer:** active-play accumulation (pauses on background, persists across relaunch); game-start ad runs first, then timer starts; `finalTimeSeconds` frozen at completion.

**Input rules (reducer-backed modes):** type/delete/submit gated to `currentInput.count == wordLength`. Reject (toast + invalid sound + `shakeCount++`) on: not enough letters / not in word list / already-guessed on the active board. Multi-board submits `applyToAll:true`; single-board → board 0. Sequence duplicate-check uses the **active** board index.

## 1. Classic / Duel — `DUEL`
1 board · 6 guesses · len 5 · standard kbd. Win = board 0 correct; loss = 6 used. `gameStatus = boards[0].status` (mirrors board 0; no "all boards" logic). No hints/prefill. Score: no guessBonus; 1000(win)+timeBonus(cap300)+200. Accent `#7C3AED`.

## 2. Six — `DUEL_6`
1 board · 7 guesses · len **6** · standard · 6-letter dict. Win/loss = board 0. **Vowel+Consonant hints** (`hasHints`): each picks a random un-guessed vowel/consonant in the solution, reveals it at all positions (`CORRECT`), others `HINT_USED` gray; **consumes a guess row** (`submitHint`, stored in `hintEvaluations[rowIndexString]`; reaching maxGuesses → LOST). If none of that type remains: mark used, reveal `"—"`/"No vowels left", **add no row**. Each hint once; button state persisted `wordocious-hints-{mode}-{seed}`. Score: guessBonus `max(0,7-g)*90`; hintCost 150; `hintsUsed = hintEvaluations.count`; cap 360. **Hint rows must NOT be re-evaluated as real guesses** — use stored `hintEvaluations`. Accent `#06B6D4`.

## 3. Seven — `DUEL_7`
Like Six but: 8 guesses · len **7** · 7-letter dict · guessWeight 80 · cap 420. hintCost 150. Accent `#84CC16`.

## 4. QuadWord — `QUORDLE`
**4** boards · 9 (shared) · len 5 · **quadrant** kbd. Every guess applies to all still-playing boards (`applyToAll`); completes when all 4 non-playing; WON iff all won else LOST. Solved board → green frame+✓; finished unsolved → red frame. Quadrant keyboard `useQuadrantKeyboard = mode != .sequence && boardCount>1`. Score: no guessBonus; completionBonus partial (counts won boards even on loss); cap 600. Accent `#EC4899` (roman "IV").

## 5. OctoWord — `OCTORDLE`
**8** boards · 13 · len 5 · quadrant. Same completion path as Quad. guessWeight 30, cap 900. Accent `#7E22CE` (roman "VIII").

## 6. Succession / Sequence — `SEQUENCE`
**4** boards · 10 (shared) · len 5 · **standard** kbd (NOT quadrant). Same reducer completion as Quad/Octo but played **one board at a time**: `sequenceActiveIndex` = first PLAYING board; only active + done boards show colors; **future locked boards** dimmed 0.6 + prior guesses rendered as masked `•` bullets; active board yellow border `#FACC15`; keyboard colors from the **active board only**; duplicate-check uses active index. guessWeight 60, cap 480. **Masking is presentational** (engine still evaluates all boards via applyToAll) — get it right or it leaks answers. Accent `#2563EB`.

## 7. Deliverance / Rescue — `RESCUE`
**4** boards · 6 (shared) · len 5 · **quadrant**. Different completion: **WON when all 4 won; LOST as soon as ANY one board loses** (stricter than Quad/Octo). **Prefilled rows:** each board gets 3 deterministic words (`generatePrefillWords`: pool=5-letter allowed; for i in 0..<3 key `"{seed}-prefill-{i}-{attempt}"`, `index=simpleHash%pool`, re-roll if word == any solution, max 100) evaluated per-board, revealed, **do NOT consume the 6-guess budget**, rendered above guess rows. Score: guessWeight 80, cap 480, no guessBonus, partial completion. Prefill determinism needs `simpleHash` parity + identical allowed-words ordering. Accent `#059669`.

## 8. Gauntlet — `GAUNTLET`
5 stages, **21 total boards**, budget 44 (scoring), cap 1800. Keyboard per-stage (quadrant when stage boardCount>1 & not sequence).

| idx | name | baseMode | boards | maxGuesses | sequential | prefill |
|---|---|---|---|---|---|---|
| 0 | The Opening | DUEL | 1 | 6 | no | no |
| 1 | QuadWord | QUORDLE | 4 | 9 | no | no |
| 2 | Succession | SEQUENCE | 4 | 10 | **yes** | no |
| 3 | Deliverance | RESCUE | 4 | 6 | no | **yes** |
| 4 | OctoWord | OCTORDLE | 8 | 13 | no | no |

All 21 solutions generated up front (`generateSolutionsFromSeed(seed,21)`); each stage takes its contiguous slice. `GauntletProgress{currentStage, totalStages:5, stages, stageResults[], stageStartTime, stageStartElapsedMs, allSolutions, blackoutCount}`. **Stage cleared:** all boards WON while PLAYING → transition overlay → tap Continue → `nextStage` (records `GauntletStageResult{stageIndex, status:.won, guesses:max boardGuesses, timeMs, boardsSnapshot}`; if next≥total → game WON; else builds next stage). **Stage fail (auto in `submitGuess`):** any board LOST & not all WON → record failed result + game LOST immediately. `stageGuesses` = max across the stage's boards; stage timing prefers `elapsedMs - stageStartElapsedMs`. Engine also supports `stealGuess` (per board `maxGuesses = max(guesses+1, maxGuesses-1)`) and `blackoutRestart` (LOST board → replacement solution `"{seed}-blackout-{n}"`). Scoring: `guesses = Σ stageResults.guesses + (not completed ? current max : 0)`; `solved = Σ (won stage→boardCount, lost→won-boards-in-snapshot)`; `total = Σ recorded stage boardCounts`; on WON the final nextStage already pushed the last stage (current=0, avoid double count). Header = 5-node stepper (done=green✓, active=purple play+glow, future=number). Accent `#D97706`.

## 9. ProperNoundle — `PROPERNOUNDLE` (separate engine)
1 board · **6** guesses · **variable** length (normalized answer, ≤15) · standard kbd. Puzzles from `propernoundle-puzzles.json` (`{id,answer,display,category,themeCategory?,hint?,wikiTitle?}`, filtered ≤15). **Daily selection (deterministic):** group by `themeCategory` (default "general"), categories sorted alpha → cycle; `day = daysSinceEpoch(date)` epoch **2024-01-01 UTC**; `cat = cycle[day%count]` (positive mod), `idx=(day/count)%list.count`. VS variant uses **FNV-1a 64-bit** of the seed `% all.count`. **Normalize:** lowercase, strip diacritics+spaces, keep alnum + `'` `-`. `wordGroups(display)` = per-token normalized lengths (tile-group layout). Win = all correct; loss = 6 used. **3 hints:** Clue (Wikipedia summary first-2-sentences name-redacted via `WikipediaHint.fetch`, fallback `puzzle.hint`/`"Category: X"`, shown as italic header), Vowel/Consonant (random unique letter revealed as a board row; "None" if exhausted). `hintsUsed = count{clue, vowel, consonant}`. Score: guessBonus `max(0,6-g)*100`, hintCost **120**, cap 300. Daily seed `generateDailySeed(today,"PROPERNOUNDLE")`. Accent `#DC2626`. Marked `mode:nil` in the home catalog (own view).

---

# PART 2 — In-Game UX, Board Rendering, Keyboard, Animations

All values verbatim from SwiftUI. Brand typeface **Nunito** (ExtraLight→Black). Tile/keyboard colors are FIXED (only colorblind mode changes them); surface/text/border are theme-driven. Reduced-motion gates ALL animation.

## Nav / immersive chrome
Game screens are **full-screen immersive**: bottom nav HIDDEN while any game/solved-puzzle screen is up (track by a **per-screen ID set**, not a counter — counters drift and let the bar bleed back). No system back chrome. **Corner Home button** top-leading (pad 8/8): 44×44 circle, `Theme.surface` fill, 2pt accent stroke, `house.fill` size 20 accent, two shadows (accent@0.2 r0 y2 + black@0.08 r12 y4); visible in play AND post-game; dismisses. **Gauntlet-only sound toggle** top-trailing (same style; `speaker.wave.2.fill`/`speaker.slash.fill`, persists `pref-sound`). Background = vertical gradient `Theme.background`→`backgroundGradientEnd` (default `#F8F7FF`→`#F3F0FF`). Root `GeometryReader` measures the board area. Game VStack outer h-padding **10pt**.

## Tiles — geometry & colors (`TileView`)
Params: letter, state, revealed, size(=58), height?(non-square fill), isInvalid. `h=height??size`, `s=min(size,h)`. Corner `s*0.14`; font Nunito Black `s*0.5`; border `min(2,max(1,s*0.09))`.

| Condition | Text | Background | Border |
|---|---|---|---|
| isInvalid | `#EF4444` | `#FEF2F2` | `#F87171` |
| filled && revealed | white | `tileColor(state)` | absent→`#D1D5DB`, else `borderAlt` |
| empty/not revealed | `textPrimary` | white | `#D1D5DB` |

`tileColor` (FIXED): correct `#22C55E` (CB `#F5793A`), present `#EAB308` (CB `#85C0F9`), absent `#6B7280`, **hintUsed `#D1D5DB`** (NOT present color), empty clear→white. Colorblind (`pref-colorblind`) swaps correct→orange, present→blue on tiles AND keyboard.

## Board rendering
**Row composition per board:** prefilled rows (revealed, no budget) → guess rows `0..<maxGuesses` (committed=revealed eval, animate flip only if `fresh` = latest row committed live this session via `seenGuessCount` captured on first appear; current-input row = live typing with invalid-red + shake; empty filler). Intra-board spacing = `fillGap ?? tileSize*0.1`.

**Multi-board fill layout** (`BoardLayout.multiGrid`): cols = `n<=1?1 : n<=4?2 : 4` (**Octo = 4×2**); `boardRows=ceil(n/cols)`; **boardGap=8**, **tileGap=2**, **framePadTotal=8**. Math:
```
cellW  = (availableWidth - (cols-1)*8) / cols
tileW  = max(6, (cellW-8 - (wordLen-1)*2) / wordLen)
rows   = rowsPerBoard           // max over boards of (prefilled + maxGuesses)
cellH  = fitHeight!=nil ? (fitHeight-(boardRows-1)*8)/boardRows : nil
tileH  = max(6, cellH!=nil ? (cellH-8-(rows-1)*2)/rows : tileW)
```
In-play (`fitHeight` set) tiles are **non-square** (fill); post-game (ScrollView, no fitHeight) square. Each board framed `width=cellW` with `tileSize=tileW, tileHeight=tileH, fillGap=2`.

**Single-board sizing** (`fittedTileSize`): largest square fitting width & height; `framePad = boardCount>1?12:0`; `maxTile` caps 58/46/38/32 (1/2/4/8 boards); colSpacing 10, rowSpacing 14.

**Per-board card frame** (`SolvedBoardFrame`, multi-board only, `.padding(4)` reserved even when neutral): won border `#4ADE80`/fill `#F0FDF4`; lost `#F87171`/`#FEF2F2`; neutral active `#E5E7EB`/white; single board = no frame. **✓ badge** (won) top-trailing: `clamp(tileSize*0.7,13,20)` white check on `#22C55E` circle, offset `+0.3/-0.3` of badge.

**Sequence per-board:** `seqActive` (active or done) shows colors; `seqLocked` (sequence & !active & !done) → opacity 0.6 + committed rows masked as `•`; active border `#FACC15`; keyboard from active board only; no quadrant.

## Animations
- **Tile-flip** (`TileFlip`): orthographic — `angle = (p<0.5?p:1-p)*180`, `scaleY = cos(angle)` (1→0→1), final color throughout (no face swap), cheap 2D scaleY. easeInOut. Full board (single): dur **0.5s**, stagger **0.15s**. Mini (multi): **0.3s**/**0.08s**. Only the freshly-committed latest row animates. Reduced-motion → snap.
- **Shake** (`ShakeEffect`): `translateX = 4*sin(d*π*6)` (±4px, 3 osc), `.animation(.linear(0.4), value: shakeCount)`.
- **Live invalid red row:** current input full-length & (not valid OR already-guessed) → non-empty tiles render `isInvalid`.
- **Victory/game-over (non-gauntlet):** final flip first → on status change haptic+sound → after `revealDuration+0.2` spring in `VictoryOverlay` over dimmed board (`.scale(0.92)+.opacity`, spring 0.5/0.82) → tap-to-continue builds finished/stats screen. Resume-finished sets `revealComplete=true` onAppear. **VictoryOverlay:** dim `#18182E@0.6` + ConfettiView; card rounded16 surface + 1.5pt border + shadow, max 380; 6pt accent bar gradient `[#A78BFA,#EC4899,#FBBF24]`; title Black 36 ("VICTORY!" gradient / "GAME OVER" `#F87171`); single→solution + DefinitionCard, multi→word grid; stat blocks (Boards if multi / Guesses / Time); "Tap anywhere to continue" `#C4B5FD`; tap dismisses; `Haptics.success()` on appear. **ConfettiView:** 40 rects 8×12, colors `[#A78BFA,#EC4899,#FBBF24,#22C55E,#60A5FA]`, easeIn 1.8s staggered, fall + spin + fade, once.
- **OctoWord tap-to-zoom** (`boardCount>4 && fitHeight`): tap → `zoomProgress 0→1` (`spring 0.45/0.82`); tapped mini hidden; overlay = dim `black@(0.6*p)` (tap dismiss) + enlarged playable board, `maxScale = max(1, min(availW*0.96/cellW, areaH*0.96/cellH))`, `s = 1+(maxScale-1)*p`, `dx=(srcMidX-availW/2)*(1-p)`, `dy=(srcMidY-areaH/2)*(1-p)` → at p=0 overlays the slot, p=1 centered full size; stays playable; dismiss reverses then clears after 0.5s.
- **Gauntlet active-stage glow** (`StageGlow`): pulsing `#A855F7` shadows base(on?0.6:0.3, r on?7:3)+outer(0.25, r12 when on), easeInOut 1.25s repeatForever autoreverse (=2.5s cycle). Reduced-motion → static.
- **Gauntlet stage-transition overlay** (`stageCleared`): full `black@0.8`, keyboard hides; green check circle; "STAGE COMPLETE" + completed name; "NEXT UP" + next name gradient + "{n} board(s)·{g} guesses[·sequential][·pre-filled clues]"; **auto-advances 2.5s** or tap; `.opacity` transition.
- **XP/level-up toast** (`xpResult`): top pill gradient `[#7C3AED,#6D28D9]`, star `#FDE047`, "+N XP" + "+N streak"/"+N daily" chips + "Level up! Lv.N"; spring in from y-80, **auto-dismiss 3s**, non-interactive.
- **Toasts:** Bold 12 white on `Theme.textPrimary` rounded8, top pad 90, 1.5s (1.4s PN), `.easeInOut(0.2)`.
- **Reduced motion** (`Theme.animation` → nil when on; `pref-reduced-motion` + OS) snaps everything.

## Keyboard
3 rows QWERTYUIOP/ASDFGHJKL/ZXCVBNM; row spacing 7, key spacing 5, outer h-pad 4. **Delete LEFT, Enter RIGHT.** Letter key `maxWidth∞ × 52`, rounded6, Nunito Bold 18. Action keys (`⌫`,`ENTER`) fixed 54×52, `keyDefault #E8E5F0`, Bold 14 (PN uses `delete.left` icon). Every press: type/delete/submit + `Haptics.tap()` + key-tap sound.

**Letter color states (`keyColor`) — darker 600-weight than tiles:** correct `#16A34A` (CB `#E8612A`), present/hintUsed `#CA8A04` (CB `#6AAEF0`), absent `#9CA3AF`, default `#E8E5F0`. Text white when stateful else `textPrimary`. `keyState` merges best state per letter (correct>present>absent); Sequence colors from active board only.

**Quadrant keyboard** (`mode != .sequence && boardCount>1` — Quad/Octo/Deliverance): per-letter grid of sub-cells, `cols = count<=4?2:4`, each `quadColor(boardState[letter])`: correct `#22C55E`, present `#EAB308`, absent `#9CA3AF`, nil `#E8E5F0`. All-absent → solid `#9CA3AF`. Letter overlaid Bold 18, white if `hasAny` (with shadow) else `#374151`. Frame `maxWidth∞×52`, rounded6, 1.5pt border. Sub-cells use board-tile (500) palette, NOT colorblind-swapped.

## Hints UI
**Six/Seven** (`hasHints && playing`): two pills between board & keyboard; accent Seven lime `#84CC16` / Six cyan `#06B6D4`; "💡 Vowel"/"Vowel: X"/"No vowels left"; unused = accent text/`accent@0.08` bg/1.5pt accent border; used = muted/`#F3F4F6`/disabled. **ProperNoundle:** 3 capsule pills Clue/Vowel/Consonant (Clue `#9333EA`/`#D8B4FE`/`#FAF5FF` lightbulb→hourglass; Vowel `#2563EB` eye; Consonant `#16A34A` number); clue renders in header italic SemiBold 12.

## Headers
**Standard:** title Black 28 in `ModeStyle.gradient`, below `progressLabel` + live `M:SS` clock (1s ticker). **Gauntlet:** stepper (nodes + connectors) + stage name Black 18 per-stage gradient + subtitle (trophy solved + guesses + time, hidden when stageCleared).

**Mode accents/titles (`ModeStyle`):** titles CLASSIC/CLASSIC SIX/CLASSIC SEVEN/QUADWORD/OCTOWORD/SUCCESSION/DELIVERANCE/GAUNTLET/PROPERNOUNDLE. accents duel `#7C3AED`, duel6 `#06B6D4`, duel7 `#84CC16`, quordle `#EC4899`, octordle `#7E22CE`, sequence `#2563EB`, rescue `#059669`, gauntlet `#D97706`, propernoundle `#DC2626`.

---

# PART 3 — Completed / Post-Game / Results Surfaces (highest rework risk)

## Shared data model
`GameMode` raw = Supabase keys (persist/query by raw). `BoardState` carries its OWN guesses + `hintEvaluations[rowIndexString]`. `GauntletStageResult{stageIndex,status,guesses,timeMs,boardsSnapshot?}`. `GameState` is Codable → persisted to disk. Scoring config + formula per Part 1.

## 1. In-game post-game (non-gauntlet) — `GameScreen.swift`
Sequencing: status→won/lost (not gauntlet) → haptic+sound → after `delay = reduceMotion?0:revealDuration+0.2` spring `showVictory` (board stays for the final flip) → tap dismiss `showVictory=false; revealComplete=true` → build finished ScrollView. Resume-finished: onAppear `revealComplete=true` (no replay). **Finished layout:** `FinishedStatsHeader` → `if isDaily { DailyRankBadge }` → `BoardLayout(width-20)` (square) → `ScoreBreakdownView` → `if boardCount==1 { DefinitionCard(showWord:false) }`. Persistent corner Home + (gauntlet) sound toggle + toast + XP toast. Stats fed: `guessCount=rowsUsed` (board 0), `maxGuesses`, `timeSeconds=elapsedSeconds`, `boardsSolved=won count`, `totalBoards`, `hintsUsed=board0.hintEvaluations.count`.
- **FinishedStatsHeader:** gradient title; stat row (trophy boardsSolved/total if multi; guesses; clock time); summary line green/`#F87171`; Home + optional Share links.
- **DailyRankBadge:** `LeaderboardService.userRank(mode,uid,"solo")`; **hidden unless total≥2**; "Top {top}% · #{rank} of {total}"; gold when ≥75th pct.
- **ScoreBreakdownView:** "SCORE BREAKDOWN" + "{total} pts"; rows Win bonus/Did not finish, Guess bonus (hint modes), Time bonus, Completion bonus, Hint penalty (red `−`).
- **DefinitionCard:** dictionaryapi.dev; single-board only; **always populates** (else "No definition available"); `showWord:false` live / `true` on re-entry.

## 2. ProperNoundle post-game — `ProperNoundleView.swift`
Finish → VictoryOverlay(`solution=display`). Layout: header (category pill + "{n} letters" + clue) + NoundleBoard + result ("🎉 Solved in N!" / "Out of guesses"; display in red; Home/Share `#DC2626`; DailyRankBadge; ScoreBreakdownView hintsUsed). **No DefinitionCard.** `hintsUsed = count{clue,vowel,consonant}`. **No SolvedPuzzleView re-entry** — leaderboard card uses the generic single-board flat-matches reconstruction.

## 3. Gauntlet results — `GauntletResultsView` (shared by in-game finish, re-entry, leaderboard card)
In-game: `vm.isFinished && isGauntlet` → render `GauntletResultsView` immediately (NOT the revealComplete/Victory flow). Animated entrance (`RiseIn` opacity+offset staggered; icon springs). Layout: icon (trophy `#D97706` won / xmark `#F87171` lost, 60) → title ("GAUNTLET CLEARED!" gradient / "GAUNTLET FAILED" `#FCA5A5`) → Home/Share → `if isDaily DailyRankBadge` → 3 stat cards (Stages `{cleared}/{total}`, Guesses, Time) → `ScoreBreakdownView("GAUNTLET", boardsSolved:cumBoards, totalBoards:cumTotal)` → `GauntletCompletedView(showSummary:false, showStageHeader:true)`. Computed: `cleared`, `totalGuesses=Σguesses`, `totalTimeMs=Σtimits||elapsedFallback`, `cumBoards=Σ(won?boardCount:snapshot won)`, `cumTotal=max(1,Σ boardCount)`. **GauntletCompletedView:** per-stage rows (✓/✗ badge, name, "{g}g·{time}", chevron if snapshot) tap-expand → `solutionsReveal` (answer pills green/red) + `stageBoards` (mini boards). Same screen for win AND loss.

## 4. Re-entry "View Solved" — `SolvedPuzzleView.swift`
Branch order: `!loaded`→spinner; `gauntlet && gauntlet!=nil`→`GauntletResultsView`; `data!=nil && mode != .gauntlet`→standard finished ScrollView; else error card. Corner Home always.
**Non-gauntlet boards fallback:** (1) local `GamePersistence.load` (won/lost) → `localBoards` (correct for every mode); (2) `MatchStatsService.solvedDaily` → `CompletedBoardReconstruct.boards(mode,solutions,guesses,maxGuesses)` (SEQUENCE splits sequentially; others share). **Gauntlet fallback:** (1) local `state.gauntlet`; (2) server `gauntletStages` → `GauntletProgress`; (3) `GauntletReconstruct.reconstruct(seed,guesses)` deterministic replay. **🚨 Gauntlet must NEVER hit the generic flat-grid branch** (gated `mode != .gauntlet`).

## 5. Leaderboard `CompletedDailyCard.swift`
Current-user only; shows if a daily result exists. Header: accent bar (green won/gray attempted), ✓/✗ + "COMPLETED/ATTEMPTED TODAY" + `summaryLabel` + chevron. Expanded gauntlet → `GauntletCompletedView` + score breakdown; non-gauntlet → boards + (single) solution + Guesses/Time + ScoreBreakdownView. **🚨 `.task` first does `localBoards=nil; gauntlet=nil; data=nil`** (per-mode reset → no cross-mode leak), then local→solvedDaily→gauntlet chain; `expanded=false`. `data==nil` → render nothing (`Color.clear height 0`, keeps `.task` running).

## 6. Shared completed renderers — `BoardView.swift`
`CompletedMiniBoardView`: row r = `board.guesses[r]` via `hintEvaluations[String(r)] ?? evaluateGuess` (**own guesses**); `SolvedBoardFrame`. `CompletedBoardLayout`: cols 1/2/4, maxWidth 200/240/320. `CompletedBoardReconstruct`: SEQUENCE splits sequentially, others shared. `GauntletReconstruct`: replay through `gameReducer` + `.nextStage` on all-won, safety cap 1000.

## 7. Share — `ShareCardView`/`ShareService`
Kinds single(1080²)/multi(1080² or 1080×1350 if >4)/gauntlet(1080×1350). Card: "WORDOCIOUS" wordmark + mode label + stats+Win/Loss pill + boards/stage chips + "wordocious.com". Render→PNG, upload `share-images/{uid-lower}/{ShareMode}-{date}.png`, build `wordocious.com/s/{key}?...` for OG scraping, share `[image,url]`. Share grid includes prefilled rows + hint evals, padded.

## Cross-device / empty / error matrix
| Surface | Cross-device (no local) | Empty/error |
|---|---|---|
| SolvedPuzzleView | matches-row reconstruction | error card |
| CompletedDailyCard | server stages / replay | renders nothing |
| DailyRankBadge | leaderboard query | hidden (<2 / signed out) |
| DefinitionCard | dictionaryapi | "No definition…" |

## Persistence + Supabase (this area)
Local: `applicationSupport/games/wordocious-{MODE}-{seed}.json` (full GameState incl gauntlet); elapsed UserDefaults `wordocious-elapsed-{MODE}-{seed}`; `cleanupStaleDailyGames` at launch. Supabase: `daily_results` (written best-score-wins), `matches` (`player1_guesses, solutions, winner_id, player1_score, player1_time, hints_used`, + `gauntlet_stages` jsonb best-effort), `solvedDaily` filters player1_id+game_mode+seed limit1. **uuid lowercasing** for compares + storage paths.

---

# PART 4 — Home / Leaderboard / Profile / Records Tabs

## Global
Every tab root = vertical gradient + `AppHeaderView` + `.adBanner()` (free only, inside NavStack). Pro gate = expiry-aware `isProActive`. "today" = local `yyyy-MM-dd`. Tab tap `Haptics.tap()`.

## Bottom nav (`RootTabView`)
Custom bar (system tab bar hidden), 4 tabs persist state. Item: icon(20) + label(`font(10,.heavy)`) + 4px dot. Active = filled icon + `Theme.primary` + filled dot; inactive = outline + `textMuted` + clear dot. Home=house, Leaderboard=trophy, Profile=person, Records=crown. Bar bg `Theme.background` + 1.5px top hairline. Re-tap active Leaderboard pops to root; leaving Leaderboard clears its stack (path hoisted to parent). **Hidden** whenever any immersive screen is up (per-screen ID set). Games present as `fullScreenCover` OVER the nav.

## Shared header (`AppHeaderView`)
HStack: Wordmark "WORDOCIOUS" (wordmark 20, gradient, minScale 0.6) · PRO badge (if Pro, "PRO" Black 9 white on `#F59E0B`→`#D97706` capsule) · Spacer · Help (32×32 circle `questionmark`) → HelpView sheet · Settings (`gearshape.fill`) → SettingsView · Daily-streak pill (if `dailyLoginStreak>0`: flame `#F97316` + count `#92400E` on `#FFFBEB`→`#FFF7ED`, tap→Current/Best popover) · Shield pill (shield `#8B5CF6` + `streakShields` `#5B21B6`, tap→Available popover). Source: live `Profile`.

## HOME (`HomeView`)
Order: pending-invites banner → (Pro) play-mode toggle → hero slot (fixed 78pt: UnlimitedHero / Sweep-Flawless banner / DailyChallengeHero) → Word of the Day → "GAME MODES" header → 9 mode cards (LazyVGrid 2-col) → live-players bar → sign-out → footer links. Overlays: ModeLimitModal, proPromptBanner, StreakShieldModal.
- **Pending invites:** if ≥1; first invite card (envelope `#EC4899`, "@{inviter} invited you to {Mode}", "+N more pending", Play→VSGameView, X→decline). Data `match_invites` (invitee_id=me, pending, expires>now).
- **Play-mode toggle** (Pro only): "Daily | Unlimited" capsule; `pref-play-mode`; free forced Daily.
- **Hero:** Unlimited→"∞ Unlimited Play ∞"; allDone→Sweep ("Daily Sweep!" `#A78BFA`→`#EC4899`, "+200 XP") / Flawless ("Flawless Victory!" `#D97706`→`#B45309`, "+600 XP") + "Next puzzles in HH:MM:SS"; else→DailyChallengeHero ("★ Daily Challenge ★", "9 puzzles · Leaderboards & medals", "Resets in HH:MM:SS").
- **Word of the Day:** NOT Supabase — deterministic by UTC day index over solutions, try ≤20 until a dictionaryapi.dev definition resolves; loading placeholder.
- **9 mode cards** (`ModeCatalog`, exact order): Classic(DUEL `#7C3AED`), VS Battle(`#0D9488`, swords), QuadWord(QUORDLE `#EC4899` IV), OctoWord(OCTORDLE `#7E22CE` VIII), Succession(SEQUENCE `#2563EB`), Deliverance(RESCUE `#059669`), Six(DUEL_6 `#06B6D4`), Seven(DUEL_7 `#84CC16`), Gauntlet(`#D97706` skull), ProperNoundle(`#DC2626` crown). Card: accent top bar(4pt), icon box(32), played→W/L badge + "{guesses} guesses · {time}", else desc; done styling (accent@0.06 bg); locked styling (gray, opacity 0.6). **Lock:** Pro never; VS = `VSPlayLimit.hasPlayedToday()`; others = daily completion exists. **Tap routing:** locked→ModeLimitModal; Pro revisiting→SolvedPuzzleView; Unlimited→`resolvedUnlimitedSeed`; Daily→`DailySeed.today`; ProperNoundle→ProperNoundleView; VS→VSLobbyView. **VS swords overlay** on non-VS cards only when Pro+Unlimited. Data: `DailyCompletionsStore` reads `daily_results` (solo, today); `allDone` = ≥9, `flawless` = ≥9 won.
- **Live-players bar:** pulsing green dot + "LIVE" + "{n} players online" (poll `server.wordocious.com/presence` 10s, nil until first success); (Pro) Invite button → InviteSheet.
- **Footer:** About / How to Play / Privacy / Terms.
- **ModeLimitModal:** lock icon, "{mode} — Played Today", upsell copy, "Play again tomorrow in HH:MM:SS", Upgrade to Pro→ProView, View Solved Puzzle (hidden for VS).
- **proPromptBanner** (`!shown && !pro && dailyLoginStreak≥7`): crown, "You're on a streak!", Go Pro / X; `pro-prompt-shown` persisted once.
- **StreakShieldModal** (`!checked && streak>0 && isStreakAtRisk`): flame + "!", "Streak at Risk!", big streak #, shield pill; Use Shield (n left)→`useShield`; "Let Streak Reset"→`declineStreak`; `Haptics.warning()`.

## LEADERBOARD (`LeaderboardTab`)
Signed-out placeholder + Sign in. Header "DAILY CHALLENGE" (Black 28 gradient) + date + countdown. `HModePicker` (9 modes, 5+4, no scroll, default `.duel`). `CompletedDailyCard` (Part 3). Rank banner ("You're ranked #N of M", gold, if userRank). "LEADERBOARD" label. List: loading spinner / empty "No results yet. Be the first!" / rows. **Row:** rank icon (1 crown `#D97706`, 2 medal muted, 3 medal `#B45309`, else number); username (NavigationLink→public profile; " (you)" `#D97706`); trailing composite score + detail ("{guesses} Guesses · m:ss" + " · {bs}/{tb}" if multi + " · N hint(s)" for hint modes) + Win/Loss pill (green/red). Row bg me→`#FFFBEB`, top-3→surfaceAlt. "{n} players today". Yesterday's Winners toggle (top 3). Data `LeaderboardService` from `daily_results` joined `profiles!inner(username,avatar_url)`: fetch (composite desc, created asc, limit 50), userRank, playerCount.

## PROFILE (`ProfileTab`)
Signed-out: person icon + Sign in. Content: header → Today's Dailies → Global Summary → Daily Medals → mode picker (+per-mode stats) → ProfileDashboard → Recent Matches → Achievements → Sign-out.
- **Header:** avatar(96) (image or gradient + initial); username + (Pro) PRO capsule; level-tier pill (Diamond≥100/Platinum≥51/Gold≥26/Silver≥11/Bronze, per-tier colors); XP bar (160×6, `(xp%1000)/10`%, `#FBBF24`→`#F97316`) + "{1000-xp%1000} XP to next"; "Member since"; Edit profile→EditProfileView; social links row (twitter/instagram/tiktok/threads/discord/website); Go Pro (free); **DEV Simulate Pro (is_admin only)**.
- **Today's Dailies:** card "{completed}/9", 5+4 badges (36×36, played→W/L green/red, else mode icon@0.7), tap played→SolvedPuzzle, else→start; allDone→Sweep/Flawless styling.
- **Global Summary:** 4 cards Wins (`trophy.fill` `#16A34A`), Win Rate (`target` `#2563EB`), Streak (`bolt.fill`, "Best: N"), Daily (`flame.fill` `#F97316`, "Best: N").
- **Daily Medals:** Gold/Silver/Bronze counts (`crown.fill` `#D97706`/medal muted/medal `#B45309`) + recent medalRows (`MedalsService.recent` from `medals`, limit 5; streak_7/30/100, perfect).
- **Mode picker + per-mode stats:** "All" chip (nil=global) + per-mode chips with games-count; selected → 4×2 stats card (Wins/Losses/Games/Win Rate/Best/Fastest/Streak/Best Streak via `UserStatsService.aggregate` solo+vs).
- **ProfileDashboard (`ProfileCharts`):** Guess Distribution, Activity (90-day heatmap), Solve Time (last N wins line), When You Play (24-bar), Top Words; **Pro section** self-gating — per-mode→Pro Insights, All→Pro Stats; free→frosted teaser + Upgrade. (Data from `matches`/`user_stats`.)
- **Recent Matches (`RecentMatchRow`):** up to 5; mode icon box(36); title + Solo/VS pill (Solo green `#F0FDF4`, VS `#7C3AED`/`#EDE9F6`); "{guesses} guess(es) · {duration}"; Win/Loss + "MMM d · h:mm a". `isSolo = player2_id==null`, won = `winner_id==me`. Data `PublicProfileService.recentMatches` (player1 OR player2, limit 10/show 5).
- **Achievements:** CollapsibleSection "{unlocked}/72", 3-col grid (✓/?, name, desc). Data `achievements` table (unlocked keys); catalog `AchievementService.all` (port verbatim).
- **Edit Profile:** avatar PhotosPicker (256² JPEG q0.85 → `avatars/{uid}/avatar.jpg` → `profiles.avatar_url`); username (3–20, `[a-zA-Z0-9_]`, dup→"Username already taken"); social links per platform; Save writes `username`+`social_links`.
- **Public profiles (`PublicProfileView`, /profile/[id]):** Back + avatar + username gradient + level pill + XP bar; 4 overall cards; Solo/VS toggle + mode chips + mode stats; Top Words; Recent Matches. Data `profiles`, `user_stats`, `recentMatches`, `topWords`.

## RECORDS (`RecordsTab`)
Signed-out: crown + Sign in. Header "RECORDS" gradient + "Daily | All-Time" toggle (default Daily). **Daily:** HModePicker + leaderboard card (accent bar + icon + Solo/VS toggle + "{total} players"/"Your rank #N" + rows). Data `LeaderboardService.fetch/userRank`. **All-Time:** Hall of Fame (global: `longest_streak, highest_level, most_gold_medals, most_daily_completions`) + By Game Mode (HModePicker → `fastest_win, fewest_guesses, most_games_played, longest_streak`); `RecordStatCell` (icon + formattedValue + label + holder; me→`#FFFBEB`+crown). Data `RecordsService.fetchAll` from `all_time_records` joined `profiles!inner(...)`.

## Supabase tables (tabs)
`profiles` (`Profile.selectColumns` + `social_links` separate), `daily_results`, `matches`, `user_stats`, `medals`, `achievements`, `all_time_records`, `match_invites`. Non-Supabase: `/presence`, dictionaryapi, `avatars` storage, local prefs.

---

# PART 5 — Auth, Pro/Billing, Ads, Settings/Info, Notifications, Modals

## Auth
**Login-required gate** (no anon gameplay): loading→branded skeleton (matches home layout, pulsing 0.25↔0.45); unauth→AuthView (no close); auth→app (+ onboarding cover if `!hasOnboarded`). **Bootstrap** order: `cleanupStaleDailyGames` → `auth.bootstrap` → `StoreManager.start` → `AdsManager.start` → `PresenceService.start`. Session restore + auth-state listener (signedIn/tokenRefreshed/userUpdated → handleSignedIn; signedOut → clear). **Resilient storage:** Keychain→UserDefaults fallback (Android: EncryptedSharedPreferences/DataStore + secure-fallback). **AuthView:** Wordmark 30 + "Epic Word Battles"; card "Welcome Back!"/"Join the Fun!"; **Sign in with Apple** (black, App Store 4.8 — keep on Android too) + **Continue with Google** (white + google icon); "or" divider; form (signup→Username; Email; Password); error box red; primary "Sign In"/"Create Account" gradient `#7C3AED`→`#6D28D9`; mode toggle link; Privacy|Terms footer. **No Facebook** (native replaced it with Apple). **Email:** `signIn`/`signUp(data:{username})` — username via metadata, DB trigger creates profile row (do NOT client-insert); sign-up success ≠ signed-in (confirm email). **Google:** GoogleSignIn SDK → `signInWithIdToken(.google)` (iosClientID `…4ftd…`, serverClientID = web `…lris79d9`); **Supabase "Skip nonce checks" ON**. Android: Credential Manager → idToken → `signInWithIdToken(GOOGLE)`; register Android OAuth client (+SHA-1); add to Supabase authorized IDs. **Apple:** native nonce flow on iOS; Android = web OAuth Custom Tab (provider `apple`). **First OAuth sign-in:** fetch profile; banned→sign out; no row→insert `{id, username:"Wordocious{10000..99999}", avatar_url}`; `has_onboarded:false`→onboarding. **Onboarding (`WelcomeView`):** 3 pillars + username picker (3–20, regex) → "Get Started" (`has_onboarded=true`) / "Skip for now". **Sign-out:** `signOut` + clear + stop presence. **Account deletion:** `POST wordocious.com/api/account/delete` Bearer token (server cascades) → local signOut; confirm dialog copy verbatim (App Store 5.1.1 / Play equivalent). **Profile columns:** `id, username, avatar_url, is_pro, pro_expires_at, is_banned, is_admin, has_onboarded, level, xp, total_wins, total_losses, current_streak, best_streak, daily_login_streak, best_daily_login_streak, streak_shields, last_played_at, gold/silver/bronze_medals, created_at` (+ `social_links` separate).

## Pro / Billing
**Entitlement = `isProActive`** (is_pro && (no expiry OR future)), never raw is_pro. **Client never self-grants** — server-written. Android: **Play Billing + Google RTDN webhook** (verify token via Play Developer API → write is_pro/pro_expires_at/shields); same fail-closed posture. **Plans:** Monthly `pro_monthly` $6.99 (+30d, **+4 shields**); Yearly `pro_yearly` $59.99 (+365d, +4 shields, BEST VALUE); Day Pass `pro_day` $1 consumable (+24h **stacked**, no shields). Prices live from store. **ProView:** crown + "Go Pro"; active-pro state; else benefits(8) + Monthly/Yearly cards + Day Pass + Restore + subscription disclosure (Android: "Google Play → Subscriptions") + Terms/Privacy; never link web checkout. **Purchase:** tag with Supabase uid (`appAccountToken` / Android `setObfuscatedAccountId`); grant shields only on new monthly/yearly; reconcile on launch/restore (no shields). **Simulate-Pro** dev toggle (is_admin/debug only).

## Ads
Free only (`enabled && !isProActive`). iOS App ID `ca-app-pub-3015627373086578~8393761846`; banner `…/4287985559`; rewarded-interstitial `…/6909445311` → **create Android units**; `app-ads.txt` already serves `google.com, pub-3015627373086578, DIRECT, f08c47fec0942fa0`. **Banner** bottom of content area, 50pt, Home (and lists) only, NOT game screens. **Game-start interstitial** once per game screen (timer starts on ad dismissal). **UMP consent** flow (Android: no ATT) → init SDK gated on `canRequestAds`.

## Settings / Info
**Settings:** THEME (Default/Dark/Ocean/Forest radio cards, live recolor) · SOUND (`pref-sound`) · NOTIFICATIONS (Daily Reminder, `pref-daily-reminder`) · ACCESSIBILITY (Colorblind, Reduced Motion) · ABOUT (About/Help/Privacy/Terms) · Account (Sign out, Delete) · "v1.0.0". Android: DataStore + Compose theme. **InfoPages** (about/privacy/terms/support) — single source of truth, **port copy verbatim**, incl. About's "10 modes" vs Help/Pro "9 modes" (preserve divergence); Terms billing line add "Google Play". **HelpView:** How to Play / Game Modes / FAQ — example tile rows, per-mode `helpDesc`, 9 FAQ items (scoring/XP numbers load-bearing). Contacts `legal@`/`support@wordocious.com`.

## Notifications
Single **local daily reminder** at 18:00 local, id `daily-reminder`, title "Wordocious" / body "Your daily puzzles are ready — keep your streak alive! 🔥". Toggle requests permission (denied→toggle off + dialog). Android: WorkManager/AlarmManager + Android-13 `POST_NOTIFICATIONS`.

## Modals/Toasts
XP/level-up toast (auto 3s), VictoryOverlay (non-gauntlet, confetti, tap-to-continue), StreakShieldModal (>20h + day rolled), proPromptBanner (streak≥7, once), ModeLimitModal (free replay), VSLimitModal (free daily VS used), plus Settings alerts ("Notifications are off", delete confirm/fail), Pro "Purchase issue", Home "Coming soon" (Android: "...Android app soon").

---

# PART 6 — VS Multiplayer + Cross-Cutting Data/State/Awards

Realtime server `apps/server` (socket.io @ `https://server.wordocious.com`); payloads JSON (first array element).

## VS components
`VSConfig` (serverURL), `VSProtocol` (events+payloads = `server/src/types.ts`), `VSMatchService` (socket wrapper, callbacks on main), `VSMatchViewModel` (queue→match→waiting→result→rematch; owns child game VM; relays + records), `VSLobbyView`, `VSGameView`, `PresenceService` (always-on idle socket), `LivePlayerCount` (/presence poll), `InviteService`.

## Connection & presence
**Two sockets, same presenceId.** Presence socket (always-on foregrounded, signed-in only): handshake `{presenceId:"u:<userId>"}`, no handlers, reconnect 2/10. Match socket (per session): forceWebsockets, payload `{presenceId:"u:<userId>"}`. **presenceId:** signed-in `"u:"+uid` (dedupes tabs+devices), anon web `"a:"+uuid` (native anon → no presence socket). **Live count:** `GET /presence`→`{online:int}` (set of `presenceId ?? socket.id`); poll 10s, nil until first success, `Cache-Control:no-store`.

## Matchmaking
One FIFO queue per mode. `join_queue {mode, dailySeed?, inviteCode?}` → server dedups, queues, emits `queue_status {position(0-based), mode}`, matches when ≥2. `createMatch(p1,p2,mode,preferredSeed = e1.dailySeed||e2.dailySeed)`. `leave_queue` removes + releases private lobby. Player id = socket.id.

## Match creation & seed
`matchId="match-"+now`; `seed = preferredSeed || generateMatchSeed()`; `boardCount = MODE_BOARD_COUNT[mode]` (DUEL1, QUORDLE4, OCTORDLE8, SEQUENCE4, RESCUE4, GAUNTLET21, MULTI_DUEL2, TOURNAMENT1, PROPERNOUNDLE1; `||1` fallback); `serverStartAt = now+3000`. Solutions: PN→`selectProperNoundlePuzzle`; else `generateSolutionsFromSeed(seed, boardCount)`. Emit `match_found` immediately, `match_start {seed, startTime, puzzleMetadata}` after 3s. `MODE_MAX_GUESSES` (`||6` fallback): DUEL6/QUORDLE9/OCTORDLE13/SEQUENCE10/RESCUE6/GAUNTLET50/PROPERNOUNDLE6. (DUEL_6/_7 not in server tables — rely on fallbacks; private invites reliable.)

## Private invites
Code alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, len 8; insert `match_invites {inviter_id, invite_code, game_mode}` (retry 3× on collision); targeted form resolves username + rejects self. Server pairing (`join_queue` w/ inviteCode): purge stale (TTL 10min); existing lobby from other player → `createMatch`; else park + `queue_status{position:0}`. On `match_found` w/ inviteCode → `markAccepted`. **Incoming banner:** `fetchPending(uid)` (invitee_id, pending, expires>now); Accept→VSGameView, Decline→status='declined'.

## In-match
`beginMatch(seed, startMs)`: PN→`ProperNoundleVM(isVersus)`; board modes→`GameViewModel(isVersus)` wired `onGuessCommitted→submit_guess{guess,boardIndex:0}`, `onBoardSolved→board_solved`, `onStageCompleted→stage_completed`, `onCompleted→player_completed{status,totalGuesses,timeMs}`. Server `submit_guess` validates (length 5 non-PN, isValidWord, dedup per player case-insensitive, not-completed), emits `guess_result{boardIndex,isValid,isCorrect,reason?}` to guesser + `opponent_progress{attempts,solved,boardsSolved,totalBoards,latestGuess?{boardIndex,tiles}}` to opponent. **Opponent mini-board:** accumulate `latestGuess.tiles` per board, colors only (correct `#22C55E`, present `#EAB308`, absent muted), no letters; show boardsSolved/total or Stage N + attempts + ✓; cell 5px if >4 boards else 8px. `board_solved`→boardsSolved++; `stage_completed`→opponent_stage_completed (client `stagesCleared = max(cur, idx+1)`); `player_completed`→status+guesses, if both done→endMatch.

## match_ended (designated writer)
Per-player time = `completedAt - serverStartAt`. Winner: oneWon→that; both won→higher boardsSolved, tie→composite `guesses + timeMs/1000/45`, <0.01→draw; neither→null. Payload (perspective-relative): `{winner:"player"|"opponent"|"draw"|null, playerGuesses, opponentGuesses, playerTime(ms), opponentTime(ms), playerScore, opponentScore, opponentId:string|null, recordMatch:bool}`. `opponentId` = other's `u:<id>`. **`recordMatch` = true for player1 only (& real uid)** — single shared `matches` row.

## recordResult
Guarded `!resultRecorded && profile`. `won = winner=="player"`, `secs=round(playerTime/1000)`. (1) `GameResultsService.record(mode, playType:"vs", ...)` → XpResult (toast); updates `user_stats(vs)`, profile XP/streak/login/shield, and if `isDailySeed`→`DailyResultsService.recordVs`. (2) if `recordMatch && opponentId` → `recordVsMatch`. (3) `checkAchievements(...,"vs",...)`. If `dailyVsActive`→`VSPlayLimit.markPlayedToday()`.

## Rematch
**Both emit `offer_rematch`** (NO `accept_rematch`; Accept re-emits offer). Server: `rematchOffers.add`; emit `rematch_offered`; when size==2 → new match (`match-now`, **fresh `generateMatchSeed()`** never daily), `rematch_start{matchId,seed,puzzleMetadata}`. `decline_rematch`→`rematch_declined`+teardown. **Client: rematch is Pro-only.** RematchState idle→offered/received/declined.

## Disconnect/abandon
`abandon_match`(forfeit)→ABANDONED+endMatch. socket disconnect→remove from queue/lobbies, emit `opponent_left`+teardown. `leave()`→leave_queue+disconnect.

## Daily-VS limit
`dailyVsActive = isDaily && !isPro && mode==.duel` (one free daily Classic VS). Seed mode string **`"DUEL_VS"`**. Two gates: `VSPlayLimit` (UserDefaults `vs_daily_played_on`) + `hasPlayedDailyVS()` (server `daily_results` DUEL/vs). Greyed card → VSLimitModal. Pro: all 9 modes + private + unlimited. Free: game-start interstitial before matchmaking.

## Full socket protocol
**Client→Server:** `join_queue{mode,dailySeed?,inviteCode?}`, `leave_queue`, `submit_guess{guess,boardIndex?=0}`, `board_solved{boardIndex}`, `player_completed{status,totalGuesses,timeMs}`, `stage_completed{stageIndex}`, `abandon_match`, `offer_rematch`, `decline_rematch` (`accept_rematch` declared, no handler).
**Server→Client:** `queue_status{position,mode}`, `match_found{matchId,mode,serverStartAt,countdownSeconds}`, `match_start{seed,startTime,puzzleMetadata?}`, `guess_result{boardIndex,isValid,isCorrect,reason?}`, `opponent_progress{attempts,solved,boardsSolved,totalBoards,latestGuess?}`, `opponent_stage_completed{stageIndex}`, `match_ended{...}`, `rematch_offered`, `rematch_declined`, `rematch_start{matchId,seed,puzzleMetadata?}`, `opponent_left`, `error{message}`. **Guard non-object payloads** (payload-less events deliver empty/null).

## Cross-cutting data/state

**Local persistence:** `GameState` JSON at `/games/wordocious-{MODE}-{safeSeed}.json` (`/`→`_`); elapsed UserDefaults `wordocious-elapsed-{MODE}-{safeSeed}` (ms); hints `wordocious-hints-...`; `cleanupStaleDailyGames` deletes non-today `*-daily-*` saves at launch. VS limit `vs_daily_played_on`.

**Seed determinism:** `simpleHash` 32-bit overflow (Android: `Int` with explicit wrap, `abs`); `generateSolutionsFromSeed` collision-rehash; word lists `solutions.json`+`allowed.json` (ship identical). `todayLocal` device-local; daily VS seed mode `"DUEL_VS"`. Ship `apps/web/data/*.json` verbatim.

**Award logic:** XP `won?100:25` + `(won && winStreak>1)?50:0` + `isDailySeed?50:0`; level = `xp/1000+1`. Win streak `won?+1:0`, best=max. Daily-login streak (player-local days): today→no change; yesterday→+1 (**+1 shield if %7==0**); else→1; best=max; always set last_played_at. Sweep/Flawless (solo daily, ≥9 rows): +200 / +400 once each via `daily_bonuses{sweep_awarded,flawless_awarded}` (onConflict user_id,day). Medals (`MedalService`): streak_7/30/100 once; perfect (per-mode min guesses) per day+mode; **podium top-3 via server cron** (Android doesn't award). Shields (`ShieldService`): isStreakAtRisk = >20h && day rolled; useShield −1 + bump last_played; declineStreak → login streak 0.

**user_stats (SECONDS):** per (user,mode,play_type): total_games+1, average_time = `round((avg*tot+secs)/new)`, best_score=min(guesses), fastest_time=min(secs), wins/losses. **Times: ms wire, seconds stored.**

**matches:** solo `recordSoloMatch` (player2 null, solutions[], player1_guesses[], hints_used); VS `recordVsMatch` (player2_id/score/time, winner_id, solutions=[], guesses=[]); gauntlet `recordGauntletStages` best-effort.

**daily_results:** solo `record` (key user+day+mode+solo, update if composite>old; then streak+perfect medals); VS `recordVs` (upsert vs_wins/losses/games + `vsCompositeScore`). **VS composite:** `games<3→0`; else `round2((wins*100 + winRate*50 + games*5))`.

**RLS:** writes need `auth.uid()`; `profiles.is_pro/pro_expires_at` NOT client-writable (pending lock migration — server webhook only); VS row by player1 (designated writer); uuid lowercase for client compares.

---

*End of spec. Implementing Android to this document yields full feature/UX parity AND cross-platform stat sync (web ⇄ iOS ⇄ Android share Supabase tables, the socket protocol, and the deterministic seed/scoring math). Keep this in lockstep with the iOS app — when iOS changes, update the relevant Part here.*
