# Parity audit — 2026-10-16 (read-only, HEAD 357ca8f3b)

Scope: iOS (SwiftUI) vs Android (Compose) vs web (Next.js), surface by surface, by code reading and grep. Share-image renderers were skipped (being rebuilt); only the spoiler-chooser availability per game is recorded. No code was changed.

Classification (founder guidance, 10-16):
- **(a)** real mismatch to fix
- **(b)** intentional platform difference (tablet sizing, web-as-website layouts, hover states, web nav) — listed briefly, no action
- **(c)** unsure — needs a founder call

Path prefixes: `iOS` = `apps/ios/Wordocious/Sources/`, `AND` = `apps/android/app/src/main/kotlin/com/wordocious/app/`, `WEB` = `apps/web/`, `core` = `packages/core/src/`.

---

## Top 10 by user impact

| # | Surface | Finding | Class | Right platform |
|---|---|---|---|---|
| 1 | VS (web) | In-match Home button forfeits immediately, no "FORFEIT MATCH?" confirm | (a) HIGH | iOS + Android |
| 2 | Leaderboard (iOS) | Sweep → Yesterday draws the podium twice (ledge + expanded block) | (a) HIGH | Android + web |
| 3 | Leaderboard (iOS) | Yesterday with ≤3 finishers renders an empty card instead of "That was everyone yesterday" | (a) MED | Android + web |
| 4 | Finished, multi-board (web) | No boards chip ("3/4 solved"); loss shows bare guess count, not `g/max` | (a) MED | iOS + Android |
| 5 | Android dialogs | 14 Material `AlertDialog`s (Unfriend, Report, Cancel invite, Purchase issue, Edit-profile sheets…) where iOS replaced every system alert with family sheets (ef37c5902, 2e76f12c5) and web uses house modals | (a) MED | iOS + web |
| 6 | Friends (iOS) | Tab badge never counts pending game invites | (a) MED | Android + web |
| 7 | Friends (Android) | Friend card: no way into the profile; no-games card lacks the start row (spec) | (a) MED | iOS + web |
| 8 | Guest gate (iOS) | Mode-limit modal: "Go Pro" / "Not now" / "Play again in" vs "Upgrade to Pro" / "Come back tomorrow" / "PLAY AGAIN TOMORROW IN" | (a) MED | Android + web |
| 9 | A11y (web) | Keyboard keys read "A, present" / "A, absent" / "Backspace" | (a) MED | iOS + Android |
| 10 | Finished, puzzles (Android) | Android-only loss chips + answer tiles under a lost single board | (c) MED | iOS + web agree |

Also MED (c): Stats Today-card header wording ×3; Leaderboard/Records empty-state copy ×3 (7 states). LOW-MED (a): iOS ProperNoundle rank badge after Unlimited; iOS ignores `podium_burst`; tour-replay last button.

---

## Cross-cutting (core ports, recent commits)

**Core port coverage.** Every `packages/core` module that drives UI rules has a Swift and Kotlin twin under a matching name (parity fixtures: 34 JSON fixtures asserted on web, iOS `apps/ios/Tests/Fixtures`, Android `apps/android/core/src/test/resources/fixtures`). The only unported modules are web/server-only by design (`feature-switches`, `ads`, `contrast`, `username`, `wotd-blocklist` — the WOTD 18-word list is hand-copied into iOS `WordOfTheDayView.swift:386` and AND `HomeScreen.kt:616` and matches). **(b)**

**Recent single-platform commits (since 09-25) that never got a parity twin:**
- `fc4da6523` (iOS 10-09) header always reserves the Pro crown's room so Pro resolving late never shifts the header. AND `ui/AppHeader.kt:138` still adds `padding(bottom = if (pro) 3.dp else 0.dp)` → a 3 dp hop when Pro resolves. Web `components/ui/app-header.tsx:243` passes `crown` only (no height change seen). **(a) LOW** — Android: reserve the 3 dp always.
- `ef37c5902` / `2e76f12c5` (iOS 10-09) no system alerts: Android still has 14 `AlertDialog(` call sites — `AND/ui/ProScreen.kt:224` "Purchase issue", `AND/ui/PublicProfileSocial.kt:357,476,541,752,845`, `AND/ui/friends/FriendlyGameScreen.kt:554`, `AND/ui/InvitePanel.kt:262` "Cancel invite", `AND/ui/SettingsScreen.kt:819`, `AND/ui/EditProfileScreen.kt:619` (Your links / Private profile / Favorite game), `AND/ui/FriendsPanel.kt:430` "Unfriend", `AND/ui/PublicProfileScreen.kt:767` "Report this user?". iOS: 0 `.alert(`; web: 0 `window.confirm`, house modals (`WEB/components/friends/friends-panel.tsx:1139`, `WEB/components/referrals/invite-panel.tsx:182`). **(a) MED** — Android should move these to the FamilyActionMenu confirm sheet (same copy, so a small change per dialog; the look change is the already-approved family sheet).
- Verified paritied (no action): dark-board audit ×3, calm Friends page ×3, tile names/Leaderboard rows ×3, RPS hand cycling ×3 (`WEB/components/friends/friendly-boards.tsx:163`), Ladder REACH dark ink (AND `LadderScreen.kt:439`), 13+ lockout gold ink ×3, Halloween `buttonTint` from `core/season-registry.json:9`, widget midnight rollover (AND `widget/WidgetBridge.kt:236`), head-to-head "Daily scores a–b · Pocket games c–d" from core `stats-profile.ts:217` ×3.

---

## Home

