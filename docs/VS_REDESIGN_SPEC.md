# VS overhaul — build spec (founder-approved 2026-10-01)

Mockups: the design canvas, Round 7 (boards Z, AA, AB, AC). Founder: "Go with your picks
and build it on all three"; "make sure the stats all align with the stats in the
respective vs modes in the stat menus too". Every item ships on web, iOS and Android
(parity rule). Shared rules live in `packages/core/src/vs-lobby.ts`; the Swift/Kotlin
ports assert against `vs-lobby-fixtures.json` (already generated into
`apps/ios/Tests/Fixtures/` and `apps/android/core/src/test/resources/fixtures/`).

The idea: almost nobody is ever waiting live (5 human matches ever), so every tap must
end in a game, and friends must be able to play without being online together.

## 0. Look and feel (same aesthetic as the new home)

- Page background `#f8f7ff`. Nunito everywhere; headlines ALL CAPS, weight 900.
- Section labels: 11 sp/pt, weight 900, letter-spacing 1.2, `#6b7280` (PLAY, RIVALS, THE LADDER…).
- Cards: white, radius 14, soft shadow (`0 2 10 rgba(76,29,149,0.07)`), **no borders**.
- VS accent is teal: ink `#0f766e`, soft `#ccfbf1`, deep `#134e4a`; title gradient
  `#0d9488 → #0891b2`. Primary VS buttons: solid `#0f766e`, white caps text. Soft pills:
  `#ccfbf1` bg, `#0f766e` text.
- Results screens use the HOME palette (purple), see §5.
- Real mode icons (the same icon set as the home cards). Bot art, never emoji (§9).
- The share icon sits bare in the frosted strip (no bubble), exactly like the home banner.

## 1. The VS banner (one window, like the home banner)

358 wide, radius 16, background `linear-gradient(180deg, #d5f5ee, #e0f2fe)` with the same
white sheen as home; gold (`#fde68a → #fcd979`, glow `0 0 26 rgba(245,158,11,0.8)`, trophy
icon) on a VS sweep (`vsSweep`). One shimmer when either of today's battles is won.

- Frosted strip (`rgba(255,255,255,0.5)`): headline `vsBannerHeadline(...)` 16/900 ink
  `#134e4a` (gold: `#78350f`); clock line `vsBannerClockLine(..., clock, {free, challengeLeft})`
  10.5/800 `#0f766e` (gold: `#92400e`). `clock` counts down to the next **UTC** midnight
  (Daily Battle + Bot of the Day are UTC-seeded). `challengeLeft` = hours left on the
  newest open incoming challenge, e.g. `17H` (minimum `1H`).
- TODAY row: label `TODAY` + `vsTodayStatus(...)`, then two tiles side by side:
  - **DAILY BATTLE** (swords icon) — open: `Classic · open` (free: `Classic · free`);
    won `Beat @kate` / `Beat Lexi`; lost `Lost to @kate`; draw `Draw with @kate`.
  - **BOT OF THE DAY** (bot icon) — open: `<Bot> · open` (free: `<Bot> · free`);
    won `Beat <Bot>`; lost `Lost to <Bot>`; draw `Draw with <Bot>`.
  - Tile look: open = white 85% + 1.5 dashed teal border (45%), teal icon on `#ccfbf1`;
    won = solid `#0f766e`, white text, glow `0 0 10 rgba(15,118,110,0.55)`;
    lost/draw = solid `#9ca3af`, white text. Tapping an OPEN tile starts that battle.
- RECORD row: label `RECORD` + `vsRecordLine(people, bots, ladder)` + flame with the bot
  win streak. `people` = SUM of `user_stats` rows with `play_type = 'vs'` (all modes),
  `bots` = SUM of `play_type = 'vs_cpu'` — **exactly the numbers the Stats page's VS
  section shows** (stats alignment). `ladder` = `ladderCleared` (null for free players).
  The streak is the same CPU progression store Stats reads for "best CPU streak".

Today's results:
- Daily Battle vs a **person**: the existing `daily_results` row (`play_type 'vs'`,
  today UTC): `vs_wins > 0` → won, `vs_losses > 0` → lost, a played game with
  neither → draw.
- Daily Battle where a **bot stepped in** (§6): local key
  `wordocious-vs-daily-<YYYY-MM-DD UTC>` = `{"result":"won|lost|draw","opponent":"Lexi"}`.
  The person row wins if both exist.
