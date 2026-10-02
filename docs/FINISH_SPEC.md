# The finishing build (founder-approved 2026-10-02)

Source of truth for the big polish pass. Every decision here was approved by the founder across
several mockup rounds. The mockups are the visual reference — read their CSS for exact values:

- Game kit: `docs/design/brand/mockups/game-kit.html` (https://claude.ai/artifact/91A2SEAfM68uUXcaCWVxTK)
- Leaderboard: `docs/design/brand/mockups/leaderboard-polish.html` (https://claude.ai/artifact/GFYw52z6RyM5ZMC5HFsk7A)
- Stats + Friends: `docs/design/brand/mockups/stats-friends-polish.html` (https://claude.ai/artifact/Fh5uVbknKaphQ7aTTSVPCP)
- Finishing touches (result screen, popups, footer pages, share, widgets, emails):
  `docs/design/brand/mockups/finishing-touches.html` (https://claude.ai/artifact/A3hfTv93bxBsjDg1oZNdyh)
- White audit (every plain-white surface, per platform): `docs/WHITE_AUDIT.md`

Parity on web, iOS and Android. Respect Reduce Motion everywhere (motion → instant/crossfade).
American spelling. All mascot images decorative (hidden from screen readers).

## A. Global look

A1. **No plain white anywhere** (founder: "get rid of as much white space as possible"). Every card,
    tile, chip, pill, popover, sheet, row, input and empty board tile takes a soft wash of its accent:
    `background = mix(accent 12–14%, white)`, `border 1.5 = mix(accent 30–35%, white)`. Cards also get the
    game-card **top bar** (the 10-pt band already used by the Home game cards). Icon tiles (game icons in
    pickers, rails, sweep rows, widgets) are mini game cards: tint + border + a 4-pt accent top bar + soft
    accent shadow. Use the game's catalog accent; page cards use the page accent. Start with the shared
    levers in `docs/WHITE_AUDIT.md` (surface token, VS/Friends card helpers, header circles, light game-tile
    tone, web definition rows), then the one-offs. Dark mode keeps its existing dark surfaces.
A2. **Soft numbers**: every big number (streaks, points, ranks, timers, stat tiles) is Nunito Black (900),
    dark purple `#3b1a78`, `tabular-nums`, soft white text-shadow on light backgrounds. Never the gradient /
    gold digit art (founder hates it).
A3. **Header controls = soft 3D icons, no bubbles**: the `icon3d-*` set (flame, shield, help, gear, back,
    sound, share, tab-home for "home") drawn bare (no circle/pill behind), 23 pt tall, numbers 17 pt soft
    numbers, 44-pt tap area, **squish** on press (scale .86/.80 → 1.08 → 1, 260 ms spring).
A4. **Docked tab bar**: flush to the bottom edge, edge to edge, opaque, content ends above it (nothing
    shows underneath), soft page-tinted gradient (lilac on Home, warm on Leaderboard, blue on Stats, pink on
    Friends) with a faint top line; the home-indicator area is part of the bar. Each tab icon squishes on tap.
A5. **Living cast header** (Home and the tab pages): the ten cast hero images (`mascot-<id>`) in a row
    spelling WORDOCIOUS, edge to edge (§option A). Every 2.6–5 s ONE random character (never the same twice
    in a row) plays its move: O1 spin 360 (900 ms) · W hop + squash (700) · R nod off + jolt (1.6 s) · D double
    bounce (760) · O2 star pulse + tilt (820) · C curious lean (1.2 s) · I shy wiggle (900) · O3 jump (760) ·
    U levitate (1.8 s) · S dash jitter (700). Exact keyframes: `.castrow` CSS in the mockups. Off with Reduce Motion.
A6. **Page titles are headlines**: page/day title art full width edge to edge, right on the wallpaper, no
    box/stage/border, no float animation. Footer-page titles share one height (fit width up to that height).
A7. **Character variety**: on one screen never the same character in the same image twice; secondary spots
    (popups, share footers, empty states, emails) use a different character than the page/game host.
A8. **Buttons: one glossy candy style everywhere** (founder: the big blob Play / View buttons are
    "horrendous … there should be no buttons looking like that on the app"; design by ChatGPT, reference
    `docs/design/brand/buttons/chatgpt-buttons-*.jpg`). Every button (pill and round) is:
    - a pill (radius = height/2) or circle filled with a vertical 2-stop gradient in its color
      (purple #a66bff→#6d28d9 primary · pink→purple #f472b6→#a21caf secondary · amber #ffc56b→#f97316 ·
      teal #5eead4→#0d9488 · soft peach #ffd6c2→#fbb38f with dark-purple text for quiet actions);
    - a thin GOLD outline (2 pt #f5c542, 1 pt on small buttons) just inside the edge;
    - a thick darker bottom lip (4–5 pt, the gradient's bottom color darkened ~35%) so it looks pressable,
      plus a soft drop shadow;
    - a glossy white highlight across the top half (white 45% → 0%, inset from the edges);
    - label in Nunito Black, white, with a 1.5–2 pt dark-purple outline (#3b1a78) and a soft shadow; optional
      leading icon in the same white-with-outline treatment (▶ play, eye, arrow);
    - press = squish (scale .92, the lip compresses) with the spring back.
    Sizes: large 52 pt (primary CTAs), medium 40 pt, small round 40 pt. No other button styles remain
    (no flat pills, no blobs, no plain text-link buttons for actions).
A9. **Everything tappable squishes** (founder: "give all the buttons that spongey feel when pushed"): every
    button, icon button, chip, segmented option, game tile, card and list row that responds to a tap gets
    the same spongy press — scale down to ~.92 (icons .86/.80) on touch-down, spring back past 1 (~1.05) and
    settle on release (≈260 ms, bouncy spring). One shared modifier / style per platform applied app-wide.
    Off with Reduce Motion.

## B. Game kit (all word games + number games)

B1. **Tiles** (§20 recipe): rounded square, thick bottom lip, gloss, white Nunito Black letters.
    Right spot PURPLE (no gold rim), wrong spot GOLD, not in word SLATE GREY; empty = frosted glass
    (white ~55% over the wallpaper with a faint lilac border, NOT solid white); typed = white face + purple
    border + dark purple letter. Same tiles carry digits 0–9; Sudoku "given" = plain light tile, dark purple digit.
B2. **Keyboard**: keys are tiles too (lilac lip, light face, dark purple letters) and take the state colors
    after a reveal; Delete = chunky purple backspace icon (not a tiny glyph); ENTER label 12 pt.
B3. **Motion**: type = 300 ms soft spring (fade in + swell 1.07); reveal = each tile turns over 720 ms,
    300 ms apart, color swaps at the half, lands with a soft color GLOW (bloom 900 ms) — the founder loved
    the hint glow; not a word = small row nudge (520 ms) + letters turn red with a red glow (1 s), then
    clear right to left 90 ms apart; win = hop wave (560 ms, 90 ms apart); lose = wobble + sink; hint =
    flips in purple + gold glow ×2; place a number = same as type; key/control press = squish.
B4. **Game screen layout**: controls row (home left; sound + help right) tucked right under the status
    bar; the big game title art under it, centered; the status line under the title; then the board.
B5. **One shared board-sizing rule for every game**: the board fills the space between the title/status
    and the keyboard — as wide as the screen allows (small side margin) and centered in the remaining
    height; multi-board games size their whole grid the same way. Minimal empty space on every phone.
B6. **Finished game screen**: no "Home" text link; Share = the 3D share icon; the result line = two
    tinted pills (purple guesses, blue time) with 3D icons + soft numbers; leftover empty rows frosted;
    score breakdown on a lavender card (purple top bar, dashed dividers, purple values, big soft total);
    today's word spelled in purple tiles on a soft green card with a green part-of-speech chip + definition;
    the three CTAs are chunky 3D buttons with icons (gold next daily, purple leaderboard, soft Unlimited).

## C. Pages

C1. **Home**: living cast header (A5); controls row under it (A3); cards tinted (A1). Home cards keep §21.
C2. **Leaderboard**: the day title is the headline (A6); the date/reset row tops the picker card (tinted);
    picker icon tiles are mini game cards, selected = stronger tint + accent ring; play card = title art +
    "N players today" + a medium VIEW BOARD / PLAY glossy pill (A8) — never the old tall purple/orange blob on a lavender card with top bar;
    ONE result card (crown, "#1 of N today", how you solved it, points) on gold; a top-3 PODIUM (gold /
    silver / bronze steps, letter-tile avatars, crown on 1st), then the rest in one tinted card with soft
    striped rows. Monday + Wednesday titles were regenerated (already shipped).
C2a. **Board rows: W/L badge in its own column** (founder): on every leaderboard / records / yesterday's
    winners / sweep row, the W / L result badge moves out of the subtitle line ("4 Guesses · 48s [W]") into a
    fixed-width column immediately LEFT of the points total, vertically centered on the row, so the badges
    stack in one perfectly even column down the list and the points stay right-aligned beside them. Rows
    without a badge keep the column's space (empty) so the points still line up.
C2b. **Sweep is a game tile** (founder): a new glossy 3D broom icon `game-sweep` (ChatGPT, same style as the
    game icons) sits as the 9th tile in the WORDOCIOUS row, right after Seven, on the Leaderboard picker (and
    anywhere the dailies row appears with Sweep) — no separate "SWEEP" pill above the row.
C3. **Stats game picker = the Leaderboard picker** (founder): the Stats page gets the same picker window as
    the Leaderboard (same card, header row, WORDOCIOUS row incl. the Sweep tile + PUZZLES row, mini-game-card
    tiles tinted by game, selected = stronger tint + accent ring), with every game visible at once — no
    horizontal scrolling rail. Tapping a tile switches the Stats content below to that game's stats (Today /
    All-time stay as the first two options, e.g. a two-segment toggle in the window's header row). Reuse ONE
    shared picker component on both pages.
C3 (cont). **Stats page look**: STATS headline; player card lavender + purple→pink top bar + gradient level bar; game rail
    chips with game icons (tinted by game; selected filled purple); Today on a soft blue card with the 8
    sweep tiles (mini game cards with W/L badges) + three tinted pills (magenta Puzzles, teal VS, gold
    Standing); streak + best-moment tiles and the four all-time tiles each in their own color with 3D icons;
    charts on tinted cards.
C4. **Friends**: FRIENDS headline; race banner pink with O1 cheering, medal-colored chips; online friends
    as letter tiles with a green dot; the six friend games as small tinted cards with their own top bars;
    this week's race with the podium on gold; friends list on lavender with striped rows and chunky
    Play / Challenge / Nudge buttons.
C4b. **Friends header cleanup** (founder): remove the bell (notification prefs) and the add-friend circle
    from beside the FRIENDS title. Notification preferences move into Settings under a new "Notifications"
    section (same toggles). "Add a friend" becomes a small glossy candy button (A8, no white bubble) in the
    "Your friends" section header. The FRIENDS title is then centered (A6 headline, nothing beside it).
C5. **Streak + shield popups**: colored header (warm orange streak / purple shields) with the big 3D icon,
    a friendly headline and a host character (S the speedster for streak, U for shields); Current + Best in
    two tinted soft-number tiles; the streak popup shows this week as seven day tiles (filled orange per
    day played); the shield popup shows the shields as a row of 3D shields (next to earn faded); page dims
    softly; anchored under the tapped control.
C6. **Footer / info pages** (How to Play, Guides, Strategy, Words, FAQ, Privacy, Terms): each shows ITS
    OWN title art (`art-title-howto|guides|strategy|words|faq|privacy|terms`, all shipped; same height);
    same layout on all: back + help 3D icons, title, an intro card, then tinted cards with top bars (game
    guides in each game's color; FAQ as question cards; Privacy/Terms as section cards).

## D. VS (every screen) and the bot cast

D1. **Bots are the cast** (founder): ladder of 10, three wins in a row per rung:
    1 Rip (R, easy, solves in 6) · 2 Ivy (I, 5–6) · 3 Ollie (O1, 5) · 4 Opal (O2, 4–5) · 5 Cosmo (C, 4–5, bold
    openers) · 6 Umi (U, adaptive — matches your form) · 7 Ozzy (O3, tricky guesses) · 8 Dewey (D, 3–4) ·
    9 Scoot (S, 2–4, fast) · 10 Webster (W, boss, 2–3). "Your Ghost" stays the player's best-run replay
    (shown as a faded version of the player's letter tile). Map the old ids (rook/lexi/nova/adapt) so
    existing progress carries over sensibly (old rung N → nearest new rung by difficulty) and old stats keep counting.
D2. **Bot of the Day rotates with the day host**: Mon Dewey (D), Tue Ivy (I), Wed Umi (U), Thu Scoot (S),
    Fri Opal (O2), Sat Ollie (O1), Sun Ozzy (O3). Same on every platform (shared helper in packages/core).
D3. **Every VS screen in the new look**: lobby, bot picker / ladder, Bot of the Day, queue/searching,
    match intro (versus card: you vs them with characters), live HUD, waiting-for-opponent, end result
    (win / lose / draw), challenges + race results, friend picker. Tinted cards (A1), soft numbers, chunky
    buttons, mascot art in character (the bot's own character as its avatar; pose variety per A7); banter
    lines rewritten per character personality (kind, never mean).

## E. Share images, widgets, emails

E1. **Share images** (every game + sweep + leaderboard + profile): wallpaper background, the game's title
    art, glossy result tiles (no flat squares, no white empty cells), three tinted stat windows with top
    bars (purple guesses, blue time, gold points; soft numbers), and a footer line ("Can you beat me? ·
    wordocious.com") with a cast character that is NOT the game's title host, with NO bubble behind it.
E2. **Widgets** (iOS + Android, small + medium): wallpaper, today's games as mini game-card tiles (purple
    check on finished), streak + rank in soft numbers with 3D icons, the cast across the top of the medium.
E3. **Account emails** (`supabase/email-templates/*`): cast header image (hosted on wordocious.com), message
    on a white-free card (very light lilac) with a purple top bar, chunky purple button, a cast character,
    friendly footer. Reset password, confirm sign-up, magic link, change email. Founder pastes them into
    Supabase.

## F. App icon, launch, store

F1. **App icon → option B** (the W mascot on the purple→pink gradient; founder approved switching it in
    this build). Source: `docs/design/brand/logo/app-icon-B-1024.png` (full-bleed square, no alpha, made
    from `option-B-w-mascot.png`). iOS AppIcon (1024, no alpha), Android adaptive icon (foreground = the W
    mascot on transparent with safe-zone margin, background = the gradient) + legacy/round, web favicon,
    `apple-touch-icon`, PWA `icon-192/512` and the manifest. The in-app "logo" spots that show the old W tile
    switch too.
F2. **Cold-start launch** (founder: "a big prominent centered, professional, polished image to animate into
    the initial boards when you boot up"):
    - Static launch screen (the OS shows it before code runs): the Home wallpaper color with the app-icon W
      mascot centered (iOS `UILaunchScreen` / launch image; Android 12+ SplashScreen API icon + background;
      web: an inline first-paint splash in the HTML).
    - Then an in-app intro, cold start only, ≤ 1.6 s, tap to skip: the W mascot (same spot as the static
      screen, so it is seamless) bounces once; the other nine cast heroes pop in to its left and right one
      after another (60 ms apart, spring) until the row spells WORDOCIOUS; the whole row glides up and
      shrinks into the Home header's cast row while Home fades in underneath. Reduce Motion: a 200 ms
      crossfade. Never shown again on resume / warm start.
F3. **Store** (after TestFlight): the founder takes raw screenshots; I make captioned store screenshots
    for iOS (6.9" + 6.5") and Play (phone) in the new look, a new Play feature graphic, and update the
    listing text. Not part of the code build.

## G. Popups + celebrations with custom art (founder 10-02: "anything else that wasn't stylized yet")

Art (OpenAI API, transparent, on-model; shipped as `art-scene-*` ×3):
`art-scene-pro-crown` (W crowned with a golden star), `art-scene-shield-guard` (U shielding the streak flame),
`art-scene-flawless-star` (pink O on a gem), `art-scene-sweep-broom` (S racing a broom),
`art-scene-banner-sweep` (O1 + S with broom + W, wide), `art-scene-banner-flawless` (D + pink O with gem + I, wide).

G1. **Go Pro popup / Pro page**: gold-tinted card family (A1) with a gold top bar; `pro-crown` art large at
    the top; plan options as tinted cards (selected = stronger tint + ring); the primary CTA a large amber/
    gold candy button (A8); feature list rows with 3D icons; no plain white anywhere.
G2. **Streak-at-risk window** (StreakShieldModal) + streak / shield / flawless header popovers (C5): purple
    header with `shield-guard`; soft-number streak; USE A SHIELD = purple candy button, "Let it reset" = soft
    peach candy button; the "streak saved" state shows the art with a glow + confetti.
G3. **Flawless + Daily Sweep celebrations** (SweepCelebration / VictoryOverlay "flawless" + "sweep" variants):
    full-screen tinted overlay in the moment's color, the big art (`flawless-star` / `sweep-broom`) springing in
    with a bounce, the existing moment lettering above it, soft-number stat tiles below, confetti, candy CTAs.
G4. **Home banner Sweep / Flawless states**: when the banner flips to the sweep or flawless state, show the
    wide `banner-sweep` / `banner-flawless` art across the banner (behind/beside the headline, cast fully
    visible), in a tinted banner card with its own top bar color (gold for sweep, pink for flawless).
G5. **Everything else not yet touched** (sweep of the app): limit-reached window, More Games sheet, invite /
    add-friend windows, sign-in + first launch, Settings + Edit profile, toasts, loading + empty screens —
    tinted surfaces, candy buttons, soft numbers, squish, and a cast pose (art-pose-*) where there is room,
    following A7 (different character than the page host).