**All three match:** two-line headline slot (08e529cbd: iOS `HomeBannerView.swift` hidden two-line reference; AND `HomeBannerView.kt` alpha-0 reference; web `home-banner.tsx:223` + `lib/home-headline.ts`), saved order from the first frame (7a82def72: iOS `GameOrderStore.swift:27-34`, AND `HomeScreen.kt:275-276`, web `lib/game-order-store.ts`), game-order rules (Classic pinned, Reset disabled at default, `profiles.game_order` + local copy, `custom_game_order` flag fails open), edit UI (long-press or title coin 30/44 @ 80 %, circular-arrows icon, "DRAG TO REORDER" / Reset / Done, "Reorder Dailies" / "Reorder Puzzles", wiggle ±1.4°, purple drop glow), WOTD blocklist, VS live tile copy + Bot-of-the-day seed (UTC day) + Pro-only Invite, celebration trio (D, O2, I; tempo 0.42, sway 4°, Halloween 0.7 / 3°).

**(b) intentional:** web SEO footer links and desktop grids (`WEB/app/page.tsx:447-566`); web announcements banner mounted in `app/layout.tsx:207` (shows on Home anyway); web More Games sheet retired (`?more=1` scrolls to PUZZLES, `page.tsx:260-266`) while `MoreGamesSheet.swift` / `.kt` remain — reachability not checked; web streak Pro upsell is a modal (`components/modals/pro-prompt-modal.tsx`) vs a dismissible Home card natively.

---

## Leaderboard + Records

1. **(a) HIGH — iOS Sweep → Yesterday podium drawn twice.** `iOS/LeaderboardTab.swift:490-512`: `StageYesterdayLedge` already draws the yesterday podium (`LeaderboardStageView.swift:376-386`), then the `expanded:` block calls `sweepPodiumBoard` (`LeaderboardTab.swift:639-653`) which draws a second `PodiumView` (644-647). AND `LeaderboardScreen.kt:843-858` and web `app/daily/page.tsx:960-972` show rows only (`drop(filled)` / `rest`). Fix: render `rows.dropFirst(layout.filled)` only. Yesterday opens by default, so it is seen on every Sweep visit.
2. **(a) MED — iOS Yesterday, ≤3 finishers → empty card.** `iOS/LeaderboardBlocks.swift:227-235` (game boards) and `LeaderboardTab.swift:648-652` (sweep) render an empty `.lbCard()`. AND `LeaderboardScreen.kt:848,866` (`YesterdayAllShown()` :910) and web `daily/page.tsx:963-964` say "That was everyone yesterday". iOS has no such string.
3. **(c) LOW-MED — "Play now" on an empty game board only on Android.** AND `LeaderboardScreen.kt:670-679`; iOS `LeaderboardTab.swift:570-572` and web `daily/page.tsx:889` have no action. Add ×2 or drop ×1.
4. **(c) LOW-MED — empty-state copy differs ×3** (all from 3ddc032f8, 10-03, so no platform is newer):
   - Sweep today: iOS `LeaderboardTab.swift:454` "No sweeps yet / Nobody has swept today. Be the first!"; AND `:648,:1199` "NO SWEEPS YET / Finish all of today's dailies to land on this board."; web `daily/page.tsx:871` "NO SWEEPS TODAY / Nobody's swept today. Be the first!"
   - Game board today: iOS `:570-571` "No results yet / Nobody has finished today. Be the first!"; AND `:672-673` "Nobody has finished today's {Mode} yet…"; web `:889` "Nobody's finished today's daily…"
   - Friends board empty: iOS `:570` "Your board is empty"; AND `:662` "NO FRIENDS HERE YET"; web `:882` "NO FRIENDS ON THE BOARD" (line + "Add friends" button match).
   - Records today Sweep: iOS `RecordsTab.swift:628`; AND `RecordsScreen.kt:392`; web `app/records/page.tsx:606-607` (+ web-only "Play today's dailies" button — (b)).
   - Records today game board: iOS `:564` ("Friends are still asleep" variant); AND `:418-419`; web `:625-626` (no friends variant).
   - Records all-time Sweep: iOS `:211`; AND `:696`; web `:905`.
   - Records all-time records: iOS; AND `:705`; web `:933`.
5. **(a) LOW — Records your-rank card on the Friends board.** iOS `RecordsTab.swift:539` "OF N FRIENDS" (no TOP %); AND `RecordsScreen.kt:366-371` "OF N FRIENDS · TOP X%"; web `records/page.tsx:578` always "OF N TODAY · TOP X%" even on Friends. iOS is right (a friends rank is not a day percentile); web is wrong.
6. **(c) — guest Leaderboard.** iOS `LeaderboardTab.swift:364-371` and AND `LeaderboardScreen.kt:118-130` swap the board for the "Climb the boards" pitch; web `daily/page.tsx` shows the live board and gates Play (`:685`). Probably (b) (public website), confirm.

**All three match:** rank-delta pill (same key, sign, 5 s fade, 9 pt; never on Sweep), Yesterday empty header "YESTERDAY · No results from yesterday", podium "Open spot / Claim #N" from core `podiumOpenSpot`, player tint from core `player-tint`, signed-out copy "Climb the boards / Sign in to see today's rankings and earn medals." (iOS = Android).

---

## Stats

