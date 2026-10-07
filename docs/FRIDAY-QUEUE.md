# Queue for when usage resets (Fri 2026-10-09, 1:00 PM CT) — founder 10-06

## FRIDAY GAME PLAN (founder 10-07: all of it Friday, submit 2.8 for review; thorough but usage-efficient)
Models: Opus = me (orchestrate, specs, merges, reviews, release, final gate); Sonnet = build threads + ChatGPT art
driver; Haiku = inventories/scans/screenshot sweeps. Max 3 agents at once, each in its own worktree, owning a
feature ×3 (iOS/Android/web) with disjoint files, time-boxed ~45 min → commit + report; serial native builds, one sim.
- 1:00 Opus: merge #41–#50, move #46 cutover, tests ×3; write short specs for every thread; start wave 1.
- Wave 1: [Sonnet] ChatGPT art driver in Chrome (all art in RUN ORDER B, batches → Art Library) · [Sonnet]
  foundations (6 lettering + guard, 14 header, 8 tile) · [Sonnet] 1b readability + 10 + 21 + truncation.
  [Haiku] button + plain-surface inventory (18/23) feeds wave 3.
- Wave 2: [Sonnet] mascots alive + banners (13, 7) + voices/moods synth (19b, spec from Opus) · [Sonnet]
  Friends/pocket (9, 9e, 9c, 12) · [Opus-reviewed Sonnet] invites + live play (9f deep links/OG images, 9b realtime).
- Wave 3: [Sonnet] pages (11, 16, 17, 20, 22, 15) · [Sonnet] wire approved art + every button (23) · [Sonnet]
  extras (3, 4/4b, 2, 5, 18 picks).
- Gates (Opus): readability + smoothness + final ×3 → Android internal + TestFlight for founder → on OK: iOS 2.8
  submit (auto release) + Play production + web push.
