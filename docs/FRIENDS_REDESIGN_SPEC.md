# Friends overhaul — build spec (founder-approved 2026-10-01)

Mockups: design canvas Round 8 (board AD Friends tab, AE pocket games, AF ideas). Founder:
"build out the friends mode as you see it … rock paper scissors to be chatgpt images …
make sure the aesthetic always remains true". Ships on web, iOS and Android (parity
rule). Shared rules + words: `packages/core/src/friendly-games.ts` (ports assert against
`friendly-games-fixtures.json`, already in `apps/ios/Tests/Fixtures/` and
`apps/android/core/src/test/resources/fixtures/`). Server: `apps/web/app/api/friends/*`.

Goal: the tab feels alive the moment it opens, and there is always something to do with
a friend — live when they're on, turn by turn when they're not.

## 0. Look and feel (same rules as the home and VS pages)

- Page `#f8f7ff`; Nunito; ALL-CAPS 900 headlines; section labels 11/900, letter-spacing
  1.2, `#6b7280`; white cards radius 14 with a soft shadow, **no borders**; one shimmer.
- Friends accent is pink: ink `#831843`, mid `#9d174d`, solid `#db2777`, soft `#fce7f3`;
  title gradient `#db2777 → #7c3aed`. On-now green `#10b981`. Flame streaks orange
  `#c2410c` on `#f59e0b` (the home flame).
