# All-time Records redesign (founder, 2026-10-01)

Founder: "Restyle the all time records pages with the new polished aesthetic it should all
match." Same look as the Leaderboard redesign (docs/LEADERBOARD_REDESIGN_SPEC.md), the game
tiles (docs/GAME_TILE_STYLE.md) and the home / VS / Friends banners. Web `app/records/page.tsx`
(both its Daily and All-Time views), iOS Records screens (the views that still use
`HModePicker` and the bordered completed-board cards), Android Records (the screens behind
the `restyled = false` flag on `ModePickerRow` and the shared row components). Parity ×3.

## 1. The Records banner (one window)

358 wide, radius 16, `linear-gradient(180deg, #ede9fe, #fef3c7)` + the white sheen, soft
shadow, no border.

- Frosted strip: trophy icon (gold `#b45309`) + headline `ALL-TIME RECORDS` 22 / 900
  `#4c1d95` with a soft gold glow (`#f59e0b` at 55%); sub line 10.5 / 800 `#6d28d9`:
  `THE BEST EVER · <N> RECORDS` (N = the records count already loaded; omit the number if
  it isn't available) — on the Daily view: `<DAY TITLE> · RESETS IN hh:mm:ss` using core
  `leaderboardTitle`.
- In the strip's right side, the existing **DAILY | ALL-TIME** toggle as the home-banner
  pill switch (white selected segment, `rgba(124,58,237,0.12)` track, 10.5 / 900 caps).
- Then the same two game rows as the Leaderboard banner (WORDOCIOUS + SWEEP chip / PUZZLES,
  icon-only squares 38 pt and 31 pt, selected state) — reuse the Leaderboard banner's row
  component; labels in `#6d28d9`.
- Replaces the old header, the Daily / All-Time toggle row and the old mode picker.

## 2. Below the banner

Section labels 11 / 900, letter-spacing 1.2, `#6b7280`; white cards radius 14, soft shadow,
no borders; caps headers.

- **Per-game board card** (the old "Leaderboard Card"): header in the game-tile CARD style
  (tint, border, top bar in the game's color; icon chip; game name 15 / 900), with the Solo |
  VS and Everyone | Friends controls as soft pill segmented controls and a bare share icon.
  Player count + your rank line as on the new Leaderboard. Rows exactly like the new
  Leaderboard rows (medal discs 1–3, avatar, name, stats line, points; your row `#fef3c7`
  with a 1.5 `#f59e0b` ring; hints wording unchanged).
- **Completed-board dropdown**: the soft completed-board style (no bordered card).
- **Yesterday's podium**: identical to the Leaderboard's YESTERDAY'S WINNERS.
- **HALL OF FAME**: each record a white soft card — game icon chip (tile chip in the game's
  color), the record name caps 10 / 900 grey, holder avatar + name, the value big (20 / 900
  `#4c1d95`), a small gold crown on records you hold.
- **BY GAME MODE**: one section per game with a game-tile CARD-style header (tint, border,
  top bar) and the rows in the new row style.
- Remove the Records-only `restyled = false` / bordered fallbacks the Leaderboard pass left
  for this page so both pages share one look.

Keep every query, sort, share, friends filter, blocked-user hiding and navigation unchanged.
Safe area respected.
