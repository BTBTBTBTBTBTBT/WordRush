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

## H. Starsweep in the new look (founder 10-02)

Pieces (OpenAI API, glossy candy style, transparent, 256 px): `art-starsweep-star-placed` (navy, an unchecked
star), `art-starsweep-star-correct` (purple + sparkle), `art-starsweep-star-wrong` (coral with a crack),
`art-starsweep-cross` (soft lilac X). Replace the drawn ★ / × glyphs with these images (~78% of the cell).
Board: the region cells become soft glossy candy tiles — each region a pastel tint of a distinct hue
(8–9 friendly pastels: lilac, peach, mint, sky, butter, pink, aqua, coral, lavender), cell = rounded 6–8 pt
square with a faint lighter top gloss and a 1.5 pt darker bottom lip; region borders as a slightly thicker
gap / darker seam instead of black lines; no plain white. Placing a star = the type pop; playing it =
the flip-and-glow (purple glow when right, red glow + small shake when wrong); hint = gold glow. The pad /
buttons = candy buttons; stats + result screen per B6. Same on web, iOS, Android.

## I. Muddle letters (founder 10-02: "the letters that appear in circles … super polished")

Coins (OpenAI API, glossy, blank — the letter is drawn on top in code, white Nunito Black with the tile
text-shadow; dark amber #7a3d00 on the gold coin): `art-muddle-coin-empty` (a gold ring; draw it over a
frosted empty cell), `-coin-filled` (purple with gold rim), `-coin-hint` (violet + sparkle, a revealed
hint letter), `-coin-punchline` (gold, the punchline tray).
I1. Circled answer slots use the round coins instead of a square tile with a thin ring (the uncircled
    slots stay the B1 square glossy tiles); same footprint as the square tiles, letter ~52% of the coin.
I2. The punchline tray letters are gold coins (empty = the gold ring on frosted).
I3. The scrambled clue letters become small glossy letter chips (B1 tile recipe at ~70% size, light amber
    face, dark-purple letter); used letters sink (scale .9, faded 35%) instead of only dimming text.
I4. The bulb (reveal a letter) and eye (solve this word) buttons are small round candy buttons (A8), the
    active word row is a tinted card (A1) instead of a lilac fill, the cartoon panel keeps its cream paper
    card with the A1 border/shadow. Placing a letter = type pop; a solved word = the reveal flip + glow;
    the punchline solved = hop wave + confetti. Same on web, iOS, Android.

## J. Remaining game pieces (founder 10-02 audit)

J1. Hubbub: the seven hive letters are glossy HEXAGONS — `art-piece-hex` (lilac) for the six outer letters
    and `art-piece-hex-center` (gold) for the required center letter, laid out as a honeycomb (center + six
    around); the letter drawn on top in code (white Nunito Black; dark amber #7a3d00 on the gold center).
    Tap = squish + type pop.
J2. Tic-Tac-Tile: the X and O pieces are `art-piece-ttt-x` (purple) and `art-piece-ttt-o` (pink) instead of
    the thin white line drawings; a placed piece drops in (type pop); the winning three glow.
J3. Code-only polish (no new art): Crosswordocious cells = B1 glossy tiles with the clue number as a small
    soft badge in the corner (blocks stay absent); Kindred word cards = glossy chips (tinted face, lip,
    gloss), selected = the tier color filled, solved bars = tinted cards with top bars; Cipher cells = B1
    glossy tiles with the code letter as a small chip beneath; Spyglass = the 10×10 letters as small glossy
    tiles (or crisp letters on a tinted board if tiles crowd the grid) and found words as glossy capsules in
    the accent with a soft glow.

## K. Notifications in the new look (founder 10-02: "the notifications (x beat you)")

K1. In-app notices (friend beat you, challenge received / result, nudge, race lead change, friend request,
    streak reminders shown in-app — the toast / banner / notification list): a tinted card (A1) in the event's
    color with its top bar, the sender's letter-tile avatar (§20), a small cast pose that fits the event
    (A7; e.g. O2 gasp for "beat you", S ready for a challenge, O1 cheer for a win, R sleepy for a nudge),
    the headline in Nunito Black with soft numbers for scores ("Oliver beat you · 2,005 vs 1,860"), and a
    candy action button (Rematch / Play / View). Slides in with a spring, squish on tap, swipe to dismiss.
K2. Push notifications (OS-drawn): the new icon B; Android small icon = a white monochrome W-mascot
    silhouette (`ic_stat_wordocious`), accent color #7c3aed; friendly copy with the sender + numbers; where
    the platform allows a large icon / image, attach the matching cast pose. (iOS rich images would need a
    Notification Service Extension — leave for later unless already present.)

## L. The boards themselves (founder 10-02: "make sure the boards themselves match the same polish")

Every board container (the panel the tiles sit on) becomes one shared GAME TRAY, drawn in code:
rounded 20–22 pt, filled with a soft wash of the game's accent (10–12% over white, never plain white),
a 1.5 pt accent border (30%), a 4 pt darker lip at the bottom, a faint inner top gloss, a soft accent
drop shadow, and 10–12 pt inner padding. Applies to: the Classic-family boards, every QuadWord/OctoWord
mini board (each its own tray; the active/zoomed one gets the stronger tint + ring), Succession/Deliverance
boards, Sudocious (the 3×3 boxes are separated by soft darker seams in the tray color, not black lines),
Crosswordocious, Cipher, Spyglass, Starsweep (regions as in H), Kindred's grid, Hubbub's honeycomb,
Ladder, Muddle's word rows, and the Friends pocket boards. Solved boards: the tray takes a gentle purple
(won) or slate (lost) wash. One shared tray component per platform; no black grid lines anywhere.

## F2 fix (founder 10-02, on iOS 234: "there are two of them and the one that animates whips off the
screen while the duplicate stays in place")

The cold-start intro must hand off to the REAL header with no duplicate and no overshoot:
1. While the intro runs, the real Home header cast row is hidden (opacity 0, still laid out).
2. The intro measures the real row's on-screen frame (SwiftUI preference/anchor or onGeometryChange;
   Compose onGloballyPositioned; web getBoundingClientRect) and glides its row to EXACTLY that frame
   (position + width, matching per-character spacing/lift), easing in with no overshoot past it.
3. On landing, in the same frame: the real row turns visible and the intro row is removed (no crossfade
   overlap, no second copy). The rest of Home fades in under the glide as before.
4. Then a brief all-cast flourish on the real row: each character hops once (the W hop keyframes,
   ~420 ms each, 50 ms apart, left to right), then the normal one-at-a-time personality moves resume.
5. Tap to skip jumps straight to step 3. Reduce Motion: a 200 ms crossfade, no flourish.

## M. Friends tab notification badge (founder 10-02)

