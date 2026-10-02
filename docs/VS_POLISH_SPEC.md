# VS polish — every mode, every screen (founder, 2026-10-01)

Founder (with screenshots of VS Succession vs Rook): "the vs modes need a major audit on
ux and ui and need to look polished across the board. The games when playing in vs mode
need to match the exact boards the users are used to seeing and playing in the main
modes … Succession … needs to look like the daily. Audit every game on vs mode … make the
loading screens, waiting screens (both before and waiting for a player or bot to finish)
to match the updated aesthetic as a lot of this looks unfinished."

Applies to all nine VS modes (Classic, Classic Six, Classic Seven, QuadWord, OctoWord,
Succession, Deliverance, Gauntlet, ProperNoundle) on web, iOS and Android, and to every
VS screen: entry/loading, live search (queue), intro splash, countdown, the match itself,
"still playing" waiting screen, result, and the bot / race / challenge-send variants.

## 1. The match: the SAME board the player knows

- Each VS mode renders the gameplay area with the **same board component, layout, tile
  size, tile colors, keyboard, active-board rules and animations as that mode's daily /
  solo screen**. If the solo screen shows Succession one board at a time with the
  upcoming boards as minis, VS does exactly that; QuadWord/OctoWord use the solo grid;
  Gauntlet the solo stage stepper; ProperNoundle the solo board + hints row; Classic
  Six/Seven the solo 6/7-letter board. No VS-only board layouts, no dotted placeholder
  boards, no extra borders the solo screen doesn't have.
- The ONLY VS additions in a match:
  1. **Header**: the solo mode header (its icon + title in the mode's usual style) with a
     small solid teal `VS` pill beside the title and the elapsed clock; home/close as in solo.
  2. **Opponent strip** (one compact row, ≤ 64 pt tall, white card, soft shadow, no border):
     avatar (bot art for bots, the challenger for races), name (`Rook · Bot`), a slim
     progress bar (their boards solved / total, teal), `N guesses`, and a typing dot. For
     single-board modes a tiny 5×N color-only mini board on the right; for multi-board
     modes `2/4 boards` text, never a wall of empty mini grids.
  3. The callout toast (existing), restyled as a soft pill.
- Remove the large "Opponent" HUD card with empty grids from every mode.

## 2. Screens around the match (home/VS aesthetic)

Rules: page `#f8f7ff`; Nunito; ALL-CAPS 900 headlines (`#134e4a` on teal windows,
`#4c1d95` on purple ones); one-window cards with a frosted strip; white cards radius 14
with a soft shadow and **no borders**; teal VS accent (`#0f766e`, soft `#ccfbf1`); bot art
in circles; content always inside the safe area (nothing under the status bar or the
home indicator).

- **Loading / entry** (fetching the match, loading word lists): centered teal ring spinner
  on `#f8f7ff`, the mode icon in its color above it, `LOADING <MODE>` 12/900 grey. No
  bare text, no blank screen.
- **Live search / queue**: the VS overhaul queue (ring timer, step-in card) on every mode.
- **Intro splash**: two avatars facing each other (you vs them), names caps, the
  head-to-head line, mode chip; teal/purple window; 2.5 s as today.
- **Countdown**: big 3-2-1-GO in the mode color over the dimmed board, no gradient text.
- **"Still playing" waiting screen** (you finished first): a teal one-window card —
  headline `<NAME> IS STILL PLAYING` (bots: `ROOK IS STILL PLAYING`), sub line from the
  existing "needs N more boards …" copy, their avatar/art, `N guesses · m:ss · 2/4 boards`;
  then their live board(s) drawn with the **same mini-board component the solo screen
  uses**, laid out correctly for the mode (fix the overlapping/clipped grid bug — boards
  must never overlap or overflow horizontally); `YOUR RESULT` card (guesses, time,
  solved/boards) in the soft card style; `SKIP TO RESULT` (bots/races only) as a soft teal
  button; `LEAVE` as a small soft grey pill.
- **Result screen** (live, bot, race): home-palette window like the challenge result —
  split halves (winner's half `#ebd6fd`, other `#e2e6ff`; draw both `#ece8ff`), frosted
  strip with `YOU WIN!` / `<NAME> WINS` / `IT'S A DRAW` (caps 900 `#4c1d95`), a sub line
  with the mode icon and the deciding margin (core `vsMargin`), then per side: name,
  the score in big numerals, `9 guesses + 2.43 time`, time, Solved / Not solved chip
  (purple/slate, not green). Under it the score rule line in small grey. Buttons:
  `REMATCH` solid `#7c3aed` (not an orange gradient), `HOME` and `SHARE` soft `#ede9fe`
  with `#6d28d9` text. Session tally and the "Bot game — counts in your Bots record, not
  People" note sit BELOW the window inside the safe area. Final boards card: white, soft
  shadow, no purple outline borders on each board unless the solo completed board has
  them; boards use the solo completed-board component.
- Toasts, forfeit confirm and rematch prompts: soft cards, caps titles, purple primary /
  soft secondary buttons.

## 3. UX fixes to check in every mode

- Keyboard letter colors and hardware keys behave exactly like solo.
- The active board / board focus rules match solo (Succession unlocks in order, Gauntlet
  stages, Deliverance rescue order).
- Tapping a solved/locked board does what solo does (nothing broken).
- No layout jumps when the opponent strip updates; no clipped boards on small phones
  (iPhone SE / 360 dp) or iPad.
- Back/leave always asks to forfeit only during a live match.
- Every string American English; numbers formatted like solo.

## 4. Deliverable

A short audit list (mode × screen × issue × fix) in each platform's report, then the fixes.
