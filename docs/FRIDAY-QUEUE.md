# Queue for when usage resets (Fri 2026-10-09, 1:00 PM CT) — founder 10-06

## 1. Cloud results → 2.7.2 (URGENT: content swap cutover is 2026-10-13 → 2.7.2 must be live by ~10-12)
- Review + merge, running iOS/Android tests + sim checks the cloud couldn't:
  - #46 content fixes (swap batch 4, 283 swaps, banks, everyday words, automatic content gate)
  - #45 change/remove profile photo ×3 + web upload
  - #43 2.7.1 review: regression tests + 2 Android fixes
  - #42 items re-shipped through the rule-based fit (real letter guard) (+ #41 prototype base)
  - cloud/body-rigs (prompt 06) if finished: verify on devices, keep behind the flag until approved
- Android 208 (widget fix): confirm Play approval.
- Cut + gate + submit 2.7.2 (iOS + Play), push web, bible entry.

## 1b. Halloween readability audit — MUST be in 2.7.2 (founder 10-06)
- Founder: "a lot of areas where the font is impossible to read" under the Halloween skin.
- NOTE: 2.7.1 (live) turns Halloween ON automatically on Oct 17 — so these fixes must be live in 2.7.2 before
  Oct 17, or every player sees unreadable text. (2.7.2 target: live by ~Oct 12 for the content cutover anyway.)
- Sweep EVERY screen and state with the season preview on, on iOS, Android and web: Home (all cards, banners,
  headlines, chips, counters), every game screen + its finish/share screens, VS (lobby, game, results), Friends,
  Stats, Leaderboard (podium, rows, picker), Settings, Edit Profile/Stage/Dressing Room, popups/sheets/toasts,
  onboarding, paywall, empty/error states, widgets.
- Fix every text that fails contrast: on-wall text, text on glass cards, small labels, numbers, disabled states,
  placeholders. Rule: WCAG AA (4.5:1 small text, 3:1 large/bold) measured against the ACTUAL pixels behind it.