- Bot of the Day: progression fields `botOfDayPlayedDay` (UTC day) +
  `botOfDayResult` (`won|lost|draw`), §7.

## 2. The lobby (route/screen `VS`), top to bottom

1. Nav: back chevron (teal), title `VS BATTLE` (teal gradient), right side the honest
   count: `N looking` with a green dot when anyone is waiting in the matchmaking queue
   (sum of `/vs/counts` waiting across modes, excluding yourself), otherwise
   `N online` with a grey dot (`/presence`).
2. The VS banner (§1).
3. Incoming challenges (only when any): up to 3 cards, newest first, from
   `GET /api/vs/challenges` → `incoming`. Card: initial avatar circle, `CHALLENGE FROM @DOUG`
   (11/900 teal, caps), line `Classic · solved in 4 · 1:52 · 17h left` (unsolved run:
   `Classic · not solved · 17h left`), `RACE` pill (solid teal). Tap → race flow (§4).
4. PLAY: label `PLAY` + selected mode name (caps, in the mode's color) on the right.
   - Mode strip: the 9 VS modes in `VS_MODE_ORDER`, 34×34 tiles radius 9: selected =
     filled with the mode color + glow + white icon; others white with colored icon.
     Selection persists locally (`wordocious-vs-mode`). Default `DUEL`.
   - Three equal tiles (3 columns, white cards, min height 104): icon in a 30×30 soft-teal
     square, title 12/900, sub 10.5/700 `#4b5563`:
     - **LIVE** (radio icon): `N waiting now in <Mode>.` when the queue for that mode has
       someone, else `0 waiting now. A bot steps in at 0:15.` → live search (§6).
     - **FRIEND** (users icon): `You play first. They race your run.` → Friend page (§3).
     - **BOTS** (bot icon): `Ladder <cleared> of 4. <Next> is next.` (`Ladder cleared!`
       at 4) → Bots page (§8).
5. RIVALS (Pro): label + `See all` (→ Stats All-time VS section). Top 3 from the existing
   rivalries fetch (H2H from `matches`): initial avatar, `@name`, `You lead 4–3 · last: QuadWord`
   (teal) / `You trail 1–2 · last: Classic` / `Even 2–2 · last: Gauntlet` (grey), and a
   soft `Challenge` pill → Friend page with that friend preselected. Hide when empty.
6. YOUR CHALLENGES (only when you sent any in the last 24 h): up to 3 compact rows from
   `sent`: mode icon, `Classic · sent to 2`, right side `@doug beat it` / `@doug lost` /
   `waiting` (results are already from YOUR side in the API).
7. `HAVE A CODE?` label, code field (8 chars, caps, letter-spaced), soft `JOIN` pill. Join
   first tries `GET /api/vs/challenges/<code>` (200 → race flow); otherwise it is a live
   private-match code (the existing join path).

**Free players**: banner in `free` mode (ladder hidden). Mode strip shows every icon but
only Classic is selectable (others at 35% opacity; tap → Pro page). Tiles:
**DAILY** `Today's battle. A bot steps in if nobody is on.` (after today's battle:
`Played today. Pro plays live any time.`), **FRIEND** with a small lock
`Send with Pro. Answering is free.` (→ Pro page), **BOTS** `Bot of the Day is free. Ladder is Pro.`
(→ Bots page with locks). Instead of Rivals: a card (gradient `#ede9fe → #ccfbf1`)
`GO PRO FOR ALL OF VS` / `All 9 modes, live matches any time, challenge any friend, the bot ladder, rematches and your rivals.` / `SEE PRO` (purple pill). Incoming challenges and
the code row work for free players. **Guests** keep today's sign-in card.

## 3. Friend page (`Challenge`) — Pro to send

Nav: back, `CHALLENGE` title, mode chip on the right (icon tile + mode name in its color).

- Segmented control on `#ccfbf1`: **RACE MY RUN** (`they play any time in 24 h`) |
  **LIVE NOW** (`both online`). Default RACE MY RUN.
- RACE MY RUN: `FRIENDS` list (accepted friends; avatar, `@name`, H2H line like Rivals or
  `Never played · new friend`), multi-select with round checks (selected row gets a 2px
  teal ring). A `Send a link instead` row (link icon) is selectable too. CTA
  `PLAY, THEN SEND TO N FRIENDS` (`… TO 1 FRIEND`; link only: `PLAY, THEN SHARE A LINK`;
  disabled with nothing picked). Footnote `They get a notification with your time to beat.`
- LIVE NOW: the existing invite flow (link or @username into the live private lobby).

Challenge-send game: the normal VS game screen on a fresh `generateMatchSeed()` for the
mode, with **no opponent** — the opponent panel reads `YOUR RUN` / `N friends will race it`
(or `Anyone with the link`). The match ends when the player finishes. Then
`POST /api/vs/challenges` `{gameMode, seed, run, friendIds, link}` where
`run = {solved, boardsSolved, totalBoards, guesses, timeMs, guessLog, solutions}`
(guesses = the VS score unit the live match uses; guessLog = the player's guesses).
Nothing is recorded to the challenger's stats now — each friend's race adds a game to
both players later (server side). Result screen in the home palette: headline
`CHALLENGE SENT!`, sub `CLASSIC · SOLVED IN 4 · 1:52 · 24H TO RACE` (unsolved:
`CLASSIC · NOT SOLVED · 24H TO RACE`), the player's mini board, buttons `SHARE LINK`
(when link: share `https://wordocious.com/vs/challenge/<code>` with text
`Race my Wordocious <Mode> run — code <CODE>`) and `VS HOME`.

## 4. Racing a challenge (free to answer)

Entry: incoming card, push (`url: /vs/challenge/<code>`), the code field, or the web link
`/vs/challenge/<code>` (natives route this URL to the race flow).

- `GET /api/vs/challenges/<code>` → `{challenge, isMine, expired, entry}`.
  `expired` → a simple card `This challenge has expired` + `VS HOME`. `entry` present →
  show the result screen (§5) from stored numbers. `isMine` → show `Your challenge` with the
  results so far (from `GET /api/vs/challenges` `sent`).
- Intro card (frosted, teal): `RACE @DOUG'S RUN`, mode chip, target
  `Solved in 4 · 1:52` (or `Not solved — just solve it`), `Same puzzle. Doug's pace plays
  out beside you.`, `START` button.
- Game: the normal VS screen against a **ghost of the challenger's run**: the local bot
  service with `fixedSeed = challenge.seed`, plan options `targetGuesses = run.guesses`,
  `targetSolveMs = run.timeMs`, and the bot solves only if `run.solved`. Opponent identity
  is the challenger (username + avatar, NOT a bot label; subtitle `@doug's run`).
- On finish: outcome = core `vsOutcome(myRun, challengerRun)` (never the bot service's own
  winner), then `POST /api/vs/challenges/<code>/result {run}` (server stores the entry,
  writes the shared `matches` row, counts the challenger's side, pushes them), and the
  racer records their own side through the NORMAL live-VS path
  (`recordGameResult(me, mode, 'vs', won, guesses, timeMs, seed, …, isDraw)` with XP).
  Do **not** write a matches row from the client and do **not** record vs_cpu.

## 5. Challenge result screen (home palette — board AA phone 4)

- Top: close (purple), centered `WORDOCIOUS` wordmark gradient.
- One window (radius 16): background split left/right — YOUR half `#ebd6fd` when you won,
  otherwise `#e2e6ff`; THEIR half `#ebd6fd` when they won; draw: both `#ece8ff`.
  Shimmer when you won.
  - Frosted strip: swords icon `#7c3aed`, headline `challengeHeadline(outcome, name)`
    16/900 `#4c1d95`, bare share icon `#6d28d9` on the right; below it the mode icon
    (18×18, mode color) + `CLASSIC · SAME PUZZLE · <vsMargin>` 10.5/800 `#6d28d9`.
  - Two columns: label `YOU` / `@DOUG` (10/900 caps, trophy on the winner), mini board,
    big time `vsClock(timeMs)` 22/900 `#4c1d95`, `SOLVED IN 3` / `NOT SOLVED` 10/900.
  - Mini board tiles (16×16, radius 4, gap 3) in OUR colors: correct `#7c3aed` with a
    soft purple glow, present `#f59e0b`, absent `#cbd5e1`. Single-board modes: each guess
    row evaluated against the solution. Multi-board modes: one square per board (filled
    `#7c3aed` = solved, `#cbd5e1` = not).
- H2H card: avatar, `YOU AND @DOUG` (10/900 grey), `You lead 5–3` (14/900 `#4c1d95`),
  XP chip (`#fef3c7` bg, `#fcd34d` border, `#92400e` text) `+100 XP`.
- Buttons: `CHALLENGE BACK` (solid `#7c3aed`, sub `new puzzle, Doug races you`) → Friend
  page with Doug preselected (free → Pro page) and `VS HOME` (soft `#ede9fe`, `#6d28d9`).

## 6. Live search (queue screen) — never a dead end

- Ring timer counting up (teal ring on `#ccfbf1`, pulse behind), `SEARCHING`,
  headline `LOOKING FOR A RIVAL`, line `Nobody else is waiting in <Mode> right now` or
  `N waiting in <Mode>` from `/vs/counts`.
- Step-in card: bot art, `<Bot> steps in at 0:15`, sub `If a person joins first, you get them.`,
  a progress bar to 15 s, buttons `PLAY <BOT> NOW` (solid teal) and `KEEP WAITING` (soft).
- At 15 s the bot match starts **automatically** unless KEEP WAITING was tapped (then the
  card says `We'll keep looking` and PLAY NOW stays). The bot is labelled a bot, as today.
- Which bot: Pro = the ladder's next bot (Adapt once cleared); the free Daily Battle = Lexi.
- **Free Daily Battle can now fall back to the bot** (today it waits forever). That game
  records like any bot game (`vs_cpu` stats + progression) and writes the local
  `wordocious-vs-daily-<UTC day>` result; the daily VS play is already consumed at match
  start. It does NOT write a `daily_results 'vs'` row (People record and the VS
  leaderboard stay people-only).

## 7. Progression (per device, as today) — new fields

Add to the CPU progression store (web `lib/bot/cpu-progression.ts`, iOS
`CpuProgression.swift`, Android equivalent), defaults shown:
`ladderCleared: 0`, `ladderRun: 0`, `botOfDayPlayedDay: null`, `botOfDayResult: null`.
- After every bot game: `{cleared, run} = ladderAfterGame({ladderCleared, ladderRun}, botId, won)`
  with botId by kind: easy→`rook`, medium→`lexi`, hard→`nova`, adaptive→`adapt`,
  Bot of the Day→`daily`, ghost→`ghost`, challenge ghost→not a bot game at all.
- Bot of the Day: set `botOfDayPlayedDay = today UTC` and `botOfDayResult` on finish
  (win/loss/draw), keep the existing streak logic.
- Free players may play the Bot of the Day once per UTC day (Classic); Pro any mode.

## 8. Bots page

Nav: back, `BOTS`, mode chip. Then:
- BOT OF THE DAY card (frosted teal window): `BOT OF THE DAY · LEXI`, `SAME BOT, SAME PUZZLE FOR EVERYONE`,
  bot art (48), `Medium · solves in 4–5` (tier line from the persona), flame
  `N days in a row` (botOfDayStreak), `PLAY` (teal). Played today → the result instead of PLAY.
- THE LADDER: label + `STREAK <streak> · BEST <bestStreak>` (orange). Four rungs from
  `ladderRungs(...)` joined by a 3px vertical line (teal up to the next rung, grey after):
  avatar 36 with the art (cleared: `#ccfbf1` bg + 2px teal ring; next: `#ede9fe` + 2px
  purple ring and glow; locked: grey, row at 55% opacity), `Rook · Easy`, the core line,
  and a tag `CLEARED` (teal) / `NEXT` (orange `#c2410c`) / `LOCKED` (grey). The next row
  is a white card with a 2px teal ring. Tapping a cleared or next rung plays that bot;
  locked does nothing.
- BEAT YOUR BEST: ghost art, `Beat your best`, `Your best <Mode>: N guesses · m:ss`,
  soft `Race it` pill (hidden when there is no best run).
- Free: Bot of the Day playable (Classic); ladder rows and Beat your best show a lock and
  route to the Pro page.

## 9. Bot art

The founder-picked GPT designs: `docs/design/vs-bots/picked/{rook,lexi,nova,adapt,ghost}.png`
(256 px, transparent). Web serves them from `/vs/bots/<id>.png`. iOS: asset catalog image
sets `bot-rook`, `bot-lexi`, `bot-nova`, `bot-adapt`, `bot-ghost`. Android:
`res/drawable-nodpi/bot_rook.png` etc. Replace the persona emoji (🤖🧠⚡⚖️👻📅) everywhere
a bot appears (lobby, Bots page, queue step-in, CPU chip/header, intro splash, result) with
the art in a circle; keep the names and banter.

## 10. Stats alignment

- The Stats All-time VS section's toggle reads **People | Bots** (was Live | CPU) on all
  three platforms, and any "CPU" wording in that section becomes "Bots".
- People = `user_stats` `'vs'`; Bots = `user_stats` `'vs_cpu'` — the banner's RECORD row
  uses the same sums, so the numbers always match.
- Async challenge results count as People games for BOTH players (racer: client
  `recordGameResult 'vs'`; challenger: server `addVsStat`) and appear in head-to-head,
  Rivals and Recent Matches through the one shared `matches` row.

## 11. API (web, bearer-authed like /api/friends/*; natives call https://wordocious.com)

- `POST /api/vs/challenges` `{gameMode, seed, run, friendIds?: string[], link?: boolean}`
  → `{code, url, invitees}` (403 when not Pro).
- `GET /api/vs/challenges` → `{incoming: ChallengeView[], sent: [{code, gameMode, createdAt,
  expiresAt, invitees, results: [{username, outcome (sender's side), guesses, timeMs, solved}]}]}`.
- `GET /api/vs/challenges/<code>` → `{challenge: ChallengeView, isMine, expired, entry}`.
- `POST /api/vs/challenges/<code>/result` `{run}` → `{outcome, margin, challengerRun, alreadyRecorded}`.
- `ChallengeView = {code, gameMode, seed, challenger: {id, username, avatarUrl},
  run: {solved, boardsSolved, totalBoards, guesses, timeMs, guessLog, solutions},
  createdAt, expiresAt, isLink}`.
- Tables `vs_challenges` / `vs_challenge_entries` (applied 2026-10-01,
  `supabase/manual-migrations/20261001000002_vs_challenges.sql`).

## 12. Not in this build

Server-synced progression, and per-bot win–loss lines on the ladder.

## 13. "Ping me when someone's looking" (founder, 2026-10-01 follow-up)

- Opt-in preference `profiles.notification_prefs.vsLooking` — a MISSING key means
  **OFF** (unlike the friends categories). Clients write it the same way the
  notification-prefs toggles write `notification_prefs` (merge into the existing object).
- Live search screen (§6), Pro only, live random queue only (not the Daily Battle): a row
  under the step-in card — bell icon, `Ping me when someone's looking for <Mode>`, a
  switch (on = solid `#0f766e`) bound to `vsLooking`.
- KEEP WAITING (Pro, live random queue) also calls `POST /api/vs/looking {gameMode}`
  → `{pinged, throttled}`. The card line under the buttons then reads
  `We pinged N players who play live.` (N = 1: `We pinged 1 player who plays live.`),
  `Nobody has pings on yet. We'll keep looking.` when 0, and stays `We'll keep looking`
  when throttled.
- The push (`Someone's looking for a <Mode> match`) carries `url: /vs/live/<MODE>`:
  web redirects into that mode's live queue; natives route it to the live search for
  that mode (same as tapping LIVE in the lobby with that mode selected).
- Server: `app/api/vs/looking/route.ts`, table `vs_looking_pings` (sender ≤ 1 per 10 min,
  recipient ≤ 1 per 30 min, ≤ 50 recipients, Pro senders and recipients only).

## 14. Race results never get lost (founder, 2026-10-01 follow-up)

- Racing a friend's run, the racer's own side (+ XP) is recorded only after the server
  accepts the result (`alreadyRecorded: false`), as built. NEW: when the result POST fails
  with a network error or a 5xx, save it to a local pending list
  `wordocious-vs-pending-races` = `[{code, gameMode, seed, run, savedAt}]` (one per code)
  and show the result screen from the locally computed outcome with the line
  `Saved. We'll send your result when you're back online.`
- Every time the VS lobby loads (and on app start where convenient), retry each pending
  item: success with `alreadyRecorded: false` → record the racer's side (+ XP) then drop
  it; success with `alreadyRecorded: true` → drop; a 4xx (400/403/404/410) → drop;
  network/5xx → keep; drop anything older than 3 days.
- Quitting a race mid-game is the SAME on all three platforms: post the run as unsolved
  (a loss, like a live forfeit) and record the racer's side as a loss (through the same
  pending path if offline). Leaving a challenge-send game mid-game sends nothing. Leaving
  a bot game records nothing.