Art approvals (founder 10-07): NO Art Library gating — I pick by judgment from what's been approved so far and
wire it. The one hard rule: the 10 main characters stay true to their LOOK, SOUND and PERSONALITY whenever they're
drawn or interact with anything (hero refs + docs/MASCOT_SPEC.md + brand-mascots signature features; face-region
check vs hero; voices/moods match each character's personality; anything off-model is rejected, never shipped).
Founder reviews themed items + buttons on his phone (internal/TestFlight) or live while I drive the sim, gives
feedback, then the final submit OK.

## RUN ORDER — ONE BUILD: 2.8 (founder 10-07: no separate 2.7.2; one App Store review before Halloween)
Two dates to protect (handled first thing Friday):
- Content swap batch 4 (PR #46) is set to cut over 2026-10-13 → move its cutover to 2.8's go-live date, after
  checking that no flagged word is scheduled in the gap (if one is, swap that day's answer in the new date's data).
- Halloween turns on by itself Oct 17 in the live 2.7.1 (baked in; confirm there's no remote switch) → aim to submit
  2.8 by ~Oct 14 so it's live by the 17th. Build order puts Halloween-facing work first; anything not gate-ready
  by the submit day rides in 2.8.1 after launch instead of holding the build.
Order:
A. Merge cloud PRs #41–#50 (+ cutover date move) → 1b readability fixes → 10 crossword cells → 21 tour button.
B. Free-ChatGPT art session alongside everything (I pick + wire; cast accuracy is the only hard gate): bubble alphabet (6), banner variants (7),
   pocket boards + coin (9d), invite images (9f), "?" sheets (9c), Leaderboard button (11), welcome tutorials (12),
   wallpaper cutouts (15), Stats titles/icons/ring (16), profile shelf + titles (17), speech bubbles (19), Go Pro
   scenes (20), waiting lobby (22), all leftover buttons (23), Ocean/Forest/Dark walls + Settings icons/titles (25).
C. Foundations: 6 bubble lettering + no-clip guard → 14 scroll edge → 8 shared game tile → 23 every button.
D. Mascots alive: 13 (podium, Stats, Home host, banner cast) + 7 daily banners + 19 speech bubbles + 19b voices/moods.
E. Friends + pocket games: 9 → 9e → 9f invites → 9b live play → 9c "?" → 9d boards → 12 welcome tutorials.
F. Pages: 11 + 11b Leaderboard living top section → 16 Stats → 17 profiles → 20 Go Pro → 22 waiting rooms → 15 living wallpapers → 24 Halloween kit
   (Theme setting, widgets, opening animation) → 25 full themes + Settings redesign.
G. Extras (first to slip to 2.8.1 if time is short): 18 polish sweep → 3 share titles → 4/4b musical cast →
   2 Sound Library → 5 mascot content round.
H. 26 Halloween icon + 27 Halloween screenshots/captions + store text → gates (readability, smoothness, final) ×3 → iOS 2.8 submit + Play production (paired) + web, on founder's OK.
   Expedited review (founder 10-07): request it right after submitting. Honest grounds: the live 2.7.1 turns on the
   Halloween theme by itself on Oct 17 and has readability problems in it (text contrast on the Halloween screens,
   found by our audit); 2.8 fixes them and must be live before the 17th. Draft the request text ready to paste;
   founder fills Apple's form (the app picker resists automation). Last expedite was 10-06 (2.7.1) — Apple may say
   no on a big release, so submit as early as possible regardless.

## STANDING RULE for every ChatGPT design on this list (founder 10-07)
- **Main cast stays exactly on-model:** attach cast/hero/<id>.png (+ refs/poses) to every prompt; prefer layering
  (ChatGPT draws only boards/props/frames, the canonical cast art is composited in code); any redraw passes the
  face-region check (eyes, mouth/teeth, brows, letter) side by side with the hero, or it's rejected.
- **Fonts stay the house fonts:** title lettering matches the existing ChatGPT title family (the WORDOCIOUS /
  game-title style), UI text uses the app's current typefaces; no new or generic fonts in art or screens.
- **Every button is covered (founder 10-07: "All buttons should be covered"):** no button ships outside the
  ChatGPT family style — not just the ones named in items. Item 23 does the full sweep.
- **Aesthetic stays the family's:** glossy purple/gold/grey tiles, soft 3D icons, smooth motion; check every new
  piece next to the live screens it sits beside before wiring.

## 1. Cloud results → 2.8 (move PR #46's 10-13 cutover to 2.8's go-live date; see RUN ORDER)
- Review + merge, running iOS/Android tests + sim checks the cloud couldn't:
  - #46 content fixes (swap batch 4, 283 swaps, banks, everyday words, automatic content gate)
  - #45 change/remove profile photo ×3 + web upload
  - #43 2.7.1 review: regression tests + 2 Android fixes
  - #42 items re-shipped through the rule-based fit (real letter guard) (+ #41 prototype base)
  - cloud/body-rigs (prompt 06) if finished: verify on devices, keep behind the flag until approved
- Android 208 (widget fix): confirm Play approval.
- Cut + gate + submit 2.7.2 (iOS + Play), push web, bible entry.

## 1b. Halloween readability audit — MUST be in 2.8 (founder 10-06)
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
- Acceptance test (founder 10-07): render "DAILIES" tinted purple and "PUZZLES" tinted teal from the glyph set and put
  them next to today's ChatGPT title art — they must look like the same lettering (shape, puffiness, gloss, rim).
- One "bubble text" renderer ×3: composes any string from the glyph atlas (baseline, kerning pairs, auto-fit to
  width, two-tone words), pre-rendered/cached so it's as cheap as an image; falls back to today's live font for
  any missing character.
- Animations: letters bounce in on appear (staggered), a gentle wave on idle (rare), and the changing part pops
  when it updates (7 → 8 OF 18 flips/pops) — Reduce Motion = static; same perf rules as the cast.
- EVERYWHERE the wording changes, not just Home (founder 10-07): first inventory every live/changing headline
  ×3 — Home greetings that change through the day (GOOD MORNING/AFTERNOON/EVENING, BMT), ON A ROLL / sweep
  counters, Friends headers (YOUR TURN, ON NOW, TODAY'S RACE, streak lines), Leaderboard (TODAY'S BOARD, ranks),
  Stats, VS (match found, results), finished-game + Gauntlet stage headlines, banners, season greetings — and
  switch them all to the bubble renderer. Static titles stay ChatGPT title art.
- Live example (founder 10-07): Home "WORDOCIOUS FLAWLES…" is truncated today (also "SWEPT! 1…", item 8) —
  both must fit in full.
- Fit rules (never clipped, always fills its space): auto-fit to the slot (scale UP to fill the width as well as
  down), keep a min size, then wrap to a balanced 2nd line before ever truncating; no "…" ever. Guard test ×3:
  render every headline template with its LONGEST values (long usernames, 4-digit numbers, longest greeting,
  Halloween strings) at the narrowest widths (iPhone SE/mini, small Android, 360 px web) up to Pro Max / iPad /
  wide web and assert nothing clips, overflows or leaves the slot under-filled; screenshot sheet per width.

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

### 9f. Invites that make sense: one branded link per invite, straight to the right screen (founder 10-07,
screenshot: Johnny's iMessage "Race me at CLASSIC! ⚡ Code ANT5TTZR" under a generic wordocious.com preview)
- Today a VS/friend invite arrives as TWO things: a generic site card ("Daily Word Games") + a text line with a code,
  and the receiver can't easily find where to type the code.
- One link per invite (e.g. wordocious.com/vs/<CODE>, /play/<game>/<CODE>, /friend/<CODE>) whose share PREVIEW is a
  custom image of exactly what's being sent: sender's mascot vs a "?" / receiver's slot, the game's title art,
  "Johnny challenges you to CLASSIC", the time to beat if it's a race-my-run, the code small as a fallback.
  Generated per invite (OG image route, cached), frame + VS art designed in free ChatGPT, one per invite type
  (live VS, race my run, pocket game, friend request).
- Short share text beside it ("Johnny wants to race you in Classic"); no separate code line needed.
- Tapping opens the app straight to that invite's accept screen (iOS universal links / Android app links); not
  installed → a branded web page with Accept (plays on web) + App Store / Play buttons that keep the code through
  install (deferred deep link or a "paste your code" prompt on first open).
- Inbound invites also land on the Friends tab as an "Invites" row at the top (accept / decline), and "Have a code?"
  sits in one obvious place on Friends + VS (not partly hidden).
- ×3; test from iMessage, WhatsApp and SMS previews on both platforms; guests too.

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

## 13. Mascots BIG and alive wherever they appear (founder 10-07, Leaderboard podium screenshot)
- Today the podium shows small mascots inside framed tiles floating above the steps (MJT/Oliver tiny). Make the
  player's custom mascot the star:
  - Podium: full-body mascots STANDING on their steps, no tile frame, ~2–3× today's size (1st biggest, crown on
    its head, not floating above); name + score on a plaque on the step; the stats line simplified (game · time).
  - Alive (rig from cloud 06): breathe + blink; pose by place (1st cheers, 2nd claps, 3rd waves); confetti burst
    when the podium loads; tap a mascot → their mini Stage card (look, title, streak) + a reaction.
  - Same rule elsewhere: Yesterday's winners, ranks 4+ rows (mascot heads), Friends race pills + friend cards,
    Stats header, finished-game screens, VS intro (mascot vs mascot), invites (9f). Your own mascot hops up a
    step when you climb a rank.
- Uses real resolver renders only (never mockups); smoothness gate (Leaderboard scroll) ×3; compact, symmetric.
- Stats profile card (founder 10-07 screenshot): your mascot is trapped in a small framed square with DRESS UP
  under it → break it out: large full-body mascot standing on the card's edge (overlapping the top like the Home
  host), breathing/blinking, tap = laugh/pose; DRESS UP becomes a small family pill by its feet; name, title chip,
  rank/XP re-flow beside it, symmetric.
- Home host (the mascot over the Daily Sweep / Flawless card): bigger and alive, and it plays WITH the new bubble
  headline (item 6): hops onto/leans on the letters, letters bounce when it lands, tap it → the headline does a
  wave; when the counter changes (7 → 8 OF 18) it reacts (cheer/point). Pairs with item 7's daily banners.
- The banner cast (founder 10-07: the D / O / I scene etc. under the headline) come alive too: idle breathe/blink
  with offset timing, small signature moves (D taps his pencil, O holds up the gem, I sways), and they REACT to
  the day's moments: a game finished (a little cheer), the banner changing through the day (they hop in / out as
  the scene swaps), Daily Sweep or Flawless reached (the banner flips with a celebration: confetti, the cast jumps,
  the bunting swings). Your mascot (host) reacts in sync on the same beat — one choreographed moment, no
  separate pops. Rig-based from canonical art (on-model), Reduce Motion = static, smoothness gate ×3.