1. **(c) MED — Today card header (not finished) ×3 wordings.** iOS `TodayCard.swift:88-93` "Today · Oct 16" + "3/8 PLAYED"; AND `TodayCard.kt:156-160` "TODAY · OCT 16" + soft "3 / 8"; web `components/stats/today-card.tsx:123` "Today · 3 of 8 done". iOS + web last touched 2ef3346be (10-09); Android unchanged since 10-02.
2. **(c) — Today card header, all done.** iOS `TodayCard.swift:79-85` BubbleText "FLAWLESS VICTORY!" / "DAILY SWEEP!" between SF glyphs; AND `:150-154` and web `:113-120` use the FLAWLESS! / SWEEP! art. Lean Android + web (the art spec) — visible change on iOS, needs founder approval.
3. **(a) LOW — Sweep-streak tile.** AND `TodayCard.kt:236` shows "· N flawless" from 1 (`>= 1`); iOS `TodayCard.swift:177` and web `:215` from 2 → Android `>= 2`. iOS `TodayCard.swift:142` repeats the number ("5" over "5 days · …") where AND/web print "days · …" → iOS drop it. AND `:241` "Puzzles: 3 days" has a colon the other two lack.
4. **(a) LOW-MED — Best-moment tile on web.** iOS `TodayCard.swift:148-170` and AND `:248-253` split big value / small line and "—" / "Play a daily to start your day"; web `today-card.tsx:227-231` crams the sentence into the value and "Play a daily / to start your day". Web → the split. Icon rule (iOS badgeCheck/trophy, AND crown, web crown/trophy) is (c).
5. **(a) LOW — Today's Games empty title.** AND `RecentMatches.kt:265` "NO GAMES TODAY", `:79` "NO MATCHES YET"; iOS `RecentMatchesList.swift:50,137` and web `stats/recent-matches.tsx:96` "No games yet" (caps) → Android "NO GAMES YET".
6. **(c) LOW — People | Bots toggle color.** iOS `ProfileTab.swift:797-799` pink #EC4899; AND `ProfileScreen.kt:906-908` teal #0D9488; web `app/stats/page.tsx:1174-1178` purple #7c3aed.

**All three match:** head-to-head line (core `headToHeadLine`), section labels ("Your Records", "Pocket Games", "Signature", "Weekly Race Finishes", "Daily Medals"), empty "Play a game and I'll crunch the numbers." and "No {Mode} games yet today.", pills (Puzzles "N of M", VS W/L/—, Standing "Top X%"), footer "All N dailies completed · +200 XP earned". Not covered: Stats picker / Signature internals, medals grid, Weekly Race body.

---

## Finished screens (every game)

### Spoiler chooser ("No spoilers / Colors only" vs "Full results / Letters revealed") — matches ×3

Chooser: iOS `ShareVariantSheet.swift` (via `FinishedShareCTA` `hasSpoilers`, `FinishedScreenKit.swift:187`; `PostGameViews.swift:140`); AND `ui/InfoNavScreens.kt:131` via `ui/game/PostGameScreen.kt:171-177`; web `components/share/share-variant-modal.tsx:39` `chooseShareVariant()`.

| Game | iOS | Android | Web |
|---|---|---|---|
| Six / Seven / Classic | yes (`GameScreen.swift:472`) | yes | yes (`practice-game.tsx:335`) |
| QuadWord | yes | yes | yes (`quordle-game.tsx:170`) |
| OctoWord | yes | yes | yes (`octordle-game.tsx:165`) |
| Succession | yes | yes | yes (`sequence-game.tsx:263`) |
| Deliverance | yes | yes | yes (`rescue-game.tsx:172`) |
| ProperNoundle | yes (own sheet, `ProperNoundleView.swift:396`) | yes | yes (`propernoundle-game.tsx:666`) |
| Gauntlet | no (`GauntletCompletedView.swift:320`) | no (`PostGameScreen.kt:172`) | no (`gauntlet-results.tsx` shares directly) |
| Crosswordocious, Codebreaker, Sudocious, Muddle, Kindred, Letter Ladder, Spyglass, Starsweep, Hubbub | no (`PuzGameKit.swift:341` default false) | no | no |
| Custom daily / WOTD quiz | no share | no share | no share |
| Revisit a solved daily | yes (`SolvedPuzzleView.swift:62`) | not checked | not checked |

### Mismatches

- **F1 (a) MED — web multi-board strip has no boards chip.** iOS `PostGameViews.swift:187` "3/4 solved" (purple); AND `ui/game/PostGameScreen.kt:224` "3/4 boards" (amber); web `components/game/finished-kit.tsx:55-90` `ResultStrip` takes guesses/time/pts only (callers `quordle-game.tsx:248`, `octordle-game.tsx:245`, `rescue-game.tsx:249`, `sequence-game.tsx:356`). On a loss iOS `:188` / AND `:226` show `g/max`, web the bare count. Web adds the chip; founder picks "solved" vs "boards" (and purple vs amber).
- **F2 (a) LOW-MED — iOS ProperNoundle rank badge after Unlimited.** iOS `ProperNoundleView.swift:614` has no `isDaily` check; AND `PostGameScreen.kt:294` and web `propernoundle-game.tsx:913` are daily-only. Fix: `if vm.isDaily`.
- **F3 (c) LOW — rank badge placement, word games.** iOS behind More (`GameScreen.swift:136`); AND inside the More sheet (`PostGameScreen.kt:294`); web phone on the first screen as the strip `sub` (`finished-screen.tsx:165`, `practice-game.tsx:462`). Desktop web open layout is (b).
- **F4 (c) MED — Spyglass strip stat.** iOS `SpyglassView.swift:369` and AND `SpyglassScreen.kt:579` "N/M found"; web `spyglass-game.tsx:338` misses count (matches the "Miss bonus" breakdown row). All from e94daea29.
- **F5 (c) MED — Android-only loss chips.** Sudocious "N cells left" (`AND/ui/game/SudokuScreen.kt:678`), Starsweep "N stars left" (`RegionsScreen.kt:492`), Muddle extra "n/m solved" (`MuddleScreen.kt:1247`), Kindred extra "n/4 groups" (`KindredScreen.kt:739`). iOS and web (`sudoku-game.tsx:388`, `regions-game.tsx:402`, `muddle-game.tsx:397`, `groups-game.tsx:406`) show mistakes/checks, time, pts only. Two platforms agree → likely drop on Android.
- **F6 (c) LOW — Letter Ladder label.** Web `ladder-game.tsx:346` "moves · par N"; iOS `LadderView.swift:342`, AND `LadderScreen.kt:543` "moves".
- **F7 (c) MED — Android shows answer tiles under a lost single board** (`PostGameScreen.kt:344` `FinishedAnswer`). iOS (`GameScreen.swift:146`) and web (`practice-game.tsx:504`) keep it in the word card behind More; the loss popup shows it ×3. Two agree → likely remove on Android (shrinks the board on short phones).
- **F8 (a) LOW — word card label after Unlimited.** iOS `GameScreen.swift:147` "TODAY'S WORD" / "THE WORD"; AND `PostGameScreen.kt:728` and web `post-game-summary.tsx:43` always "Today's word". iOS right.
- **F9 (c) LOW — next-daily countdown rounding.** iOS rounds minutes up (`apps/ios/Sources/Core/FinishCloseScreen.swift:11-15`); AND `FinishedScreen.kt:540-546` and web `lib/finished-layout.ts:26-32` round down. No core function; pick one (two round down).
- **F10 (a) LOW — Sweep line punctuation.** Web `next-daily-cta.tsx:62` "done — Sweep complete!"; iOS `PostGameViews.swift:641`, AND `FinishedScreen.kt:477` "done. Sweep complete!".
- **F11 (a) LOW — strip headline a11y label.** iOS `PostGameViews.swift:195-200` "SOLVED IN 4" / "ALL 4 SOLVED" / "3 OF 4 SOLVED" / "SO CLOSE"; AND `FinishedScreen.kt:289-293` "SOLVED IN 4 GUESSES" / "SOLVED!" / "SO CLOSE"; web `finished-kit.tsx:75` "Solved!" / "Not today". Art is the same; align the labels (iOS set is the richest).
- **F12 (c) LOW — the More disclosure.** iOS `FinishedScreenKit.swift:120` + AND "More / Less"; web per-game pill ("Score breakdown", "Score + word", "About + score", "Stages + score", e.g. `practice-game.tsx:490`). Android opens a sheet; iOS + web expand in place.

