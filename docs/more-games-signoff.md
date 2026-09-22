# More Games — founder sign-off sheet

Nothing in More Games reaches a player until every cell below is ticked **by Brian**, on a real
build of each platform: the Vercel preview of `feature/more-games` for web, TestFlight for iOS,
the Play internal track for Android. Tester-audience flags keep it invisible to everyone else.
A game with any unticked cell stays flagged off; it can be held back without blocking the rest.

Tick a cell only after checking, in order:

1. **Home button** present top-left, returns Home, progress saved (reopen → same board).
2. **"?" button** present top-right; the sheet matches the other games' sheet; the clock pauses.
3. **Rules and scoring text** read correctly against real play (mistakes, hints, time, score).
4. **Daily/Unlimited**: the daily is the same puzzle on all three platforms for the same date;
   Unlimited (Pro) never lands on the daily; free players see the Pro gate.
5. **Finish**: win and loss overlays, the Solved/Out line, score breakdown, rank badge, XP toast,
   Home · Share · Play Again (Unlimited, Pro) and the Next Daily handoff.
6. **Records / Leaderboard / Profile**: the mode appears behind the **More** chip; its rows read in
   its own words (Sudoku: "0 mistakes"), never "guesses".
7. **Sweep untouched**: finishing the game changes nothing on N/8, the celebration, the profile
   ring, the friends panel or the widget.
8. **Share** image renders the board without spoiling it; the caption reads right.
9. **Kill/restore**: kill the app mid-game, reopen → same board, same clock; cross local midnight
   → the daily is discarded, Unlimited resumes.
10. **Polish**: side by side with Classic (light and dark, default and large text) nothing looks
    like it came from a different app.

| Surface | Web (Vercel preview) | iOS (TestFlight) | Android (Play internal) |
|---|---|---|---|
| More Games tile + sheet | ☐ | ☐ | ☐ |
| Pickers' More chip (Leaderboard, Records) | ☐ | ☐ | ☐ |
| Stats registry rows (Profile → mode) | ☐ | ☐ | ☐ |
| **Sudoku** | ☐ | ☐ | ☐ |
| **Starsweep** | ☐ | ☐ | ☐ |
| **Letter Ladder** | ☐ | ☐ | ☐ |
| Muddle | ☐ | ☐ | ☐ |
| **Spyglass** | ☐ | ☐ | ☐ |
| Crosswordocious | ☐ | ☐ | ☐ |
| Codebreaker | ☐ | ☐ | ☐ |
| Kindred | ☐ | ☐ | ☐ |
| Hubbub | ☐ | ☐ | ☐ |

## Sudoku — what to look for (built 2026-09-22)

- Daily = Medium, "#N" in the header counts from 2026-09-23. Same givens everywhere on a date.
- Three mistake dots; the third wrong digit ends the game and the board shows the solution muted.
- **Notes** is a toggle (label never changes; it fills blue when on); pencil marks sit in the
  standard 3 × 3 corner grid and are cleared from a row/column/box when that digit is placed.
- **Undo** never refunds a mistake or a hint. **Hint** fills the selected cell (or the first empty
  one), costs 100 points, never a mistake.
- Pro Unlimited: Easy · Medium · Hard capsules above the board; switching starts a fresh puzzle.
- Score: mistakes + 1 out of 4, 300 per unused step, 30-minute speed cap. The share card is the
  board as coloured squares with "0 mistakes · 3:58".

## Starsweep — what to look for (built 2026-09-22)

- Daily board is 7 × 7 Monday–Wednesday and 8 × 8 Thursday–Sunday; "#N" counts from 2026-09-23.
  Same regions and the same hidden stars everywhere on a date (fixture-pinned on all three).
- One continuous ruled board: heavy rules between colour regions, hairlines inside a region, nine
  soft tints. Tap a cell once for ×, again for a star, again to clear. A wrong star turns red and
  counts a mistake that clearing never refunds; the third ends the game and the missing stars show
  muted. Stars placed by **Hint** are violet and cannot be erased.