## 14. Clean scroll edge under the cast header (founder 10-07)
- Not a bug: when you scroll a little, content (e.g. the WEDNESDAY WIZARDS title) slides under the cast row and
  gets sliced by a hard edge, which looks clipped. Make it clean on every tab (Home, Leaderboard, Stats, Friends):
  - a soft fade at the header's bottom edge (content dissolves as it passes under, no hard cut), and
  - on scroll the cast header gently condenses (mascots shrink to a slimmer row, stats/settings stay) and
    expands again at the top — smooth, 60 fps, no jumps; Reduce Motion = fade only.
- Same ×3; check under Halloween surfaces and in the smoothness gate (Home + Leaderboard scroll).

## 15. Living wallpapers — subtle background motion (founder 10-07: keep both current wallpapers, add fun, not annoying)
- Regular: the background letter tiles softly drift (slow float + tiny rotation, each on its own path, wrap
  around the edges); a rare tile flips to a new letter; tap a tile → it bops (easter egg); optional faint
  tilt parallax.
- Halloween (Midnight walls): bats flap and drift in small loops; a witch on a broom crosses the moon about once a
  minute (never over a card); stars twinkle; low fog drifts; jack-o'-lantern glow flickers; a tiny spider drops on
  its thread now and then; a ghost peeks from a corner rarely. Cutouts from the existing wallpaper art (ChatGPT
  only fills missing pieces, family style), animated in code — no video.