When the player has anything waiting in Friends — incoming friend requests, game invites / challenges
waiting on them ("Your turn"), unseen friendly-game moves — the Friends tab icon shows a badge:
- a glossy candy badge at the icon's top-right: hot pink → coral gradient (#ff5fa2 → #f0435f), a 1.5 pt
  gold (#f5c542) outline, a white top gloss and a darker lip, white Nunito Black count (1–9, then "9+");
  min 18 pt round, grows into a pill for 2 digits;
- it springs in (scale 0 → 1.15 → 1) when a new item arrives, and the Friends tab icon does a small
  happy wiggle (±8°, 2 swings) at the same moment; afterwards a slow soft pulse of the badge's glow every
  ~4 s while unseen (no pulse with Reduce Motion);
- the count = incoming requests + invites/challenges awaiting the player + friendly games where it's their
  turn; opening the Friends tab marks requests/invites as seen (badge clears; it returns only for new
  items). Inside Friends, each waiting row/section shows the same small badge so the player can find it.
- Accessibility: the tab's label reads "Friends, 3 new".
Same on web (bottom nav), iOS and Android; use the data the apps already load (no new backend unless a
count isn't available — then reuse the existing requests/invites queries).

## N. Calmer top (founder 10-02: "the top is kind of ugly on the new pages and seems really busy … so
the top characters really pop")

N1. One cast per screen: the living cast row is the only whole-cast art. Page titles (`art-title-*`, now
    re-shipped as LETTERING ONLY — no characters) are smaller centered headlines: ≈62% of the content width,
    max 300 pt / px, height ≤ 64 pt; the Home section titles (DAILIES / PUZZLES / WORD OF THE DAY) follow the
    same rule. The Leaderboard day title keeps its single host and is capped at ≈58% width / 150 pt tall.
N2. Wallpapers re-shipped with a clean top third (no letter tiles behind the header). Add a very soft fade
    under the header area: the page tint at 0% → 55% opacity over the top ~170 pt, so the cast sits on calm color.
N3. Cast row breathing room: ≈90% of the screen width (not edge to edge), centered, with 8–10 pt top margin
    under the status bar and a soft elliptical ground shadow under the row (the page accent at ~14%, blurred).
N4. The controls row (streak / shields / help / settings) sits 6 pt below the cast row; icons stay 23 pt.
    Order of attention: cast → title → cards; no other decoration in the top band.

## O. VS Battle gets its own Home section (founder 10-02: "VS Battle needs its own title … it seems like
it's extra … make this better without any drastic changes")

O1. A VS BATTLE section title (`art-title-vsbattle`, lettering only, same size rule as DAILIES / PUZZLES /
    WORD OF THE DAY, N1) above the VS card, with the same spacing as the other sections — so Home reads
    DAILIES → PUZZLES → WORD OF THE DAY → VS BATTLE.
O2. The VS card (same place, same data — no drastic change): teal-tinted game card with its top bar; on the
    left the `art-scene-vs-faceoff` W-vs-S art as a small hero (~40% of the card width, cropped to the two
    characters and the bolt); on the right "LIVE · N players online" with the pulsing green dot, today's
    status line ("Today's shared battle" / "Battle won!"), and two candy buttons: PLAY (teal, primary) and
    INVITE (peach). The W/L badge follows §21.1. Bot of the Day can show as a small line with that day's
    cast bot pose (e.g. "Bot of the day: Dewey").

## P. Gauntlet stage screens (founder 10-02: "a mascot on each one that shows next stage")

The between-stage / "next stage" screen (components/gauntlet/stage-transition*, iOS / Android equivalents)
becomes a tinted amber card (Gauntlet accent) with: a big cast pose that changes per upcoming stage —
Stage 2 `art-pose-o1-cheer`, 3 `art-pose-d-eureka`, 4 `art-pose-c-telescope`, 5 `art-pose-s-flex`, and the
final stage / boss `art-pose-w-proud` (the poses spring in); the stage number in soft numbers ("STAGE 3 OF 5")
with a 5-dot progress row (done dots filled amber, current pulsing); the stage's word length / rule as a
tinted pill; the running score in soft numbers; and a large amber candy CONTINUE button. Cleared stages
show a small W badge per stage. A failed run shows `art-pose-r-sit` with a gentle message and candy buttons.
Same on web, iOS, Android.

## Q. Gauntlet finish screen (founder 10-02: "a custom designed gauntlet finish screen … with a mascot or two")

New art: `art-scene-gauntlet-champion` (1200×815, transparent — S on top of a gold star staircase holding the
trophy high, D cheering at the bottom with his pencil, confetti). Shipped ×3 (web public/art, Android
drawable-nodpi art_scene_gauntlet_champion, iOS imageset); web must add it to ART_SIZE + SceneArtName.

Gauntlet results (web components/gauntlet/gauntlet-results.tsx + iOS / Android equivalents), keeping the
B6 finished-screen layout and all existing data:
- WON (all 5 stages): an amber-tinted hero card at the top: the champion scene full card width (springs in,
  then a gentle bob; confetti burst once), headline lettering-style "GAUNTLET CLEARED!" in soft numbers ink,
  "5/5 stages" + total time + total guesses as three soft-number stat pills, a 5-star row (all filled gold,
  popping in one by one 90 ms apart), then the share icon (B6) and a large amber candy button "Play again
  tomorrow" / Home. The per-stage boards below sit on the shared game tray (L) with a small W badge each.
- LOST (stopped at stage k): same card, lighter amber tint, two poses side by side instead of the scene —
  `art-pose-r-cocoa` and `art-pose-i-goodgame` (kind, never sad) — headline "SO CLOSE!", "k/5 stages" with
  the 5-star row showing k filled + the rest soft grey, the failed stage's answer revealed on glossy tiles,
  and the same candy buttons.
- Reduce Motion: no bob or confetti, stars appear at once. Same on web, iOS, Android.

## R. Win / lose popup, one-screen finished screen, Unlimited (founder 10-02 with a Quadword VICTORY screenshot:
"stylize this a bit more on all the completed game screens … looks pretty plain"; "keep the screen afterwards
… fit one screen so the user doesn't have to scroll to the buttons"; "unlimited games buttons … polished,
possibly with a mascot")

R1. Win popup (web components/effects/victory-animation.tsx + game-over-animation.tsx; iOS / Android
    equivalents) — one shared component for EVERY game, so all completed games get it at once:
  - Card: no near-white. A soft game-accent gradient (accent at ~10% top → ~4% bottom over the warm cream),
    the existing rainbow top bar kept, 28 radius, a soft accent glow shadow. Dark mode = deep accent tint.
  - Mascot: keep the game host's pose but give it a stage — a soft radial glow + slow-turning light rays
    (accent, 12% opacity, 24 s per turn) behind it, a ground shadow, a spring-in with a 1.06 overshoot,
    then a gentle bob. One confetti burst in the cast colors on open (not looping).
  - Lettering: keep art-moment-victory / youwin / soclose / youlose, add a single gloss sweep across it
    0.4 s after it lands.
  - Answers: replace the plain white box with a tinted inner tray (accent 8%, no border line) holding each
    answer on small glossy SOLVED tiles (the game's win tile color, the B-kit glossy tile, ~26pt, soft
    numbers font for letters), one word per row, flipping in left→right 40 ms apart. Multi-board games keep
    the 2-column grid; each word gets a tiny check badge (icon3d-badge-check) on the right.
    Loss: unsolved answers on the slate tile, a small "the answer" label.
  - Stats: four stat chips instead of loose numbers — each a tinted pill (accent 10%) with a small glyph
    (boards = grid, guesses = target, time = clock, points = star in gold), the value in soft numbers and
    the label below in small caps. POINTS counts up from 0 over 700 ms with a sparkle at the end; the points
    chip is gold-tinted. Extra chips when they apply: "🔥 Day N" streak +1 (flame, pops), FLAWLESS (pink),
    NEW RECORD (art-moment-newrecord lettering small).
  - Replace "Tap anywhere to continue" with a candy CONTINUE button in the game accent (tap-anywhere still
    works). Reduce Motion: no rays/bob/confetti/count-up.

R2. Finished screen fits one screen (every game, after the popup): no scrolling to reach the buttons on any
    phone ≥ 667pt tall (iPhone SE). Layout top→bottom: header, compact result strip (one line: badge ·
    guesses · time · points), the board(s) scaled to fit the remaining height (finished boards may shrink
    below the playing size — Quadword / multi-board use the 2×2 mini grid; Crossword / Spyglass / Hubbub
    boards scale to fit; long lists like Ladder/Muddle steps collapse to a summary with "See all"), then
    the action dock pinned above the tab bar: the share icon + the primary candy button (Next daily /
    Leaderboard) + the Unlimited card (R3). Anything extra (definitions, stats breakdowns) goes behind a
    "More" disclosure or below the dock, never above the buttons. Measure, don't guess: the board area gets
    whatever height is left after the dock.

R3. Unlimited (web components/game/next-daily-cta.tsx KeepPlayingUnlimited + unlimited-gate.tsx +
    play-mode-toggle.tsx + the end-of-unlimited-game "New puzzle" actions; iOS / Android equivalents):
  - New art `art-scene-unlimited-loop` (900×759, U floating with a loop of candy tiles orbiting her),
    shipped ×3 (web public/art — add to ART_SIZE + SceneName; Android art_scene_unlimited_loop; iOS imageset).
  - Pro users: a peach-tinted "KEEP PLAYING" card in the dock: the U loop art on the left (~64pt, slow orbit
    wobble), "Unlimited <Game>" title + "Fresh puzzles, no waiting" subtitle, and a peach candy button (NO infinity glyph — see Y). After finishing an UNLIMITED game the same card becomes the primary action:
    "NEW PUZZLE" (peach candy, big) + a small "Other games" link that opens the game picker.
  - Free users / guests (founder 10-02: "Free players can see keep playing unlimited, but if they do, it should
    go back to the redesigned Go Pro popup"): they now SEE the same Keep Playing card (U art, "Unlimited <Game>",
    a small gold PRO pill on the button). Tapping it opens the redesigned G1 Go Pro popup (pro-crown W art,
    plan picker, amber candy button), never the old modal and never a plain page. Guests: same popup; its
    button routes through sign-in first, then back to the popup. After a successful purchase the card
    starts the Unlimited game directly. Applies to every surface that offers Unlimited to free users
    (finished screen dock, play-mode toggle, unlimited-gate / mode-limit screens).
  - unlimited-gate / limit screens: same card language, U art, candy buttons, no white.
  - Same on web, iOS, Android, for every game that has Unlimited.

## S. Share = the image only, fitted to the puzzle, the cast IS the wordmark, fun copy (founder 10-02 with an
iMessage screenshot of a QuadWord share link preview: "adjust all share buttons so they have the images fit
the puzzles better, are all polished with the new aesthetic … the Wordocious characters at the bottom need to
be much larger and together so that is the only way you can read wordocious … I also don't think they should
populate as a link anymore … populate only the image with all of the information on it when sending a
completed game screen"; "The text should be more fun and make more sense too if there is text")

S1. Completed-game shares send the IMAGE ONLY — no URL, no caption text, so iMessage / WhatsApp etc. show the
    picture, not a link-preview card. Applies to every result share (all games, Sweep, Gauntlet, VS results,
    leaderboard result, Stats/profile cards).
    - iOS: activity items = [the PNG] only (UIImage or an NSItemProvider "public.png" with a suggested name
      "Wordocious-<Game>.png"); no URL, no String. Leaderboard "linkOnly" path → image too.
    - Android: ACTION_SEND, type image/png, EXTRA_STREAM (FileProvider uri + ClipData so the chooser previews
      it), FLAG_GRANT_READ_URI_PERMISSION, NO EXTRA_TEXT. The 2-image sweep multi-send keeps its images only.
    - Web: navigator.share({ files: [png] }) only (no url/text); drop the linkOnly / hosted-URL path for
      results. Fallbacks: copy image to clipboard, then download the PNG. (Hosted share pages can stay for old
      links; stop creating new ones from result shares.)
    - Invites (friend invite, VS join / challenge links) KEEP their links — the link is the point — but get
      the S4 copy treatment.

S2. Image fits the puzzle (all share renderers):
    - The canvas is sized to the content, no dead space: title art at the top (~70% width), one compact info
      line (date · guesses · time · W badge), the board block, the stat windows (E1), then the cast wordmark.
      Height = sum of those; aspect clamped between 4:5 and 9:16.
    - The board block fills ~88% of the width: single-board games big; QuadWord / multi-board as a tight 2×2
      (gap ≈ 4% of width); tall boards scale by height so the whole canvas still fits the clamp.
    - New aesthetic everywhere: E1 wallpaper, glossy tiles (purple/gold/grey kit, no rim, no grid lines), the
      tinted stat windows with top bars and soft numbers, no white.
    - Remove the separate "WORDOCIOUS" text wordmark at the top.

S3. The cast is the wordmark: the bottom row is the ten hero characters in order W·O·R·D·O·C·I·O·U·S, standing
    TOGETHER (touching, ~-6% overlap like the Home cast header row), spanning ~90% of the image width, with a
    soft ground shadow — big enough that it reads "WORDOCIOUS". It is the only wordmark on the image.
    Under it, one tiny line "wordocious.com" (so a recipient knows where to play — there's no link anymore).

S4. Copy that's fun and makes sense — wherever text still appears (clipboard/download toast, invite messages,
    the Android chooser title "Share your QuadWord", hosted-page OG titles for old links, web <title> of
    /s pages). Shared bank, pick deterministically by hash(date + game) % n so all three platforms agree.
    Short, no em dashes, American spelling, never mean:
    - Win: "{Game} solved in {n} guesses. Your move 😎" · "Cracked {Game} in {t} ⚡ Beat that!" ·
      "{Game} in {n}. The letters never stood a chance."
    - Multi-board win: "All {b} {Game} boards cleared in {n} guesses 🧠✨"
    - Flawless: "Flawless {Game}! 💎 Not one wasted guess."
    - Lose: "{Game} got me today 😅 Can you crack it?" · "So close on {Game}! Think you can do better?"
    - Sweep: "Swept every Wordocious daily today 🧹✨"
    - Streak ≥ 3 appends " 🔥 Day {d}"
    - Gauntlet: "Cleared all 5 Gauntlet stages 🏆" · "Reached stage {k} of the Gauntlet. Can you go further?"
    - VS: "Beat {opp} at {Game} ⚔️" · "{opp} edged me at {Game}. Rematch incoming 🔁"
    - Invite: "Come play Wordocious with me! 🎉 {url}" · VS: "Race me at {Game}! ⚡ {url}"
    Toasts: "Image copied! Paste it anywhere 📋" / "Saved! Share it anywhere 🖼️".

## T. Friend invites + gift-a-week-of-Pro screens (founder 10-02: "make sure the friend invite screens that are
sent and accepted are matching the new polish"; "the gift 7 days items … all updated with mascots")

New art (shipped ×3; web add to ART_SIZE + SceneName): `art-scene-invite-sent` (802×870, I tossing a gold star
envelope), `art-scene-friends-match` (1200×832, I and pink O high-five with hearts), `art-scene-gift-pro`
(O3, the one-eyed orange O, holding a purple gift box with a gold crown on the bow).

T1. Invite sent (invite sheet / invite panel / add-friend request sent; web components/invites/invite-modal.tsx,
    components/referrals/invite-panel.tsx, friends "Add a friend"; iOS InviteSheet / InvitePanelView; Android
    InviteSheet / InvitePanel): tinted card (Friends accent), invite-sent art springing in, lettering-style
    headline "INVITE SENT!" (soft numbers ink), the friend's name/code on a glossy pill, candy buttons
    ("Send another", "Done"). The invite code itself shown on glossy letter tiles (B-kit tiles) with a copy
    candy button. Request-pending rows in Friends get a small "Pending" glossy pill.
T2. Invite received / join landing (web app/join/[code]/page.tsx, the pending-invites banner, the accept/decline
    notice; native equivalents): tinted card with the inviter's avatar + the invite-sent art, "<Name> wants to
    be friends!", Accept = green candy, Decline = soft secondary candy. Loading, not-found (o3-notfound),
    expired and already-used states all get a cast pose + tinted card + a candy "Go to Wordocious" button —
    no bare text lines.
T3. Accepted ("You're now friends!" — after accepting, and on the inviter's side when the request is
    accepted via notice/toast): friends-match art full card width with one confetti + heart burst,
    headline "NEW FRIENDS!", both avatars side by side, and candy buttons "Challenge them" (VS race) and
    "See friends". Reduce Motion = no burst.
T4. Gift a week of Pro (the referral / gift-trial program: the invite panel's gift section, the share copy,
    the join landing's "Pro unlocked!" / "Not eligible" states, referral-redeemer, Pro page gift area,
    the gift-shield send/receive in the activity feed): gift-pro art (O3 + crowned gift box) on a gold-tinted
    card, headline "GIFT A WEEK OF PRO", soft-number "7 DAYS" badge, gifts-left counter in soft numbers,
    gold candy "Send a gift" button. Recipient "Pro unlocked!" = pro-crown W art + gold confetti + "7 days of
    Pro are yours!" + candy "Start playing". "Not eligible" = a kind pose (r-cocoa) + tinted card.
    Gift-shield rows/notices use the shield-guard art small.

## U. Sound + haptics (founder 10-02: "execute all of them")

New sound pack (synthesized, ours; docs/design/brand/sounds/make-sounds.py; 16 sounds, 168 KB AAC):
web `public/sounds/<name>.m4a`, iOS `Resources/Sounds/sfx-<name>.m4a` (XcodeGen picks up the folder),
Android `res/raw/sfx_<name>.m4a`. Names: tap, delete, flip, press, release, hop, invalid, win, lose,
celebrate, streak, tick, notify, unlock, vs, whoosh.
- One sound service per platform replacing the synthesized tones (web lib/sounds.ts, iOS SoundManager, the
  Android tone code): preload all 16 once (web: fetch + decodeAudioData into an AudioContext unlocked on the
  first tap; iOS: AVAudioPlayer pool or AVAudioEngine buffers, `.ambient` + mixWithOthers so the mute
  switch and the user's music are respected; Android: SoundPool, USAGE_GAME). Master volume ~0.6; `tap`
  varies pitch ±3% per press so typing never sounds robotic. Keep the existing Sound Effects toggle
  (`pref-sound`, default on) and add a separate Haptics toggle (default on) in Settings.
- Event map (sound · haptic):
  key press tap · light | delete/backspace delete · light | tile flip (each tile of a reveal) flip · selection
  tick | correct-row land — · light | not-a-word invalid · warning | candy button / squish press press ·
  soft | squish release release · — | cast hop / mascot spring-in hop · — | win popup win · success |
  loss popup lose · soft | Sweep / Flawless / Gauntlet champion / ladder cleared celebrate · success+heavy |
  streak +1 / shield saved streak · medium | points count-up tick (throttled ≤ 12/s) · — | in-app notice /
  Friends badge notify · light | achievement unlock unlock · success | VS match found / start vs · medium |
  popup / sheet open whoosh · —.
- Web haptics: navigator.vibrate where supported (Android Chrome), no-op elsewhere. Reduce Motion does not
  mute sound; Sound off mutes all.

## V. 3D achievement badges + level badges

22 new badges shipped ×3 as `art-badge-<name>` (256², transparent; web add to ART_SIZE):
- Achievement icons (one per existing `icon` key in achievement-service.ts): star, crown, zap, flame, trophy,
  sparkles, grid, swords, target, medal, trending-up, shuffle, quote, key-round, group, calendar.
- Level tiers: level-bronze (1–10), level-silver (11–25), level-gold (26–50), level-platinum (51–99),
  level-diamond (100+) — the thresholds already used on web stats/page.tsx; put `levelTier(level)` in
  packages/core with a parity fixture so all three agree. Plus `level-pro` (crown on purple gem) = the Pro
  member mark.
V1. Achievements grid (Stats + public profile): replace the ✓ / ? text tiles with the badge art. Unlocked =
    full color, soft glow, name + date below; locked = grayscale, 45% opacity, small icon3d-lock in the
    corner, name + progress bar ("37/50") in soft numbers. Tap = a detail sheet with the big badge.
V2. Unlock moment: when an achievement unlocks, a popup (R1 card language): the badge springs in big with
    rays + confetti, "ACHIEVEMENT UNLOCKED" in lettering-style ink, its name/description, `unlock` sound +
    success haptic, candy "Nice!" button. Several at once queue one after another.
V3. Level badge: wherever "Lvl N · Tier" / a level pill shows (Stats player card, profile hero, Friends
    rows, leaderboard rows, share profile card, level-up toast): the tier badge (16–64pt by context) with
    the level number in soft numbers beside it. Level-up = a small popup with the new tier badge if the tier
    changed. Pro members get the small level-pro mark next to their name where the PRO pill was a badge.

## W. First-run onboarding (new players only)

After the cold-start intro, ONLY for players who have never played (flag `onboarded-v1`; existing players
never see it; How to Play gets a "Take the tour" link to replay it): three swipeable full-screen cards on
the wallpaper with page dots, Skip top-right, candy Next:
1. `art-scene-onboard-tiles` (W presenting tiles) — "GUESS THE WORD" + one line on what the tile colors
   mean, using the app's real tile semantics/colors.
2. `art-scene-onboard-score` (D with stars) — "SCORE BIG": fewer guesses + faster time = more points, medals,
   the daily leaderboard.
3. `art-scene-shield-guard` (U shielding the flame) — "KEEP YOUR STREAK": play daily, shields protect it.
Final button "Play today's Classic" (candy, game accent) opens the Classic daily. Lettering-style
headlines, soft numbers, spring-in art, `whoosh` between cards, Reduce Motion = crossfade.

## X. Seasonal cast skins — Halloween (Oct 24 – Nov 1, local date)

`packages/core` `currentSeason(date)` → 'halloween' | null (+ fixture). Shipped ×3: `art-halloween-<id>`
(w, o1, r, d, o2, c, i, o3, u, s; 320², same framing as the cast poses): W vampire, O1 pumpkin
cheerleader, R ghost, D wizard, O2 witch, C alien astronaut, I scarecrow, O3 mummy, U fairy-ghost with a
lantern, S skeleton onesie. During the season these replace the hero cast in: the living cast header row
(N3), the cold-start intro + landing flourish, the share-image cast wordmark (S3), and the loading screen.
Admin preview: web `?season=halloween`; native admin debug toggle in Settings (is_admin only).
(Coming tonight via ChatGPT: Halloween props — pumpkin, bat, candy, ghost — for the day titles and a
Halloween Home banner; wire the slots now behind the season flag, art names `art-halloween-prop-*` and
`art-scene-banner-halloween`, hidden if the file is missing.)

## Y. No infinity symbols (founder 10-02: "remove the infinity symbols from the unlimited game windows,
those look stupid")

Remove every ∞ / infinity glyph/icon from Unlimited cards, buttons, the Daily/Unlimited switch, the gate and
limit screens, and the finished dock — on all three platforms. Buttons just read "Play", "New puzzle",
"Keep playing". The U loop art stays.

## Z. Daily ⇄ Unlimited toggle must not move the board (founder 10-02: "toggling from daily to unlimited games
on pro mode needs to keep the boards stationary, I don't want them to shift at all, and right now they shift
slightly")

Every game screen with the Daily/Unlimited switch: the board's top edge and size must be pixel-identical in
both modes. Everything above the board lives in fixed-height slots that exist in BOTH modes (header, the
switch, the subtitle/date/rank line — when a mode has nothing for a slot it keeps the slot empty, never
collapses it); the switch's segments are fixed-width (no text-width reflow, no bold-weight jump — use the
same weight and animate only the sliding thumb); the board-sizing measurement must not depend on mode-only
elements; the keyboard/dock below is the same height. Swap content with a quick crossfade inside the
slots. Add a test per platform that measures the board frame (or the computed layout inputs) in both modes
and asserts they are equal.

## AA. Pro identifier (founder 10-02: "there is no Pro identifier anymore, we need to cleverly get that
inputted back somewhere nicely")

New sprite `art-badge-pro-crown-sprite` (gold crown, 256², shipped ×3; web add to ART_SIZE).
AA1. The crowned W: for Pro members, W in the living cast header row (N3) wears the small gold crown,
     tilted ~-8°, sitting on his head; it does a tiny sparkle twinkle every ~8 s, and bounces with W's hop.
     Tapping the crown opens a small "You're Pro 👑" sheet (plan, renewal date, Manage). This is the main
     identifier — every page has the cast header, so Pro is always visible without clutter.
AA2. Avatars: the Pro player's own avatar (Settings/profile/Friends/leaderboard rows, and OTHER Pro players'
     avatars too) gets a thin gold ring + the tiny crown sprite on the top-right corner (≈35% of the avatar).
AA3. Settings + profile: a gold-tinted "WORDOCIOUS PRO" member card at the top of Settings with the
     art-badge-level-pro badge, "Member since <month year>", plan, and Manage subscription (candy).
     Free users see the same slot as a G1 upsell card ("Go Pro" + pro-crown art).
AA4. Pro-only buttons keep the small gold PRO pill only for FREE users (as an upsell); Pro users never see
     PRO pills — they see the crown instead.

## AB–AI. Pre-build finishing list (founder 10-02: "Do everything you can do out of that list that doesn't
require new screenshots")

AB. Accessibility for art titles: every image title/lettering (art-game-*, art-title-*, art-day-*,
    art-moment-*, section titles, headlines) gets a real label = the words it shows ("QuadWord", "Friday's
    Finest", "Victory!") and the heading trait/role (web: alt + role="heading" aria-level on the wrapper;
    iOS: .accessibilityLabel + .isHeader; Android: contentDescription + semantics { heading() }). Purely
    decorative art (poses, scenes, props, wallpaper) is hidden from screen readers. Candy buttons keep their
    text label; icon-only buttons (home, sound, ?, share, crown, back) get labels. Larger Text / font scale up
    to 200%: cards grow, nothing clips or overlaps (lettering images don't scale; their text labels do).
    Add a test per platform that every art title in the registry has a non-empty label.

AC. App size + speed: measure before/after and report.
    - iOS: report the archived app size; re-encode Assets.xcassets PNGs losslessly (zopfli/optimize) and
      quantize large transparent art (poses, scenes, badges, titles) to 256-color palette PNG where it's
      visually identical (PIL quantize with dithering off; keep any image where the diff is visible); make
      sure the widget target bundles only what it uses.
    - Android: report the AAB size; art is WebP — confirm quality 92 → 85 is visually identical for poses/scenes
      and apply if the size win is >15%.
    - Web: preload the current page's title art (link rel=preload / priority on the img) so titles never pop
      in late; lazy-load below-the-fold art; width/height on every <img> (no layout shift).
AD. Dark mode + older phones: (native) audit every new tinted card/popup in dark mode against the web ink
    rules (≥4.5:1 text contrast) and fix; Low Power Mode (iOS ProcessInfo.isLowPowerModeEnabled / Android
    PowerManager.isPowerSaveMode) and Reduce Motion both turn off: light rays, continuous bobbing, the living
    cast header's idle animations, confetti count halves. One-shot springs stay.
AE. Push + reminder copy in the fun cast voice (pure text change; server pushes on web/API routes + native
    local reminders): friend beat you ("{name} just beat your QuadWord time ⚡ Your move!"), your turn
    ("{name} played. Your turn! 🎯"), streak reminder ("Your 🔥 12-day streak misses you! One quick game?"),
    shield used ("A shield saved your streak 🛡️ Phew!"), challenge received ("{name} challenged you to
    {Game} ⚔️"), friend request ("{name} wants to be friends! 🎉"), gift received ("{name} gifted you a week
    of Pro 🎁"), daily ready ("Today's puzzles are fresh 🌅"). Short, American spelling, no em dashes, put the
    bank in packages/core (push-copy.ts + fixture) so native local reminders match.
AF. In-game "?" help popups (every game's rules sheet): the R1 card language — the game's host pose at top,
    the game title art, 3–4 short steps each with a tiny animated example row of real B-kit glossy tiles
    (e.g. a guess flipping purple/gold/grey), candy "Got it" button, `whoosh` on open. Content from the
    existing how-to-play copy (shortened); "Take the tour" link (W).
AG. Desktop web + iPad: wide-screen layout pass. Web ≥ 900px: content column max ~560px centered for game
    screens (boards keep the phone sizing rule, never stretched), Home/Leaderboard/Stats/Friends use a
    two-column grid of the tinted cards up to ~1100px, the wallpaper's wide variant fills the sides, the cast
    header stays at 90% of the column. iPad (iOS) + Android tablets/foldables (width ≥ 600): same column
    max-width idea, popups capped at ~440pt wide, centered; landscape doesn't break the board fit.
AH. Pick-a-character avatars: in Edit Profile, a grid of the 10 cast heroes (plus the player's photo/initials
    option). The chosen character becomes the avatar everywhere (Friends, leaderboard, VS, share profile
    card) on a tinted circle in that character's color. Avatar frames unlock by level tier (bronze/silver/
    gold/platinum/diamond ring, art `art-frame-<tier>` coming tonight — until then a code-drawn ring in the
    tier color) and Pro adds the AA2 gold crown. Stored on profiles (avatar_cast_id text null, avatar_frame
    text null) — web agent: write the migration SQL to docs/sql/ and STOP (the coordinator applies it after
    a backup); the apps must work if the columns don't exist yet (treat as null).
AI. Store review prompt at a happy moment: right after a Flawless, a Daily Sweep, or a 7-day streak milestone
    — never in the first 3 days of play, at most once per 120 days, never after a loss. iOS
    SKStoreReviewController/AppStore.requestReview(in:); Android Play In-App Review API (add
    com.google.android.play:review-ktx); web: none. NO custom "do you like us?" pre-prompt (Apple 5.6.1 and
    Google policy forbid gating/filtering) — just let the celebration finish, then call the system prompt.

## AJ. Footer Home tab always goes Home (founder 10-02: "tapping the home button on the footer always gets you
back to the main page when you're on another menu as a player would expect to happen at any time")

From ANY depth — a game, a footer info page (Guides/FAQ/…), Settings, Edit Profile, a profile, Records,
the VS lobby/ladder/results, a pocket game, Pro page, a sheet or popup — tapping the footer Home tab:
- dismisses any open sheet/popup/modal, pops the whole navigation stack, and lands on Home (root), scrolled to
  the top; tapping Home while already on Home root scrolls to the top (standard re-tap).
- the same applies per tab: tapping the CURRENT tab pops that tab to its root (iOS/Android convention).
- in-progress solo games are already saved — leave without a prompt.
- the ONE exception: a live VS match (where quitting counts as a forfeit) shows a small candy confirm
  "Leave the match? It counts as a forfeit." [Stay] [Leave] — never silently forfeit.
- web: Home tab is a real link to "/" that also closes any open modal/overlay state (no stale overlay on
  return); browser Back still works normally.
- Add a test per platform: navigate 3 levels deep (e.g. Settings → Edit Profile → avatar picker, or a game →
  its help popup) and assert Home tap lands on root with no overlay.

## AK. Home game cards must squish (founder 10-02: "The game buttons on the main menu aren't squishy, they don't
have any animation when pressed right now")

A9 applies to Home first: every Home game card/tile (DAILIES cards, PUZZLES cards, the Word of the Day card,
the VS card + its buttons, the banner, More games, Sweep) gets the shared squish: press → scale 0.95 with a
spring, a slight darken/lip-compress, `press` sound + soft haptic; release → springs back past 1.0 (1.02) to
1.0, `release` sound; then navigates. Must not break scrolling: iOS uses a ButtonStyle reading
`configuration.isPressed` (never a DragGesture/onLongPress that steals the scroll); Android uses the
interactionSource press state (pressSquish) so a scroll cancels silently; web uses pointer events + :active
with touch-action: manipulation. Then sweep the rest of the app for any tappable without the squish
(leaderboard/stats picker tiles, Friends rows, Records rows, footer page cards, Settings rows, badges,
header icons, the cast-header crown) and add it. Add a small test/registry check where feasible (e.g. the
shared card components route through the squish modifier/style).

## AL. Widgets must show progress, points and time left (founder 10-02: "make sure the revamped widgets populate
the amount of puzzles completed, total points, amount of time left in the day. The most recent smaller version
dropped all of that information aside from the amount of time left until new puzzles")

Both widget sizes on iOS (WordociousWidget) and Android (DailyWidgetProvider + widget_daily[_small].xml) must
ALWAYS show these three, in the new look (soft numbers, tinted pills, no white):
1. Puzzles completed today: "5/8 today" (all dailies incl. Puzzles group as the app counts them; the medium
   may split "Dailies 5/8 · Puzzles 2/9").
2. Total points today: the day's point total in soft numbers with the gold star glyph ("⭐ 3,420"); 0 before
   the first game, never hidden.
3. Time left until new puzzles: a live countdown to local midnight (iOS Text(timerInterval:countsDown:);
   Android Chronometer countdown) — "New puzzles in 7:42:10".
Plus the streak flame (already there). Small layout (2×2): top row streak flame + day host; middle the tile
mini-grid (may shrink to one row of dots if needed to fit); bottom two lines: "5/8 · ⭐ 3,420" and the
countdown. Medium keeps the cast row + tiles and adds the same three in a stat row.
DATA: the app must write `played/total`, `points today` and the day into the shared widget snapshot (iOS App
Group defaults; Android WidgetBridge) after every finished game, on app launch/foreground, and after sync;
then reload (WidgetCenter.reloadAllTimelines / AppWidgetManager update). Points must be the same number the
app shows for today (sum of today's daily scores). At local midnight the timeline/alarm resets to 0/N, ⭐ 0,
fresh countdown — never shows yesterday's numbers. Add a unit test for the snapshot math (today's points sum,
played/total, midnight rollover). Also fill the rank slot if the app has today's rank (else hide it cleanly).
AL addendum (founder 10-02: "don't just show them as numbers, they should clearly highlight what they
represent"): every widget number is a labeled stat — a small tinted pill/chip with an icon AND a word:
  [icon3d-flame] 12 DAY STREAK · [grid/check glyph] 5/8 SOLVED · [gold star] 3,420 POINTS ·
  [clock glyph] NEW PUZZLES IN 7:42:10.
Small widget: two stacked chips at the bottom ("5/8 SOLVED" + "3,420 PTS") and a full-width countdown chip
"NEW IN 7:42:10"; the label text is small caps (9–10pt, letter-spaced) under or beside the soft number so a
glance reads what each number means. Medium: a row of four labeled chips. VoiceOver/TalkBack read full
phrases ("5 of 8 puzzles solved today", "3,420 points today", "new puzzles in 7 hours 42 minutes").
AL addendum 2 (founder 10-02: "I don't want any of those phone emojis … match the aesthetic"): NO system emoji
in any widget or in-app UI. Widget chip icons are our 3D art: streak = icon3d-flame, solved = icon3d-badge-check,
points = `art-badge-icon-star-sprite` (new gold star, shipped ×3), countdown = `art-badge-icon-clock-sprite`
(3D clock, coming tonight via ChatGPT — until then a code-drawn soft gold clock face, no emoji). Also new:
`art-badge-icon-zap-sprite` (gold bolt) for speed/time stats. The widget target must bundle these.
Sweep the apps for emoji used as UI icons (stat chips, popups, R1 chips, toasts, badges, notices) and swap in
the 3D art; emoji stay ONLY in plain-text channels that can't show images (share captions text, push
notification text).

## AM. No phone emoji anywhere in the app (founder 10-02: "No phone emojis anywhere on the app … the friends page
… different reactions under moments. I'd like that to be polished, and all new emojis made using our style")

AM1. Reactions (Friends moments / feed / VS results; web api/friends/react REACTIONS = clap, fire, wow, grr,
     rematch): keep the stored KEYS unchanged (no data migration); render each as our 3D art
     `art-react-clap|fire|wow|grr|rematch|heart` (coming tonight via ChatGPT, glossy candy style; until the
     files exist, fall back to the existing 3D icons: fire → icon3d-flame, others → a tinted pill with the
     word "Clap!", "Wow!", "Grr!", "Rematch" — never the emoji). Reaction bar = a tinted candy tray with the
     icons as squishy buttons (AK), your chosen one pops + `press` sound + light haptic, counts in soft
     numbers beside each, a little burst animation when you react. Push text may keep an emoji (plain text).
AM2. Emoji avatars (profiles.avatar_emoji): retire the emoji option from the avatar picker — the AH cast
     characters + photo + letter tile replace it. Existing emoji avatars render as the player's letter tile
     in their accent color (never the emoji), and they get a one-time gentle nudge in Edit Profile:
     "Pick your character!". No DB change.
AM3. Any remaining emoji in UI strings (labels, chips, toasts, empty states, buttons, headlines, the R1 chips
     "🔥 Day N" etc.) → our 3D art or plain words. Allowed only in plain-text channels: share captions, push
     notification text, invite message text. Add a test per platform that scans UI source/strings for emoji
     outside an allowlist of those files.

## AN. Build-your-own-mascot avatar maker (founder 10-02: "selecting a body type/shape, color/pattern options, and
different eyes nose and mouth options … accessories … build your own version of these mascots. Then those mascots
will populate the initial parts on leaderboards flawlessly"; custom photos should be "a square, as well, possibly
with a border … similar to the border selectable in our new avatar maker")

AN1. The avatar is a LAYERED mascot in the cast's glossy 3D style, with the player's own INITIAL as the white
     body letter (like the cast's W/O/R…), rendered in code (Nunito black, white, soft emboss + shadow so it
     reads like the cast letters). Layers back→front: frame back, cape-type accessory (behind), body (tinted),
     pattern (clipped to the body), body letter, cheeks/nose, eyes, mouth, face accessory (glasses, mustache),
     head accessory (hats), front frame.
AN2. Parts (art coming tonight via ChatGPT, transparent, one shared manifest of anchors):
     - body shapes (6): classic rounded square, tall narrow, wide squat, round blob, bean, soft star — each a
       neutral white/light-grey glossy body with stubby arms + feet and NO face/letter, so code can TINT it.
     - colors (12 code swatches from the cast palette + 4 extras) applied by multiply onto the white body so
       the gloss/shading survive; patterns (code-drawn, clipped to the body alpha, multiplied): solid, two-tone
       (top/bottom), stripes, polka dots, gradient, sparkle speckles.
     - eyes (9): beady (cast default), happy arcs, big sparkly, sleepy, wink, hearts, stars, round glasses,
       one big cyclops eye.
     - mouths (9): smile, big grin, tongue out, little o, cat :3, toothy grin, smirk, tiny smile, gasp.
     - nose/cheeks (5): none, button nose, round red nose, blush cheeks, freckles.
     - accessories (up to 1 head + 1 face + 1 neck/back): crown (Pro only), cape, nightcap, sweatband, sprout,
       heart sunglasses, beanie, bow, headphones, wizard hat, party hat, pirate hat, mustache, bow tie, flower,
       cowboy hat, chef hat, graduation cap, halo.
     - Presets: the 10 cast members as one-tap starting points ("Start from W" …) → AH's character pick lives
       here now.
     Art names: art-av-body-<shape>, art-av-eyes-<id>, art-av-mouth-<id>, art-av-nose-<id>, art-av-acc-<id>.
     Manifest `packages/core/src/avatar-parts.json` (written by the coordinator after the art lands): per body
     shape the anchors {faceCenter, eyeY, mouthY, cheekY, headTop{x,y,w}, neckY, letterBox} in 0–1 body
     coords; per part its anchor slot + scale. Until tonight, build against a placeholder manifest + simple
     code-drawn placeholder parts so the engine and UI are done when the art drops in.
AN3. Data: `profiles.avatar_config jsonb null` = {v:1, body, color, pattern, patternColor, eyes, nose, mouth,
     head, face, neck, frame}. packages/core `avatar-config.ts`: schema/validate (unknown ids → defaults),
     `defaultAvatar(userId, accent)` = a deterministic friendly default (seeded body/eyes/mouth, the player's
     accent color, no accessory) so EVERY player without a photo shows a mascot with their initial — this
     replaces the plain letter tiles on leaderboards, Friends, VS, Records, profiles, share cards. Fixture for
     parity. Web agent writes the migration SQL to docs/sql/ (with AH's columns) and STOPS; the coordinator
     applies it after a backup. Apps must work while the column is missing (fall back to the default).
     APIs (/api/friends, leaderboard, VS, profile) return avatar_config (null-safe).
AN4. The builder (Edit Profile → "Make your mascot"): a big live preview on a tinted stage (the mascot hops on
     every change, `hop` sound), category tabs as candy chips (Body · Color · Pattern · Eyes · Nose · Mouth ·
     Hats · Extras · Frame), each a grid of squishy option tiles showing that part on the current mascot,
     Randomize (dice candy button, playful), Save (candy). Pro-only items (crown, diamond frame) show the
     gold PRO pill for free users → G1 popup. Accessible: every option labeled.
AN5. Rendering everywhere: one shared renderer per platform (web: layered <img>/canvas component; iOS ZStack;
     Android Box) at any size 16–200pt; small sizes (≤ 28pt) drop the pattern + accessories except hats for
     legibility; cache composed bitmaps per config+size. Leaderboard rows/podiums/Friends/VS/Records/profile/
     share images/widget (if it shows the player) all use it.
AN6. Photo avatars become SQUARE: rounded square (radius ≈ 22%), never a circle, with the player's selected
     frame (same frame options as the builder: none, bronze/silver/gold/platinum/diamond by tier, Pro gold
     with crown) — e.g. johnnyauer's photo. Frames are rounded-SQUARE (not rings), matching the mascot tile
     shape. AH/AA2 "gold ring" become this rounded-square frame language.

## AO. First-run welcome + guided profile setup (supersedes W) (founder 10-02: "something that matches the
aesthetic that clearly welcomes and guides you to the app on the first go after downloading … a quick overview
of everything and also guide to the first steps of creating a profile"; "the avatar maker feature walked through
for a new user")

Shown once, to a brand-new install/account (flag `onboarded-v2`; existing players never see it; How to Play →
"Take the tour" replays steps 1–2). Every screen: wallpaper, lettering-style headline, cast art, candy buttons,
squish, `whoosh` between steps, page dots, Skip (top-right) on 2–4, Reduce Motion = crossfades.
1. WELCOME (after the cold-start intro lands): the whole cast waving (`art-scene-welcome-cast`, tonight),
   "WELCOME TO WORDOCIOUS!", one line "Daily word games, a cast of friends, and bragging rights.",
   candy "Let's go!" + text link "I already have an account" (→ sign in, then straight to Home).
2. QUICK TOUR — 4 swipe cards, one sentence each:
   a. Daily games — art-scene-onboard-tiles (W + tiles): "New puzzles every day. Guess the word, solve the board."
   b. Score + leaderboards — art-scene-onboard-score (D): "Fewer guesses and faster times earn more points."
   c. Streaks + shields — art-scene-shield-guard (U): "Play daily to grow your streak. Shields save it."
   d. Friends + VS — art-scene-friends-match (I + pink O): "Race friends, react, and battle the cast."
3. MAKE YOUR PROFILE (account): sign up (existing auth screens, restyled per G5) → pick a USERNAME (candy
   field, live availability check with a green check / "taken" shake, suggestions as chips) → "Play as guest"
   stays available on step 1 of this (guests skip 3–4 and get the default mascot).
4. MAKE YOUR MASCOT (AN builder in onboarding mode): starts from the player's DEFAULT mascot with their
   initial; a coach character (W, small pose in a speech-bubble card, 3 short tips, tap to advance):
   "This is you! Your initial is on your belly." → points at the tabs "Change your body, colors, face and hats
   here." → points at Surprise me "Stuck? Let me pick!" → points at Save "Love it? Save it!". Spotlight dims
   everything except the pointed control. "Do it later" link keeps the default.
5. ALL SET: the player's new mascot hops into the cast row next to W (`hop` sound, confetti),
   "YOU'RE IN!", "Meet the gang. Your first puzzle is ready." → candy "Play today's Classic" (opens the daily)
   + "Explore first" (Home). Then the first-game coach (existing W tips) continues.
Fresh art tonight via ChatGPT: art-scene-welcome-cast (all ten waving, wide), art-scene-all-set (cast cheering
with an empty spot in the row, wide). Until they land use the cast row + existing scenes.

AN addendum (founder 10-02: "Add more hat and accessory options to the builder, as well as different background
color options"; mockup https://claude.ai/artifact/FJVwK3UNHJM4p5cvZCamM7):
- HATS (21): crown★, party, beanie, sprout, nightcap, headphones, bow, wizard, pirate, cowboy, chef, grad cap,
  halo★, flower, top hat, propeller, cat ears, bunny ears, tiara★, viking, sweatband.
- EXTRAS (8): cape, wings★, mustache, heart shades, monocle, bow tie, scarf, gold chain★.
- NEW TAB "Backdrop" — the tile background behind the mascot (shown everywhere the avatar shows): tints lilac,
  bubblegum, sky, mint, lemon, peach, cloud, night; gradients sunset, ocean, cotton candy, aurora★; patterns
  galaxy★ (stars on purple), polka, starry (gold stars on navy), sunburst (rays), checkers, confetti.
  ★ = Pro only (gold PRO pill → G1 popup for free users). avatar_config gains `bg` (default: a light tint of
  the body color). Web: add AVATAR_HEADS/FACES/NECKS entries + AVATAR_BACKDROPS (id, kind solid|gradient|
  pattern, colors) to avatar-config.ts with the fixture; natives port; renderers draw the backdrop.

## AP. Welcome to Pro (first purchase) (founder 10-02: "a thanks for joining pro and a rundown of the benefits
they have now … a custom screen when someone joins the pro version for the first time")

Shown ONCE, right after the FIRST successful Pro purchase (or a gifted week's first activation — headline
"YOUR FREE WEEK OF PRO!" then), full screen, never again (flag `pro-welcomed`; restores don't trigger it):
- gold sunburst rays slowly turning + falling gold/cast-color confetti (calm motion: static rays, one burst),
  `celebrate` sound + success haptic.
- `art-scene-pro-crown` (W with the crown) springs in; lettering-style "WELCOME TO PRO!" in gold; "Thanks for
  joining, <name>! Here's everything you just unlocked."
- 8 benefit cards (2-col grid, each a tinted card with a top bar, 3D art, short title + one line, popping in
  70 ms apart): Play unlimited (unlimited-loop) · No ads, ever (badge-check) · VS everything (swords) ·
  Battle the cast (ladder-cleared) · 4 shields a cycle (shield-guard) · Gift Pro (gift-pro) · The Pro look
  (level-pro badge: crown on W, gold frames, Pro hats/backdrops) · Deeper stats (trending-up).
- chip "Your 4 streak shields are ready" (shield art) — only if shields were credited.
- gold candy "LET'S PLAY!" → back to where they were (or the Unlimited game they reached for, R3) and the
  crown then drops onto W in the cast header (AA1) with a sparkle; text link "Gift a friend a free week" → T4.
- Also: update the Pro page / G1 benefit copy to the cast bots ("Battle all ten of the cast" — not
  "Easy, Medium & Hard bots").

## AQ. Speed + smoothness pass (founder 10-02 on iOS 235: "feels a little slow when playing through a puzzle,
especially when I am trying to go through it fast. The keyboard tiles take a bit to populate the color … it seemed
to lag a little at parts when going through the menus and scrolling … on the load in screen after closing the app
and reopening it, the little guy looks duplicative")

AQ1. Fast play (every word game + puzzle input):
  - Keyboard key colors update AS EACH TILE FLIPS (the key for tile i takes its color when tile i lands), not
    after the whole row's reveal; never slower than the row.
  - Input is never blocked by animation: typing during a reveal buffers into the next row (and Enter/Delete work);
    the reveal can't drop keystrokes. The not-a-word reject also doesn't block typing.
  - Tighten timings ~30%: flip per tile ≤ 220 ms, stagger ≤ 70 ms (multi-board reveals in parallel, not
    sequential), win hop shorter; the finish hold before the popup ≤ 1.2 s (was ~2.4 s); popup springs in
    faster. Reduce Motion: instant colors.
AQ2. Menus + scrolling smoothness (iOS + Android especially; web too):
  - Downsample art to its display size (never decode 900–1200 px scenes/poses for a 40 pt thumbnail; use
    thumbnail/downsampled images or pre-sized assets; cache).
  - Pause continuous animations (rays, bobbing, living cast header idles, shimmer, confetti) when off-screen or
    while a list is scrolling; no per-frame state changes in scrolling cells.
  - Avoid expensive per-cell effects in lists (blur, many shadows, large gradients); rasterize static decorated
    cards (iOS .drawingGroup / compositingGroup where it helps; Android graphicsLayer); lazy lists everywhere long.
  - Mascot avatars: use the cached composed bitmap at row size; never re-compose while scrolling.
  - Measure before/after where possible (iOS: Instruments Time Profiler / os_signpost in the simulator;
    Android: a Macrobenchmark or at least FrameMetrics/JankStats logging in debug) and report the hotspots fixed.
AQ3. Launch → intro must be ONE continuous image, never two W's:
  - iOS: the system launch screen (project.yml UILaunchScreen: LaunchBackground + launch-w) and the first frame
    of ColdStartIntro must match pixel-for-pixel (same W image, same size, same center), then the intro animates
    from there — or drop UIImageName so the launch screen is just the background color and the intro owns the W.
    Pick whichever gives a seamless start. Warm resumes (app returning from background) never replay the intro.
  - Android: Android 12+ shows the launcher icon on the system splash by default → set the SplashScreen theme
    (core-splashscreen) icon to a transparent/blank drawable (or the exact first intro frame) and keep the splash
    background = the intro background, so there's no icon-then-W double. Same warm-resume rule.

## AR. Live lettering for the rotating personalized headlines (founder 10-02: "I love the custom rotating
personalized headlines … what can we do to style them to the new aesthetic so they're not plain text?" — screenshots:
Home banner "WARMING UP · 3 DOWN" (flat lilac text) and Friends "OLIVER LEADS TODAY'S RACE" (flat dark text))

One shared `LiveHeadline` component per platform that renders ANY dynamic headline in the title-art lettering
style, drawn in code (these change all day, so they can't be pre-made art):
- Font: Nunito Black (already bundled on all three), all caps, tight tracking.
- Fill: vertical gradient per palette; a thin gold outline (2–3 px stroke drawn behind the fill); a darker
  3D extrusion underneath (3–4 stacked 1 px offsets down in the palette's deep shade); a soft white gloss on the
  top ~40% of each glyph (gradient overlay masked to the text); a soft drop shadow.
- Token styling (split the headline into tokens in code): NUMBERS ("3", "6,976", "#2") render as gold soft
  numbers with a slightly bigger size; the player's/friend's NAME gets the palette's accent gradient; the "·"
  separator becomes a tiny gold star sprite (art-badge-icon-star-sprite); the rest is the main lettering.
- Palettes: Home banner = purple→magenta (gold numbers); Friends race = pink→orange; Leaderboard = gold→amber;
  VS = teal→blue; Stats = blue→violet; celebrations (DOUBLE SWEEP!, FLAWLESS) = gold with sparkle.
- Motion: when the headline text changes (and on first show), letters pop in left→right (scale 0.6→1.08→1,
  25 ms stagger) with a tiny `tick`; idle = a slow gloss sweep every ~6 s. Reduce Motion / calm: no pop, no sweep.
- Layout: max 2 lines, balanced; auto-shrink to fit before wrapping; never clips the host art (the W on the Home
  banner, the O1 on the Friends card). Accessibility: plain-text label + header trait.
- Apply to: the Home banner headline (bannerHeadline), the Friends race headline + its sub-lines' names/numbers,
  Leaderboard / Records dynamic headlines (e.g. "YOU'RE #3 TODAY"), VS lobby status headline, Stats summary
  headlines, Gauntlet "STAGE 3 OF 5", finished-screen result strip headline. NOT the widget (keep its chips).

## AS. Founder notes on iOS 235 (10-02 evening) — do with AQ/AR, then the App Store build
AS1. The menu sheet opened by the "?" button next to Settings shows "MENU" in plain text beside a mascot → give
     it a lettering title like Settings has: art-title-menu (tonight via ChatGPT, same style as the page titles);
     until it lands, render "MENU" with LiveHeadline (AR) — never plain text.
AS2. Header order: move the controls row (streak flame + shield + ? + settings) ABOVE the WORDOCIOUS cast row
     (controls on top, the cast wordmark below them) on every page that has the header.
AS3. Home can't scroll to the very bottom — the footer tab bar covers the last content. Add bottom content inset =
     tab bar height + safe-area bottom (+ 16) on Home and every tab page/scroll view.
AS4. Leaderboard: the important info is halfway down. Reorder top→bottom: headline, the picker, YOUR result/rank
     card, the standings (podium + rows), then the rest. Compress the "classic view / play board" card and the
     "your rank" button into one compact row (smaller art, one line of text, small candy buttons).
AS5. Friends moments / activity feed: remove the "View" button from every moment row (rows get shorter); tapping
     the row (or the avatar) opens the player profile as before.
AS6. The streak flame + shield popups are broken: tapping only shades the top header strip and nothing shows
     (the popup is presented inside the header's clipped container). Present them from the app root as a
     full-screen overlay (iOS: from the root view / fullScreenCover-level overlay; Android: a Dialog/Popup at the
     window level; web: portal to body) so the scrim covers the whole screen and the G2 popup appears.
AS7. Remove the two small streak flames on the Home banner rows (the "48" on WORDOCIOUS and "9" on PUZZLES).
     Put ALL streak info, cleanly laid out, in the streak-flame popup: daily streak (current + best), Wordocious
     sweep streak, Puzzles sweep streak, flawless streaks, shields (count + how they work), and the week strip —
     labeled chips with our 3D icons, soft numbers, no emoji.

## AT. Founder notes on 236 (10-02 night) — before the App Store submission
AT1. Every finished-game screen looks off-center because of the share button: the share icon sits in the same row
     as the title/result strip and pushes the centered content sideways. Center the title + strip relative to the
     SCREEN: put the share button in an overlay pinned to the trailing edge (or balance it with an equal-width
     invisible spacer on the leading side) so nothing shifts. All games, Gauntlet, puzzles, the another-device view.
AT2. Deliverance LOSS: the boards on the completed screen were different sizes. Multi-board recaps (QuadWord,
     OctoWord, Deliverance, Succession; win AND loss) must draw every board at ONE shared tile size and the same
     board height: compute the tile size from the largest board (max rows × cols) and pad shorter boards with empty
     rows so all boards match; unsolved/lost boards never render bigger or smaller than solved ones. Add a test.

## AU. Founder notes on 236, batch 2 (10-02 night) — then the App Store build
AU1. Win/lose popups (R1) must be centered VERTICALLY as well as horizontally on the screen (the VICTORY card sits
     high, top-anchored). Center the card in the safe area; if it's taller than the space, it scrolls inside.
AU2. Leaderboard: tapping into it should cleanly show the PODIUM without scrolling (on a 390×844 phone the podium's
     top must be visible above the tab bar on arrival). Compact the top: the day title ≤ ~110 pt tall; the game picker
     as ONE horizontally scrolling row of smaller tiles (Wordocious + a divider + Puzzles) instead of two rows in a
     card; the rank card collapses to ONE compact row — "#2 of 5 · 2,005 PTS · 4/6 · 48s" + the completed check —
     with no duplicate headline/"OF 5 TODAY" repeats (keep the LiveHeadline only if it fits in that row); then
     "Today's board" (Everyone|Friends) + podium immediately. The play/view-board row and Yesterday's winners stay
     below the standings.
AU3. Gauntlet stage transitions: fluid (one smooth crossfade/slide + spring-in of the pose; no flash/jump between
     the board and the card), and the stage card stays up AT LEAST 5 s (auto-advance at 5 s), while a tap anywhere
     / Continue / Enter still skips immediately.
AU4. Tile flips look choppy: make the flip GPU-only — iOS rotation3DEffect with perspective on a fixed-size tile,
     no layout changes mid-flip, colors precomputed; Android graphicsLayer { rotationX; cameraDistance } with no
     recomposition of the whole board per tile; web transform rotateX + backface-visibility + will-change, no
     layout-affecting properties. Sound/haptics off the main-thread hot path (pre-warmed). Target a steady 60/120 fps.
AU5. Cold-boot intro is "VERY choppy" since the launch change: preload/decode every intro image BEFORE the first
     intro frame (keep the plain launch color up until ready, max ~300 ms), and defer heavy startup work (network,
     caches, mascot composition, widget refresh, art prefetch) until the intro has landed. Animate only transforms/
     opacity. Must be smooth on the first frame.
AU6. (art, tonight's ChatGPT session — not this build) A Gauntlet header graphic: "GAUNTLET" lettering in our style
     built around a five-stage path (5 medallion slots / steps) that the app lights up as stages are cleared, for the
     Gauntlet page + stage screens.

## AV. Small widget refresh (founder 10-02 with a home-screen screenshot: "I don't like the borders it looks too
stale, and could use more mascots") — iOS + Android, small AND medium for consistency
- NO outlined chips/borders: drop every stroke/outline box. Stats float on the widget's soft wallpaper on borderless
  soft tint blobs at most (≤10% fill, no edge line), or no fill at all — the 3D icon + soft number + small-caps
  label carry it. Keep the labels (DAY STREAK · SOLVED · PTS · NEW IN).
- MORE MASCOTS: the day host bigger (~40% of the widget height) leaning in from the top-right corner, overlapping
  the edge a little; plus 2–3 small cast heads PEEKING up from the bottom edge (only the top half of each visible,
  like over a ledge), a different trio per day (rotate through the cast by date, never the day host twice);
  Halloween skins when the season is on.
- Layout (small): top-left "🔥 82 DAY STREAK" as a big soft number with the flame art (no box); the tiles row
  stays; then "✓ 7/18 SOLVED  ★ 10,779 PTS" on one line with a soft divider dot; then the countdown "🕐 5:41:43
  NEW IN" (art icons, never emoji) with the peeking cast along the bottom edge behind it.
- Medium: same rules — no boxes, the cast row stays, peeking cast at the bottom, stats as one clean row.
- Keep everything legible in light + dark (StandBy/tinted modes: icons/text keep contrast); TalkBack/VoiceOver
  phrases unchanged.

## AW. Footer returns instantly after closing a game (founder 10-02: "when loading muddle open then closed, the
footer takes a second to repopulate at the bottom")
The tab bar must be back the instant a game (Muddle and every other full-screen game/page) is dismissed: show it as
part of the dismissal (animate it in alongside the closing transition, or keep it mounted under the game and just
reveal it) — never after an onDisappear / completion delay / data reload. No layout jump when it returns. Check all
games, not just Muddle.

## AX. Bigger game-page header buttons (founder 10-02: "make the home, volume and question mark buttons on each game
page a little bigger … they're really tiny")
On every game page header, the home, sound and "?" 3D icons go from ~23 pt to ~30 pt visual size, each with a
≥ 44 pt tap target (they keep the squish). Re-check the header so the title art still fits (the icons sit on the
same row as before; nothing overlaps on a 375-pt-wide phone). Same on web (≈ 30 px icons, 44 px targets).

## AY. Top-left Home button must ALWAYS land on Home (founder 10-02: "sometimes I feel like the new home buttons
open another game and I need to hit home again")
Investigate and fix both likely causes, on every screen that has the top-left home button (games, puzzles, info
pages, VS, Gauntlet, finished screens):
1. Back-stack: Home must pop to the Home ROOT (same router as AJ), never just one level back — a game opened from
   another game ("Next daily", Unlimited "New puzzle", a deep link, Gauntlet → results) must not reveal the previous
   game. Dismiss any sheet/popup too.
2. Tap-through: the home tap must not "fall through" onto the Home card that ends up under the finger as the game
   dismisses (the squish fires on touch-up). After navigating Home, ignore taps on Home cards for ~400 ms, and make
   the home action single-fire (debounce double taps).
Add a test: open game A → Next daily to game B → tap home → assert Home root with no game presented.

## AZ. Motion fluidity pass (founder 10-02: "a quick little pass for the motion fluidity in the popups too,
completed game screens, transitions … make it run as smooth as possible")
Quick audit + fixes, no redesign: popups (win/lose R1, streak/shield, achievement, Go Pro, Welcome to Pro, help),
finished screens, page/tab transitions, sheets, Gauntlet stage cards, onboarding steps.
- Animate only transform + opacity (never width/height/padding/frame/blur radius/shadow radius mid-animation).
- One consistent spring family (e.g. response ~0.38, damping ~0.82) for every spring-in/out; matching exit
  animations (no instant pops out); no stacked/competing animations on the same view.
- Prepare heavy content BEFORE the animation starts (decode images, compose mascots, measure layout), so frame 1 is
  ready; defer data loads/haptics/sounds off the first frames of a transition.
- Rasterize decorated static layers that animate as a whole (iOS drawingGroup/compositingGroup, Android
  graphicsLayer, web will-change/contain) and drop live blurs under moving popups (use a pre-blurred/static scrim).
- Confetti/rays: cap particle counts, run on the render thread / Canvas, stop when off screen.
Report the specific janky spots found and what changed.

## BA. Founder decisions on the one-screen audit (10-02 night)
BA1. Short screens (height < 700 pt/dp, e.g. iPhone SE / 360×640): the "Keep playing: Unlimited" card collapses to
     ONE small candy button in the action row (U loop art mini icon + "Unlimited", peach, the same candy style — must
     look clean and on-aesthetic, not a cut-down card), and the game title art caps at ~56 pt tall. Boards get the
     freed height (QuadWord ≈ 15 pt tiles, OctoWord ≈ 10 pt). Tall screens unchanged.
BA2. Gauntlet results fit one screen: hero card + stars + stat pills + buttons; the score breakdown and stage
     breakdown move behind the "More" chip like the other games.

## BB. Stats + Leaderboard picker polish (founder 10-02 on 237, screenshots of the Stats picker)
BB1. Stats: the selected game's name ("CLASSIC", tiny plain caps) must be prominent: show that game's own title art
     (art-game-<mode>, the game's lettering title with its host) ~44–52 pt tall as the card's header (centered),
     falling back to LiveHeadline in the game's accent when there's no title art (Sweep, puzzles without art).
     It swaps with a quick pop when another game is picked.
BB2. Stats Today | All-time toggle: a real candy segmented control — tinted track, a filled sliding thumb in the
     game's accent (white bold label on it), the other label clearly legible (≥ 4.5:1), 36–40 pt tall, squish — not
     two floating words.
BB3. Leaderboard picker: use the SAME two-row grid as Stats (WORDOCIOUS row incl. Sweep, then PUZZLES row, every
     game visible, no sideways scroll) instead of the one long scrolling row — at a compact tile size (~30–32 pt) so
     the podium is STILL visible on arrival at 390×844 (take the room from the day title, ≤ 90 pt, and tighter gaps).
BB4. Remove the ALL-TIME button from the Leaderboard (all-time lives only in Stats, as planned).

## BC. Small widget fill (founder 10-02 on 237: "fill out the widget better so the games cover more of that empty
space"; screenshot: one thin row of tiny game tiles + dots with a big empty band, "10,7… PTS" truncated, the peeking
cast squeezed into the bottom-right corner)
- Game tiles take the empty middle: TWO rows of four big tiles (the 8 Wordocious dailies, ~30–34 pt each, edge to
  edge with small gaps), each with its check / ✕ / unplayed state; the Puzzles row stays as the thin colored dot
  strip under them (or drop it on the small size if space is tight — tiles first).
- Numbers never truncate: auto-shrink the stat line to fit ("7/18 SOLVED · 10,779 PTS"), shorten labels before
  numbers, use compact thousands (10.8K) only as a last resort.
- The peeking cast sits along the bottom edge evenly across the width, behind/below the countdown line, never
  overlapping text; the day host stays top-right.
- Medium: same tile rule (one row of 8 at a bigger size) — no empty bands.
BC addendum — MEDIUM widget (founder screenshot: tile rows fill only the left ~2/3, empty block on the right and a
gap above the stats, peeking cast crammed bottom-right): both game rows span the FULL width evenly (Wordocious 8
tiles across, Puzzles 10 tiles across, sized up to fill — tiles grow until the width is used), vertical space
distributed so there's no empty band between the rows and the stat chips; the medium already has the full cast row
at the top, so DROP the peeking cast on medium (keep it on small only).

## BD. A unique badge for every achievement (founder 10-02: "Add cool images to match what achievements you get, we
repeat a lot of the same ones right now")
All 73 achievements (list: docs/design/brand/badges/achievements.txt, key|name|description) get their OWN badge art
`art-ach-<key>` in the existing shield-badge style (glossy candy, purple shield rim) with a symbol that tells that
achievement's story (e.g. first_win a tiny trophy + first-place ribbon, streak_30 a calendar with a flame, octo_boss
eight mini boards, quad_king four boards wearing a crown, speed_demon a stopwatch with a lightning tail, rescue_hero
a shield carrying a letter tile, close_call a nervous tile on the last row…). Made in tonight's ChatGPT session
(3x3 sheets). Apps: render art-ach-<key> when it exists, else fall back to the current icon badge — no layout change.

## BE. New achievements for the new games (founder 10-02: "think about new achievements we can add and add additional
photos to correspond with all the new games even the pocket games")
38 new achievements in docs/design/brand/badges/achievements-new.txt (key|name|description): every Puzzle (Muddle,
Hubbub, Kindred, Letter Ladder, Codebreaker, Spyglass, Starsweep + Puzzle Sweep/Week/Grand Sweep), the bot ladder +
cast (Rip, five rungs, Webster, all ten, Bot of the Day), friends (first friend, 10 friends, race win, friend streak,
reactions), all six pocket games (+ Pocket Pro), the mascot maker, Halloween week, Early Bird / Night Owl.
- Web (owns the server): add them to achievement-service.ts definitions with categories + the award checks where
  the data already exists (puzzle results, VS/bot results, friends, reactions, friendly/pocket game results, avatar
  saves, finish timestamps); check whether user_achievements.achievement_key has a CHECK/enum (if a migration is
  needed, write it to docs/sql/ and STOP — the coordinator applies it after a backup). Any achievement whose
  trigger data isn't recorded yet: define it but mark it `hidden: true` (not shown until its tracking ships) and
  list it in the report.
- iOS + Android: mirror the definitions (or read them from the API/catalog if that's how they work today), show them in
  the grid + unlock popup, and award client-side only where the platforms already award today.
- Art: each gets its own art-ach-<key> badge (tonight's ChatGPT session, with BD); fallback to the category icon.

## BF. Achievement unlocked — players must SEE it (founder 10-02: "a celebratory popup with mascots, highlighting an
achievement received and purpose for it. Right now, I never know when I get achievements")
Likely root cause: achievements are awarded server-side after a result is saved, but the clients never learn which
ones are NEW, so the V2 popup never fires. Fix detection first, then the popup:
BF1. Detection (all three): the result-submit / daily-completion / VS-result / friendly-game endpoints return
     `newAchievements: [{key, name, description, category, xp?}]` for keys inserted by THIS request (web server owns
     this; null-safe for old clients). Clients ALSO diff on app open / foreground: fetch the user's achievements,
     compare with a locally stored "seen" set, and queue any unseen unlocks (so server-side awards from crons or
     other devices still celebrate once). First launch after this update: mark everything already earned as seen
     (no flood of old popups).
BF2. The popup (one shared component per platform, R1 card language): a celebratory full-screen moment —
     rays + confetti + `unlock` sound + success haptic; a mascot pair holding up the badge (new art
     `art-scene-achievement` tonight: two cast members presenting an empty glowing frame/pedestal where the badge
     art is composited; until it lands, the related game's host pose beside the badge); the achievement's own badge
     big (art-ach-<key>, fallback category icon) springing in; lettering "ACHIEVEMENT UNLOCKED!" (LiveHeadline gold);
     the NAME in big soft-number ink; the PURPOSE line = its description ("Solve all ten Puzzles in one day"); XP
     reward chip if any; "3 of 111 unlocked" progress; candy buttons "Awesome!" (dismiss) + "See all" (→ Stats
     achievements) + share icon (image share of the badge card, S-style). Several unlocked at once → queue them
     one after another (with a "2 more" chip), never stacked. Shown AFTER the win popup closes (never on top of it),
     and not during a live VS match. Reduce Motion: no rays/confetti.
BF3. Tests: unseen-diff logic (new key → queued once; already-seen → no popup; first-launch seeding), queue order.

## BG. Stats: Today | All-time and the game picker work TOGETHER (founder 10-02: "the today and all time toggle is very
confusing on what it populates below … selecting all time from the individual puzzle screen should immediately load
the all time records for that same game … the stats don't reflect what I'm toggling")
Two independent selections, always both visible:
- SCOPE: Today | All-time (the BB2 candy toggle) — ALWAYS shows its selected half; never hidden or cleared when a game
  is picked.
- GAME: none (= Overview) or one game from the picker. Tapping the selected game again returns to Overview.
Content = scope × game:
- Today + Overview: today's summary — dailies solved N/18, points today, today's rank(s), the Sweep/Flawless status,
  today's results list (tap a row → that game, keeping Today).
- Today + Game: THAT game today — its board/result, guesses, time, points, today's rank; "Not played yet — Play" if
  unplayed.
- All-time + Overview: the all-time profile — totals, win %, streaks, records, achievements, level.
- All-time + Game: THAT game's all-time stats — played, win %, guess distribution, best/avg time, best score, records,
  streaks for that game.
Switching the toggle KEEPS the picked game (Today/QuadWord → All-time/QuadWord immediately). Picking a game KEEPS the
scope. Open default: Today + Overview. The header always says what's shown: the game's title art (or "OVERVIEW"
lettering) + a small "TODAY" / "ALL-TIME" chip under it. Content swaps with a quick crossfade (no jump; the Stats
swipe still changes the GAME only, within the current scope). Put the scope×game resolution in a small pure function
with tests (each of the 4 cells, toggle keeps game, pick keeps scope, re-tap clears game). Also audit the Stats page for
any other stale/ mismatched data (e.g. a section still showing the previous game after a switch).

## BH. Home game card trims + compact cards (founder 10-02: "get creative, even the outlines to the menu games";
10-03: "they all look really bloated … the windows are a bit big … make that all more crisp")
Every Home game card (DAILIES grid and PUZZLES grid; one shared card per platform) trades its flat colored top bar for a
**candy cap trim** and gets ~30% more compact. Consistent across all cards, varying only by the game's color.
BH1. Trim = ONE shape per card: a slim glossy band across the card's top in the game's accent (vertical gradient
     lighter→accent→a touch deeper), whose bottom edge is a soft **frosting scallop** (a row of shallow round drips,
     ~8 bumps across a card), with a soft white highlight streak baked into the same gradient (no second layer, no blur,
     no shadow of its own). Clipped by the card's rounded corners. Band height 9 (iOS pt / Android dp / web px) +
     the 4-unit drips (8 across a card); the icon + text row is centered in the rest of the card, the icon just
     under the drip line (drawn in front of it). Shared geometry: web lib/card-trim.ts, iOS Core HomeCardLayout.swift,
     Android ModeCardView.kt (CardTrimGeometry). VS Battle's window wears the same trim (the shared chrome).
BH2. Compact card (founder 10-03: "make the Classic text, the icon, and the W all align at the tops"): ONE top row —
     [icon 40][name 17 heavy, one line, scales down for long names (Crosswordocious), never wraps][W / L / ✓ badge 22]
     — all top-aligned (the icon's top edge, the name's cap height and the badge's top share one line); the subtitle
     (13 medium, muted, one line, ellipsis) 4 under the name, left-aligned with it. The card hugs it: trim band 9 +
     7 + max(icon 40, 21 + 4 + 16) + 9 = 66 (was ~104). Long subtitles are shortened in packages/core/modes.json
     ("4 words, one by one" → "4 words in a row"); a long result takes the short form ("38 guesses · 10m 46s" →
     "38g · 10m 46s"; web compactCardLine / iOS CardLine / Android HomeCardSpec.compactLine). Inner padding 10;
     grid gaps 10; tap target ≥ 44. Section titles (DAILIES, PUZZLES) ~25% smaller with less space above/below.
     The Good Morning card's content is unchanged (but see BH5).
BH3. States keep working: played/completed (check / W / L / score chips) stay legible on the compact card; a completed
     card's trim keeps its color (the card's existing done treatment stays as it is).
BH4. Rules: no strokes or outlines around cards, no emoji, every card in a grid the same size, the existing squish
     (AK) is the only motion (transform/opacity), and it stays cheap — one path per trim, no per-card blur/animated
     shadow; Home scrolling must stay smooth. Layout tests updated (web `lib/home-card-layout.test.ts` and the
     native equivalents).

BH5. The Home banner, tighter (founder 10-03: "from the headline to the WORDOCIOUS 4/8 row is almost a quarter of
     the screen"): ONE headline line, auto-fit (≈20 lettering, shrinking, never wrapping: "WARMING UP · 4 DOWN");
     the share button (34) at the left and the host (52; the player's own mascot when BJ6 applies) at the right, both
     centered on the headline row; 8 above a slimmer switch (28 tall, ~64% wide) with the PRO crown inside
     Unlimited; the meta line 4 under it (11 small caps); rows: label → icons 4, rows 8 apart, icons up to 36 (10
     across still fit, so ~29 on a 6.1" phone). Card ≈ 273 → ≈ 208 (−24%) on a 390-wide phone; the full 40% would
     need dropping the meta line or a row label (not done; founder call).

## BI. Smooth as glass + finish-screen fixes (founder 10-02 late: 2.7 (239) pulled from review — "Gauntlet … plays
really sluggish, the rest of them too … The load in intro graphic is not smooth"; "run a serious audit to make this seem
smooth as glass and as fast as possible in all areas. that's your main priority"; then "The cleared screens need to be
centered vertically and horizontally … this play again tomorrow is odd at the close screen … formatting issues on the
propernoundle.")
1. MEASURED perf pass ×3 (xctrace Time Profiler/Hitches on iOS; gfxinfo framestats + Perfetto on Android): fix the
   proven hotspots in Gauntlet, boards/keyboard flips, intro/cold start and scrolling; report before/after numbers.
2. Completed-game screens (every game): the column is centered vertically in the space between header and safe area and
   on the screen's center line; art card sized so everything fits one screen.
3. "PLAY AGAIN TOMORROW" → a centered SHARE RESULTS primary button (no side-floating share icon) + a small live
   "Next {Game} in 3h 12m" line.
4. Win popups: answer tiles always fit inside the card — one line per word for phrases, tiles scale down to fit
   (ProperNoundle "HUBBLE SPACE TELESCOPE" overflowed). Game title art never collides with the +XP toast.
Then: iOS 2.7 (240) TestFlight + resubmit 2.7 to App Review (auto-release); Android internal.
BI5. Reveal pacing restored to the pre-overhaul feel (single 0.5 s/150 ms, mini 0.3 s/80 ms); the popup waits for the final row + a win's hop wave + a 0.2 s beat (no 1.2 s cap).
BI6. Sudocious: same-digit cells clearly highlighted; row/col/box soft tint
BI3 follow-up (founder 10-02: "we can't give up board room"): SHARE RESULTS sits IN the dock's existing action row
(beside Next daily / Leaderboard; in the Unlimited card's row after an Unlimited game) at that row's height (web 40 px,
Android 40 dp, iOS 42 pt) — no row of its own. The "Next {Game} in 3h 12m" countdown is the candy's small second line
(the share glyph steps aside for it) and is dropped under 700 tall. Board room back to the BA1 floors (OctoWord 11 px on
390×844, 8 px on the SE; single boards ≥ 22).
BI7. No sound the player didn't cause (founder 10-02: "random sound effects playing while I was playing sudocious and I
wasn't even hitting anything"): the header cast's idle hop, rotating-headline ticks and the Friends badge arrival chime
are silent ×3 (the visuals stay). In-app notice banners keep their chime (a visible banner explains it).
BI8. Muddle: cartoon + caption always visible and bigger; solved words compact; punchline row fits
BI9. In-game feedback popups finished: colorful +N score burst with quality label, calm candy messages, never over the title
(founder 10-02: "look at hubbub how it shows the +5, that needs to be engaging as a colorful graphic"). One classifier ×3
(core FeedbackToast.swift / FeedbackToast.kt / lib/feedback-toast.ts, unit tested): "+N" / "Pangram! +N" = a gold (rainbow
for a pangram) candy burst with a 3D star, outlined +N and Good!/Nice!/Great!/Amazing!/PANGRAM!, spring pop + one sparkle
burst + float-up; anything else = a calm candy pill with a glossy tone coin (errors shake once). Anchored on the entry line
or the line under the board in every game and VS; Reduce Motion = a fade. App-wide sweep: Friends, Leaderboard, Public
profile (moderation), invites/referrals and friendly-game statuses use the same candy message ×3.
BI12. Streak / shield / flawless header popups always close (founder 10-02: "no tap to close feature and you have to
restart the app"): iOS full-height scroll content was swallowing the scrim's taps — the space around the card now closes,
the card keeps its taps, and a white close circle sits on the card's header corner ×3.
BI14. Strategy (and How to Play) now match the per-game Guides pages ×3: hero card (host ready pose on a glow, game title art, title, dek, MIN READ chip), Solve smarter + Tip of the day (deterministic by local date), game-colored tiles grouped Wordocious dailies / Puzzles / Every game, reader with numbered soft-numeral sections, takeaways on soft color fields, a candy PLAY {GAME} into today's daily (hidden for general articles and VS) and prev/next; How to Play gets the same hero + numbered sections + 3D game icons on the mode rows; no bordered boxes. Shared rules: StrategyPlan.swift / StrategyCatalog (Android) / lib/strategy-games.ts, unit tested.
BI10. Home button never opens another game (root cause: iOS counted a full-screen game COVER over Home as a PUSH — the
Home root's onDisappear fires under a cover — so every top-left Home press also "popped" Home, bumping its pop token, which
re-identifies Home's whole NavigationStack mid-dismissal; all twelve game `.fullScreenCover` modifiers were torn down and
rebuilt, and any game binding still set at that instant presented again (a cover dismissed only by `dismissAllOverlays`'
UIKit call — e.g. game A still behind the root's "Next daily" game B — a New-puzzle/Play-again swap in flight, or a widget
open that couldn't present while covered). The same rebuild reset Home's scroll). Fix ×3: iOS — a root leaving screen under
a modal is not depth (core `HomeButtonRules.rootDisappearanceIsPush`), Home closes every game through its BINDING (HomeView
`closeAllGames`, the root's nextDaily / unlimitedGame / queued present), and every handoff ("Next daily", Unlimited,
Leaderboard, a queued root present) carries its tap time and is dropped if Home was pressed since
(`HomeButtonRules.handoffAllowed`); a widget open over a game closes it first. Android (one game layer, synchronous
handoffs) and web (Home pushes "/", Next daily is a plain link) don't share the cause. Tests: HomeButtonRulesTests (A → Next
daily → B → Home ⇒ Home root, nothing presented, no Home rebuild, no scroll, in-flight handoff dropped), HomeNavTest, home-button.test.ts.
BI11. Tab switches keep each tab's scroll position; only a re-tap on the root scrolls to top (founder 10-02: "the home
footer automatically scrolls up … if you were … mid way down, and on another tab and click right back, the position should
persist"). Replaces AJ's "scrolled to the top": footer Home from another tab (any depth) still dismisses overlays and pops
stacks but keeps Home's position; leaving a game with the top-left Home button keeps it too; re-tapping the current tab at
its root scrolls to the top (a re-tap with a push just pops). Same for every tab. Core TabRouter / Android TabNav /
web nav-home + `useTabScrollMemory` (Home's column and the window-scrolled tabs remember their position; footer links pass
`scroll={false}`).
BI15. Every game's daily result reaches Home, leaderboards, stats; timed-out writes queue and retry (founder 10-02: beat the
Muddle daily on iOS 2.7 (240) during the Supabase outage — board restored, but no W on Home and no leaderboard row; "make
sure all games hit those spots and stats accordingly"). Audit ×3 of all 18 dailies (9 word dailies + ProperNoundle + the 9
Puzzles): seed → isDaily → scoring config → daily_results key → Home key → leaderboard key is one dbKey everywhere (no
Muddle key bug; the write died in the outage). Fixes: Home flips the instant a daily finishes (local, before any network —
it used to wait behind the user_stats + profile round trips); today's finishes still in the pending queue count as done on
Home across relaunches until the row lands; Home no longer blanks today's completions when the token refresh can't reach the
server; the queue drains at launch, on every foreground and when the network returns, never replays a game whose live write
is still in flight, re-checks achievements on a replayed result; a daily_results write is bounded (20 s) and a timeout
leaves the part queued; results that owe no row (implausible / no config) no longer sit in the queue forever. Tests: the
table-driven mode map + timed-out-write-stays-queued (iOS DailyResultPipelineTests, Android + web equivalents).
BI16. Late celebrations wait for a calm moment; an outage never signs you out (founder 10-02, same outage: his last write
landed late, so the Daily Sweep popped at an awkward moment, and the app showed SIGN-IN as if he were signed out).
Celebrations from a late result (pending-queue replay, the launch/foreground achievement sync, or a live write that came
back more than 6 s after the finish) wait for calm: Home's root, nothing presented (game, cover, sheet, alert), no other
popup. Daily Sweep / Flawless / Puzzles sweep always wait for calm and present one at a time; one still waiting when the
local day rolls is dropped. A live finish's achievements keep the BF2 behavior (after the win popup). Sign-out: a session
refresh that fails from a network or server error (timeout, auth unreachable, 5xx, 429) keeps the stored session, user and
last profile and retries (5 s, 15 s, 30 s, then every 60 s, plus foreground and network back). Only an invalid/revoked
refresh token (refresh_token_not_found / _already_used, session_not_found / _expired, user_not_found / _banned, "Invalid
Refresh Token") or the player signing out clears it. A profile fetch that can't reach the server keeps the last profile
(never blanks it or mints a new one). Root causes: iOS launch restore read any thrown `auth.session` (an expired token
whose refresh timed out) as "no session" and wiped the profile cache; web auth-js 2.93.3 treats only 502/503/504 and
thrown fetches as retryable, so a 500 / 520-530 / 429 / HTML error page on refresh deleted the stored session and fired
SIGNED_OUT (now an auth-only fetch wrapper turns outage responses into network errors), and an expired token's retryable
failure surfaced as INITIAL_SESSION null, which auth-context read as signed out. Rules: core CelebrationGate + AuthSessionPolicy
(iOS), Android + web equivalents, unit tested (transient refresh error keeps the user signed in; revoked token signs out).
BI17. Word of the Day restyled to match the Guides family; quiz progress survives outages ×3: Home card on the borderless hero card (I's ready pose on a glow, the word in brand caps, pronunciation + part-of-speech chip), glossy candy choices with clear right (green, pops once) / wrong (rose) / faded states through the reveal beat; the word page gets the hero (I, date eyebrow, big caps word), numbered senses with soft numerals, the example as a highlighted line and the puzzle notes on soft color fields; archive rows borderless. Every quiz answer is also kept on the device per player (written first); an outage read falls back to it, and device-only days merge in and re-send when the database answers (WotdQuizLocal, unit tested).
BI18. Crossword fits one screen in play: cells sized from width and height for the real grid size, compact header, keyboard pinned (founder 10-03: "the daily today required you to scroll to see the whole puzzle"; today's daily is 10 × 11). ×3: the play header is compact like Muddle's (title art ≤ 44 in the corner-button row, then the puzzle title and the meta line); the grid alone owns the band between the header and the pinned clue bar / Check · Letter · Word · Reveal all / keyboard, its cell the largest square that fits the band's width AND height for the puzzle's real cols × rows (3-pt gaps, tray chrome and cursor-ring room off first, 14–42 cap; letters and clue numbers scale with the cell), so nothing scrolls. The clue bar keeps a fixed two-line height (the grid never resizes between clues); a Clues toggle beside it swaps the Across / Down list into the band (it scrolls there; picking a clue goes back to the grid). Screens under 700 tall get 44-pt keys. Rules: iOS CrosswordFit (Core, FinishLayoutTests), Android BoardSizing.crosswordCell (BoardSizingTest), web lib/board-fit.ts crosswordCell + crosswordCellFonts (board-fit.test.ts), unit tested. Estimated cells for 10 × 11: iPhone SE 20 pt, 390×844 29 pt, Pro Max 36 pt; Android 360×640 17 dp, 411×891 34 dp; web 375×667 22 px, 390×844 32 px.
BI19. Instant W/L + leaderboard via optimistic local results; cache-first pages that never blank (founder 10-03: "the W and
L will populate immediately now upon return to the main menu as well as the leaderboard immediately populating the
results … make sure the information on all pages is quick to load and stays every time"). A finished daily is written
locally before any network call (Home's W/L map, the player's own row on the cached per-game boards placed by score desc /
time asc and marked as theirs, the Stats cache) and kept until the server confirms; the server's rows then win silently.
Pages paint their last cached data and refresh underneath; a failed fetch keeps the cache. iOS: core OptimisticResults
(merge, CompletionLedger, CacheFirst, PersistentMemoStore) wired into DailyCompletionsStore + the leaderboard own-row
merge; StatsMemo, Friends' same-day payload and All-Time records now persist across launches; the Stats tab no longer
blanks on a failed read; DataPrefetch warms today's boards + Stats after launch, on return (throttled) and after each
finish lands. Web: lib/optimistic-results (Home W/L, per-game + Sweep board rows, Stats Today card), lib/page-cache
(per user, versioned, size-bounded, cleared on sign-out) behind Leaderboard, Records, Friends, Home banner, public profiles,
persisted SWR for Stats, prefetch after launch + after each finish. Android: equivalents. Verified: iOS app build + 263
core tests; Android 430 JVM tests; web 1220 vitest tests + tsc clean (all unit tests; no device/browser run, DB was down).
Not covered: WOTD (already cached on iOS; untouched on web), web rank/medal/achievement reads can still blank the rank
line in an outage, iOS per-card Stats views not audited for failed-read blanking.
BI21. Home banner card rebalanced: centered headline, centered wide Daily|Unlimited switch with PRO inside, centered meta line, evenly spread borderless progress icons
BI22. Hints and feedback never resize or move the board (overlay / reserved slot) (founder 10-03: "hitting the hint button
caused one of the puzzle games to shrink a bit"). Culprits: Hubbub (the "Starts with…" chips were a row of their own, so
the honeycomb band shrank), ProperNoundle (the clue landed in the header's flow — a long Wikipedia clue shrank the board a
lot) and Kindred (the "Name a category" chip row was subtracted from the grid's band); also Codebreaker / Crossword (a
label growing — "Hint · 1", "Word · 1", "Reveal all?", the Reveal countdown — could flip the control rows from one to two)
and Codebreaker's conflicts line. Fix ×3: Hubbub's hint chips lead the found-word flow (soft filled amber chips, lightbulb,
no dashed outline); ProperNoundle has an always-present two-line clue slot (clamped; tap = the whole clue); Kindred's
category slot is always reserved (chips scroll sideways); control rows are laid out by the screen, never the labels, with
equal-width pills (Classic + VS Vowel/Consonant, ProperNoundle Clue/Vowel/Consonant, Ladder, Kindred, Spyglass,
Codebreaker, Crossword — web shows the counts as a gold corner badge); fixed-height status lines (Starsweep stars left,
Codebreaker conflicts, Pocket-game move errors); in-play clocks use tabular digits; the VS Six/Seven hint pills are amber
like every solo hint; Spyglass hinted words glow with a stronger tint instead of a ring. Toasts stay overlays (BI9).
Tests: iOS HintLayoutTests (Kindred tiles identical with 0–4 named categories), web lib/hint-layout.test.ts (Hubbub tile
identical with/without hints, clue slot fixed, source guards), Android equivalents.
BI23. Guest empty states keep the header pinned; cast mascot instead of a generic icon (founder 10-03: "get rid of the
sign in to track your stats gray circle image and make that screen look nicer"). iOS Stats + Leaderboard put the
content-sized signed-out body under the header in one VStack, so header + body centered mid-screen; web Stats' guest page
had no header at all. Fix ×3: one shared GuestPitch (iOS Mascots.swift, Android GuestPitch.kt, web
components/ui/guest-pitch.tsx) fills the space under the pinned AppHeader and centers in it: the page host (Stats D,
Leaderboard O2, Friends O1 + I as a duo) pops in once, a gradient caps headline (YOUR STATS LIVE HERE / CLIMB THE BOARDS /
PLAY WITH FRIENDS), one line, a dimmed decorative preview (Stats: streak / wins / best-time glossy chips; Leaderboard: a
mini 2·1·3 podium; soft glossy tiles, no border, hidden from accessibility), the SIGN IN candy (no generic icon) and a
quiet "Play without an account" link to Home. Friends guests keep the FRIENDS title art and no longer see the empty
skeleton list or the add-by-username card. No outlines: the Friends list / friends cards, skeleton rows and the
add-by-username field are soft filled (iOS FriendsCardChrome + SkeletonBlock + field; Android friendsCard, list card,
friendsFieldColors). Web Leaderboard shows boards to guests (no gate), so only Stats + Friends changed there.
BI24. No unfinished-looking states: every empty/error/loading/not-found state uses a cast host, brand headline, subtext and CTA
(founder 10-03, after the grey person-circle on signed-out Stats: "any screens that show things like that are unfinished in my
opinion and you should know what good looks like by now"). One shared BrandEmptyState ×3 (iOS BrandEmptyState.swift, Android
ui/BrandEmptyState.kt, web components/ui/brand-empty-state.tsx): the state's ART_SPEC §7 scene (R asleep for empty boards, R
unplugged for errors / offline, O3 for not found, I for no friends, D for no stats) or the page host, the title in the brand
gradient caps, ONE short line in the app's voice, a candy action where one makes sense (Try again / Home / Back / Got it), an
optional dimmed preview; it fades + rises in (transform / opacity only), no bordered box, no emoji, no generic SF Symbol /
Material / lucide icon. Loading is always the CastLoader wave (never a bare spinner or a plain "Loading…" line); a fetch that
fails with nothing cached shows R unplugged + Try again instead of spinning forever. Compact in-card hints (Stats "not enough
data yet", empty charts) put D beside the line instead of a generic chart icon. System alerts are not used for in-app
messages (iOS "Coming soon" is a sheet with U + Got it).
BI25. Settings options are filled tiles with live theme/keyboard previews (no outlines); sheets open on the tap frame, single-fire
(founder 10-03 on the sim: THEME / KEYBOARD rows were stroked boxes with a thick selected ring; the gear took over a second and
one tap queued then closed). ×3: each choice is a soft filled tile — unselected a pale wash of the section color, no stroke;
selected a glossy filled tile in that color (top sheen, soft glow) with white text and a small white check badge, cross-faded
(opacity only), squishing on press. THEME tiles carry four mini glossy W·O·R·D tiles in that theme's colors on its page wash;
KEYBOARD tiles a mini key row showing where Enter (return) and Delete sit (Michael: the Z row with delete on both ends + the
enter / space / enter row). The shared option + field chrome lost its outlines too (iOS g5Option / g5Field / tintedPill, Pro
best-value card glows instead of a gold ring; Android Edit profile fields, swatches, privacy row, chips and Pro plan cards;
web softRow / softInput): selected = deeper wash + glow, fields = soft fill, errors tint the fill rose. Help / gear are
single-fire (600 ms debounce, ignored while a sheet is up) and the Settings sheet builds light: Linked sign-ins (identity
load + provider art, below the fold) mounts ~0.35 s after the sheet lands. Rules: iOS Core SettingsPreviews
(SettingsPreviewsTests), Android data/SettingsPreviews (SettingsPreviewsTest), web lib/settings-previews.ts, unit tested.

## BJ. Fluidity round 2 (founder 10-03)
BJ1. Stats: Today then All-time in one scroll per game, no toggle; measured smooth scrolling (founder on iOS 2.7 (241): "each
game should populate their daily stats first and all time beneath, no more toggle, it is really choppy … stats was almost
unscrollable because it was going so slow"). Replaces BG's Today | All-time toggle ×3: the picker picks the GAME only
(Overview, the Daily Sweep, or one game; re-tap → Overview); every view is ONE scroll — a TODAY section banner (brand gradient
caps + a short gradient rule + the date) with that game's today (Overview: the Today card + today's games; a game: its result
line, rank, finished board and today's rows, or "NOT PLAYED TODAY" + a Play candy in the shared BrandEmptyState; the Sweep:
today's runs), then an ALL-TIME banner ("Since Mar 2025") with its all-time stats and charts. A pick swaps the content with one
quick opacity-only fade and resets the scroll to the top; the swipe still walks the games with the same diagonal guard (≥ 70 and
twice as wide as tall). Pure model + tests: iOS core StatsSelection.sections (StatsSelectionTests), Android StatsNav.sections
(StatsNavTest), web lib/stats-view.ts statsSections (stats-sections.test.ts).
Measured (iOS Release, iPhone 17 Pro simulator, seeded Pro account with a full history; a debug autoplay drove the scroll
top → bottom → top at 2,400 pt/s with a CADisplayLink frame monitor + main-thread CPU, then removed). Before → after:
Overview (the ~16,500-pt page) round trip 44–58 s (≈ 4–6 fps) → 13.7 s (the autoplay's nominal time, ≈ 57 fps); hitch time
876–931 → 47–59 ms/s; worst frame 1.1–1.4 s → 0.10–0.14 s; main thread 95–98% → 25% busy; game pages 24–412 → 7–29 ms/s
hitch time (worst frame 53–88 → 33–40 ms); switching games: worst frame 0.9–1.8 s (building the whole All-time page, ~180
badge bodies at once) → 77–82 ms, hitch time 463–625 → 57–67 ms/s. Causes and fixes: the page was ONE eager VStack — every Swift Chart, ~120
achievement badges (each a SwiftUI grayscale filter + an image shadow = two offscreen passes), medals, VS board — built, laid
out and composited at once. Now ONE LazyVStack with every card its own element (charts split out of ProfileDashboard, the
achievements grid one lazy row of three), locked badges drawn from a pre-grayed downsampled bitmap (decoded off the main thread
when Stats opens) with no image shadow, cached date formatters, the badge progress table built once per pass instead of per
badge, and count-ups that play once per session (never replayed mid-scroll). Android: the page was ONE LazyColumn item holding
every card — now every card is its own keyed lazy item, one draw-phase alpha for the fade, the swipe on the list. Web: no
scroll listener writes React state and nothing scrolling uses backdrop-filter; the below-the-fold All-time groups use
content-visibility: auto (.stats-cv) so the browser skips their layout and paint until they near the viewport.
BJ2. Completion screens fluid: measured; one animation at a time; leaf timers; pre-decoded art (founder on iOS 2.7 (241): "If
there is a way to try and make the completion screens less choppy too it all feels like it can use some fluidity"). Measured
on an iOS Release build (iPhone 17 Pro simulator, 60 Hz): a temporary debug hook played Classic / OctoWord / Gauntlet / Hubbub
dailies to the finish (an XP result with a tier level-up injected during the finish hold) and drove popup in → CONTINUE →
finished screen → More → scroll, with a CADisplayLink frame monitor + a run-loop main-thread meter; then removed. Then
toggled each suspect off one at a time to attribute the cost. Before → after (frames rendered / hitches / main thread busy):
- Win popup spring-in (1.3 s): Classic 19–21 fr, 16 hitches, 88–90% → 70–74 fr, 1–3 hitches, 18–20%; Hubbub/Gauntlet
  11–23 fr, 92–94% → 57–100 fr, 25–46%; OctoWord 13 fr, 95% → 58–67 fr, 86–91%.
- Win popup idle (1.8 s, confetti falling): 17–28 fr (≈ 12 fps), 15–26 hitches, 86–95% → Classic/Hubbub/Gauntlet 99–109 fr
  (≈ 58 fps), 0–2 hitches, 2–17%; OctoWord 59–64 fr (it now builds the finished screen hidden here; the rays, bob and
  confetti run on Core Animation, so they keep moving through it).
- CONTINUE → finished screen (0.6 s): Classic 6–11 fr, worst frame 200–330 ms, 82–94% → 30–34 fr, worst 50–94 ms, 16–23%;
  OctoWord 1 fr, worst 696 ms, 100% → 29 fr, worst 124–135 ms, 29%; Gauntlet 14 fr → 36 fr, 14%.
- Finished screen idle: OctoWord 76% busy → 2–3% (Classic/Hubbub/Gauntlet 7–12% → 1–9%).
- More expand: 9–15 hitches, 360–425 ms of hitch time → 3–4 hitches, 135–245 ms. Scroll (OctoWord): 15 hitches, 83%
  busy → 0 hitches, 6–7%.
Causes found → fixes (×3 where the platform had the cause):
1. Confetti was 36 SwiftUI views in a drawingGroup, re-rendered on the main thread every frame for the 4.5 s burst (the
   biggest single cost: confetti off alone took popup-idle from 89% to 14% busy). iOS ConfettiView is now CALayers with one
   fall + spin + fade animation group each, run by the render server — same pieces, palette, spread and timing. (Android
   was already one draw-phase Canvas; web already transform-only CSS keyframes.)
2. Any SwiftUI repeatForever (the popup's turning rays and host bob, the Unlimited card's wobble) made SwiftUI rebuild the
   whole screen's display list every frame — with OctoWord's 8-board recap that was 40–76% of the main thread forever. iOS
   LoopArt (PostGameEffects.swift) runs those loops on Core Animation (rays drawn once into an image, LightRaysArt). Android
   (graphicsLayer lambdas) and web (CSS transforms) already loop off the main thread / in the draw phase.
3. The 8-board recap (~500 glossy tiles) built in the frame CONTINUE was tapped, then cost every later frame. iOS: the
   finished screen is built hidden under the win card once its entrance beats are done (FinishMotion.prebuildFinished =
   2.0 s; CONTINUE then only cross-fades) and the multi-board recap is drawn ONCE into an image (FlattenedStatic, via
   ImageRenderer), so the page holds one image instead of ~500 views. The multi-board answer tray on the card fades in as one
   flattened layer instead of 40 separate 3D tile flips (a single answer keeps its flips).
4. Shadows of whole composited views re-blurred every frame they moved: the win card's glow and the XP toast's glow are now
   the SHAPE's shadow behind them; the live-lettering headline's drop shadow is part of its one raster, and its left → right
   reveal is a transform on the mask (it animated a mask width).
5. Big art decoded on the main thread at presentation: the VICTORY / SO CLOSE lettering, every cast host at the card's size
   and the achievement badges / scene are decoded into the display-size cache off main (iOS ArtThumbs.prewarm at launch, the
   finish and when an unlock queues; Android FinishMotion.prewarm into ArtBitmaps when the game ends / Hubbub opens; web
   already holds the card until its art is decoded).
6. Everything animated at the same moment: the XP toast slid in under the win card, achievement / level-up popups landed
   0.35 s after CONTINUE on top of the finished screen's build, and the extras behind "More" (rank, breakdown, definition)
   were built in the same frames as the expand. Now ONE big thing at a time, the same beats ×3 (iOS FinishMotion,
   Android FinishMotion, web lib/finish-motion.ts FINISH_MOTION, unit tested ×3): card spring-in → tiles flip (0.25 s) →
   points count up (0.45 s) → one gloss sweep (0.9 s) → sparkle (1.15 s) → idle bob (1.2 s); CONTINUE → the finished strip's
   headline pops once the card has gone (0.3 s) → the XP toast (0.45 s after the card closes; it waits while the card is up)
   → achievement / level-up popups (0.85 s after). iOS builds the More extras hidden below the fold once the screen has
   settled, so More only fades + scrolls. The countdown in SHARE RESULTS was already a leaf (TimelineView inside the label,
   every minute; Android/web 30 s); the finished screen's GeometryReader centering only re-lays out on size changes.
The reveal pacing and finish hold (BI5) are unchanged — nothing is faster, only ordered. Android was not re-measured on the
emulator this round (the machine was at its load limit); its changes mirror the measured iOS causes where Compose had them.
BJ3. App-wide measured hitch hunt + reusable perf harness (docs/PERF_HARNESS.md). iOS: a DEBUG-only `-perfTour` autoplay
(PerfTour.swift; `Perf` build config = Release optimization + DEBUG, simulator only) visits launch, Home, the four tabs,
Settings, Help, a header popup, Word of the Day, Strategy, Classic / QuadWord / OctoWord (type, submit, reject, play to the
win), Gauntlet (stage card), Hubbub, Sudocious, Muddle, Crossword, a VS bot start and the pocket-games sheet; each step an
os_signpost interval with CADisplayLink frame gaps (> 25 / > 50 ms, worst, first frame), hitch ms/s and main busy %;
AttributeGraph cycles counted from the log; `apps/ios/scripts/perf-tour.sh`. Android: `scripts/android-perf-tour.sh`
(adb input + gfxinfo per step). Web: `scripts/web-perf-tour.mjs` (own headless Chrome over CDP, 4× CPU). Measured fixes
(iOS sim, guest, before → after): AttributeGraph cycles ~14 per game → 1 per whole tour (the hardware-key catcher resigned
first responder inside SwiftUI's graph update; found with a breakpoint on AG::Graph::print_cycle; now deferred a turn);
OctoWord typing main busy 53–83% → 14–24% and QuadWord typing hitch 160–300 → 19–40 ms/s in the clean run (the typed-tile
pop was a custom Animatable keyframe modifier re-running per frame on every tile — now two plain scale/opacity animations,
off on 5+ board grids; settled rows and keys are Equatable views); OctoWord finish worst frame 507 → 141–172 ms (recap
boards render one per frame, never built live first); widget snapshot / completions no longer rewrite or re-render when
unchanged; LiveHeadline stops observing scroll state; the Home banner's 1 s tick is the clock line only; web: audio decode
leaves the first touch (a Home scroll's first frame blocked 190 ms–2.9 s at 4× CPU). Still open: every game open has one
~300 ms frame (title-art prewarm tested, no gain — reverted), Settings open 450 ms, OctoWord typing still shows 0–6 frames
> 50 ms per word run to run.
BJ4. Podium on every board with a finished stage backdrop (founder 10-03 on iOS 2.7 (241): "The podium only appears on classic
right now" + "can we make the podium have a subtle background … it could use some finish"). ×3, every board — each game's
daily board (Everyone AND Friends), the Sweep board (today + yesterday), Puzzles / More Games boards, Yesterday's Winners,
Records' yesterday podium and the Friends weekly race — stands its leaders on the podium as soon as ONE result is in. Core
podiumLayout(ranks) (packages/core/src/podium-layout.ts; iOS Core PodiumLayout, Android core PodiumLayout; pinned by
podium-layout-fixtures.json): the leading rows ranked within the top three stand on it (ties share a metal + height), at
most three; the free places are open spots — the step in its metal softly dimmed (40%), R asleep (art-scene-r-asleep) where
the avatar goes, "Open spot" over "Claim #N" (podiumOpenSpot), not tappable, no grey circle, no outline. Rows continue below
from the first row off the podium. Friends on the podium keep the taunt bell under their name. The stage: one soft vertical
wash in the game's accent (gold for the Sweep / the race) fading to nothing at the step base, ONE static shape layer (12
faint sunburst rays fanning out from behind #1 + 8 tiny confetti dots in the cast colors) and a soft elliptical floor shadow
under the steps — drawn once, no animation, no blur, no border; tighter top padding so the podium fills its card.
BJ5. One avatar resolver everywhere; edits show instantly (founder 10-03: "I updated my profile pic and it isn't populating on
there"). Why: the iOS podium drew only a mascot (it ignored avatar_url and the Pro mark), while rows drew the photo — so BMT
(an uploaded photo, display = photo, Pro) was a plain B mascot on the Classic podium and his real picture + crown in the
Gauntlet rows; and the daily board query carried only (username, avatar_url, avatar_emoji), so other players' mascots / cast
heroes / frames resolved only if a friends list or a profile visit had recorded them. Ukrainian Cyclone's avatar_url is a
Google sign-in picture (Google's default is a plain colored letter — the orange "W"), so rows showed a letter tile and the
podium a seeded U. Now ONE precedence, core resolveAvatar (packages/core avatar-config.ts; iOS Core AvatarResolve; Android
core; pinned by avatar-resolve-fixtures.json): the custom photo when display = photo → else the saved mascot (avatar_config)
→ else the worn cast hero (avatar_cast_id) → else the seeded mascot; avatar_frame fills a frameless config. A photo is
"custom" when the player chose it (uploaded to our avatars bucket, or a saved config with display = photo); an OAuth
picture with no saved choice is never drawn — no avatar is ever a plain letter tile. One resolver per platform routes every
avatar (podiums, rows, Sweep, Yesterday's Winners, Records, Friends, profiles + head-to-head, share images, and every VS
surface: lobby / matchmaking, the intro slam cards, the HUD + opponent label, results / rematch, race-my-run challenges sent
+ received, the friend challenge sheet, the bot ladder's own card, the VS share image). The signed-in player's own avatar
always comes from their live profile (photo, mascot, cast, frame, accent, Pro) wherever it appears — cached boards and the
BI19 optimistic own row included — so an edit shows at once with no refetch. Board queries return avatar_config /
avatar_cast_id / avatar_frame / accent_color on every row (retried without them if the select fails); RPC payloads (Sweep,
VS, challenges) and name-only avatars are filled by a batched profiles lookup. No SQL needed.
BJ6. Your mascot hosts a finished, personal Good Morning card (founder 10-03: "swap the purple main character … for your
own created guy"; "a little more prominent"; "I don't just want the profile pics tacked on to a body as if it were a face";
"even and symmetrical"; "looked small and there was a lot of empty space"; "that window needs flair … it looks unfinished";
"the main titles a snag bigger" = the progress icons; "sign in at the top should be closer to the question mark"; "a clever
way to populate longer usernames without shrinking anything down or scrolling off screen"). ×3:
Host — an 88 pt box CENTERED on the card's top edge: it rises 28 above the card (iOS: into the scroll's existing 12 pt +
16; Android / web: 22 of headroom + 6 overhanging the header's empty bottom edge through an extended scroll viewport) and
overlaps 60 into the card; the headline's caps start ~4 under its feet. Who stands there: a signed-in player whose avatar
shows their uploaded photo → the photo whole as a framed portrait (chosen frame → Pro gold → level tier art frame); else a
custom mascot (saved avatar_config or worn cast hero) → the full mascot; else W in its wave pose. It renders in every state
(fix: iOS hid W on every Daily day because the "W steps aside for the celebration art" rule read `showsMomentArt`, which
is true all Daily day — it now needs real moment art; web's host span had no block box and was clipped). Waves once per
launch (transform only); the pose is decoded at launch (no pop-in).
Greeting — personal for signed-in players: "GOOD MORNING / AFTERNOON / EVENING, NAME!" and 0–4 h "UP LATE, NAME?" (guests:
the plain greeting). Core headline-tokens `headlineLayout` (+ Swift / Kotlin ports, fixtures) decides identically ×3 from
Nunito Black advance widths: the device's full lettering size is the largest (≤ 38) at which "GOOD AFTERNOON," fits the
slot; the headline is one line when it fits at that size, else the words before the name on line 1 and the NAME + "!"/"?"
on the gold hero line(s) at the SAME size — a long name breaks at natural boundaries (space, _ . -, letter↔digit,
camelCase), then by characters. Never shrunk, truncated, scrolled or clipped (every length 3–20 is tested on a 375 pt
phone). On phones a signed-in greeting therefore stacks (the card grows by exactly one line); lines without a name stay one
line. The line box's empty ascent / descent is trimmed so there's no dead space.
Flair (static, no blur / outline / loops) — a candy frosting cap across the top edge (the game cards' trim shape, brand
purple → pink; the moment's gold / pink on swept / flawless days), a soft diagonal sheen in the strip, a few tiny mirrored
confetti dots + faint sparkles in the top corners, small gold four-point sparkles flanking the headline, and the two
progress rows in a soft lavender band (two zones). Progress icons: both rows one size, edge to edge, 4 pt minimum gap, the
rows' side inset trimmed, the glyph ~56% of its tile (~32 pt tiles on a 402 pt phone; 34–36 can't fit 10 across).
Header — one right-aligned control group with even gaps: [SIGN IN] [?] [gear] for guests, [Share] [?] [gear] on Home once
something's finished (Daily); no reserved invisible slots; the share-today button left the card for the header. Home shows
each fact once (one resets countdown; web dropped the locked cards' "Back in" clocks and the desktop Today card's clock /
share / streak duplicates). Photo rule everywhere (BJ5 resolver): photo → framed portrait, mascot → full mascot; nothing
composites a photo onto a body (audited ×3).
BJ7. App-wide density pass: cards hug content, top-aligned title rows, one-line details (founder 10-03, after BH's compact
Home cards: "Any areas across the app that you can do that exercise would be amazing"; "I don't like any of the bloating if it
is unnecessary, I like the crisp look"). The BH pattern everywhere else: no fixed min heights or vertically centered content
leaving dead space, no chip floating at a card's bottom; ONE top line (leading icon / avatar, title, trailing badge / action
all top-aligned) with the detail 4 under the title on one line; padding 10–12, gaps 6–10, section gaps 12 (was 16–18),
section labels and title art smaller with less air (page title art 52 tall, was 64; the Leaderboard day title 78, was 90;
WORD OF THE DAY / VS BATTLE take the compact DAILIES / PUZZLES title); leading icons ~40, list avatars 36; card top bars
5–6 (were 8–10). No outlined boxes (the last strokes go: social tiles, recent-match rows, VS code field / pills / day
tiles, bot-ladder ring, Leaderboard your-row ring and board-card / segment lines on Android, reaction chips, pocket cards).
Tap targets stay ≥ 44 (rows / toggles / links keep a 44 floor). Surfaces: Friends (banner, your turn, pocket games — 116
floor gone, friend rows, weekly race, invites, Moments, add a friend, Gift a week of Pro), public profile (header, social
cards, medal shelf, head-to-head, recent-match rows on one line), Records (hall-of-fame cards — 110 floor gone), VS (lobby
tiles — 112 floor gone, incoming / rival / challenge rows, bot of the day, ladder rows one detail line, challenge cards,
the VS banner), Home (WORD OF THE DAY card, VS BATTLE card 104 tall, was 126), Settings (sections, option tiles, toggles,
links; Michael Keyboard reads "4 rows, delete + enter on both sides"), the info pages (menu, guides, words rows, strategy
tiles — 170 floor gone, tip card), notification prefs, and the Leaderboard (result card, rows 7 vertical, headers, sweep
card one line). No duplicate facts: under the Leaderboard result / rank row the completed-board toggle reads YOUR BOARD
(the solve line above already says "Solved in 3 guesses · 23s"). The podium, Stats, in-game boards and finish screens are
untouched.

BJ9. Games grow + soft rise from the tapped card and shrink back (founder 10-03 approved the demo: "grows and shrinks as a
user expects"; "making sure it isn't choppy at all"). Open: the tapped card lifts (scale 1.03, up 4, 0.12 s), then a light
shell in the card's color with its rounded corners grows from the card's exact frame to full screen on a soft settling spring
(0.44 s, ease-out-expo-like) while the real game — built under the shell the moment the card is tapped — fades in over the last
60% of the grow (it never shows before its first frame is committed). Close reverses: the game fades (0.18 s), the shell
shrinks back into the SAME card's current frame (0.38 s) and fades away. Every launch with a source card: Home dailies, Puzzles
and the first-game card, the Leaderboard play card, Strategy's PLAY (frame only: its sheet closes as the game opens, so it
closes as a soft rise); no source (widget / deep links, Next daily, Keep playing, pocket games, VS covers): a centered soft rise
(scale 0.96 → 1, up 14, fade) and its reverse. Reduce Motion: a cross-fade. Smoothness rules: only the shell (one plain
rounded shape) and snapshots move — never the live game; transform / opacity / one shape's frame only, one driver, no blur.
iOS (16+): `.gameCover` replaces `.fullScreenCover` for every game — the cover presents with no system slide in the next run-loop
turn under a root overlay window (Home snapshot + card snapshot + shell, all Core Animation committed and flushed at the tap,
so the render server plays them while the main thread builds the game), and the dismissal is the cover's own UIKit animator
(every close path — the Home button, dismiss(), BI10's binding clears, dismissAllOverlays — goes through it; HomeButtonRules /
TabRouting and the Next-daily hand-off are untouched). Cards carry a zero-cost probe view read on demand (live frame at close).
Android: one elapsed-time driver read only in draw / graphicsLayer lambdas (no recomposition per frame): the shell is drawn
between the tabs and the game layer, the game layer's alpha reveals / fades it, Home keeps drawing under the shell until the
reveal ends, the tapped card's own layer lifts. Web: one View Transition (`game-shell` group: the card → a solid shell; the
new route fades in over the last 60%), a single WAAPI shell as the fallback. Geometry / timing: core MotionSpec ×3 (iOS
MotionSpecTests, Android MotionSpecTest, web motion-spec.test.ts). Measured 10-03 (iOS Perf build, iPhone 17 Pro sim, DEBUG harness `-bj9Measure`: Home card → grow → Home button → shrink, 3× each, CADisplayLink main-thread monitor): Classic open 1/2/1 frames > 25 ms (worst 281/172/137), close 4/2/2 (worst 58/62/60); OctoWord open 1–4 (worst 406–463), close 2–4 (worst 117–128). Every long frame is the game's own first build (open) or Home's re-entry + the game's teardown (close) — the same frames the system slide had (BJ3 baseline: classic.open worst 340, octo.open 499, octo.close 122); the transition itself adds no main-thread work (all Core Animation, flushed at the tap, so the lift / grow / shrink keep playing through those stalls). Target 0 > 25 ms still OPEN: needs the game builds split (perf harness owner). Mid-transition frames: `-bj9Slow`.

BJ10. App menus / sheets soft pop, system sheets excepted (founder 10-03). The background dims and the sheet / menu springs up
gently from the bottom center (scale 0.94 → 1 + fade, a light spring ~0.42 s, damping 0.82) instead of the system slide;
dismiss reverses quickly (0.2 s). Everything the app presents: the ? menu, Settings, streak / shield / flawless popups, guides,
Strategy / Word of the Day, profile / records, leaderboard board sheets, VS sheets, the mascot maker, the Pro page, friend
sheets, pocket games, achievement lists. Exceptions keep their native motion (core SoftPopPolicy): share, purchase (StoreKit /
Play Billing / Stripe), Sign in with Apple / Google, the photo picker, mail, Safari — and full-screen games (BJ9). Swipe-to-
dismiss keeps working: the sheet follows the finger, then dismisses. iOS: `.softSheet` replaces `.sheet` for every app-owned
sheet (a source-scan test fails on any other `.sheet`): presented without the slide (built in that frame), then a pure Core
Animation pop on the sheet's container + its dim, and a reverse animator for programmatic closes (a live swipe keeps UIKit's
interactive dismissal); the header popups use the same pop as a SwiftUI transition. Android: every app Dialog / AlertDialog
window pops via the theme's dialog window animation (system compositor, off the UI thread); bottom sheets are SoftModalSheet
(replaces ModalBottomSheet; own scrim, pop, finger-following drag, nested-scroll pull-down); the full-screen popups (streak /
shield, guides) pop from the bottom center. Web: the shared dialog / alert / bottom sheet and the modal / popup animations
pop from the bottom center (transform-origin 50% 100%).

BJ11. Old logo retired everywhere in-repo; subscribe menus in the new aesthetic (founder 10-03: "When I clicked check
subscription somewhere the Apple menu popped up with the old logo showing"; "Anywhere that would have the old W icon should
be looked at"). Logo sweep (contact sheet of every logo-like asset vs the pre-B icon): the app icons, launch, splash, adaptive
and push icons were already icon B; what still carried the old white-W tile is gone — the Play feature graphic
(apps/android/feature-graphic-1024x500.png, rebuilt by scripts/store-screenshots/play-feature-graphic.py from icon B) and the
docs logo marks (docs/design/brand/logo/mark*.png are icon-B rounded tiles; the old tile lives only in logo/retired/, and
draw-logo.py writes there). New: the Android 13+ themed-icon `monochrome` layer (the W-mascot silhouette), the web push badge
= that white silhouette (badge-96.png; a full-color badge reads as a blank square), and an upload kit for the dashboards we
don't own (logo/upload/: Play hi-res icon 512, Stripe icon 512, Google OAuth logo 120). Apple's Manage Subscriptions sheet
shows the App Store listing's icon, which turns into icon B when 2.7 is released. Subscribe menus ×3: never a cold jump to a
billing page — every Manage subscription (Settings row, the member card, the "You're Pro" sheet, the Pro page's member state)
opens a short branded hand-off first (W pointing, "Opens your Apple subscription settings" / "Opens your Google Play
subscriptions", why it's the store's page, the amber candy, Restore Purchases); the web lists rows that each say what opens
(Stripe's secure billing page, Apple's, Google Play's) and every Subscribe says "Opens Stripe's secure checkout". The Pro page:
GO PRO lettering on iOS too, a member state with the plan, renewal, Manage and Restore, a lapsed state ("Welcome back · Your
Pro ended Sep 30, 2026" with W waving) and the Settings upsell names the end date; the auto-renew disclosure uses the live
store prices, and the web Pro page / Go Pro popup gained the renewal terms + Terms / Privacy links (a guest's web Subscribe
now signs in first instead of doing nothing). Copy lives in one tested place per platform (SubscriptionCopy: Core / data /
lib/payment/subscription-copy.ts).

BJ12. Every game reaches Stats (Today + All-time + recent) and Friends Moments; mode-consistency test (founder 10-03: "Make
sure the games all tie to stats and the Moments part too, so the recent history is always up to date … with all new games").
Audit of all 18 catalog games (+ Unlimited, VS people / bots) end to end: the writes (user_stats, daily_results, matches) and
the Stats picker / Today / All-time / recent-match chrome were already catalog-driven ×3, and the server allowlists (the
game_mode CHECKs on daily_results, matches, user_stats, daily_seeds; the plausibility floors; the daily-medals cron) hold every
mode. Gaps fixed: (1) the Perfect medal — the Moments "played a perfect …" row — was a hand-typed nine-word-mode switch on iOS
and Android, so no More Games puzzle ever earned one on a phone (prod: zero, against 86 qualifying results since 09-22); now one
shared rule ×3 (packages/core mode-coverage isPerfectDailyResult: the word modes' table, every More Games title at the
catalog's guessBase with every board solved) + docs/sql/20261003-more-games-perfect-medals-backfill.sql (not applied).
(2) Moments copy ×3 from one core headline (modeMomentHeadline): the More Games Sweep count from the catalog (was the literal
"all ten"), a puzzle record reads through its game ("Sudocious Fewest Mistakes · 0 mistakes", was "Fewest Guesses" on web and
iOS), "1 guess" not "1 guesses". (3) Stats VS boards ×3 include ProperNoundle (word games only before). (4) Recent history
never a game behind: web re-reads the Stats bundle on any recorded game (Unlimited / VS / bots, not only today's daily); iOS
Stats re-reads match list + totals on GameResultsService.gameRecorded; the profile matches API never serves a signed-in caller
a CDN copy (was up to 150 s stale right after a finish). (5) Android puzzle finishes flip only TODAY's card and keep the
recorded score (notePuzzleFinish; a cross-midnight puzzle marked today done and the score read 0). Tests: core
mode-coverage.test.ts (every mode in every generated catalog, a reachable Perfect, its Moments headlines, fixture freshness)
+ mode-coverage-fixtures.json pinned by iOS ModeCoverageFixtureTests and Android ModeCoverageFixtureTest; web
lib/mode-coverage.test.ts (recording call sites, recent-match chrome, format parity with core, feed wiring).

BJ13. Pocket-game friend picker = character-select grid under title art (founder 10-03: "I don't like the pick your opponent
look of the new game, can we make this a little more finished looking? I don't like the right arrows either"; "There shouldn't
be any plain text menus looking like this"; "as long as it fills out the space as it should, the icons look a bit spaced
apart"; built toward ChatGPT mockup docs/design/brand/menus/pick-friend-1.png, option 1). The quick-play sheet opened from a
game tile (no friend yet) ×3, on a calm lavender sheet (#f4f0ff; the play state keeps the Friends wash): the game's title art
spanning the sheet (art-titlecast-pocket-<kind> from titles/cast-colors/pocket-<kind>.png, all six shipped; a kind without
art would draw its name in the live title lettering, Friends palette), ONE rules line in dark ink from
core FRIENDLY_TARGET ("Best of 3 · first to 2", Call It "Best of 5 · first to 3", Word Chain "First to 30 points", Pass the
Puzzle "Six guesses, shared board"), then WHO ARE YOU PLAYING? in muted letter-spaced caps (per the mockup; the code would
take art-titlecast-pick-friend if shipped, but cast-colors/pick-friend.png reads PICK A FRIEND in big pink and would compete
with the game title, so it is not shipped). Under it the friends as a grid that fills the sheet — no list rows, chevrons, stripes or bordered card: 3 across on
phones, a 4th column once cells would pass 96 (wide web), gap 8, each friend's REAL avatar (the shared resolver + avatar
component: their mascot, photo or cast pick, never mockup art) as a tile filling its cell (≤ 124), the name (no @, one line,
dark ink) and one short status centered under it — "On now" in green with a soft green glow around the tile (no outline), else
"20 min ago" / "5 h ago" / "Played today" / the rivalry ("You lead 5–3") / "Away" in muted. Online first, then most recent,
then A–Z. Tap = squish, then the play state in the SAME sheet with the shared soft rise (MotionSpec rise: 0.96 → 1, up 14,
fade, 0.34 s on the expo curve; Reduce Motion a 0.22 s cross-fade); the sheet itself opens / closes with BJ10's soft pop (the
web friends Sheet gained the pop + quick reverse). iOS opens the picker at a height that shows the header + two full rows
(PickerGrid.twoRowHeight; medium for the empty state). No friends: I's invite scene (BrandEmptyState) ×3. Android now matches
iOS / web (a separate picker state; was a face strip above the full sheet). Title art is looked up BY NAME — iOS
ArtAsset.exists, Android getIdentifier (+ res/raw/keep_pocket_titles.xml), web lib/art.ts ART_SIZE — so shipping a new title is
a file drop (+ its ART_SIZE line on web, which art.test.ts enforces). Helpers + tests: web friends-play.ts kindRules /
pickerStatus / pickerGrid / pocketTitleArt (vitest), iOS FriendsKit.rules / pickerStatus / PickerGrid, Android FriendsKit
friendlyRules / pickerStatus / PickerGrid.
BJ14. Game open/close long frame (perf harness 10-03: every game open had ONE main-thread frame of 300–490 ms a few frames
after the tap; closes 64–219 ms). Cause, measured: (b) building the game hierarchy, not (a) the BJ9 transition. A/B with
`--flag noXition` (DEBUG: present the cover with no overlay and no custom dismissal) still stalls — Classic open 381 → 283
ms, OctoWord 574 → 413 — so the transition adds ~100 ms on top but is not the stall. A Time Profiler trace of the tour,
samples cut to each "hitch" signpost, puts the whole long frame inside ONE SwiftUI update (graph instantiation of the new
cover: GameScreen, BoardLayout / BoardView / GlossyTile bodies, KeyboardView / KeyCap, header); app-side setup
(GameViewModel.init, seed / solution pool, persistence) is ~1% of it. The close stall is the cover's teardown in
`completeTransition` at the END of the shrink (GameCoverDismissal finish closure), not the animation. Fix 1 (shipped iOS):
multi-board games build their mini boards two per run-loop turn under the overlay (BoardLayout.builtBoards; a pending slot
holds its exact cell size, so nothing shifts) — OctoWord open worst 574 / 491 → 212–223 ms, hitch 259 → 135–162 ms/s.
Owed: Classic-family opens (the single board + keyboard + header still build on one frame: stage the keyboard / header art a
turn later, or pre-instantiate a hidden GameScreen on Home idle), the close teardown (drop the game hierarchy a turn after
the shell lands, or in pieces), and the ~100 ms the overlay adds (window snapshot + flush). Target stays < 50 ms open and
close on Classic, OctoWord, Sudocious, Muddle, Crossword and a VS bot start.
BJ14 round 2: unplayed filler rows are ONE Canvas each (BoardView EmptyTileRow: the exact GlossyTile(.empty) geometry —
edge lip, face, ring, gloss — no letter), not N GlossyTile trees; real tiles stay for typed / revealed / masked rows, the
active row, and the zoomed OctoWord copy (it is scaled up, and a Canvas would blur). Classic empty rows at 3x match the old
pixels (mean diff 0.19/255, 0.13% of pixels > 8: antialiasing only). A/B in one build (`--flag noCanvas`): OctoWord open
328 → 165 ms cold / 202 → 204 warm, QuadWord 239 → 162 / 187 → 121. The first game opened in a launch carries a cold
~150–250 ms extra (first instantiation of the game view types); warm Classic open is 107–166 ms. The perf tour now zooms an
OctoWord mini board (octo.zoomIn / zoomType / zoomOut; `--flag slowZoom` for screenshots): worst 33–48 ms, none over 50; a
board still staging has no tap target, so it can't be zoomed into empty. Still owed: the warm ~110–330 ms open floor
(header / keyboard / page built on the presenting frame), closes (game teardown in completeTransition; an intermittent
~460–660 ms frame on Home re-entry after a finished game), and the overlay's ~100 ms.
BJ14 round 3 — the post-win close: timestamped marks (`-perfMarks <host file>`: steps, Home route, the close animator's
phases, long frames) showed the 200–660 ms frame was `fromView.snapshotView(afterScreenUpdates: false)` at the start of the
close — a synchronous render-server snapshot of the finished screen (~200 ms for OctoWord's recap) — not Home re-rendering
(the Home route itself took ~1 ms). The close now fades the LIVE game view, flattened by the render server
(shouldRasterize + group opacity for the fade only, so the board never shows through the win card mid-fade; checked in
burst screenshots); `--flag closeSnap` restores the snapshot for A/B. Closes: OctoWord 210–660 → 105 ms, Classic 464 → 50–71,
QuadWord 64, Sudocious 71, Muddle 54, Crossword 59, VS 33. The remaining close frame is the game's teardown inside
`completeTransition` (~45 ms + ~50 ms the next turn). Android: unplayed board rows are one Canvas (GameScreen EmptyTileRow,
the same drawGameTile paint; ProperNoundle's grouped rows keep TileViews).
BJ14 round 4: the open overlay is not the cost — beginOpen (Home snapshot + card lift + commit) measures 25 ms; the long
frame is the cover's build on the next turn. Classic-family games now (a) build the keyboard one run-loop turn after the
board, in a slot of its measured height (layout math before the first measure; `--flag noKeyStage` for A/B), and (b) warm
the board / tile / keyboard view types once, 1.5 s after Home settles: an offscreen UIHostingController (no window: no
onAppear, no first responder) around a VS stand-in view model (never touches solo persistence), released the same turn
(`--flag noWarm`). Classic first open (3 runs each): 309 → 297 (stage) → 245 ms (stage + warm); warm opens 116 → 98;
QuadWord 154 → 135 cold. Owed: Sudocious / Muddle / Crossword (270–360 ms, their own screens), the sharp OctoWord zoom
(needs a scale factor through GameTrayChrome + SolvedBoardFrame clamps to stay identical), the ~100 ms teardown on close.
BJ14 round 5 — CORRECTION: the round-4 warmup was removed. Event marks showed it built nothing (an offscreen
UIHostingController's layoutIfNeeded without a window is ~1 ms, no view graph), so its A/B "gain" was run-to-run noise.
Forcing the build (sizeThatFits) DOES instantiate the views, but then their onAppear fires even without a window (checked
with a DEBUG probe) — a whole game screen's onAppear would start its timer / ad gate / presence / VS start(), and each warm
cost a 100–260 ms frame on idle Home. Not safe, not cheap: no warmup. A real one needs views with no onAppear work (or a
"warming" environment flag every onAppear checks) — owed. Kept: the keyboard a turn after the board (exact slot).
Round-5 table: opens Classic 301 (first game of the launch), QuadWord 109, OctoWord 99, Sudocious 304, Muddle 323,
Crossword 324, VS bot start 214; closes 33–109 (Classic 50, OctoWord 109); OctoWord zoom worst 51 / 33 / 17.
BJ14 round 6: Sudocious / Muddle / Crossword keypads arrive one turn after the board (StagedSlot in GameScreen.swift: the
slot holds the keypad's last measured height, saved across launches; `--flag noKeyStage` for A/B). Three runs each, first
open: Sudocious 419 → 364 ms, Muddle 319 → 306, Crossword 297 → 283; burst screenshots show the cover's shell over the
staging turn and no layout shift after. A safe Classic warmup (board + keyboard sized offscreen around a VS stand-in, key
catcher disabled; the probe showed it really built: 24 ms, no Home hitch) did NOT help the first open (309 vs 266 ms, 3 runs
each) and added launch frames over 25 ms, so it was dropped: the first-open cost is not the view types a sized-but-unrendered
tree covers (layer / glyph / image work that needs a window). VS bot start not staged: its board appears inside the VS
screen with no overlay, so a keyboard-less frame would be visible. Full table: opens Classic 270, QuadWord 124, OctoWord
125, Sudocious 255, Muddle 248, Crossword 250, VS 210; closes 33–111.
BJ15. Cast-color buttons + art labels (founder 10-03; spec docs/design/brand/buttons/cast/README.md + labels.json). One shared
primary button per platform — iOS `CastButtonStyle` (CastButton.swift; `CandyLabel` switches to art inside it), Android
`CastButton` (ui/CastButton.kt), web `CastButton` / `CastLink` (components/ui/cast-button.tsx + app/cast-button.css). Skin =
art-btn-<color>-<s|m|l>[-pressed][-dark] three-slice (caps drawn as is, only the middle 1-px column stretches; web = CSS
border-image), s/m/l = 32/44/56 (old candy small/medium/large map to them). Label = the 39 ChatGPT/API labels shipped ×3 as
art-btnlabel-<slug> (buttons/labels/ship-labels.py: trimmed to the letters, normalized to 96 px tall; web ART_SIZE + Android
keep_night_art.xml updated), looked up by the label's letters, drawn at ONE cap height = 0.42 × h; the button widens to
label + 2 × max(0.6 h, 14 @44); a fixed-width slot shrinks the label (inset kept), never upscales. Shadow = the label alpha
in the color's deep hue, 1 pt down; gold adds the #9a5a00 55% amber halo. Dynamic text (names, prices, countdowns, CREATE
INVITE LINK, STARTS WITH…) = the live fallback: white Nunito Black at the same cap height (size = cap / 0.705), thin
same-hue stroke, soft same-hue shadow. Press = the -pressed skin + label drops 1 pt + the existing squish; dark = -dark
skins. Color: the screen's cast color (Go Pro gold, Friends/invite pink, VS blue, WOTD green, Stats slate; default purple);
old variants keep their meaning — amber → gold (Pro), peach (quiet) → slate, pink / teal kept. Old SF-symbol / outlined
glyph icons are dropped on cast buttons; 3D icons (crown, loop art) stay. Perf: iOS CastArt.prewarm (AppWarmup) decodes all
96 skins and pre-scales every label to its exact pixel height per size off main (drawn 1:1, no on-screen resampling);
Android CastArt.prewarm (App.onCreate, IO) decodes + pre-scales the same; web <CastArtWarmup/> decodes every skin + label
at idle in slices of 12. Swapped (first pass, highest traffic): finish card + finished screens, Home CTAs + header SIGN IN,
Go Pro / Pro identity / Pro welcome, Friends panel + invite sheet / panel / finish, VS lobby + live tile + challenges, WOTD,
onboarding / welcome / auth, sweep + achievement + streak-shield popups, mode-limit modals. Not swapped: icon-only round
buttons, toggles, segmented controls, system sheets, and the web friends/VS files with other agents' uncommitted work
(next pass). DEBUG iOS: `-bj15Screen finish|pro|invite|gopro` presents that screen (gopro = the Settings Go Pro card + every
color, light and dark) for headless screenshots.
BJ15 round 2 (coordinator 10-03): text links / tertiary / quiet actions are NEVER cast pills — Forgot password?, Sign up /
Sign in (the mode switch), Play without an account are brand-purple text links on all 3 (iOS TextLinkLabel, Android
TextLink, web TextLink / TextLinkA); quiet peach actions (Not now, Close, Skip, Maybe later, Let it reset, Restore
Purchases, Explore first, Come back tomorrow, Cancel, How to play, Sign out, See all…) went back to their previous candy
style; real secondary CTAs (Keep playing, New puzzle, Decline beside Accept, Copy) stay slate cast. Web round icon buttons
are never cast. Live-fallback cap ratio 0.705 → 0.75 (matches the art caps); Android live text + art labels scale down to
a narrow slot instead of clipping. A subtitle never goes inside the skin: Share results' "Next Classic in 4h 29m" is a
small muted caption UNDER the button (×3), and the label art keeps the normal cap height. Also swapped: web friends / VS
(primary only; peach + round untouched), Android PostGameScreen + the trailing-› CTAs (the › dropped). DEBUG iOS adds
`-bj15Screen share`.
BJ16. No plain-text menu headings (59 titles wired) (founder 10-03: "There shouldn't be any plain text menus"). The 59
cast-color heading titles (docs/design/brand/TITLE-INVENTORY.md, shipped ×3 as art-titlecast-<slug>) get ONE shared
component per platform: iOS `HeadingArt` enum + `HeadingArtView` (ArtKit.swift), Android `Heading` enum + `HeadingArt`
(ui/HeadingArt.kt), web `HeadingArt` + `HEADING_ART` (components/ui/heading-art.tsx). Size rule: popup / sheet titles 48 tall
(≤ 300 wide), two-line art (aspect < 3.2) × 1.3 so its letters match; nav bars 36, strips 26–36; the words stay the a11y
label (heading trait / role). Dynamic headings pick art per state (SOLVED! / NOT TODAY by result; WELCOME BACK! / JOIN THE
FUN! / RESET PASSWORD by auth mode; WELCOME TO PRO! / FREE WEEK OF PRO!; OVERVIEW / DAILY SWEEP) and keep the dynamic part
as a small sub-line (PLAYED TODAY + the game, LET'S PLAY! + @name, PRO PERK + the reason). Shared chrome gained a `heading`
slot: iOS MenuScaffold + VSNavBar, Android PageHeader + VsNavBar, web VsNav. Perf: drawn at display size (iOS ArtThumbs,
Android HeadingArtCache = inSampleSize + exact-pixel scale in its own 8 MB LRU, web plain <img> of the shipped webp); the
tap-presented titles are pre-decoded off the presenting frame — iOS HeadingArt.prewarm (AppWarmup), Android
HeadingArtCache.prewarm (App.onCreate, IO), web <HeadingArtWarmup/> (root layout, idle, 6 per slice). Tour titles: iOS
aligns to web / Android (DAILY GAMES, SCORE BIG, KEEP YOUR STREAK, PLAY TOGETHER). Quick wins: WELCOME! on the first-run
welcome, GO PRO on the reason-less Go Pro popup (web), STATS / LEADERBOARD above the signed-out pitch, VS BATTLE on the
Android live-search nav, SO CLOSE! on the Gauntlet loss. Round 2: header streak / flawless / shield popups (STREAK! /
FLAWLESS! moment art, SHIELDS where the popup is its own), Strategy VS tile (VS BATTLE), NUDGE! (taunt sheets, @name under),
ARCHETYPES, HEAD TO HEAD (+ "vs @name"), PODIUM, STREAK CALENDAR (web modal), ABOUT / SUPPORT info pages, NOT FOUND / OOPS!
(BrandEmptyState `heading`: web 404 + error page, profile / game not found), NEW PASSWORD, DAILY CHALLENGE (web landing),
ON A STREAK! (Pro prompt), PROFILE (web profile header), iOS level-up (LEVEL UP!), the VS countdown MATCH FOUND!. Auth
screen: the big WELCOME! + WORDOCIOUS / Daily Word Games lines are replaced by the Home cast header (the card's WELCOME BACK!
already greets — no duplicate); the first-run welcome keeps WELCOME!. Left as small in-card labels: the iOS streak popup's
SHIELDS section, TROPHY CASE, Edit Profile's MAKE YOUR MASCOT card. Web Leaderboard has no signed-out pitch (guests see the
board with its banner title). DELETE ACCOUNT: the web page wears it; iOS / Android use a system alert.
BJ17. Pro-locked stats: cast GO PRO invitation instead of blur (founder 10-03: "have ChatGPT design one of the mascots
saying go pro on the stats that are unavailable to them on the stat page. Instead of it being blurred out"; then "a few
different characters holding those signs up"). ART: all ten cast members holding the gold GO PRO lettering, art-gopro-sign-<id>
(w o1 r d o2 c i o3 u s; 480 wide) ×3, from the paid images-edit API with each hero + refs + titles/cast-colors/gopro.png
attached (docs/design/brand/scenes/raw/gopro-*-1.png); where the model misspelled or cropped the lettering (c, o3, r, s, d, o2)
scenes/gopro-sign/compose.py lays the canonical gopro lettering over the sign (characters untouched). Decoded at idle on all
three (iOS GoProSign.prewarm in AppWarmup, Android GoProSign.prewarm in App.onCreate, web CastArtWarmup). STATS: the old
ProLockOverlay (blurred sample radar / rivals / trend / insights behind a pill) is gone ×3 — no blur, no sample numbers. A
locked section keeps its header; in place of the stats ProStatsInvite shows a cast member with the sign, ONE line saying what
Pro unlocks there, and the gold cast GO PRO button (art-btnlabel-gopro) that opens the Go Pro flow. No box around it. One big
sign per page: Standing Trend (W) and Deep Insights (I) are full (116 pt art, line, medium button); Skill Radar (D) and
Rivalries (O2) are compact (60 pt art beside the line + small button). The free-tier PRO STATS locked box is hidden on iOS /
Android like web already did (Standing Trend's invitation above is the gate). FINISH UPSELL: for FREE players the Keep playing
· Unlimited card becomes the Go Pro upsell — the day's GO PRO sign character (a deterministic daily rotation through all
ten: n = year*372 + month*31 + day, mod 10; same formula ×3) in the 64 pt art slot, a gold tint, "Fresh puzzles anytime with
Pro", and the gold GO PRO cast button in place of Play / New puzzle + the PRO pill. Same height as before; Pro players see the
unchanged peach card. Guard: art.test.ts (every sign ships ×3, ten-day rotation, iOS/Android cast order + formula match).
BJ18. Release-gate polish (coordinator 10-03). Finish row: Share + Next keep ONE CastButtonRow line at phone width via the
short art labels SHARE (art-btnlabel-share; a11y "Share results", countdown caption still under it) and NEXT
(art-btnlabel-next, led by the next game's 3D icon; a11y "Next daily: <game>"), both medium ×3 (iOS NextDailyCTA's Next is
medium whenever Share rides beside it). DEBUG iOS `-bj15Screen share` shows SHARE+NEXT, SHARE+LEADERBOARD, SHARE+NEW PUZZLE.
Titles PLAY WITH FRIENDS (pink) + MORE (purple) via the API (raw/inv3-1, $0.07), split by finish-inventory.py, shipped ×3
as art-titlecast-playwithfriends / -more: the guest Friends GuestPitch draws PLAY WITH FRIENDS (GuestPitch `heading` slot
×3, 36 tall ≤ 320 wide, the words as a11y); Android's finished "More" sheet (FinishedSheet) wears MORE (iOS / web expand
"More" inline — no sheet title to replace). Home card names: ONE size per grid ×2 native (Android CardNameSizeScope, iOS
`.homeCardNames` + HomeCardSpec.uniformNameSize) — the largest ≤ 17 that fits the widest name in its slot, floored at 13,
then per-card shrink as the last resort. iOS tests: CastButtonStyle is a kit squish style (own 0.92 squish + pressed skin);
MotionSpec ignores `PerfTour.send(.sheet(...))` (a perf-tour command, not a presentation); StoreDemo's mascot page wears MAKE
YOUR MASCOT like OnboardingView.