**(b) intentional:** desktop web two-column finished layout with More open inline (`finished-screen.tsx:146`); web page-level Unlimited gates (`unlimited-gate.tsx:132-218`) vs native paywall / VS-limit modals; store rating prompt native-only with the same rules (3 play days, 120-day cooldown, never after a loss: `ReviewPromptPolicy.swift:8-9`, `AND/data/StoreReview.kt`).

**All three match:** score-breakdown rows + labels from `DailyScoring.breakdown` / `computeScoreBreakdown` (iOS `PostGameViews.swift:470-515`, AND `ScoreBreakdownCard`, web `score-breakdown.tsx:12-121`); chooser copy; Share label "Share" / a11y "Share results" / "Next <Game> in …" caption on dailies only, hidden under 700 pt; dock "Next" + "Ranks"; Unlimited card copy ("KEEP PLAYING" / "KEEP GOING", "Fresh puzzles, no waiting" / "Endless puzzles with Pro", "Other games"); daily rank badge on all nine puzzle finishes, daily only; XP toast in every game + VS; Gauntlet own results screen.

---

## VS

- **V1 (a) HIGH — web Home button forfeits with no confirm.** `WEB/components/vs/vs-game.tsx:2363,2372` `<GameHomeButton onClick={handleForfeit}>` → `handleForfeit` (`:1344`) records the loss, burns the daily VS and navigates; `GameHomeButton` (`components/game/game-home-button.tsx:58`) adds no confirm. Only the footer tabs guard (`setLeaveGuard`, `:484`). iOS `VSGameView.swift:299` (`homeTapped` → `leaveWouldForfeit`) and `:207-216` "FORFEIT MATCH?" KEEP PLAYING / FORFEIT & LEAVE; AND `ui/vs/VSGameScreen.kt:543-556` same, plus system Back asks. `git log -S` shows the web confirm never existed. Fix: route the Home tap through the same confirm card (small visual change — copy exists ×2).
- **V2 (a) LOW — forfeit result line.** iOS `VSGameView.swift:836-837` "X left — you win by forfeit" / "Match forfeited — X wins"; AND `VSGameScreen.kt:1240-1241` "X left the match — you win by forfeit" / "Match forfeited — X wins"; web `vs-game.tsx:1838` "X left the match — …" / "Match forfeited" (no winner). Android is the most complete.
- **V3 (c) LOW-MED — "all ten bots beaten" copy ×3.** iOS `VSBotsView.swift:159`; AND `ui/vs/VSBotsPage.kt:134`; web `vs-bots.tsx:140` (all e94daea29).
- **V4 (c) LOW — Bot of the Day / Ghost rows.** iOS `VSBotsView.swift:76` "Bot of the day", `:254/267` "Your Ghost"; AND `VSBotsPage.kt:198` "BOT OF THE DAY · NAME", `:165` "Your Ghost · Beat your best"; web `vs-bots.tsx:94,224-226`.
- **V5 (c) LOW-MED — rematch button label.** iOS `VSGameView.swift:1180` always "REMATCH" ("Waiting for X…"); AND `VSGameScreen.kt:1445` "PLAY AGAIN" vs bot else "REMATCH" ("WAITING…"); web `vs-game.tsx:2032` "Run it back vs X" / "Rematch" / "Rematch — Pro" + lock.
- **V6 (a) LOW — challenge share text with `branded_invites` off.** Web `lib/vs-lobby.ts:241-243` "Race my Wordocious X run — code C"; iOS `VsChallengeService.swift:227-233` and AND `data/ShareHelper.kt:134-143` use `ShareCopy.vsInvite` "Race me at X! ⚡ <url>". Native right (shared caption bank).