- Make it a STANDING GATE for every season (founder: "we need to have that audit done when we do major
  changeovers during holidays and seasons"): the contrast checks run for EVERY season in the registry, a season
  can't be enabled/shipped while any check fails, and "run the readability sweep" is a required step in
  docs/design/brand/seasons/README.md "How to add a season".
- Same gate for SMOOTHNESS (founder 10-06: "New seasons also need to go through the choppiness/fluidity tests"):
  every season runs the perf harnesses (apps/ios/scripts/perf-tour.sh, scripts/android-perf-tour.sh,
  scripts/web-perf-tour.mjs) with the season ON vs OFF — Home scroll, game open/close, FINISHED-GAME screens
  (win/lose reveal, celebrations, share card, Sweep/Flawless banners), GAUNTLET stage screens (each stage
  transition 1→5 incl. the 8-board OctoWord stage, stage-cleared moments, final result), ALL VS screens (lobby,
  challenge + pick-a-friend, finding a rival / match found, the VS intro splash, live in-game with opponent
  updates, results + rematch, bot ladder / Bot of the Day, pocket games), Friends, Stats,
  Leaderboard, Stage/Dressing Room, cast puppets — and may not ship if it's choppier than OFF beyond noise.
- Add an automated check so it stays fixed: web — a contrast test over every route with ?season=halloween
  (computed colors vs background); iOS/Android — the season palette tokens tested against both surfaces + a
  screenshot sweep (perf-tour style) reviewed by eye.

## 2. Sound Library in the admin portal (like the Art Library)
- Every sound by game/section: CURRENT vs options, play buttons, BMT + JP approve/reject/comment inline,
  "approve all" per section, feedback Claude reads; approved picks flow into make-sounds.py PICKS → ship ×3.
- Seed it from docs/design/brand/sounds (lab.html, options/, out/), mark what's live.

## 3. Share images show the game title clearly
- The share card crops the game title art off the top (founder screenshot, Classic 4/6). Re-layout every game's
  share image so the full title art sits clearly at the top (with date · guesses · time line under it), ×3.

## 4. Easter egg: the musical cast (founder idea)
- Long-press any header mascot → all ten transform (fluid, staggered animation) into little musical versions
  of themselves (instrument / music-note costume touches, on-model).
- Tapping them plays piano notes left→right (W O R D O C I O U S = a scale, in key), each note in that
  character's own voice/timbre (their laugh voices, pitched to the note), so players can play tunes like
  "Mary Had a Little Lamb".
- Long-press again → fluid transform back; normal laughs return.
- Hidden achievements for playing known public-domain tunes correctly (Mary Had a Little Lamb, Twinkle Twinkle,
  Ode to Joy, Happy Birthday…), unlocking secret titles / maybe a musical mascot item.
- Details: a subtle discovery hint (rare idle "humming" note), haptics per note, works with sound off (shows
  floating notes; achievements still count), Reduce Motion = instant swap, Halloween costumes keep their
  costume + a music touch, performance rules as the cast puppets.

## 5. Big mascot-maker content round (free ChatGPT in the browser, as before)
- Plan + candidate lists: docs/design/brand/avatar/NEXT-ROUND-INK-AND-BLING.md. Founder picks favorites first;
  draw in free ChatGPT (on-model, flat key color), fit with the landmark rules (PR #41/#42), look at every
  body sheet ("worn, not bolted on"), ship ×3.
- Order: new body types + plush shapes (+ sizes) → rig them with the one-command rigger (cloud/body-rigs) so
  poses/animations work → hair (+ colors) → letter fonts/colors + letter-fits-the-body → tattoos, piercings,
  face fun → team jerseys (sport templates, two colors) → trending kid items, buddies, kawaii food →
  ChatGPT hand art for peace sign / point / thumbs-up poses.
- **Gating pass (decide with founder):** for every item (existing + new) assign free / Pro / buy / earn /
  limited per docs/design/brand/avatar/UNLOCKS-AND-SHOP.md (decided: direct buy or earn, Pro unlocks most,
  most options gated for free users except a starter handful, everything try-on-able). Produce a table to
  approve, then build the access rules + owned-items ledger + locked card (ChatGPT lock art) + earn checks;
  purchases (Apple/Google IAP + Stripe on web) after the founder sets up the products.

## 6. Bubble-letter alphabet for live headlines (founder 10-06)
- Dynamic headlines (e.g. Home "ON A ROLL ★ 7 OF 18", greetings, counters) use the live-font fallback; make them
  match the ChatGPT title art (DAILIES style).
- Free ChatGPT draws one consistent glyph set using DAILIES as the style reference: A–Z, 0–9, and ★ ! ? , ' · - &
  in a NEUTRAL/white base with shading (light map), so code can tint each word (purple, gold, game colors,
  Halloween) like the button family tint. A few sheets, same prompt + reference each time; keyed + trimmed.
- One "bubble text" renderer ×3: composes any string from the glyph atlas (baseline, kerning pairs, auto-fit to
  width, two-tone words), pre-rendered/cached so it's as cheap as an image; falls back to today's live font for
  any missing character.
- Animations: letters bounce in on appear (staggered), a gentle wave on idle (rare), and the changing part pops
  when it updates (7 → 8 OF 18 flips/pops) — Reduce Motion = static; same perf rules as the cast.

## 7. Daily Sweep + Flawless Victory banners come alive and vary (founder 10-06)
- Today the Sweep banner always shows the same O, S and W with a broom. Make it different every day:
  a rotating cast + scene picked by date (deterministic, so everyone sees the same one that day), never the
  same combo two days in a row; a library of sweep scenes (brooms, confetti, trophies, dances…) and flawless
  scenes (crowns, gold, fireworks…), drawn via free ChatGPT on-model.
- Embed the PLAYER'S OWN living mascot (rigged body, their look, their pose/cheer — cloud/body-rigs) in the
  banner next to the cast, celebrating with them; cast members animate with the puppet rigs (cheer, hop,
  W wave, S fist pump…). Seasonal versions during seasons (Halloween sweep).
- Same performance + Reduce Motion rules; share image of the sweep uses the same day's scene.

## 8. One game-tile style everywhere: W / L badges + matching spacing (founder 10-06, screenshots)
- Reference = the Sudocious finished screen's tile rows (WORDOCIOUS + PUZZLES): each completed game tile shows the
  game-colored top band and a small W (win, purple) or L (loss, red) badge on its top-right corner; unplayed tiles
  stay plain. Spacing/size like the Home hero card rows (8 per row fit evenly).
- Home hero card: replace today's check marks / greyed-out finished tiles with the same W / L badges.
- Leaderboard game picker (WORDOCIOUS + PUZZLES rows): add the same W / L badges so it's clear what's left; fix its
  spacing to match Home/Sudocious (today 9 tiles are crammed in the Wordocious row incl. the sweep broom).
- One shared tile component ×3 so Home, Leaderboard, finish screens and Stats can't drift again; Halloween surfaces
  keep the badge readable.
- Also seen: Home headline "WORDOCIOUS SWEPT! 1…" is truncated — fit it (ties into item 6's bubble text auto-fit).

## 4b. Musical cast — persistence rule (founder 10-06, after PR #48)
- Behave like Android everywhere: once the cast turns musical it STAYS musical on every page with the header
  (Home, Leaderboard, Stats, Friends, game pages that show the cast) until the player long-presses a mascot again.
  PR #48 made iOS (and check web) Home-only — lift the musical state to an app-wide store (iOS app state / web
  context; persist across tab switches; DECIDED: resets to normal on app restart — never persisted) so all headers share it.

## 9. Friends + pocket games cleanup (founder 10-06, screenshots: Friends tab, Call It leave dialog)
- **Friends list at the top**: a clean friends strip/list with each friend's mascot; ONLINE friends highlighted
  first (live dot, "playing Muddle" etc.), the rest in a collapsible "All friends" dropdown. Replaces the plain
  "ON NOW · Nobody's on right now…" text line.
- **Pending pocket games, simplified**: no stack of "Waiting on…" windows. One compact "Your games" area: each
  pending game as a small chip/row with the friend's mascot + game icon + state ("Your turn" highlighted /
  "Their turn" quiet / score); tap to open. Resign/decline lives HERE (long-press or a ⋯ family action menu on the
  row), not inside the game.
- **In-game "Leave" dialog**: ONE button only, ChatGPT-designed in the game's theme, better wording, e.g.
  "Back to Friends — your game waits for you" (no Resign in-game).
- **Fix the flow**: today: pick a game → pick a friend → a SECOND "pick a game" screen. Make it: pick a game →
  pick a friend → straight into that game (and from a friend's profile: pick a friend → pick a game → play).
  Audit every entry point so no step repeats.
- **ChatGPT design pass for the pocket games** (free ChatGPT, on-model cast): themed title art per game
  (Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the Puzzle, Ghost, Word Chain), menus/cards, game pieces,
  a **Wordocious coin for Call It** (heads = W with his cape; tails = another design — e.g. the cast's "O" or a
  W-monogram crest; founder picks), win/lose moments, and other fun personalized touches.
- Same readability + smoothness gates; parity ×3.

### 9b. Pocket games feel LIVE when both players are in the game (founder 10-07)
- Today the game screen polls every 2 s (web game-screen.tsx POLL_MS; iOS/Android similar), so a friend's move
  lands up to ~2 s late and nothing shows the other player is there. Goal: instant and alive when both are online.
- Push, don't poll: Supabase Realtime channel per game (broadcast the move the moment the server accepts it +
  postgres_changes as backup); keep a slow poll only as a fallback when the socket drops.
- Optimistic moves: your piece/letter/coin lands instantly with its sound; roll back with a gentle shake only if
  the server rejects it.
- Presence: the friend's mascot "here now" in the game header (alive, blinking); "thinking…" while it's their turn;
  "left the game" when they go; their move animates in (slide/drop/flip) with a sound + light haptic.
- Your-turn moment: a quick pulse + sound when it becomes your turn while you're watching; reactions (existing
  emoji reactions) appear live as floating bubbles.
