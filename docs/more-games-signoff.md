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

## Hubbub — what to look for (built overnight 2026-09-22 → 23)

- Daily "#N" counts from 2026-09-23; the first letter set is U·DELMNP (centre U, 25 words, max 81,
  pangram PENDULUM). Same puzzle everywhere on a date (bank bundled on both natives, sha-guarded).
  Seven letters, no S ever, centre letter required, words of four letters or more, letters may repeat.
- Tap tiles or type; **Delete · Shuffle · Enter** under the cluster. Four-letter words score 1,
  longer words score their length, a pangram (all seven letters) adds 7. A real word that is not on
  the scoring list is accepted as a **bonus word** for 0 points (dimmed chip) — never "not a word".
- Ranks by % of the maximum: Hush 0 · Murmur 5 · Chatter 12 · Banter 20 · Clamor 30 · Racket 40 ·
  **Hubbub 50 = solved** · Uproar 70 · Thunder 85 · Pandemonium 100. The rank bar marks Hubbub.
- **Finalises once.** Reaching Hubbub records the win (XP, streak, achievements) and shows the
  victory card once; "End puzzle and see answers" before Hubbub records a loss and lists every word.
  After the win you can **Keep going**: each later rank-up updates your daily result, leaderboard and
  the matches row only (never games, XP or streak). Toast "Rank up: Uproar" on each step.
- **Starts with…** (50 points) shows the first two letters and length of an unfound word;
  **Reveal a word** (100 points) fills one in (violet chip). Neither counts against you.
- Finished screen: rank name, points/max · words · pangrams · time · hints, then Home · Share ·
  Keep going (· Play Again on Pro Unlimited). Victory card shows WORDS · TIME · POINTS. Score row
  reads "Rank bonus"; the stat label is the rank, e.g. "Racket".
- Share card: blank 2-3-2 silhouette with the centre filled, rank name, "% of the maximum", no
  letters. Caption names Rank · % · words · Score · Time. Pro "Keep playing: Unlimited Hubbub" on all three.
- Achievements: first Hubbub, 50 Hubbub days, pangram, Pandemonium, seven Uproar-or-better days in a
  row, pure (no hints) 1/10/50.

## Codebreaker — what to look for (built 2026-09-23)

- Daily "#N" counts from 2026-09-23; the first saying is "Give him an inch and he'll take a mile."
  (given A E I). Same puzzle everywhere on a date (bank bundled on both natives, sha-guarded). **On a
  holiday the saying belongs to the day** (28 holidays, `apps/web/data/holiday-days.json`) and the
  header shows the holiday's name — the first ones you can hit: Halloween Eve/Day (Oct 30–31),
  Diwali (Nov 8), Veterans Day (Nov 11), Thanksgiving Eve/Day (Nov 25–26).
- Every letter is a small tile with the CODE letter beneath it; the three most frequent letters are
  filled in the accent and locked. Tap a tile (or a chip in the frequency strip) and type: the letter
  lands in every tile with that code letter and the selection moves to the next open letter. Typing
  over replaces everywhere; **Delete** clears everywhere. Using one plain letter for two code letters
  reads red. Nothing is judged while you pencil.
- **Check** locks right letters (accent tint) and clears wrong ones with a red flash; each Check
  counts (score row "Check bonus": 750 / 500 / 250 / 0). **Hint** (100) fills the most frequent
  unsolved letter in violet. **Reveal** unlocks at 5:00 (the capsule counts down), shows the answer
  and records a loss. The puzzle completes itself the moment every letter is right.
- Finished screen: decoded board, the saying in quotes, "Code cracked clean" / "Code cracked" /
  "Answer revealed" + checks · time · hints. Victory card shows CHECKS · TIME · POINTS. Pro "Keep
  playing: Unlimited Codebreaker" on all three.
- Share card: the ciphertext only — blank cells with code letters — so it spoils nothing; caption
  "Score · Time · No checks".
- Achievements: Code Cracked, 50 cracks, Clean Crack (no Check), Swift (under 3:00), pure 1/10/50.
- Content: 372 everyday dailies + 60 Unlimited + 84 holiday sayings from the bank you are reviewing;
  your cuts flow through `merge-banks.mjs` → `build-bank.mjs` → the three copies (a rebuild before
  launch reorders the dailies; that is fine while nothing is live).