**All three match:** nine VS modes from core `VS_MODE_ORDER` (`core/vs-lobby.ts:14`, iOS `VsLobby.swift:78`, AND `VSLobbyScreen.kt:103`), free = Classic only; banner / lobby / ladder lines from core (`vsBannerHeadline`, `vsBannerClockLine`, `vsTodayStatus`, `vsRecordLine`, `vsOutcome`, `vsMargin`, `challengeHeadline`, `ladderRungs`, `ladderAfterGame`); People = `vs`, Bots = `vs_cpu`; lobby tile copy; queue copy ("We'll keep looking", "<bot> steps in at 0:15"); "Ping me when someone's looking for <Mode>" + result lines; offline race note; forfeit confirm copy iOS = Android; VS upsell copy; rematch Pro-only with auto-decline for free; intro head-to-head line. Not covered: string-by-string `VSChallengeViews` vs `vs-challenge.tsx`; whether iOS bot results use a separate screen (affects V5).

---

## Friends

1. **(a) MED — iOS Friends tab badge leaves out pending game invites.** AND `ui/FriendsTabBadge.kt:46-53` + `MainScreen.kt:109-131` and web `hooks/use-friends-badge.ts:50-66` count requests + invites (`inv:`) + VS challenges + your-turn games; iOS `FriendsBadge.swift:33-37` `recount()` counts requests, your-turn games and challenges only (never calls `fetchPendingInvitesForUser`). An incoming invite badges on Android/web, not iOS. Fix: add invites to the iOS recount. (Web `lib/friends-play.ts:295` `friendsBadgeCount` is unused legacy.)
2. **(a) MED — Android friend card: no way into the profile.** iOS `FriendCardsView.swift:77-102` and web `components/friends/friend-cards.tsx:271,278` open the profile from the avatar + name; AND `ui/friends/FriendCardsView.kt:112-116` makes the whole card one Quick Play button.
3. **(a) MED — Android friend card with no games has no start row.** iOS `FriendCardsView.swift:58-59,270` and web `friend-cards.tsx:209-217,321` show the six-game start strip; AND `FriendCardsView.kt:138,151-154` shows "Tap to pick a game" only. Spec (`docs/design/review/friends-cards-1015/SPEC.md`): "A friend with no games keeps today's start row".
4. **(a) LOW — "+N more" expanded label.** iOS `FriendCardsView.swift:236,244` "Show fewer"; AND `:169,173` and web `:227,231` "Show less" → iOS. Collapsed a11y label differs ×3 ("N more games" / "N more games, collapsed" / "Show N more games") — pick one.
5. **(a) LOW — nudge row singular.** iOS `FriendsPanelView.swift:707` "1 friend hasn't played today"; AND `FriendsPanel.kt:907` and web `friends-panel.tsx:734` "1 haven't played today" → iOS form.
6. **(c) LOW — web-only friend-card header extras.** Web `friend-cards.tsx:276,288` pink CandyBadge waiting count on the avatar + FlameCount streak in the header; iOS `FriendCardsView.swift:75-113` and AND `FriendCardsView.kt:120-148` have neither (10-15 spec: avatar, name, one sub line, •••; the gold row already says YOUR TURN). Recommend removing the web badge; flame ×3 is a founder call.
7. **(c) LOW — Quick Play sheet subtitles ×3** (all 087e4f2c7, 10-01). VS Battle: iOS `FriendsQuickPlaySheet.swift:335-338` "Classic · free for friends"; AND `ui/friends/QuickPlaySheet.kt:259-263` "Free for friends · Classic"; web `quick-play-sheet.tsx:189,202` "A private Classic match. Free for friends." Race my run: iOS "Pro · they race your time" / "They race your time"; AND always "They race your time"; web "You play first. They race your run. Pro."

**All three match:** 2.8.4 design A + waiting chip (0c515813b) — avatar 44, one sub line, 50-high rows with 34 coin, CAPS title, YOUR TURN (24h gold) / WAITING (22h) chips, max 3 rows + "+N more", in-row Resign confirm; nudge row (4 faces, NUDGE ALL gold, "slowpoke" taunt, "Nudged N friend(s)!" / "Everyone already nudged today"), All-friends fold via core `allFriendsLabel`; taunt ids + text; Today's Race (core `rankToday`, status lines, `raceBadge`, top 3 / top 5 + "All friends · N more"); presence (`isOnline` 2-min, `presenceLine`); friend streak flame in All-friends rows; Friends banner core lines (unmounted on all three — consistent dead code); badge label "Friends, N new"; notification prefs (four categories + "Friend requests always come through.").

## Settings

1. **(a) LOW — Linked sign-ins copy, iOS outlier.** Unlink confirm: iOS `LinkedSignInsSection.swift:51` "You won't be able to sign in with it anymore. Your other sign-ins keep working." vs AND `SettingsScreen.kt:456` / web `components/settings/linked-sign-ins.tsx:101` "You won't be able to sign in to this account with X anymore. Your stats and Pro stay put." Load error: iOS `:150` "…reopen Settings." vs AND `:527` / web `:137` "Close Settings and try again." → Android/web.
2. **(c) — section order, wording, delete flow.** Haptics subtitle ×3 (iOS `SettingsView.swift:96` "Gentle taps and buzzes as you play"; AND `:208` "Taps and buzzes as you play"; web `components/settings-dialog.tsx:242` "Little buzzes on taps, wins and streaks…"). Sign Out: iOS bare button, no ACCOUNT header (`:200-208`); AND `:343` and web `:276` in ACCOUNT. Linked sign-ins position: iOS before SUBSCRIPTION (`:141`); AND after ABOUT (`:341`); web after Subscription (`:273`). Delete account: iOS `:257-259` and AND `:390-397` one confirm "Delete Forever" (different message text); web `:60-71` two confirms ("Continue" → "Delete forever"). Admin season preview last on web (`:312`), between ACCESSIBILITY and SUBSCRIPTION natively.

**(b) intentional:** web Settings has no Daily Reminders / Ad Privacy / Help & Support / Privacy / Terms rows (site pages); web Subscription only for Pro or web-billing with ProMemberCard; dialog with Title-case headers; Android "To add Apple, use … iOS app"; ads admin rows on both native apps.

