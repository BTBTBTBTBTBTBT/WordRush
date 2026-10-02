# Art pass in the apps (founder, 2026-10-02 night)

Founder: "a ton of new images for every aspect of WORDOCIOUS … one cohesive project across the
board"; "put the whole cast on the page titles"; "a W and L for the game cards instead of what is
populating now upon completion"; "new icons for the games too … match this same look"; game titles
stay in their game's color. Art made per docs/ART_PLAN.md and shipped by
`docs/design/brand/ship-art.py`. Parity on web, iOS and Android. Art + presentation only: keep
every behavior, query, tap and navigation.

## 0. Assets (already in the apps)

| Name | What | Web | iOS image set | Android |
|---|---|---|---|---|
| `art-day-<monday…sunday>` | Leaderboard day title, lettering + that day's host, one graphic (≈1080 wide) | `/art/<name>.webp` | `<name>` | `drawable-nodpi/<name_with_underscores>.webp` |
| `art-title-<friends, stats, records, vs, puzzles, wotd, settings, howto, gopro, moregames>` | Page title: lettering with the whole cast perched on / leaning on it (≈1080 wide) | same | same | same |
| `game-<mode id>` | Glossy 3D game icon in the game's color, 256 sq (ids: practice, vs, quordle, octordle, sequence, rescue, six, seven, gauntlet, propernoundle, more, sudoku, scramble, hub, crossword, groups, ladder, cryptogram, wordsearch, regions) | same | same | same |
| `icon3d-<badge-w, badge-l, badge-check, lock, bell, add-friend, share, sound, back>` | More 3D UI icons, 256 sq (join the HEADER_SPEC Icon3D set) | `/art/<name>.webp` | same | same |

Every image is decorative except titles, which carry the title text as their accessibility label
(e.g. "Friday’s Finest", "Friends"). Size titles by width (fill the content width up to ~420 pt,
height follows the aspect ratio); never stretch.

## 1. Leaderboard day title

Where the Leaderboard banner shows the day title text from core `leaderboardTitle` (MONDAY
MASTERS … SUNDAY SUPERSTARS), show `art-day-<weekday>` instead (weekday of the board's date, same
source the text uses). Holidays (`<HOLIDAY> HEROES`) keep today's text treatment. The banner's own
O2 host is dropped when the day art shows (the art has its host). Keep the title's slot height
sensible (≈96–120 pt tall art, centered).

## 2. Page titles (whole cast)

Replace the text title (and its host mascot, if any) with the page's `art-title-*`:
- Friends tab: at the top of the Friends content (the slot left after the FRIENDS title was
  removed; the bell / add-friend row stays, beside or under it).
- Stats tab: the STATS label + D row → `art-title-stats`.
- All-time Records banner title (ALL-TIME RECORDS) → `art-title-records` (keep the DAILY |
  ALL-TIME switch where it is).
- VS lobby title (VS BATTLE) → `art-title-vs`.
- Home PUZZLES section header → `art-title-puzzles` (smaller: ~70% width, left aligned is fine).
- Word of the Day card / page header → `art-title-wotd`.
- Settings header → `art-title-settings`; Pro page hero (GO PRO) → `art-title-gopro`;
  How to Play / Guides header → `art-title-howto`; More Games sheet header → `art-title-moregames`.
Back / close controls stay as the HEADER_SPEC white circles beside the art.

## 3. Game icons

Wherever a game's glyph is drawn (the shared mode icon: web `MODE_CHROME` / `GameTileGlyph`,
iOS `ModeIconView`, Android `ModeGlyph`), draw `game-<mode id>` instead (fills the chip; the chip
keeps its accent tint). This covers home cards, game tiles/squares, Leaderboard/Records/Stats
selectors, Friends quick-play, More Games, guides, VS mode strip. Keep the old glyph only as a
fallback if an image is missing.

## 4. Completion badges

On the home game cards, the 20 pt W / L pill becomes `icon3d-badge-w` / `icon3d-badge-l` at
26 pt (same corner); the VS "done without a known result" ✓ becomes `icon3d-badge-check`.
Anywhere else a daily W/L pill is shown for a game result (recent matches, profile), use the same.

## 5. More UI icons

Use the new Icon3D names where the matching line icon is still drawn: `lock` (locked free cards,
Pro gates), `bell` (Friends notifications), `add-friend`, `share` (share buttons in headers and
result cards), `sound` (game sound toggle), `back` (back circles). Keep sizes; the art fills its
square, so ~1.2× the old symbol size reads the same.
