# Friends game cards: design A + B's waiting chip (founder 10-15)

Founder: "it looks unfinished and the buttons are huge" → picked **A (slim game rows) with B's WAITING chip**.
Mockups: option-a.png (layout), option-b.png (the dim clock WAITING chip), option-kit.png (piece look).
Same on iOS (FriendCardsView.swift + FriendsPanelView.swift allFriendsBlock), Android, web.

Rules: compact (the card hugs its content), symmetric, calm, **no outlined / bordered boxes** (fills and glows only),
small refined controls. Chip and row label fonts are FIXED size (do not grow with the system text size; that is what
made them huge on the founder's phone). Names may follow the text size as today.

## Friend card
- Card: today's card surface (friendsCard), padding 10, vertical spacing 8.
- Header row: avatar **44** (was 52; online dot 11), then name (today's FriendsName, 16) and ONE sub line:
  the presence line in green when they are online ("playing Classic"), else `1 GAME` / `N GAMES` (all games with
  them, caps, fixed 10.5 heavy, muted ink, tracking 0.6) when there are games, else nothing. The bubble headline
  ("1 game waiting on you") is no longer drawn on the card (the gold row says it); keep it in the accessibility label.
  `•••` menu stays (36 hit area, 20 icon).
- Games: ALWAYS one slim row per game, your-turn rows first (card.tiles then card.theirTurn). Show at most 3; with
  more, a 4th quiet row "+N more ⌄" (fixed 11.5 black, lavender) toggles the rest (reuse the expanded/onToggleTheirs
  state). No more "Pick a game" dropdown and no more centered big tile. A friend with no games keeps today's start row.

## Game row (height 50, full card width)
- Plate: rounded 14, fill white 6% on dark (lavender 10% on light). No stroke.
- **Your turn**: plate fill gold `#FFC83D` at 12% + a soft outer glow gold `#FFC83D` 40% radius 8 (shadow, not a
  border). Status text gold `#FFD45A`.
- Left: **coin 34**: a circle with a radial gradient of the game's accent (light at top-left → the accent → 25%
  darker at the rim), a white gloss ellipse (top 45%, 22% white), the game's art 22 centered.
- Text column (leading 10 after the coin): the game title in CAPS (fixed 12.5 black, heading ink, 1 line, shrink to
  75%), under it the tile's word (t.word, e.g. "Waiting for their pick" / "Your move") fixed 11 bold, muted ink
  (gold on your turn), 1 line, shrink to 80%.
- Right, in order: the chip, 6 gap, the resign flag coin (today's 22 coin / 30 hit area; the in-place
  Keep / Resign confirm stays, laid out inside the row's height).
  - **YOUR TURN chip**: capsule height 24, horizontal padding 10, gradient `#FFE58A` → `#F5B21B` (top → bottom),
    a 1 px white 35% top inner highlight, text `YOUR TURN` fixed 10.5 black, ink `#5A3200`, tracking 0.4.
  - **WAITING chip** (from B): capsule height 22, horizontal padding 9, fill white 8% (lavender 14% on light), a small
    clock glyph 9 + `WAITING` fixed 10 heavy, muted ink, tracking 0.5.
- The whole row is the button that opens the game (squish); the flag is its own button.

## Nudge row (top of the All friends card)
- Left: up to 4 of the friends who haven't played, their avatars at 22 overlapping by 7 (the first on top), then
  `N haven't played today` (fixed 12 heavy, row-sub ink, 1 line, shrink 80%).
- Right: **NUDGE ALL** compact candy button: capsule height 30, horizontal padding 12, gradient `#9B6BFF` → `#6D28D9`,
  a 1 px white 30% top inner highlight, the 3D bell 14 + `NUDGE ALL` fixed 11.5 black gold `#FFD24A`, tracking 0.4.
- Row padding: horizontal 12, vertical 8.

## All friends fold
- One slim row: the friends glyph 16 (lavender) + `All friends · N` (fixed 12.5 black lavender) + chevron 10,
  padding horizontal 12, vertical 10. Unchanged behavior.
