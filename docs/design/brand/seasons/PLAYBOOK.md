# Season Playbook — how we ship a season, end to end

Last updated: 2026-10-16

Founder 10-16: "develop a roadmap on the whole process on how we do this … so when we continue on with our efforts on
the Christmas one, it would be a well oiled machine. Everything from the flow, to the image adjustments, share screens,
everything we are currently covering."

This is the operating manual. The technical how-to for each step (scripts, registry fields, file names) lives in
`README.md` in this folder; this playbook is the order, the full checklist, the quality bar and the lessons. Halloween
2026 is the worked example; Thanksgiving 2026 is where most lessons below came from. Keep this file current: every
season ends with a "Lessons" entry (bottom).

## 0. Season tracker (one table per season — the single place to see where it stands)

Update it whenever an item moves. Status words: **todo** · **made** (art/code exists) · **in preview** (visible in
Settings → admin Season preview) · **approved** (founder + JP, Art Library) · **shipped** (in a store build / live).
"Art only" = the art exists but the app has no slot to show it yet (needs wiring).

| Item | Halloween 2026 | Thanksgiving 2026 | Winter holidays 2026 |
|---|---|---|---|
| Window + registry entry (`ready`) | shipped (live Oct 9–31) | in preview (`ready: false`, Nov 14–29) | todo (drafts only) |
| Walls, every page, ×4 times of day | shipped (2.9) | in preview | made (night v2 only) |
| Titles (games, pages, VS, pocket games, Unlimited) | shipped | in preview (30) · art only: Happy Thanksgiving, Give Thanks, Gobble Gobble, dailies-alt1 | made (25 redone) |
| Cast skins (10, integrated costumes) | shipped | in preview | made (I + O2 redone) |
| Home stage card ×4 times | shipped (2.9) | in preview | todo |
| Podium stadium ×4 times (shared) | shipped (2.9) | shipped (shared art) | shipped (shared art) |
| Flawless + Sweep costumed scenes | shipped | in preview | made (round 1) |
| Ambient flyers (bats / geese) | shipped | in preview (geese flock) | todo |
| Props for day titles | shipped | in preview (10) | made (inclusive set) |
| Extras: candy buttons, badges, streak flame/shield, tile theme, podium decoration, Home hosts | **art only** (never wired) | **art only** (6 buttons, 2 badges, flame, shield, tile, podium, hosts) | todo |
| Dressing Room tab + tag | shipped | in preview | todo |
| Songs + secret achievements + moment badge | shipped (7 tunes + Spooky Season) | in preview (4 tunes + Harvest Feast, badges made) | planned (SONGS-ACHIEVEMENTS.md) |
| Palette + readability gate ×4 times | shipped | in preview | todo |
| Share cards rendered + archived (season + standard) | made (archive owed) | todo | todo |
| Widgets, season icon, splash, store screenshots/text | shipped | todo | todo |
| Social: greeting posts + season reveal | shipped | planned (Nov 26 greeting) | planned (block 2: Hanukkah, Christmas, Kwanzaa) |
| Founder + JP approval in the admin preview | done | **pending** | todo |
| Season build (store) | 2.8 → 2.9 | due ~Nov 6–9 | due ~Nov 13 |

---

## 1. Timeline (count back from the season's first day, "D")

| When | What |
|---|---|
| D − 6 weeks | Founder picks the window (one source of truth: core `SEASON_WINDOWS`; social plan + README must match). Inventory diff vs the last season (§3). Kick off art (§4). |
| D − 5 weeks | Art round 1 done → quality review vs the last season (§5) → redo round. Walls drawn in code. **Songs + achievements** (§3 System): pick the season's public-domain tunes, verify each one's PD status, check its notation against a score, wire the batch ×3 with its secret achievements + the season's moment badge; badge art prompts queued. |
| D − 4 weeks | Code: registry entry (`ready: false`), palette + readability gate, any new slot generalized (§6). Art shipped into the bundles for the ADMIN preview only. |
| D − 3½ weeks | Founder + JP review in Settings → admin Season preview on iPhone, iPad, Android, web; feedback → fixes. |
| D − 3 weeks | Approve in the Art Library. Season build cut: TestFlight + Android internal → founder test. |
| D − 2½ weeks | Submit iOS (auto-release, expedite only for real bugs) + paired Play production. Season build must be LIVE ≥ 2 days before D. |
| D | The clock turns it on. Social: holiday greetings 7 AM, season reveal post. |
| D + window | Watch feedback; small fixes ride the next build. |
| Last day + 1 | Clock turns it off. **Never flip the `season_halloween` flag off** — it gates every season. |
| ~Last day | The "revert" build already submitted: normal app icon, normal launch/splash color, normal store screenshots + text (iOS needs a version; Play listing anytime). |