## Content banks awaiting your veto pass (drafted overnight 2026-09-22 → 23)

The four titles that need authored content now have first-draft banks, machine-validated, packaged
for one review sitting. Build the pack with `node apps/web/scripts/more-games/merge-banks.mjs` then
`node apps/web/scripts/more-games/build-bank-review.mjs`; it lands in `scripts/out/more-games-banks/`
(`index.html` + one page and one CSV per game; set the CSV `keep` column to `n` to cut a row).
Sources (committed, the files the real bank builders will read): `apps/web/scripts/groups/puzzles.json`
(Kindred, 516 puzzles = 460 everyday + 56 holiday, in `bank/` shards), `apps/web/scripts/cryptogram/sayings.json`
(Codebreaker, 516 sayings = 432 everyday + 84 holiday), `apps/web/scripts/crossword/phrases.json` (Crosswordocious,
82 evergreen + 28 holiday themes, 3,535 phrase pairs → 494 grids = 410 evergreen + 84 holiday) and
`apps/web/scripts/muddle/jokes.json` (Muddle, 442 puns = 386 everyday + 56 holiday, composed into four-word
puzzles; cartoons not drawn — that batch needs your image key). Plus the word games' holiday tables:
`apps/web/scripts/holidays/holiday-answers.json` (514 themed answers for Classic/Six/Seven/QuadWord/OctoWord/Gauntlet)
and `holiday-wotd.json` (thematic Word of the Day + definition), and the shared calendar
`apps/web/data/holiday-days.json` (160 holiday days 2026–2030).

**Your three rules, as built (2026-09-23):** every game ships ≥ 365 everyday puzzles (CI fails otherwise);
when a bank runs out it replays from its first puzzle, oldest first (never breaks), and you are told before
that: CI red at 60 days, the nightly sweep + admin > Ops **Content runway** card at 90, Sentry email at 30;
on any of the 28 holidays every game draws from that holiday's own set and the everyday puzzle that day is
simply never dated.

- **Kindred:** every puzzle proves exactly one solution with honest `alsoFits`; tiers 1–4; all words
  in the app lexicon (the authors had to drop cuisine loanwords, cheeses and most dog breeds — the
  lexicon is core English). Some tier-4 mechanics recur across the 400 ("sound like numbers" ×6,
  "hidden numbers" ×6): fine for a year of dailies, flag any you find tired.
- **Codebreaker:** proverbs only, 30–90 chars, three letters given. The 30-char floor excludes a few
  classics ("Laughter is the best medicine." is 29); say if you want the floor at 25.
- **Crosswordocious:** you asked for many more themes and for holiday puzzles on their dates. The
  evergreen bank is 46 themes; the holiday bank is 28 themes pinned by
  `apps/web/scripts/crossword/holidays.mjs` (fixed dates, weekday rules, Easter computus; Hanukkah,
  Passover, Lunar New Year and Diwali tabled 2026–2030 — check those against a calendar before the
  bank freezes). Holiday grids borrow filler from evergreen themes only. Holiday vocabulary the
  lexicon lacks sits on a per-theme `allow` list (MENORAH, DREIDEL, SHAMROCK, KINARA, MATZO…);
  proper nouns are only the holiday's own (SANTA, CUPID, LINCOLN, ABE, MOSES, PHIL, SAM) — cut
  any you would rather not see. The lexicon is American (NEIGHBOR, TRAVELED); "Friends and
  Neighbours" as a title may want the US spelling. MLK Day uses general sayings only (Dr King's
  words are under copyright).
- **Muddle:** the composer picks the four scrambled words from the Classic answer lists, so the
  puns are the review; the scrambled words were swept for tone (the blocklist grew after the first
  pass surfaced RACISM, GUNMEN, WHISKY). Cartoons come later, ten first for a style check.
- Hubbub, Letter Ladder, Sudoku and Starsweep need no authored content. Spyglass's 180 themes
  still await your skim (above).

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