- Data-driven: an "ambient" slot in season-registry.json so future seasons plug in (snow, leaves, fireworks…).
- Not annoying: slow, low-contrast, behind the glass cards; menus/tabs only — games and VS boards stay still;
  Reduce Motion / Low Power = static; pause when the app is in the background; one-shot events (witch, ghost)
  rate-limited. Must pass the smoothness gate ×3 ON vs OFF (smooth beats pretty: cut effects that cost frames).

## 16. Stats page: cleaner, less wordy, designed (founder 10-07, Stats → per-game screenshot)
- VS game picker: all 9 VS games (each has bots) fit at once, no swipe: 5 on top, 4 centered under, equal tiles;
  the People | Bots toggle smaller, centered, under the grid (replaces the clipped sideways strip).
- Pocket games get stats too: a POCKET GAMES section (6 game tiles; record per game vs friends, e.g. Ghost 3–1,
  best Word Chain run) and per-friend pocket records in HEAD TO HEAD; the same numbers show on that friend's card
  on the Friends tab (item 9e) so the two pages agree.
- Say each thing once:
  - drop the "Classic" header row (the selected tile already says it); its VS button moves into the toggle row.
  - 8 stat boxes → 4 hero stats with soft 3D icons: Record 3–2 (wins–losses; GAMES is their sum), Win rate (a
    ring), Streak 2 (best 2 underneath, small), Fastest 16s; "Best 4" moves into the guess chart. Everything else
    behind "More stats".
  - VS Bots: one line, "26–17 · 60%", with the bot's mascot, best streak as a small flame; no dashed box (no
    bordered boxes rule), and "43 matches" dropped (it's 26+17).
  - Head-to-head rows (johnnyauer 1–0): friend's mascot + a two-color record bar, not a plain line.
  - Guess distribution empty state: hide it until there's a win, or a ChatGPT illustrated preview (no plain
    sentence + icon placeholder).
- Designed in free ChatGPT (house fonts, family look): small section title art for MY GAMES / HEAD TO HEAD /
  BOTS / GUESSES / ACTIVITY (replacing plain caps labels), the stat icon set (trophy, flame, stopwatch, target),
  the win-rate ring, the record bar; sketch the whole page first, then build ×3.

## 17. Player profile overhaul (founder 10-07, Oliver's profile screenshot) — same treatment as Stats/Home
- Hero: the player's mascot full-body and alive on a mini Stage (podium + curtains from Edit Profile), not a framed
  tile; tap = laugh/react. Name in the bubble lettering (6); "played 2 hours ago" as a small online dot/line.
  Rank (84 PLATINUM) + XP bar as one compact strip under the name.
- Say each thing once: the 24-day streak shows in LATELY and again as "24" in the bottom tiles → one place; the
  four bottom number tiles get labels/icons or fold into the hero stats; HIGHLIGHTS shows one lonely tile with an
  empty half → fill symmetrically (2–4 highlights) or fold into Lately.
- Trophy case: a ChatGPT trophy shelf with 3D gold/silver/bronze medals and counts (not three flat boxes).
- With you: a HEAD TO HEAD strip (your record vs them, VS + pocket games, same numbers as Stats 16 and Friends 9e)
  and one clear action row: Challenge (VS) · Pocket game · React — family buttons.