Store review can take 1–3 days; Halloween 2.8 needed two builds. Always leave a full rebuild of slack.

## 2. Who does what (agents + founder)

- **Founder:** picks the window, approves designs (mockups → admin preview → Art Library), green-lights store submits.
- **Lead (me):** plans, splits work, reviews every image and render personally, commits, ships, keeps the bible.
- **Agents (time-boxed ~45–75 min, report back):** ChatGPT runners (efficient model; cast work on a stronger model),
  a quality reviewer (side-by-side vs last season), a code agent per concern, a parity checker. Max 3 builders at once
  (build lock `scratchpad/build.lock`, one simulator), read-only agents can run alongside; background disk watch
  (`scripts/wait-for.sh`), keep ≥ 12–15 GB free.
- **Images:** ALWAYS the free ChatGPT in the founder's MacBook Chrome (never the paid API unless he says so; never the
  Windows PC). Multiple tabs in parallel (4–6). One download per tab.

## 3. The full kit — inventory checklist (diff against the last season before starting)

Every surface Halloween changed needs the new season's version. Missing = falls back to normal (no holes), but the
founder's bar is "every screen and game wallpaper that has adjusted and designed for Halloween needs a version".

**Titles (bubble lettering, one family):** every game (Classic, Six, Seven, QuadWord, OctoWord, Gauntlet, Succession,
Deliverance, ProperNoundle, Starsweep, Sudocious, Crosswordocious, Kindred, Spyglass, Hubbub, Muddle, Letter Ladder,
Codebreaker), every POCKET game (Rock Paper Scissors, Tic-Tac-Tile, Call It, Pass the Puzzle, Ghost, Word Chain), VS
Battle, Unlimited, pages (Dailies + alt, Puzzles, Leaderboard, Stats, Friends, Word of the Day), "HAPPY <SEASON>" + alt,
2–3 labels (e.g. GIVE THANKS / GOBBLE GOBBLE).
**Time of day (founder 10-16: "different wallpapers to match the time of day"):** every season's walls come in four
looks from the same scene — MORNING (sunrise), DAY (blue sky), EVENING (golden dusk, windows glowing), NIGHT — picked
from the player's local clock (proposed: morning 5–10, day 10–16, evening 16–19, night 19–5) with a slow crossfade;
a static image swap only (no per-frame cost). Daytime skies are bright, so the readability gate must pass for each
time (light cards or a soft scrim in daytime — decided from the mockup in `seasons/time-of-day/`). The code-drawn
wall engine takes a time-of-day parameter; never fork the script per time. The Home STAGE card (and any full-bleed art window that sits on the wall) gets four CUSTOM time-of-day designs made in ChatGPT from the night original (same camera + layout, re-lit and re-designed for sunrise / daylight / golden hour — a code color-grade was rejected as 'faded copies', founder 10-16), then ALIGNED with `seasons/time-of-day/stage/align-stage.py` so the three spotlight pools land on the night version's pixels (≤ 6 px) and the animated cast still stands in them. Flyers (bats, geese …) are never painted into a wall: they are the living-wallpaper ambient layer, animated like the Halloween bats. **Every page, every window, every button:**
tinted per time of day from the same sky (the registry `surfaces` palette gets a per-time override, crossfading with
the wall); readability gate per time; no surface or button color that clashes with its wall. The pages must read as
one finished product at every hour (founder 10-16: "the windows on all the pages are clashing").
**Walls (code-drawn, full resolution):** home, leaderboard, stats, friends, games — each phone + `-wide`. Same scene
quality as Halloween (sky, moon/sun + glow, flying silhouettes, horizon silhouette with a per-screen focal), calm
center/bottom, a lighter band where page titles sit.
**Cast:** all 10 cast skins + alts as INTEGRATED costumes (layered pieces fitted to the body, or a full on-model redraw);
header cast row; Home hosts (W, O1) in costume.
**Celebrations:** Home stage card art (Halloween = curtain stage; Thanksgiving = harvest barn stage) with the same pool
geometry; the costumed FLAWLESS scene (`scene-flawless-star`) and SWEEP scene (`scene-sweep-broom`); celebration extras
(burst, streamers, seal, floats) — floats sit beside the art, never on a mascot, never duplicating the scene's own prop.
**Extras:** candy buttons ×6, badges, streak flame, streak shield, tile theme, podium decoration, Home hosts, Dressing Room
season tab + shelf tag, props for day titles, mascot-maker pieces (optional, README step 8). **Status 10-16: the candy
buttons, badges, streak flame/shield, tile theme, podium decoration and Home hosts are ART ONLY for every season** — the
apps have no slot that shows them (found while wiring Thanksgiving). Wiring them = one generalized registry slot per
extra on iOS, Android and web, Halloween's values first (queued for the week of Oct 19, before Thanksgiving goes live).
Until a slot exists, don't count an extra as done — the tracker says "art only".
**System:** registry entry + window, surfaces palette (readability gate), theme row "Seasonal — <season>", ambient
animation (optional), widgets (iOS + Android, every size), season icon, splash color, store screenshots + text,
sounds (optional).
**Songs + achievements (founder 10-16: "a natural part of the seasonality roadmap"):** a batch of public-domain tunes for
the musical cast that only count in the window (core `musical-cast.ts` SEASON_MELODIES[<season>], Swift
`MusicalCast.seasonMelodies`, Kotlin `MusicalCast.SEASON_MELODIES`, parity fixtures), one SECRET achievement per tune
(`secret(...)` in `achievement-rules.ts`, listed only once unlocked) and one seasonal moment badge ("Finish a daily
during the <season> season", `momentAchievements`, gated by `currentSeason` so `ready` is respected; the admin preview
passes the season id). Halloween = 7 tunes + Spooky Season; Thanksgiving = 4 tunes wired (Simple Gifts, We Gather Together, Come Ye Thankful
People Come, Now Thank We All Our God — each checked against two published PD scores) + 3 parked in THANKSGIVING_TUNES_TODO
+ Harvest Feast (`thanksgiving/NEEDS-BADGES.md`); winter = `winter-holidays/SONGS-ACHIEVEMENTS.md`. A short list of
verified tunes beats a long list of guesses: if no PD score can be found (or the tune leaves the cast's range), the tune
stays parked — never transcribe from memory. The portal's Sound Library › Secret songs shows them by season.
Quality bar: (1) PD verified for the melody AND any words shown (composer/lyricist dates; 1927-era songs like "I Have a
Little Dreidel" are NOT safe), never a recording or a copyrighted arrangement; (2) every note on the cast's white keys
C4–E5 (realize by interval shape; a natural may stand in for a sharp as in Halloween's G-for-G#), notation checked
against a score, never from memory (unchecked tunes wait in the season's TUNES_TODO list, which the test pins); (3) no
tune's shape is a prefix of or contained in another's (musical-cast.test.ts); (4) each achievement is reachable inside
the window and its badge art (`art-ach-<key>`) falls back to the category icon until it ships; (5) the copyrighted
no-go list for the season is named in the test. Optional: a seasonal voicing (`note-<x>-<id>` samples + registry
`sounds.note` + SEASON_NOTE_PREFIX ×3; iOS checks every sample ships) and an intro jingle the founder hears first.
**Share cards:** automatic — the night share style uses the season's title art + cast; render every card kind in the
season AND in the standard look and archive them in the Art Library (§8).
**Social:** posts in the season's palette, holiday greeting posts (7 AM, mascot image), reveal post tied to the ship date. Full social operating manual: [`docs/marketing/SOCIAL-PLAYBOOK.md`](../../../marketing/SOCIAL-PLAYBOOK.md).

## 4. Making the art (ChatGPT pipeline)

1. Prompts always attach references: the last season's counterpart (composition), `cast/hero/<id>.png` (+ costume art)
   for any character, 1–2 approved titles of the new season (family style).
2. One subject on a perfectly flat `#00FFFF` (or `#FF00FF` for teal/blue/green subjects), no shadow on the background,
   exact words, no extra text. Full-bleed art (stage cards, scenes with backgrounds) keeps its own background.
3. Cut out with `python3 docs/design/brand/key-capture.py <raw> full cyan <out> native-all` (titles keep native size).
4. Vet every image: spelling letter by letter; palette; clean edges (no fringe); characters vs hero — shape, colors,
   face, eyes, mouth, brows (S determined angled brows; W always friendly); costume ON the body.
5. Log every kept file + prompt (`<season>/NEW-<date>.md`).
   Runner safety: NEVER click ChatGPT's Share button (it makes a public link) — find "Download" by its accessible name
   and click by ref after a screenshot; clear the prompt box before each prompt (drafts carry over between tabs).
   iOS art ships LOSSLESS (10-16 rollback): lossy HEVC turned the button gloss maps into an opaque white haze over every
   keyboard key in 2.9 (265) — 'unreadable, unplayable'. Never switch image compression/formats without on-screen checks of
   a game keyboard, candy/quiet buttons, a finish screen and the mascot maker, at night and day.
6. Wallpapers are code (never upscale a ChatGPT image into a full-screen wall).
7. **Every new image, from day one (founder 10-16):** (a) anything that sits on a wall — walls, the Home stage card, any
   full-bleed window art — is made in all FOUR times of day (morning / day / evening / night) in the same round, never
   added later; full-bleed art = custom ChatGPT designs per time from the night original, aligned with
   `time-of-day/stage/align-stage.py` (never a code recolor); (b) every image ships through the repo ship scripts
   (`ship-art.py`, `ship-cast.py`, `ship-seasonal.py`), which re-apply the app-size compression policy
   (`scripts/ios-asset-compression.py`; the asset-size guard test fails CI if an imageset is missing it); (c) flyers and
   anything that moves are ambient layers, never painted into a wall.

## 5. The quality bar (review before anyone sees it)

- **Side-by-side review** of every new asset against the last season's shipped one (contact sheets in
  `<season>/review-<date>/`, KEEP/REDO table + ready prompts in `REDO.md`). Be demanding.
- **No bolted-on accessories.** A hat/tail stuck on the hero is a REDO. The FLAWLESS witch-hat overlay (hat pasted on
  top of O2's heart sunglasses) is the cautionary example — season art carries its own headwear; the app never overlays
  a loose season accessory on a cast image.
- **Titles:** Halloween proportions (~830×200 for long titles, stacked lines when long — never thin wide strips that ship
  30% smaller), seasonal garnish on every title, one consistent rim color that stays readable on the season's walls
  (composite them on the walls to check).
- **Readability gate** for the palette (WCAG AA vs the real wall pixels), **per time of day**: every page, every
  window, every button is tinted from that time's sky; no surface or button color that clashes with its wall; the
  gate is measured on the composited card-over-wall pixels for morning, day, evening and night.
- **Smoothness:** the perf gate on/off for the season (no new per-frame work; prewarm new art). Run the core tour A/B vs
  the live build on a quiet machine (`-perfTour -perfTourOnly home,tabs,leaderboard,stats,friends,season`, 2 runs each)
  at a non-night time too: 10-16 it caught `season.toHome` ~3× slower — the Home stage drew `Image(name)` as an
  invisible placeholder, decoding the full art on the main thread for every new time-of-day stage.
- **On-screen checks before any build:** look at a game keyboard, candy + quiet buttons, a finish screen, the mascot
  maker and Home on iOS, Android and web, at night and in daytime, in the season and in the normal look. 10-16 an
  image-compression change passed every test and the perf gate but made the keyboard unreadable — only eyes catch that.

## 6. Code steps (see README "How to add a season")

Window row ×3 + fixtures → registry entry with `ready: false` (public never sees an unready season; the ADMIN preview
always does) → surfaces palette → theme registry row → any Halloween-only path generalized to a registry slot (stage card,
celebration scenes, widgets) → ship art with the repo scripts (`ship-art.py --seasons`, `ship-seasonal.py`) →
`season-preview-wired.json` → flip `ready: true` once approved. Every change on iOS, Android and web in the same batch
(parity rule; iPad sizes and the website layout are intentionally different).

## 7. Review, approval, release

1. Sim captures of every surface in the season (`-debug-season <id>`, `-storeDemo -storeShot …`): Home (idle + stage),
   every game title, finished screens, Flawless + Sweep celebrations, Leaderboard podium, Friends, Stats, Settings,
   Dressing Room, widgets; iPad + Android + web. Look at every one.
2. Founder previews in Settings → admin Season preview; JP too; feedback in the Art Library. Use the **Time of day**
   picker (Auto / Morning / Day / Evening / Night) under it to check every time — walls, windows, buttons, stage and
   podium — before approving.
3. Approve in the Art Library → `ready: true` → **release gates: full test suites ×3, the core perf tour A/B vs live
   (PASS), the on-screen checks (§5)** → season build → TestFlight + internal → founder green light → submit both
   stores (auto-release) → bible entry.

## 8. Share cards (night style, 10-16)

The share renderers are season-aware (title art + cast). For every season: render all card kinds (leaderboard with
podium, finished-game for every game in both spoiler variants, Sweep, VS, Records, Friends race, profile, moments) in the
season and in the standard look, check them, and archive them in the Art Library under `share/<season>/`. Cards stay
within 4:5–3:4 (iMessage crop), wordocious.com clearly readable under the cast.

## 9. End of season

Revert build already in review (icon, splash color, store screenshots/text). Leave the season flag ON. Saved seasonal
mascot items stay on players' mascots; the seasonal shelf disappears by itself.

## 10. Lessons log

- **Halloween 2026:** layered costumes keep faces exact; code-drawn walls beat upscaled ChatGPT art; the splash color
  can't check the date (needs a revert build); a flag that gates every season must never be used to end one.
- **Thanksgiving 2026 (10-16):** started late — the in-app season had no window, no registry row and no shipped art two
  weeks before the deadline (the social plan was ready; the app wasn't): start at D − 6 weeks. First-pass costumes were
  hero + one bolted-on piece (34 of 71 assets redone); walls were a gradient with icons (redrawn to Halloween's scene
  quality); Halloween-only paths (Home stage card, celebration scenes) had to be generalized into registry slots; the
  Flawless/Sweep overlays clashed with the mascots (hat on sunglasses, a second broom) → costumed scenes + floats beside
  the art; titles' brown rim vanished on dark walls → title band on the walls; pocket-game, VS and Unlimited titles had
  never been made for any season.

- **Winter holidays 2026 (10-16, early start):** first drafts had ZERO Hanukkah/Kwanzaa elements and bolted-on hats —
  the inclusivity rule must be in every prompt and checked in review; costumes now spread across the three holidays
  (Christmas cast, a Hanukkah dreidel sweater + gelt, a Kwanzaa kente sash + kinara), props verified (9-branch menorah
  with raised shamash, nun/gimel dreidel, 3-1-3 kinara).

## Next: Winter holidays (Dec 1–26) — kickoff checklist

D = Dec 1 → start art NOW (D − 6 weeks = Oct 20), approve by ~Nov 9, season build submitted by ~Nov 13 (it can be the
same build as any Thanksgiving follow-up), live by Nov 28. Inclusive rules in README (Christmas + a real share of
Hanukkah + Kwanzaa sprinkled in; objects/food/light/color, never religious garments as costumes; Hanukkah 2026 starts the
evening of Dec 4). Existing drafts: `winter-holidays/` (cast, pieces, props, titles, walls) — run §5 on them first.
Then New Year (Dec 27 – Jan 2) right behind it.