**All three match:** theme / keyboard options (Standard / Flipped / Michael Keyboard), Sound Effects "Key taps, win/loss jingles", Colorblind / Reduced Motion copy, season-preview copy.

## Onboarding / guest gates

1. **(a) MED — mode-limit modal copy.** Main button: iOS `HomeView.swift:1169` "Go Pro" (spoken "Upgrade to Pro") vs AND `ui/ModeLimitModal.kt:123` / web `components/modals/mode-limit-modal.tsx:97` "Upgrade to Pro". Dismiss: iOS "Not now" vs "Come back tomorrow" (AND `:180`, web `:106`). Countdown label: iOS `:1180` "Play again in" vs "PLAY AGAIN TOMORROW IN" (AND `:132-169`, web `:83`). → Android/web.
2. **(c) — Android-only "Unlimited <mode> / Fresh puzzles, no waiting" peach card inside the limit modal** (`ModeLimitModal.kt:132-169`); neither iOS nor web has it. Port ×2 or drop.
3. **(a) LOW-MED — tour replay last button.** iOS `OnboardingView.swift:127,172` "Play today's Classic" (launches Classic); AND `Onboarding.kt:578-583` "Got it!"; web `first-run-tour.tsx:614-619` "Got it". First-run signed-out last card: AND "Make my profile" vs iOS/web "Next". Majority "Got it" (punctuation: founder); iOS's Classic launch is the outlier.

**All three match:** age check (pass offset 14, 100 years back, 2000 ms gate, privacy@wordocious.com, "A grown-up? Sign in", under-13 copy); tour card titles + sentences; welcome text; mascot-coach tips; What's New from core.

## Seasonal (Halloween)

**All three match:** window Oct 9–31 in core, Swift, Kotlin; `season-registry.json` byte-identical ×3; titles, walls, cast costumes, Leaderboard day-title prop pair, Home banner art, celebration extras, musical cast tunes wired ×3; all gate on `season_halloween`; `buttonTint` #7C3AED from the registry. No mismatch found.

## Accessibility

1. **(a) MED — web keyboard keys read raw state words.** Web `components/game/keyboard.tsx:207,255` aria-label `${key}, ${state}` → "A, present" / "A, absent"; iOS `KeyboardView.swift:204,230-231` + `BoardView.swift:170-177` and AND `ui/game/KeyboardView.kt:315,361` + `TileView.kt:34-40` say "A, wrong position" / "A, not in word". Delete key: web "Backspace" vs "Delete". Web `multi-board.tsx:76-78` already has the right mapping — reuse it.
2. **(a) LOW — iOS ignores the `podium_burst` switch.** AND `ui/BoardPodium.kt:323` and web `components/leaderboard/podium.tsx:221` gate the #1 winner intro on `isLive('podium_burst')`; iOS dropped the check in c70739fe8 (10-15) — no `podium_burst` reference remains in `apps/ios`. Re-add `FlagsService.shared.isLive("podium_burst")` in `FinishPages.swift` (~900-930).
3. See also F11 (finished-strip headline labels) and Friends #4 (collapsed "+N more" label).

**All three match:** core `A11yLabels` ports (podium place, open spot, flawless seal, headline, mascot, progress) on iOS + Android; web `placeWord` / `podiumStageCardLabel` + sr-only text; "Space (decorative)", "Submit guess", Share "Share results".

---

## "Looks off" per platform (small, safe adjustments)

**iOS**
- Sweep → Yesterday: two stacked podiums → render only the rows below the podium in the expanded block.
- Yesterday with ≤3 finishers: empty card → add "That was everyone yesterday".
- Sweep-streak tile repeats its number → "days · …".
- Multi-board finish: guesses chip blue like time (only the first chip gets purple, `FinishedScreenKit.swift:236`) → purple like Android + web.
- "Bot of the day" mixed case beside caps headers (`VSBotsView.swift:76`) → "BOT OF THE DAY".
- ProperNoundle Unlimited: no rank badge.
- Friends badge: count pending invites; friend-card presence line has an extra 7 pt green dot beside the avatar's own dot (`FriendCardsView.swift:84`) → drop the inline dot.
- Re-add the `podium_burst` flag check.

**Android**
- Friend card: name/avatar → profile; no-games card → the six-game start row; presence line 12 sp ExtraBold → 11 sp Bold (`FriendCardsView.kt:131`); Keep/Resign pills 28 dp → 26 (`:313-322`).
- Sweep-streak tile "· 1 flawless" → threshold 2; "Puzzles: 3 days" → drop the colon; "NO GAMES TODAY" / "NO MATCHES YET" → "NO GAMES YET".
- Loss-only puzzle chips (F5) lengthen the strips → drop, or founder call.
- Answer tiles under a lost single board (F7) shrink the board on short phones.
- Header hops 3 dp when Pro resolves late → always reserve the crown room.
- 14 Material AlertDialogs → the family confirm sheet.

**Web**
- VS Home button forfeits with no warning → the confirm card (needed, not a drastic change).
- Records Friends board "OF N TODAY · TOP X%" → "OF N FRIENDS".
- Best-moment tile crams the sentence into the value → big/small split.
- Multi-board strip has no boards chip → add it.
- More pill text varies per game → "More" everywhere (cosmetic).
- Keyboard key aria-labels → the `multi-board.tsx` mapping; remove the waiting CandyBadge on friend avatars (duplicates the gold row).

Nothing above needs a drastic visual change; the founder-approval items are the iOS all-done Today-card header (art vs BubbleText), the web guest Leaderboard (board visible vs pitch), the Android-only limit-modal Unlimited card, and Settings section order / delete flow.

---

## All three match (summary)

