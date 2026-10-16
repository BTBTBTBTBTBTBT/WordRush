# Season Playbook — how we ship a season, end to end

Founder 10-16: "develop a roadmap on the whole process on how we do this … so when we continue on with our efforts on
the Christmas one, it would be a well oiled machine. Everything from the flow, to the image adjustments, share screens,
everything we are currently covering."

This is the operating manual. The technical how-to for each step (scripts, registry fields, file names) lives in
`README.md` in this folder; this playbook is the order, the full checklist, the quality bar and the lessons. Halloween
2026 is the worked example; Thanksgiving 2026 is where most lessons below came from. Keep this file current: every
season ends with a "Lessons" entry (bottom).

---

## 1. Timeline (count back from the season's first day, "D")

| When | What |
|---|---|
| D − 6 weeks | Founder picks the window (one source of truth: core `SEASON_WINDOWS`; social plan + README must match). Inventory diff vs the last season (§3). Kick off art (§4). |
| D − 5 weeks | Art round 1 done → quality review vs the last season (§5) → redo round. Walls drawn in code. |
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
**Walls (code-drawn, full resolution):** home, leaderboard, stats, friends, games — each phone + `-wide`. Same scene
quality as Halloween (sky, moon/sun + glow, flying silhouettes, horizon silhouette with a per-screen focal), calm
center/bottom, a lighter band where page titles sit.
**Cast:** all 10 cast skins + alts as INTEGRATED costumes (layered pieces fitted to the body, or a full on-model redraw);
header cast row; Home hosts (W, O1) in costume.
**Celebrations:** Home stage card art (Halloween = curtain stage; Thanksgiving = harvest barn stage) with the same pool
geometry; the costumed FLAWLESS scene (`scene-flawless-star`) and SWEEP scene (`scene-sweep-broom`); celebration extras
(burst, streamers, seal, floats) — floats sit beside the art, never on a mascot, never duplicating the scene's own prop.
**Extras:** candy buttons ×3, badges, streak flame, streak shield, tile theme, podium decoration, Dressing Room season
tab + shelf tag, props for day titles, mascot-maker pieces (optional, README step 8).
**System:** registry entry + window, surfaces palette (readability gate), theme row "Seasonal — <season>", ambient
animation (optional), widgets (iOS + Android, every size), season icon, splash color, store screenshots + text,
sounds (optional).
**Share cards:** automatic — the night share style uses the season's title art + cast; render every card kind in the
season AND in the standard look and archive them in the Art Library (§8).
**Social:** posts in the season's palette, holiday greeting posts (7 AM, mascot image), reveal post tied to the ship date.

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
   iOS art ships with lossy (HEVC) asset compression (`compression-type: lossy`) — visually identical, ~70% smaller;
   only the few fully-opaque backdrops stay lossless (the check script lists them).
6. Wallpapers are code (never upscale a ChatGPT image into a full-screen wall).

## 5. The quality bar (review before anyone sees it)

- **Side-by-side review** of every new asset against the last season's shipped one (contact sheets in
  `<season>/review-<date>/`, KEEP/REDO table + ready prompts in `REDO.md`). Be demanding.
- **No bolted-on accessories.** A hat/tail stuck on the hero is a REDO. The FLAWLESS witch-hat overlay (hat pasted on
  top of O2's heart sunglasses) is the cautionary example — season art carries its own headwear; the app never overlays
  a loose season accessory on a cast image.
- **Titles:** Halloween proportions (~830×200 for long titles, stacked lines when long — never thin wide strips that ship
  30% smaller), seasonal garnish on every title, one consistent rim color that stays readable on the season's walls
  (composite them on the walls to check).
- **Readability gate** for the palette (WCAG AA vs the real wall pixels).
- **Smoothness:** the perf gate on/off for the season (no new per-frame work; prewarm new art).

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
2. Founder previews in Settings → admin Season preview; JP too; feedback in the Art Library.
3. Approve in the Art Library → `ready: true` → season build → TestFlight + internal → founder green light → submit both
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