- Friendship status (founder 10-07: the teal "FRIENDS" pill top-right is ugly): remove it. Show it on the hero:
  friends → a small ChatGPT friendship badge by the name (two linked mascot hands / heart tag) + "Friends since
  Sep 2026"; not friends → a clear "Add friend" family button in the action row; request sent → "Requested" (quiet,
  tap to cancel); they asked you → Accept / Decline right there. Unfriend / Block / Report move into the "⋯" menu.
- ChatGPT: section title art (TROPHY CASE, HIGHLIGHTS, LATELY, HEAD TO HEAD), medal shelf, highlight icons, friendship badge; house
  fonts, cast on-model; no bordered boxes; compact + symmetric; ×3, your own profile view included.

## 18. Polish sweep: surfaces with no ChatGPT design pass yet (proposed 10-07, confirm with a screenshot sweep)
Titles (88), buttons, achievements, Go Pro, moments, podium, walls are done. Likely still plain:
- Settings (rows, toggles, section icons) and Help / FAQ / Support pages beyond their titles.
- Sign-in / sign-up / username / onboarding tour screens (titles exist; layouts + illustrations don't).
- In-game keyboards (keycaps — the button-family leftover), hint / reveal / shuffle bars per game.
- Finished-game screens per game (result scenes, guess grids, share card) and Gauntlet stage map/progress.
- VS lobby, bot ladder portraits/cards, searching / match found screens beyond the titles.
- Empty / error / offline / loading states (no-placeholder rule) and the launch splash.
- Streak calendar, shields / streak-saver popup, achievements list page, notifications inbox.
- Home-screen widgets (iOS + Android) art, push-notification images, store screenshots, app icon B (ship
  when the app matches).
Run: screenshot every screen ×3 (light, dark, Halloween), mark plain ones, founder picks the order.

## 19. Home notifications as cast speech bubbles (founder 10-07, "@johnnyauer invited you to Classic" card)
- The invite/alert cards on Home (plain text + mascot thumbnail + ACCEPT/DECLINE) become a cast member TELLING you:
  a ChatGPT comic speech bubble (family style, house fonts) coming from the delivering cast member (I brings
  invites with his envelope, W for achievements, etc. — a cast-per-notification map), sender's mascot inside the
  bubble, short line ("Johnny wants to race you in Classic!"), buttons in the bubble (family Accept / quiet Not now).
- Voice: the text types out in the bubble while that cast member "talks" in their own chirpy gibberish voice
  (Animal Crossing style, pitched per character, from the Sound Library / musical-cast voices, item 4) — not a
  robot text-to-speech. Respects the sound setting + silent mode; first appearance only, never on repeat views.
- Several at once: one bubble at a time with a small "1 of 3" and swipe/arrows to the next (cast swaps in), or
  collapse into a single "3 things for you" bubble; never a stack of cards pushing Home down.
- Closing: swipe the bubble away, or a small family X; "Not now" snoozes; dismissed ones live in a notifications
  tray (the bell/inbox from item 18) so nothing is lost.
- Seasons: Halloween skin (Haunted glass bubble, orange/plum ink, costumed cast) via the season registry; readable
  per the 1b gate. ×3; Reduce Motion = no typing animation.

### 19b. Your mascot has a voice too — a Voice tab in the Dressing Room (founder 10-07: cast AND your mascot)
- Both talk: cast members deliver app/social news in their voices, AND your own mascot delivers YOUR news (streak,
  level up, your achievements, "your turn") in your chosen voice. Tap your mascot anywhere → it chirps/laughs.
- Dressing Room gets a VOICE tab: ~8–12 voices (e.g. squeaky, bubbly, deep, sing-song, raspy, robot, whisper,
  giggly) × a pitch slider; tap to preview ("Hi, I'm BMT!"); default picked from body + letter; None = silent.
  Some free, more with Pro / earn / buy per the unlock model (item 5, UNLOCKS-AND-SHOP.md); seasonal voices
  (spooky for Halloween) via the season registry.
- Friends hear your voice when your mascot shows up for them (podium, invites, Friends card, VS intro).
- Built as a tiny procedural "babble" synth (syllables → pitched blips per voice, so any text works, no recordings,
  offline, identical ×3 from one shared voice spec in packages/core); voices approved in the Sound Library (item 2);
  saved with the look, synced; respects sound settings + silent mode.
- Emotions per voice (founder 10-07): every voice has moods — cheer (win, sweep, flawless), happy/chatty
  (default), upset/grumpy (a loss, streak lost — cartoon "hmph!", never harsh or scary), surprised (close call,
  rare find), laugh (tapped), sleepy (idle), nervous (last guess). Each mood shifts pitch, speed and rhythm and
  pairs with the matching face + pose on the rig (13), for your mascot and the cast alike. Mood is chosen by the
  moment (finished screens, VS results, Gauntlet, podium, bubbles); Sound Library previews every voice × mood.

### 19b. Your mascot has a voice — a Voice tab in the Dressing Room (founder 10-07)
- Your own mascot talks too: YOUR news (streak, level up, your achievements, "your turn") comes from your mascot's
  bubble in your voice; cast members deliver app/social news. Tap your mascot anywhere → it chirps/laughs in it.
- Dressing Room gets a VOICE tab: ~8–12 voices (e.g. squeaky, bubbly, deep, sing-song, raspy, robot, whisper,
  giggly) × a pitch slider; tap to preview ("Hi, I'm BMT!"); default picked from body + letter; None = silent.
  Some voices free, more with Pro / earn / buy per the unlock model (item 5, UNLOCKS-AND-SHOP.md); seasonal voices
  (spooky for Halloween) via the season registry.
- Friends hear your voice when your mascot shows up for them (podium, invites, Friends card, VS intro).
- Built as a tiny procedural "babble" synth (syllables → pitched blips per voice, so any text works, no recordings,
  offline, ×3 identical from one shared voice spec in packages/core); voices approved in the Sound Library (item 2);
  saved with the look (avatar config v-next), synced; respects sound settings + silent mode.

## 20. Go Pro pages: your mascot alive + each page distinct (founder 10-07)
- Free players' own mascot animates on every Go Pro screen (breathe/blink, tries on a Pro item, cheers on the
  benefits, voice mood from 19b), not a static image.
