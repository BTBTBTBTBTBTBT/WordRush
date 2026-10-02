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

## 6. Moment lettering (second pass)

New assets `art-moment-<victory, soclose, sweep, flawless, youwin, youlose, draw, newrecord,
streak>` (≈900 wide, glossy lettering; gold for wins, purple-pink for SO CLOSE / DRAW, slate for
YOU LOSE, fire for STREAK). Show the image in place of the matching text headline, ~70% of the
card width, max ≈72 pt tall, accessibility label = the words:
- Solo daily result card: win headline (VICTORY) → `victory`; loss headline → `soclose` (keep any
  subtext like the answer reveal).
- VS / bot / challenge result: YOU WIN → `youwin`, YOU LOSE (or lost/forfeit headline) →
  `youlose`, draw → `draw`.
- Sweep celebration headline → `sweep`; Flawless headline/state → `flawless`.
- Personal-best / new-record callouts (wherever a "New record" / "New best" headline or toast
  exists) → `newrecord`.
- Streak milestone modal / streak headline → `streak`.
The game's host mascot pop (MASCOT_SPEC §3) stays above the lettering.

## 7. Scenes for empty / error / done states (second pass)

New assets `art-scene-<name>` (≈600 wide, one character with a prop):
- `r-asleep`: empty lists/boards ("nobody's on yet", empty leaderboard/friends feeds).
- `r-unplugged`: offline / failed-to-load / error screens.
- `u-alldone`: all dailies done / played-today limit / "fresh puzzles in …".
- `o3-notfound`: web 404, profile-not-found, missing-item states.
- `i-invite`: empty Friends ("add a friend") states and the invite sheet header.
- `d-nostats`: Stats empty ("play a game and I'll crunch the numbers").
They replace the plain mascot in the existing empty-state component (MASCOT_SPEC §6) at ~140 pt
tall (≈60% width max), keeping the one-line voice text under it. Decorative (no label).

## 8. Welcome hero + holiday Leaderboard (second pass)

- `art-title-welcome` (whole cast around WELCOME!) at the top of the sign-in / onboarding screen
  (and the signed-out landing on web), label "Welcome".
- `art-title-leaderboard` (whole cast around LEADERBOARD): on holidays, show it in the Leaderboard
  banner title slot with the holiday title text (`<HOLIDAY> HEROES`) as a small caps subtitle
  under it, instead of the text-only title.

## 9. Friends pocket game icons (second pass)

New assets `game-pocket-<rps, ttt, coin, pass, ghost, chain>` (256 sq, glossy 3D: rock fist, X+O,
star coin, puzzle piece, little ghost, chain links), keyed by the core friendly-game kind. Use them
wherever a pocket game's icon/emoji/glyph is drawn (Friends games grid, quick-play sheet, game
headers, invites, activity feed rows), same size rules as §3. The RPS hand art inside the game
stays as is.

## 10. Game title art (third pass)

New assets `art-game-<mode id>` for the 18 games (practice, gauntlet, quordle, octordle,
sequence, rescue, six, seven, propernoundle, sudoku, scramble, hub, crossword, groups, ladder,
cryptogram, wordsearch, regions): the game's name lettered in its own accent color with its host
(MASCOT_SPEC §5) standing at / perched on the end (≈900 wide).
- Game screen header: where the game's title text + 30 pt host shows, show `art-game-<id>`
  instead, fit to the available title width, ≈36–40 pt tall, accessibility label = game title.
  Keep the header's buttons where they are; if a header is too tight (e.g. Muddle's compact
  header, Gauntlet with no title), keep today's text there.
- Guide sheet / guide page top for a game: `art-game-<id>` at ≈56 pt tall replaces the waving host
  + title text.
- Leaderboard / Records "Play <game>" card: the selected game's art at ≈40 pt tall in place of the
  host + game name text.
- Parity fixes from pass 2: the VS "already played" screen shows the `u-alldone` scene and its
  W/L result as `youwin` / `youlose` art (≈28 pt tall) on all three platforms (Android has it; iOS
  and web align).

## 11. Page backgrounds — "page tint + tiles" (founder pick, 2026-10-02 morning)

Founder: "The pages look cool, but unfinished … some sort of background?" → mockups in
docs/design/brand/backgrounds/mock-compare.png → picked B + tiles. One shared `PageBackground(tint)`
per platform, drawn behind every tab/page's scroll content (below the header, edge to edge,
behind the status bar too; the tab bar keeps its own surface):
1. A soft diagonal gradient (top-left → bottom-right, 3 stops) per tint:

| tint | light stops | dark stops |
|---|---|---|
| home (Home, Settings, Pro, Help/Guides, profile, default) | #F3EEFF → #FBEFFF → #FFF1F7 | #160F26 → #1C1231 → #22122C |
| leaderboard (Leaderboard, Records) | #FFF8E6 → #FFEFD2 → #FDE9F2 | #1E1608 → #23160D → #241221 |
| stats | #EEF4FF → #EEEBFF → #F4EEFF | #0E1530 → #141433 → #1A1233 |
| friends | #FFF0F7 → #FCE7F3 → #F3E8FF | #241024 → #22102A → #1A1030 |
| vs (VS pages) | #E9FBF8 → #ECF6FF → #F1EEFF | #08201E → #0E1A2A → #15142B |

2. On top, the shipped tile pattern `art-bg-tiles` (640 px seamless, transparent) repeated across
   the page at 12% opacity in light mode, 7% in dark, drawn at 320 pt per tile (so tiles read
   ~20–32 pt), fixed to the page (it scrolls with the content is fine too — pick what's natural per
   platform, same on all three if possible).
3. Cards: keep white (dark: current surface) but tint their shadow toward the page's accent
   (home #7c3aed, leaderboard #f59e0b, stats #2563eb, friends #ec4899, vs #0d9488) at ~10–12%
   alpha, radius 12–16, y 4–6, so they lift off the tint. Sections that sat on the old flat
   background need no other change.
The old flat page background color is replaced everywhere these pages render. Respect reduce
transparency/contrast settings where the platform exposes them (fall back to the gradient only).

## 12. Home section titles

- New `art-title-dailies` (whole cast around WORDOCIOUS DAILIES): the section header above the
  WORDOCIOUS daily games on Home, styled exactly like the PUZZLES art header (same width rule,
  alignment, spacing, scroll anchor if any), replacing the text header there.
- Word of the Day: move `art-title-wotd` OUT of the card — it becomes a section header above the WOTD
  card at the same size/alignment as the PUZZLES header; the card keeps its content; "Past words"
  stays a link at the right of that header row (or inside the card top if there's no room).

## 13. Small fixes

- Leaderboard / Records / recent-match rows that show a text "Win" / "Loss" chip use the
  `icon3d-badge-w` / `icon3d-badge-l` art at ~18 pt with the same accessibility label.

## 14. Game titles fill the header (founder, 2026-10-02 midday)

Founder: "the individual pages for the game titles … all need to be much larger on the page as
there is a lot of open space". On every game screen header that shows `art-game-<id>` (§10):
- Size the art by the AVAILABLE WIDTH between the corner controls (Home / ? / sound), not by a
  fixed height: width = available width, height follows the aspect ratio, capped at 72 pt
  (phones land around 56–68 pt). Minimum 44 pt so short names (MUDDLE) don't look tiny — if the
  width rule gives less than 44 pt height, use 44 and let it center.
- Tighten the header: remove leftover vertical padding so the art, not empty space, defines the
  header height (top/bottom padding ≤ 6 pt). The corner buttons stay where they are, vertically
  centered on the art.
- Muddle and Gauntlet: Muddle now uses the art too (the compact header grows to fit it);
  Gauntlet keeps its stage-name text but at the same 72 pt cap is not needed.
- Guide sheet top art: 56 → 72 pt cap, full sheet width minus 32 pt.
- Leaderboard / Records Play card art: 40 → 52 pt cap, fill the space left of the Play button.

## 15. Game screens get a soft tint in the game's color

Behind every solo game screen (not VS matches), replace the flat background with
`PageBackground` (§11) using a per-game tint: a 3-stop diagonal gradient made from the game's
accent (`accentHex`): stop 1 = accent at 6% over white, stop 2 = accent at 10% over white,
stop 3 = accent at 4% over #FFF7FB; dark mode: accent at 10% / 14% / 8% over #120D1F. Tiles
pattern on top at 8% light / 5% dark (quieter than menus). Boards, keyboards and tiles keep
their own colors and stay fully opaque so play is never affected; card shadows use the game
accent. Respect reduce transparency/contrast (gradient only).

## 16. Title art motion

Every `art-title-*`, `art-day-*` and `art-game-*` image animates once when its page appears:
scale 0.94 → 1.03 → 1.0 and opacity 0 → 1 over 420 ms (ease-out, spring-ish), then a very slow
idle float (translateY 0 → −2 → 0 over 4 s, forever) for page titles and day titles only (not in
game headers during play). Reduce Motion (OS or in-app toggle): no animation, static.

## 17. Share cards + widgets with the cast

- Share images (the generated result / sweep / profile share cards on each platform: web
  `lib/share-image.ts` canvas, iOS + Android share renderers): add the page-tint background
  (home or the game's tint), the game title art (`art-game-<id>`) or `art-title-*` as the
  header instead of plain text where a game/page name is drawn, and a small cast strip (the ten
  mascots, ~22 px each) along the bottom above the URL/footer. Keep all numbers/grids/emoji
  results exactly as they are and legible.
- Home-screen widgets (iOS WidgetKit, Android app widget): background = home tint gradient
  (no tiles at widget sizes), the day's host mascot (MASCOT_SPEC §5 / today's day art host) at
  the corner, the flame icon3d next to the streak, and the W/L badge art for today's result where a
  result is shown. Widget assets must be bundled in the widget target (copy what's needed).

## 18. Layout pass from the ChatGPT mockups (docs/design/brand/layouts/home-mockup.png, game-mockup.png)

Founder: "design in a layout with the help of chat design and knock all of this out".
1. **Background tiles v2.** `art-bg-tiles` is now a 720 px seamless pattern of big glossy,
   softly blurred letter tiles with opacity BAKED IN. Draw it at 100% in light mode and 60% in
   dark (menus), and at 55% light / 35% dark on game screens (§15). Tile it at 360 pt per tile.
2. **Home game cards (WORDOCIOUS DAILIES + PUZZLES grids).** Match the mockup: 2-column grid
   of white rounded cards (radius 18), a THICK colored top band (10 pt, the game accent,
   rounded top corners), content in a row: the glossy game icon at 52 pt on the left (no chip
   box), then the game name (accent color, 900, 16) over the one-line description (secondary
   ink, 12.5, max 2 lines), and a small chevron at the right. Card height ~84 pt. Keep every
   existing state exactly: completed W/L badge (top-right corner over the band), Pro lock,
   free-played dim, result subtitle replacing the description when done, tap targets.
3. **Floating tab bar.** The bottom tab bar becomes a frosted floating pill: inset 12 pt from
   the sides and bottom safe area, radius 26, white at 78% with background blur (where the
   platform supports it; solid white 94% otherwise), soft shadow; selected tab keeps the purple
   label + a 3 pt purple underline pill under the label. Content gets bottom padding so the
   last row clears the pill.
4. **Greeting banner.** The frosted headline strip on Home: white at 72% with blur, radius 22,
   the host mascot peeking over its top-right edge (already there) — make sure the strip uses
   the full content width and the headline sits centered when it fits on one line.

## 19. Wallpapers, centered section titles, big game titles (founder, 2026-10-02 late morning)

1. **Wallpapers replace the tint + tile layer.** New assets `art-wall-<name>` (1080 px wide,
   portrait, opaque): `home`, `leaderboard`, `stats`, `friends`, `vs`, and `game-<mode id>` for
   each solo game (practice, gauntlet, quordle, octordle, sequence, rescue, six, seven,
   propernoundle, sudoku, scramble, hub, crossword, groups, ladder, cryptogram, wordsearch,
   regions). Each has its own tile arrangement and the page/game's color.
   `PageBackground(tint)` draws the matching wallpaper: aspect-FILL the screen, centered,
   FIXED (it does not scroll with content), behind the status bar. Home tint pages (Home,
   Settings, Pro, Help, profile) use `home`; Leaderboard + Records `leaderboard`; Stats
   `stats`; Friends `friends`; VS pages `vs`; each solo game screen `game-<id>`. Dark mode: the
   same wallpaper under a 58% overlay of #120D1F (games 62%). Reduce transparency/contrast:
   keep the wallpaper but add a 20% white (light) / 70% dark overlay. Remove the old gradient +
   tile pattern drawing (keep the tint values for card shadows and fallbacks if the image fails).
2. **Section titles centered.** The DAILIES, PUZZLES and WORD OF THE DAY title art on Home are
   centered horizontally above their sections, same width rule for all three (≈78% of content
   width, max 340 pt). `art-title-dailies` now reads just DAILIES (shipped). Word of the Day's
   "Past words" link moves under the title, centered, small.
3. **Game titles much bigger.** Game screen headers: the corner buttons (Home left, ? / sound
   right) stay in their own top row; the game title art moves BELOW that row and spans the full
   content width minus 32 pt, height following the aspect ratio, capped at 120 pt (phones land
   ~95–115 pt). The guess / timer status line sits under the title. Reclaim the empty space:
   the board area starts right after the status line (keep the board's own centering logic for
   tall screens, but the title now occupies the top third that used to be empty). On short
   screens (height < 700 pt) cap the title at 84 pt. VS matches unchanged.