Home: two-line headline slot, saved order from frame 1, game-order rules + edit UI, WOTD blocklist, VS live tile, celebration trio. Leaderboard: rank-delta pill, Yesterday empty header, podium open spot, player tints, signed-out copy. Stats: head-to-head line, section labels, pills, footer, empty lines. Finished: breakdown rows, chooser copy + per-game availability, Share label/a11y/caption, dock, Unlimited card, rank badge daily-only, XP toast. VS: nine modes, Classic-only free, every core copy line, forfeit confirm (iOS = Android), rematch gating, intro line. Friends: 2.8.4 card design, nudge row, taunts, Today's Race rules, presence, badge label, notification prefs. Settings: theme/keyboard/sound/accessibility/season-preview copy. Onboarding: age check, tour cards, welcome, coach tips, What's New. Halloween: window, registry, art, sounds, flag — no mismatch. A11y: core label ports. Cross-cutting: all 34 parity fixtures present ×2, 10-10 live-review and dark-audit passes paritied ×3, RPS hand cycling ×3, 13+ lockout ink ×3, widget rollover ×2.

---

## Fixed 10-16 (small + safe (a) items; nothing committed)

Verified: web `tsc --noEmit` clean + `vitest run` (the only 3 failures are `lib/leaderboard-share.test.ts` ×2 and `lib/season-registry.test.ts`, both in files other agents are rebuilding — not from these edits); Android `:app:compileDebugKotlin`; iOS `xcodebuild build` for the simulator.

**Fixed**
- V1 (HIGH) web VS Home button forfeits with no confirm → `WEB/components/vs/vs-game.tsx`: `leaveWouldForfeit` (iOS `VSMatchViewModel.leaveWouldForfeit` rule: live human match or a friend's race, unsettled) + `homeTapped`; both `GameHomeButton`s route through it; a `VsCard` confirm "FORFEIT MATCH? / Leaving now forfeits the match — it counts as a loss [and uses today's daily VS]. / Keep playing / Forfeit & leave" (copy = iOS + Android). Bot practice, the send game and settled matches still leave straight away.
- Leaderboard 1 (HIGH) iOS Sweep → Yesterday podium drawn twice → `iOS/LeaderboardTab.swift` `sweepPodiumBoard` renders rows after `layout.filled` only (the ledge keeps the podium).
- Leaderboard 2 (MED) iOS Yesterday ≤ 3 finishers → empty card → new `YesterdayAllShown` ("That was everyone yesterday") in `iOS/LeaderboardBlocks.swift`, used by the game boards and the Sweep board.
- F1 (MED) web multi-board strip boards chip → `WEB/components/game/finished-kit.tsx` `ResultStrip` takes `boards={{ solved, total }}` → a purple "3/4 solved" chip (iOS wording + tint) ahead of guesses; on a loss the guesses chip reads `g/max`. Wired in `quordle-game.tsx`, `octordle-game.tsx`, `rescue-game.tsx`, `sequence-game.tsx`.
- Friends 1 (MED) iOS Friends tab badge ignores pending invites → `iOS/FriendsBadge.swift` `loadChallenges()` also fetches `InviteService.fetchPending` and keys them `inv:<id>` (Android / web keys).
- Friends 2 + 3 (MED) Android friend card → `AND/ui/friends/FriendCardsView.kt`: avatar + name open the profile (`onOpenProfile`, nested inside the quick-play card so the rest of the card still quick-plays); a friend with no games shows the six-game `StartRow` (tap = `QuickPlayRequest(friend, kind, kindChosen = true)`) instead of "Tap to pick a game". Wired in `AND/ui/FriendsPanel.kt`.
- Onboarding 1 (MED) iOS mode-limit modal copy → `iOS/HomeView.swift`: "Upgrade to Pro", "Come back tomorrow", "Play again tomorrow in" (Android / web).
- A11y 1 (MED) web keyboard keys read raw state words → `WEB/components/game/keyboard.tsx` `STATE_SPOKEN` ("correct" / "wrong position" / "not in word", iOS `a11yName`); Backspace key reads "Delete".
- Bughunt 5 (LOW) Word Chain tile width floor ×3 → iOS `FriendlyGameScreen.swift` (`max(16, …)` on both the chain row and the entry row), AND `friends/FriendlyGameScreen.kt` entry tiles `maxOf(16.dp, …)`, web `lib/pocket-boards.ts` `chainInputTile` `Math.max(16, …)`.
- Bughunt 7 / Friends 4 (LOW) "+N more" expanded label → "Show fewer" on Android (`FriendCardsView.kt`) and web (`friend-cards.tsx`), matching iOS and the shared a11y label.