- Pocket-game colors and OUTLINE icons (white stroke 2.4 in a colored rounded square, glow
  in the same color): Rock Paper Scissors `#f97316` scissors · Tic-Tac-Tile `#7c3aed` hash
  (#) · Call It `#ca8a04` **coin** (two concentric circles + a short vertical line) · Pass
  the Puzzle `#2563eb` two opposing arrows. (Ghost, later, uses a ghost outline.)
- Tiles always use OUR colors: purple `#7c3aed` (right / you), amber `#f59e0b` (present /
  them), slate `#cbd5e1` (absent). Never Wordle green/yellow.
- Art (ChatGPT-designed, founder's key): `docs/design/friends-art/picked/{rock,paper,scissors,heads,tails}.png`
  (256 px, transparent). Web `/friends/<name>.png`; iOS image sets `friends-rock` …;
  Android `res/drawable-nodpi/friends_rock.png` …

## 1. "On now" (presence)

- While the app is in the foreground (web: tab visible), update your own profile every
  60 s: `last_seen_at = now()`, `last_activity` = the db key of the game on screen
  (e.g. `DUEL`, `scramble`) or null. Also update immediately on entering/leaving a game.
  The column only accepts `^[A-Za-z0-9_]{1,24}$` (a key, never text).
- `GET /api/friends` (digest) now returns per friend `lastSeenAt` (ISO or null),
  `activity` (a game title or null) and `friendStreak`.
- Online = core `isOnline(lastSeen, now)` (under 2 minutes). Row line = core
  `presenceLine(...)` ("On now · in Muddle", "Here 12 min ago") when it returns a value,
  otherwise today's line ("6/8 today", "Hasn't played today").

## 2. The Friends tab, top to bottom

1. Header: `FRIENDS` (gradient), bell = the existing notification prefs, add-friend
   icon = jumps to Add by username.
2. **Friends banner** (one window, 358 wide, radius 16, `linear-gradient(180deg,#fce7f3,#ede9fe)`
   + the white sheen; shimmer when anyone is on):
   - Frosted strip: core `friendsBannerHeadline(input)` 16/900 `#831843`; core
     `friendsBannerClockLine(input, clock)` 10.5/800 `#9d174d` (clock = to local midnight).
     Input: friend count, online usernames, today's race (me + friends by today's points,
     competition rank — the same numbers Today's Race uses).
   - ON NOW row: label + count; up to 5 faces (40 px, 2 px green ring with a soft pulse,
     green dot), name and a 2-word doing line ("in Muddle", "on now"). Tap a face → the
     quick-play sheet (§3). Nobody on: a soft line `Nobody's on right now · <name> was here
     N min ago` (the most recent presence), or `Nobody's on right now`.
   - TODAY'S RACE row: label + the best friend streak on the right (flame + `DOUG 12 DAYS`);
     three chips (rank medal 1 gold `#f59e0b` / 2 `#9ca3af` / 3 `#b45309`, name caps, points)
     — your chip gets a 2 px pink ring. Tap the row → a sheet with the full Today's Race
     (the existing ranked list, with its Challenge and bell actions).
3. **INVITES** (only when there are pending requests) — the existing card, restyled.
4. **YOUR TURN** (only when any active games): label + pink count pill. One card per active
   game, your-turn first: game icon square, `Tic-Tac-Tile vs @doug`, the server's `line`
   (pink), and a `PLAY` pill (solid pink) or a soft `WAITING` pill. Tap → the game screen.
5. **PLAY WITH FRIENDS**: label + right hint (`TAP A GAME, PICK A FRIEND`). A 2 × 2 grid of
   the four games: icon square, name, sub (`Best of 3 · our tiles`, `Three in a row, best
   of 3`, `Heads or tails, best of 5`, `One board, take turns`). Tap → the quick-play
   sheet with that game selected and a friend picker (online friends first).
6. **THIS WEEK'S RACE** — the existing weekly race card, restyled to these rules.
7. **YOUR FRIENDS**: label + `Nudge all who haven't played` (the existing slacker nudge).
   Rows: avatar (green dot when on), `@name`, presence or today line (green when on),
   flame + `friendStreak` (hidden at 0), and one action pill:
   on now → `Play` (solid pink, opens the quick-play sheet); played today → `Challenge`
   (soft pink, the existing free live VS challenge); hasn't played → `Nudge` (soft pink,
   the existing taunt picker). Row tap → profile; the existing menu stays.
8. **MOMENTS** — the existing feed, with reactions (§6) and the new game moments.
9. Add by username + share invite link (existing), then the existing InvitePanel.

## 3. Quick-play sheet

Bottom sheet on `#f8f7ff`: grabber; friend header (48 px avatar, on-now ring, `PLAY WITH
@DOUG` 17/900 `#831843`, presence line in green when on, `You lead 5–3 · 12-day friend
streak` in grey). `QUICK GAMES` label (+ ` · LIVE WHILE THEY'RE ON` when online): the four
game tiles (selected = 2 px pink ring). Call It selected → a stake row of chips from
`COIN_STAKES` (selected chip pink ring). `WORDOCIOUS` label: two cards — `VS Battle, live`
(teal; the existing free `/api/friends/challenge`) and `Race my run` (soft teal; the VS
Friend page with this friend preselected; Pro). CTA `INVITE TO <GAME>` (solid pink) →
`POST /api/friends/games {kind, friendId, stake}` → open the game screen. Footnote
`<Name> gets a ping. If they're busy, it waits as your turn.`

## 4. Pocket games (server-run; free for every signed-in player)

API (bearer-authed like /api/friends/*):
- `GET /api/friends/games` → `{active: GameView[], recent: GameView[]}`
- `POST /api/friends/games {kind, friendId, stake?}` → `{game, existing}` (one open game
  per kind per pair — returns it)
- `GET /api/friends/games/<id>` → `{game}` — poll every 2 s while the game screen is open
  (that also marks you as watching, so moves reach you live without a push)
- `POST /api/friends/games/<id>/move {move}` → `{game}`; 400 `{error}` for a bad move (show
  it inline); 409 `{retry: true}` → refetch and let the player try again
- `POST /api/friends/games/<id>/resign` → `{game}`
- `GameView = {id, kind, title, me ('a'|'b'), opponent {id, username, avatarUrl, avatarEmoji},
  state, status ('active'|'done'|'resigned'|'expired'), yourTurn, result ('win'|'loss'|'draw'|null),
  line, answer (Pass the Puzzle, once over), createdAt, updatedAt}`
- `state` shapes are the core types (`RpsState`, `TttState`, `CoinState`, `PassState`). In
  RPS the friend's open pick arrives as the string `"hidden"` (= they have picked).
- Moves: `{kind:'rps', pick:'rock'|'paper'|'scissors'}`, `{kind:'ttt', cell:0-8}`,
  `{kind:'coin', call:'heads'|'tails'}`, `{kind:'pass', word:'CRANE'}`.
- Pushes go to the friend when it becomes their turn or the game ends (url
  `/friends/games/<id>`, category `challenge`). Idle 3 days → expired.

Game screen (board AE): close (pink) + centered title (game gradient: RPS
`#f97316→#db2777`, Tic-Tac-Tile `#7c3aed→#db2777`, Call It `#ca8a04→#db2777`, Pass
`#2563eb→#7c3aed`). Score window: split halves (YOU left / @THEM right; tints per board
AE), frosted strip with core `friendlyHeadline(state, me)` + a sub line (best-of, live when
they're on, last round's result), avatars and big scores (no score for Pass). Then:
- **Rock Paper Scissors**: their card (face-down `?` on a pink-lavender gradient; `✓ DOUG
  PICKED` in green when `picks[them] === 'hidden'`), `YOUR PICK`, three tiles 104 × 118
  showing the rock/paper/scissors ART (selected = solid `#7c3aed` with glow). After each
  round, reveal both picks (art) with the winner glowing. Line: `Both picks flip at once.`
- **Tic-Tac-Tile**: 3 × 3 tiles 98 px radius 16: yours solid `#7c3aed` with a white ×,
  theirs solid `#f59e0b` with a white ○, empty white with a soft shadow; when it's your
  move and a tile would win, give it a dashed purple ring + glow. Legend `YOU · X` / `DOUG · O`.
- **Call It**: the coin ART (heads = W coin, tails = tile coin), 150 px, spinning briefly
  on each reveal then landing on the server's face. `YOUR CALL` → HEADS (solid purple) /
  TAILS (soft); otherwise `<NAME> CALLS`. `WHAT'S ON THE LINE` shows the stake chip.
- **Pass the Puzzle**: one Classic board (6 rows × 5, 44 px tiles, our colors) with the
  guesser's avatar chip at the left of each row; the on-screen keyboard colors letters by
  the best state seen; type on your turn; errors inline. The answer shows when it's over.
- Over: headline per core; buttons `REMATCH` (solid pink → POST the same kind with the same
  friend) and `FRIENDS` (soft pink). `RESIGN` lives in the close confirm while active.

## 5. Tab badge

The Friends tab badge = pending incoming requests + active games where `yourTurn`.

## 6. Moments with reactions

- `GET /api/friends/feed` now also returns `reactions: {[momentId]: {counts: {clap,fire,wow,grr,rematch}, mine: string[]}}`
  and game moments: `type: 'game'`, `kind` `'win'|'draw'`, `gameTitle`, `otherName`,
  `otherId`, `score` (`"2–1"`, `"by resignation"` or null). Text:
  win → `<Name> beat <other> at Tic-Tac-Tile (2–1)` (`you` when it's you; `You beat …`
  when you're the winner); draw → `<Name> and <other> drew at Call It`.
- Under each moment: chips for reactions with a count (👏 3, 🔥 1 …; soft pink, mine with
  a pink ring) and a `+` chip that opens the fixed set 👏 🔥 😱 😤 (+ `Rematch` on game
  moments). Tap toggles: `POST /api/friends/react {momentId, ownerId, emoji, on}` (emoji
  keys `clap|fire|wow|grr|rematch`; ownerId = the moment's userId). A `Rematch` tap on a
  game moment also opens the quick-play sheet with that game and friend.

## 7. Deep links

`/friends/games/<id>` (push url): web page; natives open the game screen. Universal/app
links are not needed (push only).

## 8. Not in this build

Ghost, Word Chain, Call the race, Send a word, Duos, live lobby.