- Measure it: move → friend's screen < 300 ms on two devices (sim + emulator/web); add to the smoothness gate.
- ×3 iOS / Android / web, ships with the item-9 pocket-games art overhaul.

### 9c. Pocket games get a "?" + How to Play like every other game (founder 10-07)
- In each pocket game, a family "?" button in the top-right corner (same placement, size and style as the other
  games' headers) opens a How to Play sheet in the same format as the other games' rules screens: short steps,
  example boards/illustrations, the win rule, plus how turns work with a friend (your game waits for you).
- Themed to each pocket game's new ChatGPT art (item 9), with its cast member; American spelling; first-time
  auto-show once per game, then only on tap.
- iOS / Android / web, built together with the item-9 art overhaul and 9b live play.

### 9d. Pocket-game boards designed in ChatGPT (founder 10-07)
- Every pocket game gets a custom ChatGPT board/play surface in the family style (Word Chain, Ghost, Rock Paper
  Scissors, Pass the Puzzle, Call It, Tic-Tac-Tile + any others): themed board, pieces, letter tiles, result
  moments. Today they read as unfinished. Same pipeline as the other game art (key, ship ×3, Art Library approve).

### 9e. Friends tab while a game streak is going — way less busy (founder 10-07, screenshot: 6 games with Johnny)
- Today: six identical full-width cards, each with a colored top bar, a "1" badge, "vs @johnnyauer" repeated and a
  huge pink PLAY pill, plus a race card with the race told twice (the "ends in · you're 2nd" line AND the pills).
- Direction (sketch first, any new elements made in free ChatGPT):
  - Group by FRIEND: one card per friend: their living mascot + name + "6 games waiting on you", and under it
    a compact strip of game tiles (the game's art + a one-word state: "E…", "Your pick", "1 of 6"). Tap a tile to
    go straight in. No per-row PLAY pills, no repeated "vs @name", one count badge on the friend card, not per game.
  - "Their turn" games collapse into a quiet line ("3 waiting on Johnny"), expanded on tap.
  - Race card: say the race ONCE (the pills, with the countdown small in the header); "On now" folds into the
    friend card (the green dot + "playing Classic" under the mascot) instead of its own section.
  - Compact + symmetric; no bordered boxes; check the 0 / 1 / 6+ games, several friends, Halloween states.
- Pairs with item 9 (online-first friend list, simplified pending rows).

## 10. Crosswordocious numbered cells (founder 10-06, screenshot of a finished grid)
- Cells that carry a clue number draw their letter SMALLER and pushed down/right (C, A, S, T, H, F, L, K in the
  screenshot) while plain cells show a full-size centered letter. Make every cell's letter the same size and
  centered; the clue number sits as a tiny badge in the top-left corner that never overlaps the letter (shrink
  the number, not the letter). Same in play, on the finished screen and the share image, on iOS, Android and web
  (earlier fix dbc30603 moved numbers "clear of letters" by shrinking/offsetting the letter — redo it this way).

## 11. Leaderboard: one game card above the podium (founder 10-06, Spyglass screenshot)
- The "VIEW BOARD" pill (eye icon, oversized pink pill) is ugly; the "#3 of 3 · 1,160 PTS · Solved · 5 misses…
  + YOUR BOARD" card under the podium repeats it. Merge them into ONE card above the podium: the branded game
  title art + cast mascot, "N today", then YOUR rank + stats underneath (#3 of 3 · 1,160 pts · 5 misses ·
  10/10 · 2m 42s — or "Not played yet" + Play button), and one clean button that opens your board.
- Button designed in ChatGPT first (family style, matches the game's tint; no eye glyph, no huge pill).
- Delete the card under the podium; "Yesterday's winners" follows right under the podium.
- Every game on the Leaderboard, iOS + Android + web; compact + symmetric; check unplayed / guest / no-friends
  / Friends-tab states and Halloween surfaces.

## 12. First-play welcome + quick tutorial for EVERY game (founder 10-07: "first time playing Word Chain, no clue
what I'm doing")
- Before a game's first play (all 18 main games AND every pocket game), a custom pop-up: the game's ChatGPT title
  art + its cast member, a 3-step animated mini tutorial (show, don't tell), and "Let's play!". Once per game per
  player (synced, so a new device doesn't re-show it); "How to Play" from the "?" opens the same content later.
- Designed in free ChatGPT first (welcome card frame, step illustrations per game); American spelling; ×3.
- Pocket games: also explain turns with a friend. Works for guests too.