- The Go Pro pages all look alike → each reason gets its own scene: the feature it's selling shown in action
  (e.g. Unlimited: mascot racing through boards; Pro items: mascot in the Dressing Room wearing a locked item;
  VS/bots, stats, no limits…). ChatGPT scenes in the family style, cast on-model; Halloween skin; ×3.

## 21. "Take the tour" inside game help sends players to the generic welcome slides (founder 10-07)
- Cause (iOS, same on Android/web to verify): every game's "?" help sheet (GuideSheet.swift ~:197) and How to Play
  (HowToPlayView.swift ~:113) carry a "Take the tour" button that replays the first-run app onboarding (welcome +
  four cards) — the same slides for every game, which makes no sense to a seasoned player.
- Fix ×3: remove "Take the tour" from per-game help; in its place "Watch how" plays THAT game's own quick tutorial
  (item 12). The app tour stays only in Settings → Help as "Replay the app tour". Check nothing auto-opens the
  onboarding for signed-in returning players.

## 22. VS waiting rooms are fun, not empty (founder 10-07, Private Match "waiting for your friend" screenshot)
- Today: a plain card (PRIVATE MATCH caps, huge spaced code, SHARE INVITE), a 0:00 circle, "SEARCHING" +
  "WAITING FOR YOUR FRIEND" (says it twice), Cancel, and an empty bottom half.
- Make it a little lobby scene (ChatGPT, family style): your mascot full-body and alive center stage, an empty
  spot opposite with a "?" where your friend will appear; when they join, their mascot runs in → the VS intro.
- Something mindless to do while you wait: tap your mascot to keep a letter tile bouncing (keepy-uppy with a
  little count), pop floating letter bubbles, or spell a quick warm-up word from drifting tiles — no stakes, no
  score saved, stops instantly when the match starts. Your mascot does idle bits (checks its watch, yawns, waves at
  the door) and chirps in its voice (19b).
- One clear status line in the bubble lettering ("Waiting for Johnny…" with a live timer that actually counts);
  the invite shown as the branded invite card (9f) with Share + Copy code; Cancel as a quiet family button.
- Same treatment for bot / random searching and pocket-game waits; Halloween skin; ×3; smoothness gate.
- The SHARE INVITE button is ugly (founder 10-07): oversized full-width purple pill, huge type, a tiny washed-out
  share icon. Redesign in ChatGPT as part of the invite card: a compact family button sized to its label, a real
  3D share icon, plus a matching small Copy-code chip; same for Cancel. Then sweep every other oversized
  full-width pill left in VS / Friends / Leaderboard (e.g. VIEW BOARD, item 11) to the same family style.

