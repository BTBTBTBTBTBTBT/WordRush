# Leaderboard redesign (founder, 2026-10-01)

Founder: "change up the leaderboard page to be styled with the updated current polished
aesthetic … redo the buttons with all 8 wordocious games on top and the 10 puzzle games
underneath with the new styling … it even looks good on the sweep banner like that …
open to changing the title [Daily Challenge]" → "a fun word play like Friday's Finest …
switching those up by the days".

Web `app/daily/page.tsx` (the Leaderboard tab), iOS `ProfileTab.swift` (the DAILY CHALLENGE
screen ~line 1484 and its pickers), Android `ui/LeaderboardScreen.kt`. Parity on all three.

## 1. The Leaderboard banner (one window, like home / VS / Friends)

358 wide, radius 16, gold-to-lilac: `linear-gradient(180deg, #fef3c7, #ede9fe)` + the white
sheen (no border; soft shadow `0 4 14 rgba(146,64,14,0.10)`).

- Frosted strip (`rgba(255,255,255,0.5)`):
  - Headline = core `leaderboardTitle(localDay, holidayName)` — e.g. `FRIDAY’S FINEST`,
    `HALLOWEEN HEROES` on a holiday (use the app's existing holiday-of-the-day lookup) —
    22 / 900, `#78350f`, with a soft gold glow (`#f59e0b` at 55%, ~8 pt radius).
  - Sub line 10.5 / 800 `#92400e`: `OCT 2 · RESETS IN 02:06:43` and, right-aligned, an
    `ALL-TIME →` link (to the existing all-time records page).
- Row 1: label `WORDOCIOUS` (10 / 900, letter-spacing 1, `#92400e`) with, at the right end
  of the label line, a `SWEEP` chip (the existing cross-mode Sweep board; soft gold pill,
  selected = solid `#f59e0b` with white text). Under it the **eight Wordocious games** as
  one row of square tiles (~38 pt, gap ~7) in the shared game-tile square style
  (docs/GAME_TILE_STYLE.md: accent tint, 1.5 border at 40%, 3–4 pt top bar, icon in the
  accent; icon-only at this size). Order = the home WORDOCIOUS DAILIES order.
- Row 2: label `PUZZLES`, then the **ten Puzzles** as one row of square tiles (~31 pt, gap
  ~4), same style, home PUZZLES order.
- Selected game: the square's selected state (2 pt full-accent border + glow + stronger
  tint). Exactly one selection across both rows and the SWEEP chip. Tiles never wrap or
  shrink below 28 pt; on wide screens they stay centered at their size.
- This banner REPLACES the old gradient title, the date/countdown row and the old mode
  picker grid.

## 2. Below the banner (same data, new look)

Section labels 11 / 900, letter-spacing 1.2, `#6b7280`. Cards white, radius 14, soft shadow,
no borders.

1. **Play card** for the selected game: the game-tile CARD style (tint, border, top bar in
   the game's color), icon chip, game name 15 / 900, today's status line (the existing
   copy), and the existing Play / View button restyled (solid accent, white caps text).
   Sweep shows its existing explanation instead of Play.
2. **Your board** (completed board preview, when present): the solo completed-board
   component in a soft card.
3. **Your rank**: a soft gold card — rank in big numerals with a medal tint for top 3,
   `OF N TODAY`, points.
4. **TODAY’S BOARD** (the leaderboard list): label + the Everyone | Friends segmented
   control (soft, pill style) + share icon (bare). Rows: rank (medal discs gold / silver /
   bronze for 1–3, plain number after), avatar, name, the existing stats line, points
   right-aligned; your row tinted `#fef3c7` with a 1.5 pt `#f59e0b` ring. Keep the
   "your neighborhood" rows, blocked-user hiding, friends-not-played rows and taunts.
5. **YESTERDAY’S WINNERS**: the existing collapsible podium restyled (soft card, medal
   discs, caps label, the bare share icon).

Keep every query, sort, share and navigation behavior unchanged; this is a restyle plus
the new picker layout and title. Safe area respected; no borders anywhere new.
