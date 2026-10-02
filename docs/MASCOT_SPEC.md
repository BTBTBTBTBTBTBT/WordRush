# The WORDOCIOUS cast in the app (founder-approved 2026-10-02)

Founder: "that is our cast of characters … build out these characters into menu items that
will flow through wordocious flawlessly." Cast + logo: memory brand-mascots, sheet
`docs/design/brand/chatgpt/12-cast-final.png`. Parity on web, iOS and Android.

## 0. Assets (production art, transparent)

- Cast hero images: `docs/design/brand/cast/app/<id>.png` (512 px, trimmed, transparent),
  ids in WORDOCIOUS order: `w, o1, r, d, o2, c, i, o3, u, s`.
  - Web: `apps/web/public/mascots/<id>.png`.
  - iOS: image sets `mascot-<id>` in Assets.xcassets.
  - Android: `res/drawable-nodpi/mascot_<id>.png`.
- One shared component per platform: `Mascot(id, size, motion)` (motion: none | bob |
  pop | wave) and `CastRow(size, motion)` (the ten in order, spelling WORDOCIOUS).
- Every mascot image is decorative (hidden from screen readers). Respect Reduce Motion:
  no bob/pop/wave, static images only.

## 1. Who lives where (one host per page)

| Place | Character | Why |
|---|---|---|
| Home banner | W (the leader, cape) | the brand hero |
| Puzzles section header | C (the explorer) | curiosity |
| Word of the Day card | I (shy, with the sprout) | growing your words |
| Leaderboard banner | O2 (pink star, heart sunglasses) | the spotlight |
| All-time Records banner | O2 | same family as the Leaderboard |
| Stats header | D (brainy, glasses + pencil) | numbers |
| Friends banner | O1 (amber cheerleader, four arms) | social, cheering |
| VS banner + VS loading | S (the speedster) | racing |
| Empty states (nobody on, nothing yet) | R (sleepy, nightcap) | "quiet in here" |
| "All done for today / new puzzles in" | U (zen, floating) | calm, come back later |
| Pocket game wins (Friends) | O3 (the cyclops prankster) | playful |

## 2. Placement rules

- **Banners** (home, VS, Friends, Leaderboard, Records): the host stands at the right end
  of the frosted headline strip, 56 pt tall, overlapping the strip's top edge by ~12 pt so
  it "peeks" over the window; the headline text keeps clear of it (right padding). Idle
  `bob`: translateY 0 → −3 → 0 over 2.6 s, ease-in-out, forever.
- **Section headers** (Puzzles, Stats) and the Word of the Day card: a 28 pt mascot just
  left of the section label, static.
- **Empty states**: 96 pt mascot centered above the empty-state line, `bob`.

## 3. Moments

- **Loading** (VS loading screens and any app-level loading screen that shows a mode
  name): the `CastRow` at 22 pt per tile doing a staggered wave: each tile hops 8 pt with
  a 70 ms stagger, 1.1 s loop. It replaces the spinner; the `LOADING <MODE>` label stays.
- **Daily win / victory screen** (solo games): above the VICTORY headline, a random cast
  member (seeded by the date + mode so it's stable for the day) `pop`s in: scale 0.6 →
  1.08 → 1 over 420 ms with a 12° wiggle, 88 pt.
- **Sweep / Flawless celebration** (the home banner turning purple/gold and the sweep
  celebration modal): the whole `CastRow` jumps in a left-to-right wave (each tile 14 pt
  hop, 60 ms stagger), twice, over the existing confetti. Flawless: W gets a small gold
  crown drawn in code (a simple rounded 3-point crown shape, `#f59e0b`, on top of W's tile).
- **Loss screen**: R at 80 pt, static, above the result.
- **VS result**: YOU WIN → S `pop`; you lose → R static; draw → U.
- **Friends pocket game result**: win → O3 `pop`; loss → R.

## 4. Not in this pass

The logo / app icon (logo I is drawn and parked in docs/design/brand/logo/, founder: "don't worry about the logo stuff for now").

Keep every behavior, query and navigation unchanged; this is art + motion only.

## 5. Every game has a host (founder: "game titles too")

One host per game, chosen to fit the game. A host can host more than one game.

| Game | Host | Why |
|---|---|---|
| Classic | W | the original, the leader |
| Gauntlet | S | endurance and speed |
| QuadWord | O1 (amber, four arms) | four arms, four boards |
| OctoWord | D | big brain for eight boards |
| Succession | I | grows one step at a time (the sprout) |
| Deliverance | C | the explorer on a rescue mission |
| Classic Six | O2 | the star of the bigger stage |
| Classic Seven | U | calm under the longest words |
| Sudocious | U | zen logic |
| Muddle | R | groggy, everything's muddled |
| Hubbub | O1 | all the words at once |
| Crosswordocious | D | glasses and a pencil |
| Kindred | O2 | heart sunglasses, connections |
| Letter Ladder | I | tall, climbing |
| Codebreaker | C | the detective |
| Spyglass | O3 (cyclops) | one big eye = a spyglass |
| Starsweep | S | the gold star |
| ProperNoundle | W | proper names, the leader |

Put the mapping in ONE shared table per platform (web `lib/mascots.ts`, iOS `Mascots.swift`,
Android `ui/Mascots.kt`) keyed by the mode db key, and use it for:
- **Game screen title**: a 30 pt host standing at the left of the game's title in its header,
  static (no motion during play).
- **Victory**: the game's host `pop`s above VICTORY (instead of a random member).
- **How to play / guide sheet** for the game: the host at 72 pt at the top, `wave`.
- **Leaderboard Play card**: the selected game's host at 44 pt inside the card, right side.

## 6. Personality touches (keep each to one short line)

- Empty states get a host + a one-line "says" voice, e.g. R: "Nobody's on yet. Wake the
  crew with an invite."; U: "All done for today. Fresh puzzles in 2:06:43."; I: "Add a
  friend and the race begins."; D (Stats, no games yet): "Play a game and I'll crunch the numbers."
- Page titles (menus) incorporate their host: VS BATTLE (S), FRIENDS (O1), the Leaderboard
  day title (O2), ALL-TIME RECORDS (O2), STATS (D), plus Settings (R, relaxed), the Pro page
  (W with its cape, "GO PRO"), Help / Guides (C). The host stands beside or leans on the
  title, 40–56 pt, `bob` where the page isn't a game.
- Offline / error screens: R with "Lost the connection. Give it a sec." Web 404: O3 with
  "Couldn't find that page."
- Loading tips: under the CastRow loader, an optional rotating tip voiced by D (5 short,
  real tips, e.g. "Tip: start with a word that has three vowels.").
- Copy rules: American spelling, no free text from users, short, warm, never mean.