- Action row: **Undo** · **Erase** (clears the last-tapped cell) · **Auto-cross** (toggle, fills gold
  when on; a correct star crosses out its row, column, region and eight neighbours) · **Hint**
  (places the star for the last-tapped cell's row, 100 points, never a mistake).
- Wording: always "Starsweep", win copy "Board cleared", picker chip "Stars". The guide's quick facts
  say More Games do not count toward the Daily Sweep. Nothing about this game should read "Sweep!".
- Pro Unlimited: 7 × 7 · 8 × 8 · 9 × 9 capsules above the board; switching starts a fresh board.
- Score: mistakes + 1 out of 4, 300 per unused step, 10-minute speed cap. The share card is the
  regions as coloured squares with the placed stars as dots and "0 mistakes · 2:10".

## Letter Ladder — what to look for (built 2026-09-22)

- Daily "#N" counts from 2026-09-23; the first ladder is SKIRT → CHOKE, par 5. Same puzzle
  everywhere on a date (the bank is bundled on both natives and sha-guarded against the web copy).
  Par follows the weekday: Mon/Tue 4, Wed/Thu 5, Fri/Sat 6, Sun 7 (a few days fall back a step
  where the pools ran thin).
- START is a filled purple row, each accepted rung a white row with the CHANGED letter filled in
  the sky-blue accent and ringed (violet when a Hint placed it), END waits as a dashed target. Type
  on the normal keyboard and press Enter.
- Rejections are FREE and say why: "Not in word list", "Change exactly one letter", "Already on the
  ladder", "Five letters, please". Every accepted word is a move; the header shows moves and moves
  left (budget = par + 5). Running out shows "Out of moves" and one shortest route, muted.
- **Undo** removes the last rung but the move stays spent. **Hint** places the next word on a
  shortest route from where you stand, counts as a move, costs 100 points, never a mistake.
- Finished screen: "Ladder climbed on par" / "Ladder climbed" / "Out of moves", then moves · Par ·
  "+1" (or "Par") · time. Victory card shows MOVES · TIME · POINTS. Score breakdown row is "Par bonus".
- Share card: START and END spelled out, rungs blank except the changed tile; caption/unfurl
  "Score · Time · Par 5 · +1 over par". Pro "Keep playing: Unlimited Letter Ladder" appears on all
  three.

## Spyglass — what to look for (built overnight 2026-09-22 → 23)

- Daily "#N" counts from 2026-09-23; the first grid is "Picnic Basket". Same grid everywhere on a
  date (bank bundled on both natives, sha-guarded). Ten words, 10 × 10, hidden across, down and on
  the two upward/downward-right diagonals — never backwards.
- **Theme bank needs your review.** 180 themes × ~24 everyday nouns in
  `apps/web/data/wordsearch-themes.json` were authored for the tester build. Skim it for anything
  you would not want on a grid; the builder already drops blocklisted words and 3-letter words.
  Changing a theme changes future dailies only after the bank is rebuilt (append-only once live).
- Select by tapping the first letter then the last (the first tap highlights), or by dragging.
  A found word gets a green capsule under it and is struck through in the list. A straight drag
  of 4+ letters that is not a word is a miss (toast "Not one of the words"); crooked or short
  drags cost nothing.
- **Hint** rings the first letter of the next unfound word (60 points, never a miss). **Reveal**
  unlocks at 5:00 (the capsule shows the countdown), ends the grid as a loss and shows the missing
  words as dashed red capsules.
- Finished screen: "Clean clear" / "Grid cleared" / "Revealed", then found · misses · time. Victory
  card shows MISSES · TIME · POINTS (Android also FOUND). Score row reads "Miss bonus".
- Share card: dot grid with the found words as capsules, no letters. Pro "Keep playing: Unlimited
  Spyglass" on all three.
- Not built yet: the Pro "Hard" variant with all eight directions (the bank only lays words forwards).

## Known gaps to close before the gate closes

- **Share link previews ("Solved 2/4", "Played X/4") come from the LIVE website**, not the app: the
  hosted `/s/…` page on wordocious.com writes the unfurl text, and production only gets the new
  wording (Score · Time · Mistakes, with the puzzle number) when this branch merges to main at
  launch. Fixed on the branch (`lib/share-page-copy.ts`, tested); the image itself is right today.
- **Every new game's finished screen must offer Pro players "Keep playing: Unlimited <Game>"** (and
  "View <Game> Leaderboard"). On iOS this is `NextDailyCTA` (looks up `homeModes + moreModes`) plus a
  branch per custom engine in `RootTabView`'s unlimited cover and `mintUnlimitedSeed`; on Android
  `NextDailyRow` shows it for any mode whose screen passes `onOpenUnlimited`; on web
  `KeepPlayingUnlimited` routes any daily mode. A new game is not done until all three show it.
- Native achievement *display* names come from production's `/api/achievements` until the web
  deploys, so a Sudoku unlock toast may show the key. Unlock detection itself is native and works.
- Android share is image + caption without the hosted `/s/` link (web and iOS upload theirs).
