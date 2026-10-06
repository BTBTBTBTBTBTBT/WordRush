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
