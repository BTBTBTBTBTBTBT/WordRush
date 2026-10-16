# Share cards: the night style (founder 10-16, option B)

Founder: "update the share images to have the style and aesthetic that we've incorporated into the game … too much empty
space … the image should show and not clip" → approved mockups (this folder): `mock-B-night-today.jpg` (leaderboard),
`mock-B-night-fullboard.jpg` (leaderboard with rows), `mock-B-night-result.jpg` (finished game). "Let's do B. All share
screens need to match the aesthetic." Same on iOS, Android and web. Nothing ships until the founder sees real renders.

## Frame (every card)
- Canvas 1080 wide, height clamped 1350 (4:5) … 1440 (3:4) — the existing share-fit clamp (iMessage crops taller). Content
  is laid out top-down; when it would pass 1440 the big block (podium / board) scales down, never the text.
- Background: the night gradient top `#1A0E2E` → bottom `#2E1440` (vertical). No cream page, no frosted cards.
- Header: the game's TITLE ART (the same bubble lettering the game screen shows: the season variant in season, e.g.
  Halloween drip `art-title-halloween-<mode>`, else the standard title art), ~150 px tall, centered. Leaderboard cards put
  the DAY title (`art-day-<weekday>`, e.g. FRIDAY'S FINEST with its mascot, ~210 px) above it.
- Info line under the title: one line, caps tracking, `#E2D6FF`, ~26-28 px heavy (e.g. `FRIDAY, OCT 16 · #24 · 8 × 8`;
  leaderboard: `DAILY LEADERBOARD · Oct 16, 2026 · #193 · as of 9:53 AM` in a soft pill white 10%).
- Footer (every card): the WORDOCIOUS cast row (the real transparent cast art, white letters on their tummies — never keyed
  off another image), drawn ~15% larger than today, with a soft light under it (a wide radial glow white ~12%) so it reads on
  night; under it `wordocious.com` in bright solid lettering at least as large as today (~34 px black weight, `#EDE6FF`),
  clearly readable.
- No outlined boxes; fills and glows only. American spelling.

## Leaderboard cards (daily board per game, Yesterday, Sweep, Friends race, Records)
- Header (day title + game title + info pill), then the one-image stadium PODIUM drawn exactly like the app's podium
  (core PODIUM_ART: stage art, mascots on the steps, names above heads, crown hat on #1, stats in the step panels, the open
  spot's sleeping R), full card width minus ~60 px, soft-feathered into the night background.
- Rows for places 4+ under the podium (compact 78 px rows: gold rank, name, points + detail right), and the player's own row
  always shown (gold-tinted) even when outside the shown rows.
- Fit: 2-3 players → 4:5. More rows grow the card to 3:4, then the podium scales down to keep everything.

## Finished-game cards (every game, daily + unlimited)
- Title art, info line (`WEEKDAY, MON D · #N · <size or mode detail>`), the status line in lavender (`Board cleared` /
  `Solved in 3` / the game's own finished word), the same three STAT CHIPS as the finished screen (dark pills with the
  colored top bar: mistakes/guesses · time · points), the game's finished board (or its result graphic), then the SCORE
  BREAKDOWN panel exactly like the finished screen (title row with the total, then each line with its detail and value —
  use core ScoreBreakdown / the same breakdown rows the screen renders), then the footer.

## Spoilers: EVERY game offers the chooser (founder 10-16: "the puzzle games need spoiler and non spoiler options")
The existing chooser (web `chooseShareVariant`, iOS ShareVariantSheet, Android equivalent): `No spoilers` / `Full results`,
with a per-game subtitle. Today only the word games use it; add it to every game. No-spoiler versions:
- Word games (Classic, Six, Seven, QuadWord, OctoWord, Gauntlet, Succession, Deliverance, ProperNoundle): unchanged rule —
  colors only vs letters revealed.
- Starsweep: the colored regions, NO stars / X marks (subtitle "Regions only" / "Stars revealed").
- Sudocious: the grid with the given digits only, solved cells as soft filled squares (no digits) / full digits.
- Crosswordocious: the grid shape with filled squares tinted, no letters / letters.
- Kindred: the four group color rows, no words / words.
- Spyglass: the grid with found paths as color strokes, letters hidden / letters shown.
- Hubbub: rank + words found + pangram count, no words / with the found words.
- Muddle: the cartoon + solved stats, no answer / the answer and caption.
- Letter Ladder: the rungs as blank colored tiles / the words.
- Codebreaker: the quote as masked blocks / the decoded quote.
Leaderboard cards are spoiler-free by construction (no chooser).