## 23. Every button in the app on the ChatGPT family style (founder 10-07)
- Inventory ALL buttons ×3 (code scan for raw Button / Pressable / <button> + CandyLabel / old candy pills, and a
  screenshot pass of every screen incl. sheets, popups, empty states, settings, sign-in, admin-facing excluded):
  primary, secondary/quiet, icon, chip, toggle/segmented, keycaps, close X, share/copy, menu ⋯.
- Redesign the leftovers in ChatGPT (the ~110 old candy buttons noted 10-05 + anything newer), sized to their
  label, real 3D icons, per-context tint, Halloween tints via the season registry; wire ×3.
- Guard test ×3: fails if a screen uses a button outside the family components, so new ones can't slip in.

## 24. Halloween full kit for 2.8 (founder 10-07) — and the same kit for every future season
- Settings → THEME (founder 10-07 screenshot: Default / Dark / Ocean / Forest rows): add a 5th row at the top,
  "Seasonal — Halloween" (subtitle "Black & orange · until Nov 1", W-O-R-D preview tiles in Halloween style with a
  tiny bat). During a season window it's preset ON for everyone; picking any other row opts out for this season
  (synced to the account). When the season ends, everyone returns to the theme they had before. Outside a season
  the row hides (or shows "Next: <season> · <date>", disabled). Same rule for every future season. ×3; admin
  Season preview stays separate.
- Halloween widgets (iOS + Android, all sizes): black + orange, costumed cast, the living-wallpaper art (bats/moon/
  witch) swapped frame-by-frame on the widget timeline (iOS/Android widgets can't animate continuously — subtle
  changes each refresh + any OS-allowed transitions). Readable + Theme-aware (Classic → normal widgets).
- New black + orange aesthetic pass across the Halloween surfaces (with 1b readability).
- Seasonal opening animation: the launch intro with the cast in their Halloween costumes (layered on canonical
  art, on-model, personality-true), short, skippable, once per launch.
- Automatic end (founder 10-07: "on November first the Halloween theme is gone"): it's already date-driven
  (SEASON_WINDOWS), but today's window is Oct 17 – Nov 1 INCLUSIVE → change the end to Oct 31 in 2.8 (core
  level-season.ts + LevelSeason.swift + Season.kt + parity fixtures; live 2.7.1 keeps its baked Nov 1, harmless).
  At local midnight Nov 1, with no build and no server change: the app returns each player to the theme they had
  before the changeover (saved when Seasonal was preset), the "Seasonal — Halloween" row disappears, widgets go
  normal on their next refresh, walls/ambient/opening animation/cast skins/Halloween items' shelf go off-season
  (saved looks keep their items). The row only reappears when a build with the next season (Thanksgiving) ships
  and its window opens. Also re-check on app foreground (no restart needed; Android currently picks the season
  at process start → fix). Clock tests ×3: Oct 31 23:59 = Halloween, Nov 1 00:00 = normal + previous theme back +
  no Seasonal row; a player who opted out stays on their pick.
- Icon: the app icon can't change by date unless it's an "alternate icon" — iOS then shows a one-time system
  "You have changed the icon" alert when the app swaps it (Apple requires it); Android can swap via an activity
  alias silently. Decision needed: (a) ship Halloween as an alternate icon the app switches on Oct 17 and back on
  Nov 1 (automatic, one alert each way on iOS), or (b) Halloween icon as primary in 2.8, normal again in the
  ~Nov 1 2.8.x. Store screenshots/text still need the 2.8.x on iOS either way.
- Season checklist: added to docs/design/brand/seasons/README.md "Every season ships the full kit" so winter etc.
  get Theme toggle, widgets, ambient, opening animation, gates.

## 25. Themes really change the look + Settings page redesign (founder 10-07, Settings screenshot)
- Ocean / Forest (and Dark) barely change anything in the new aesthetic (only some tile colors). Make each theme a
  full skin through the SAME slots the season system uses (walls, card surfaces/glass, title tints, button family
  tints, tiles, tab bar, header, widgets): Ocean = deep blue/teal water walls with drifting bubbles (ambient),
  Forest = green/earth walls with drifting leaves, Dark = true night version of Default. Themes become data
  (a "themes" block next to season-registry.json, ×3 identical), season skins sit on top when Seasonal is on.
  ChatGPT walls + any theme-specific art, cast unchanged; readability + smoothness gates per theme.
