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
| Letter Ladder | ☐ | ☐ | ☐ |
| Muddle | ☐ | ☐ | ☐ |
| Spyglass | ☐ | ☐ | ☐ |
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

## Known gaps to close before the gate closes

- The hosted share page (`/s/…`) caption for a Sudoku share still reads "1/4"; the image is right.
- Native achievement *display* names come from production's `/api/achievements` until the web
  deploys, so a Sudoku unlock toast may show the key. Unlock detection itself is native and works.
- Android share is image + caption without the hosted `/s/` link (web and iOS upload theirs).