**Android follow-up (founder-approved 10-16; Top-10 #5 and #10, nothing committed)**
- Top-10 #5 DONE: all 15 Material `AlertDialog(` call sites (the audit counted 14; `game/HubScreen.kt` "End the puzzle?" was a 15th) now present the family sheet. New in `AND/ui/FamilyActionMenu.kt`: `FamilyConfirm` (iOS `FamilyConfirm`: soft sheet, bubble-lettered question, line, quiet cancel + candy confirm, pink for danger, `cancel = null` = one-button notice) and `FamilyDialogSheet` (AlertDialog-shaped: title / bubble title, message, scrolling body, dismiss + confirm slots; optional container colour). `FamilyConfirm`: Purchase issue (`ProScreen.kt`, notice), Cancel invite (`InvitePanel.kt`), Unfriend (`FriendsPanel.kt`), Block this user (`PublicProfileScreen.kt`), End the puzzle (`HubScreen.kt`). `FamilyDialogSheet`: Report this user? reasons (`PublicProfileScreen.kt`), the `SettingsDialog` wrapper (all 5 Settings dialogs; Delete account and Unlink now `danger`), Your links / Private profile / Favorite game (`EditProfileScreen.kt`, same content), Archetypes / Head to head / Guarded board / Podium / Streak calendar (`PublicProfileSocial.kt`), "Your game waits for you" (`friends/FriendlyGameScreen.kt`, pocket night glass). Same copy, same actions, same behavior; no `AlertDialog(` left in `apps/android`. Not eyeballed on a device (compile + unit tests only).
- Top-10 #10 DONE (F5 + F7): removed the Android-only loss chips (Sudocious "cells left", Starsweep "stars left", Muddle "n/m solved", Kindred "n/4 groups"), so every strip is mistakes/checks / time / pts like iOS and web (the spoken srText keeps the progress line, as web does). Removed the `FinishedAnswer` tiles under a lost single board in `PostGameScreen.kt` and the 54 dp reserve they used (the board takes the room; the answer stays in the More word card and the loss popup). `FinishedAnswer` itself is now unused (left in `FinishedScreen.kt`).
- Button-family guard: no count dropped (no raw button sites touched), baseline unchanged; the guard passes. Verified `:app:compileDebugKotlin :app:testDebugUnitTest` green.

**Left (why)**
- (Android AlertDialogs, F5 and F7 were done in the Android follow-up above.)
- Items in files other agents are rebuilding: F2 (ProperNoundle rank badge — `ProperNoundleView.swift` is fine but the finish strip lives in `PostGameViews.swift`), F8 (word card label, `GameScreen.swift`), F10 (Sweep line punctuation — `PostGameViews.swift`), F11 (strip headline a11y labels — `PostGameViews.swift`), A11y 2 (`podium_burst` — `FinishPages.swift`), iOS multi-board guesses chip tint (`FinishedScreenKit.swift` is clear but the strip is `PostGameViews.swift`), V6 (challenge share text — share copy).
- Every (c) item (founder call): F3–F7, F9, F12, V3–V5, Stats 1/2/6, Leaderboard 3/4/6, Friends 6/7, Settings 2, Onboarding 2.
- Small (a) LOW items not reached in the time box: Android header 3 dp crown room (`AppHeader.kt:138`), Leaderboard 5 (web Records Friends "OF N FRIENDS"), Stats 3/4/5 (Sweep-streak tile, best-moment split, "NO GAMES YET"), V2 (forfeit result line), Friends 5 (nudge singular), Settings 1 (Linked sign-ins copy), Onboarding 3 (tour last button), the Friends-card collapsed a11y label ×3, iOS inline presence dot, Android presence line / Keep-Resign pill sizes, web friend-avatar CandyBadge.

### Fixed 10-16 (second pass: parity + medium findings, founder-approved; nothing committed)

Verified: web `tsc --noEmit` clean + `vitest run` 190 files / 1918 tests green; iOS Debug `xcodebuild` for the simulator succeeded; Android `:app:compileDebugKotlin` clean. No core change, so no `swift test`.

- **F2** iOS ProperNoundle rank badge only after the daily (`ProperNoundleView.swift`, `if vm.isDaily`).
- **A11y 2** iOS honors `podium_burst` (`FinishPages.swift`): the #1 glow, sparkles and crown drop run only when the flag is live; off = a still crown, no glow (Android / web). The static share-card glow is unchanged.
- **Onboarding 3** tour replay last button is "Got it" on iOS (checkmark, just closes, no Classic launch; `OnboardingView.swift`, `SettingsView.swift`). Android "Got it!" became "Got it". First-run signed-out last card: Android "Make my profile" became "Next" (iOS + web majority) in `Onboarding.kt`.
- **Stats 1** Today-card header (not finished) ×3: "Today · Oct 16" left, "3/8 PLAYED" right. iOS unchanged; Android `TodayCard.kt` ("Today · Oct 16", "3/8 PLAYED", still caps in its label style); web `today-card.tsx` (two bubble lines, was "Today · 3 of 8 done").
- **Leaderboard 4** empty states ×3 (title / line; titles keep each platform's casing):
  - Sweep today (Leaderboard + Records): "No sweeps yet" / "Nobody has swept today. Be the first!"
  - Game board today (Leaderboard + Records): "No results yet" / "Nobody has finished today. Be the first!"
  - Friends board, Leaderboard: "Your board is empty" / the shared add-friend mascot line
  - Records friends board: "Friends are still asleep" / "None of your friends have played yet today."
  - Records all-time Sweep: "No sweeps yet" / "Finish every daily in one day and you top this board. Be the first!"
  - Records all-time records: "No records yet" / "Every daily you finish can set one. The board starts with you."
  Changed on Android (`LeaderboardScreen.kt`, `RecordsScreen.kt`) and web (`daily/page.tsx`, `records/page.tsx`); iOS already had these.
- **F4** web Spyglass strip stat is "N/M found" (`spyglass-game.tsx`).
- **F10** web "All 8 dailies done. Sweep complete!" (`next-daily-cta.tsx`).
- **F11** strip headline labels aligned to the iOS set: "SOLVED IN 4" / "ALL 4 SOLVED" / "3 OF 4 SOLVED" / "SO CLOSE". Web `stripHeadlineLabel` in `finished-kit.tsx` (puzzles read "Solved!"); Android `stripHeadline` in `FinishedScreen.kt` (puzzles read "SOLVED!", was "SOLVED IN 2 MISTAKES").
- **F8** web word card reads "The word" after Unlimited, "Today's word" on the daily (`post-game-summary.tsx`, `practice-game.tsx`). iOS already right. **Android not done**: `PostGameScreen.kt:728` is off limits this pass; it still always says "TODAY'S WORD".
- iOS multi-board guesses chip is purple after the "N/M solved" chip (`FinishedScreenKit.swift`).
- **Leaderboard 3** "Play now" on an empty, unplayed game board: iOS (`LeaderboardTab.swift`, posts the Play-next-daily handoff) and web (`daily/page.tsx`, same gate/limit path as the strip's Play button), like Android.