- Settings page: still plain caps section labels and plain rows → ChatGPT section titles + soft 3D row icons
  (theme, keyboard, sound, haptics, notifications, account, help); theme rows show a real mini preview of the
  theme's wall + card, not just 4 tiles; the giant MANAGE SUBSCRIPTION pill → compact family button inside a
  nicer Pro card; Sign out → quiet family button; Delete account → small, calm danger link at the very bottom
  that opens a designed confirm sheet (never a big red slab). Everything compact, symmetric, no plain text areas.

## 11b. Leaderboard top = ONE living section (founder 10-07, "WEDNESDAY WIZARDS" screenshot) — supersedes 11's layout
- Today: a small centered day-title image (U wizard + WEDNESDAY WIZARDS), then a date/reset card with two game rows,
  then a separate CLASSIC strip with VIEW BOARD, then TODAY'S BOARD — four stacked blocks, the podium half off-screen.
- One combined section, top to bottom:
  1. Day title, alive: the day name in the bubble lettering (6), animated (Wizards: letters sparkle in with a wand
     swish; each weekday its own little motion), with YOUR mascot interacting with it (leans on it, taps a letter
     that bounces; on Wizard Wednesday it wears the day's wizard hat for the day only), and the day's cast host
     (U for Wednesday) beside it, both on-model and in character. Fills the width (no small centered image).
  2. Game picker in the same card: the two rows (WORDOCIOUS / PUZZLES) compact, "Oct 7 · resets in 07:11" as a
     small line under the title, not its own header.
  3. Selected game strip (from 11): the game's title art, "7 today", your rank + stats, one compact "Your board"
     button (opens the board exactly as VIEW BOARD does today).
  Then the podium (big living mascots, 13) starts right below: on a standard iPhone the top of the podium (all
  three mascots) is visible without scrolling.
- Everyone / Friends toggle + share sit on the podium's header line.
- Yesterday's winners folds into the BASE of the stage (founder 10-07), not its own card: under the podium floor a
  "Yesterday" ledge with yesterday's top 3 as small mascots on mini steps (alive, a little wave/bow), tap to
  expand the full list in place; same backdrop, no separate island. The whole column = one stage top to bottom.
- Cohesion (founder 10-07): the new top and the podium read as ONE continuous stage, not a card stacked on a card:
  one shared backdrop that flows down (the title's sky/rays continue behind the picker and into the podium's
  sunburst; no hard card edges between them), the selected game's tint carries through title glow → game strip →
  podium rays/base, and the motion is linked (switching games sweeps the tint and the podium mascots re-pose
  together; your mascot hops down from the title toward its podium step when you're on the board). Sketch the
  whole column first, then ChatGPT the backdrop; check every game tint + Halloween.
- Keep every function: game switching, board view, Everyone/Friends, share, reset timer, yesterday's winners;
  tests for each ×3. Smoothness gate (Leaderboard scroll + game switch).

## 26. Halloween app icon (founder 10-07)
- Same icon as today, recolored black + orange (Halloween palette; character on-model, no costume drift), shipped as
  the PRIMARY icon in 2.8 on iOS + Android (+ web favicon/PWA icons); Play hi-res 512 icon + App Store icon match.
- The icon lives in the binary → it goes back to normal with the next build (see "After Halloween").

## 27. Halloween store listing for 2.8 (founder 10-07)
- New screenshots once the build is complete: Halloween-themed captures of the NEW pages (living Home, Leaderboard
  stage, Stats, profiles, Friends + invites, pocket games, Dressing Room + voices) and the Halloween widgets, with
  Halloween captions in the store-screenshot style (scripts/store-screenshots); iPhone + iPad sizes, Play phone +
  tablet + feature graphic.
- Store text rewritten for 2.8: What's New, promo text, description, keywords (iOS) and short/full description (Play)
  — American spelling, no British spellings, ≤500 chars for Play notes.
- Ships with the 2.8 submission (iOS screenshots/description change only with a version); Play updated the same day.

## After Halloween (plan, founder 10-07)
- Nov 1–2: back to normal: normal icon + normal (non-seasonal) screenshots of the new pages + normal store text.
  iOS screenshots and the icon can only change with a new version → a small 2.8.x submitted ~Nov 1 (icon + listing,
  plus any October polish); Play listing swapped the same day (no build needed for the listing).
- ~1 week later (first week of November): the Thanksgiving build — the full seasonal kit from the seasons README
  (theme row, walls, ambient, opening animation, widgets, icon, screenshots/captions), using the seasonality playbook
  we keep polishing through October.
