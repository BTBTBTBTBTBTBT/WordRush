# One game-tile style everywhere (founder, 2026-10-01)

Founder (screenshots of the Friends games grid next to the home WORDOCIOUS DAILIES cards):
"style the game buttons on the friends page to match the games on the main page with the
color of the game as the background and the colored bar at the top styled exactly the
same way … the buttons for the leaderboard selection the same way, with the light colored
backgrounds and the line on top … but maintaining the square shape. On the stats menu,
the menu buttons to select the games' stats … the same square version … If there is
anywhere else … check and match as well."

The reference is the HOME mode card in its completed state (web
`components/home/mode-card.tsx`, iOS/Android home mode cards). Copy it exactly:

## The tile (card variant)

- Background: the game's accent color at ~6% over white (web `${accent}0f`).
- Border: 1.5 px, the accent at 40% (`${accent}66`). Radius 14.
- Top bar: 4 px tall across the full width, `linear-gradient(90deg, accent, accent at 53%)`,
  clipped to the top corners (radius 14 14 0 0).
- Icon chip: 32 × 32, radius 8, accent at ~8% (`${accent}15`), the icon in the accent color.
- Title 13 / 900 `#1a1a2e`; sub 10 / 700 muted. Same paddings as the home card.
- Press: the same 0.96 scale. No extra shadow beyond what the home card has.

## The square variant (selectors)

Same background, border, top bar and icon chip, but 1 : 1, content centered: icon chip,
then a short label (10–11 / 800, the mode's short name, one line, ellipsized) below it.
- Unselected: exactly the tile above.
- Selected: border 2 px in the full accent, a soft glow `0 0 10 accent at 40%`, the label
  in the accent color; background accent at ~12%.
- Size: fill the row grid the selector already uses (e.g. 5 across on phones); keep the
  existing scroll/wrap behavior and selection logic.

## Where it applies (audit every platform for more)

1. Friends: PLAY WITH FRIENDS game tiles (card variant, the six pocket-game accents: RPS
   `#f97316`, Tic-Tac-Tile `#7c3aed`, Call It `#ca8a04`, Pass the Puzzle `#2563eb`, Ghost
   `#9f1239`, Word Chain `#059669`; outline icons drawn in the accent on the soft chip, NOT
   white-on-solid) and the quick-play sheet's game tiles (square variant, selected state
   for the picked game).
2. Leaderboard: the game selector buttons → square variant.
3. Stats: the game rail / game selector buttons → square variant.
4. Anything else that lists games as buttons — check and match, e.g. the VS lobby mode
   strip (square variant at its size, label optional if it doesn't fit — keep top bar,
   tint, border), the More Games / Puzzles grids if they differ from the home card, mode
   pickers in sheets (invite/challenge), records/achievement filters, profile game lists,
   guides lists. Report what you changed and anything you deliberately left.

Keep all selection logic, data and navigation unchanged. Dark mode: use the same alphas
over the dark surface where the platform already supports dark mode.
