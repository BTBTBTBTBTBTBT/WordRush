# Art Playbook: how we make, check, compress and ship Wordocious art

Last updated: 2026-10-16

Every rule here came from a founder decision or a miss we paid for (dated in the Lessons log). It applies to every
image in the product: the cast, poses, titles, buttons, icons, walls, stages, mascot-maker parts, season kits, store
shots and social posts. The Season Playbook (`docs/design/brand/seasons/PLAYBOOK.md`) and the Social Playbook
(`docs/marketing/SOCIAL-PLAYBOOK.md`) build on this one; when they say "the art rules", they mean this file.

## 0. The ten rules that never bend

1. **The ten cast members always look, sound and act like themselves.** Attach `cast/hero/<id>.png` to every prompt,
   compare side by side, reject anything off-model. W is always friendly.
2. **Free ChatGPT in the browser, always.** The paid image API only when the founder says so for that job.
3. **Design first, then build.** New menus, titles, buttons and screens are designed in ChatGPT and shown before
   they are wired.
4. **Nothing bolted on.** Art reads as one composed scene: shared floor, contact shadow, overlap, same light.
5. **No outlined boxes.** Separate with space, size, color and weight.
6. **Readable everywhere:** light and dark, every season, every time of day.
7. **Smooth beats pretty.** If art costs frames, simplify it; pre-decode anything new.
8. **Lossless by default.** No compression or format change ships without eyes on the screens (section 6).
9. **Parity ×3.** Every piece ships to iOS, Android and web in the same batch.
10. **Look before "done".** No art is reported finished without a viewed screenshot of every state it touches.

## 1. Where art lives

| What | Where |
|---|---|
| Source of truth for design art | private repo `wordocious-art` (by type and season, `manifest.json`); `sync.mjs` uploads to the Supabase bucket `art-library` and upserts `public.art_assets` |
| Review | wordocious.com/admin/art (this page): sections, Grid / Before & After, In app preview, Picks, Open feedback |
| Canonical cast | `docs/design/brand/cast/hero/<id>.png` (+ `refs/`, `poses/`) |
| Specs | `docs/ART_SPEC.md` (sizes, slots), `docs/ART_PLAN.md` (pipeline), `docs/design/brand/TITLE-INVENTORY.md` (every title) |
| Seasons | `docs/design/brand/seasons/` (`manifest.json`, per-season cast / titles / props / walls / extras, `README.md`) |
| Social | `docs/design/brand/social/jp45/` (`STYLE.md`, `compose.py`, `scene.py`) |
| What is live in the season preview | `apps/web/lib/admin/season-preview-wired.json` (shows LIVE IN PREVIEW here) |

After every art session: add the files to the art repo, rebuild the manifest, sync, and point the founder at this
page. Galleries are secondary.

## 2. Making art (ChatGPT pipeline)

1. **References on every prompt:** the hero for each character in the image, the counterpart we already shipped
   (composition), and 1–2 approved pieces of the same family (style).
2. **One subject per prompt** with its full feature checklist (section 3). ChatGPT cannot hold the whole cast in one
   image: compose group pieces in code from single-character art.
3. **Prefer layering over redrawing.** ChatGPT draws costume pieces or props on transparent; code composites them
   onto the canonical hero. A full redraw only when the silhouette must change, and it passes the face check.
4. **Flat key backgrounds:** cyan `#00FFFF` by default; magenta `#FF00FF` for teal, blue or green subjects; green
   for purple props. No shadow on the background, exact words, no extra text. Cut out with
   `python3 docs/design/brand/key-capture.py <raw> full cyan <out> native-all`.
5. **Resolution:** browser captures top out around 450–800 px wide. ChatGPT is for lettering, characters and small
   art. Wallpapers and other full-screen art are drawn in code at full resolution; never upscale a capture.
   Downloaded ChatGPT originals (about 1536 px) are fine for social scenes and stage cards.
6. **Four times of day from day one:** anything that sits on a wall (walls, the Home stage, full-bleed window art) is
   made for morning, day, evening and night in the same round. Stage cards are custom ChatGPT designs per time from
   the night original, aligned with `seasons/time-of-day/stage/align-stage.py`. A code recolor reads as a "faded copy".
7. **Moving things are layers.** Flyers (bats, geese), sparkles and anything animated are ambient layers in code,
   never painted into a wall.
8. **Animation = puppet rigs cut from the approved art** (arm, cape, eyes cut in code; ChatGPT only fills hidden
   areas), animated in code. Never per-frame ChatGPT flipbooks; they drift. The rest pose pixel-diffs against the hero.
9. **Runner safety:** never click ChatGPT's Share button (it makes a public link). Find Download by its accessible
   name and click by ref after a screenshot. Clear the prompt box before each prompt. Log every kept file and its
   prompt (`<folder>/NEW-<date>.md`). Move downloads out of ~/Downloads and delete what is not kept; watch free disk.

## 3. The cast: on-model checklist

Chubby glossy letter tiles, clean minimal faces (dot eyes, small mouths), stubby arms and feet, no sparkles. One big
feature each:

| Cast | Color | Must have |
|---|---|---|
| W (Webster) | purple | tiny cape; confident but **always friendly** (no angry brows); never the old w-cheer / w-lean poses |
| O1 (Ollie) | amber | FOUR arms, purple pom-poms; bubbly |
| R (Rip) | slate | nightcap; sleepy and chill |
| D (Dewey) | blue | round glasses, pencil; brainy |
| O2 (Opal) | pink | heart sunglasses on top, no other props; dramatic star |
| C (Cosmo) | teal | the C's opening IS the mouth: clean white C, one or two rounded snaggleteeth, no dark interior or tongue |
| I (Ivy) | green | tall, two-leaf sprout, blushing, shy wave |
| O3 (Ozzy) | orange | cyclops: the eye is the O's hole, small tongue, nothing white below |
| U (Umi) | violet | floats, no feet, eyes closed; zen |
| S (Scoot) | gold | headband, sneakers, motion lines, determined angled brows |

**Face check on every image:** eyes, mouth and teeth, brows, and the letter itself, against the hero. Costumes sit ON
the body. A hat or tail stuck on top is a redo (see the FLAWLESS witch-hat lesson).

**Variety:** on one screen or card, never the same character twice. Secondary spots (share footers, popups, empty
states) use a different character from the page host. In-app avatars are always the real renderer, never a mockup.

**Mascot maker parts** sit on the body: front/back layer split (straps in front, pack behind), hand-over layer,
contact shadow, per-body anchors and scale, never over the face or letter. Every part gets a looked-at "worn, not
bolted" check on all bodies (`avatar/fit-check.py` + eyes). Necklaces drape as a U under the mouth; capes hang
behind with at most a small clasp.

## 4. Look and feel

- **Lettering:** the house title style (soft bubble lettering, lavender gradient, cream rim, footer-level gloss). No
  generic flourishes, no new fonts. Game titles in the game's own color. Page titles run edge to edge on the wall,
  with no box, stage or float animation.
- **Color:** menu and button colors are the cast body colors with deeper same-color rims. Pastels read "too
  Easter-y"; don't over-pink.
- **Tiles:** the glossy family. Right spot purple (no gold rim), wrong spot gold, absent slate gray. Frosted empty,
  white typed with a purple border.
- **Numbers:** soft rounded Nunito Black in dark purple. Never gradient or gold digit art.
- **Buttons:** every button is the ChatGPT button family (candy / quiet / round icon / keycaps), sized to its label,
  with a real 3D icon. Header icons are the soft 3D family with no circles or bubbles.
- **No outlined boxes** around streaks, stats or timers. Not-done states use pale fills, never outlines.
- **Compact and symmetric:** cards hug their content, layouts mirror on the center line, nothing is shown twice.
- **Calm backgrounds:** floating tiles are few, small and faint, never behind boards, cards or text, and static in
  games.
- **No placeholder states:** empty, signed-out, error, loading and no-results states each get a cast pose, a lettered
  headline, one line of copy and a candy button. A system icon or bare spinner is "unfinished".
- **Legibility:** list names in plain heavy type; dark and season boards mix 65–80% over the surface (30–40% reads
  "faded"); hint buttons on dark use gold outline circles; ruled-out keys are dark, recessed dead keys.
- **Copy inside art** uses American spelling.

## 5. The quality bar (before anyone sees it)

1. Vet every image: spelling letter by letter, palette, clean edges (no key-color fringe), the cast face check,
   costume on the body.
2. Contact sheet side by side with what it replaces (Before & After on this page). Be demanding; log KEEP or REDO with
   a ready prompt.
3. Composite it where it lives: titles on their walls, buttons on their cards, at night and in daytime, in season and
   in the normal look.
4. **Composition gate:** every new screen ×3 is screenshotted and anything that looks pasted on is redone.
5. **Readability gate:** WCAG AA against the real composited pixels, per time of day and per season.
6. **Smoothness gate:** new art is pre-decoded or cached so it never pops in; the perf tour A/B shows no regression.

## 6. Compression (founder 10-16: "no visual degradation")

**The rule:** an app-size win is worthless if it breaks the board. Lossless is the default; any change to formats or
compression needs eyes on the screens before it ships.

| Platform | What ships | Where it's enforced |
|---|---|---|
| iOS | every asset-catalog imageset is **lossless** (PNG as-is); `bubble-*` is a data atlas (a tint map, not color), lossless whatever the policy; wallpapers ship as JPEG q88 in their own catalog | `scripts/ios-asset-compression.py` (run by the ship scripts; `--check` runs in CI via `packages/core/src/asset-size-guards.test.ts`) |
| Android | art as WebP from the ship scripts (q92; full-screen walls q86); `bubble_`, `bot_`, `friends_`, `icon3d_`, `mascot_` stay **PNG** (restored to the 2.8.4 originals 10-16) | `scripts/android-art-optimize.py` (`KEEP_PNG_PREFIX`) |
| Web | WebP from the ship scripts (q92; walls q86, plus `-wide` desktop walls) | `docs/design/brand/ship-art.py` |

- **Faint-alpha art always stays lossless:** glows, gloss and light maps (`art-fam-lm-*`), soft shadows and
  mascot-maker pieces with soft shading. Lossy HEVC decoded the button light maps as an opaque white haze over every
  key (2.9 build 265, pulled).
- **Opaque gradients** band when encoded lossy on iOS (RGB555); keep them lossless.
- **Trying size work again** means a per-image gate, never a blanket switch: SSIM per image, plus screenshots of a game
  keyboard, candy and quiet buttons, a finish screen, the Dressing Room / mascot maker and Home, on iOS, Android and
  web, at night and in daytime, in season and in the normal look. Tests and the perf gate cannot catch this; only
  eyes do.
- **Every image goes through a ship script** (`ship-art.py`, `ship-cast.py`, `avatar/integration/ship-seasonal.py`).
  They write all three platforms and re-apply the compression policy; hand-copied imagesets fail the CI guard.

## 7. Shipping art

1. Ship through the scripts (section 6) so iOS, Android and web get the same piece in the same batch.
2. Wire behind the season preview or a flag first when it's seasonal; mark it LIVE IN PREVIEW in
   `season-preview-wired.json`.
3. Pre-decode new art (prewarm off the main thread); no synchronous placeholders that decode on the main thread.
4. Screenshot every affected state ×3 and view them before calling it done. Send the founder renders
   (he reviews on his phone).
5. **Intentional differences:** iPad / tablet sizing and the web's desktop layout are deliberate; parity means the
   same art and rules, not identical pixels.
6. **App icon:** option B (the W mascot on the purple-to-pink gradient), with a recolored seasonal variant only when
   the season ships its kit.

## 8. Review and approval

- **Two approvers:** an asset is approved only when BMT **and** JP approve it here. Approved-but-not-shipped is the
  wiring to-do list.
- **Open feedback** (this page › More › Open feedback) is read before every art pass and every wiring session; act
  on it, then resolve it with a note.
- **Exception:** for buttons and UI art the founder said to pick the recommended option and wire it; dual approval is
  for art he wants to judge (the cast, seasons, the mascot maker, social).
- Social images also log a `mascot_check` and `aesthetic_check` per image before they sync or attach to a post.

## 9. Lessons log

| Date | What happened | Rule it made |
|---|---|---|
| 10-02 | Upscaled ChatGPT wallpapers looked "very low res" | Walls are code-drawn at full resolution |
| 10-02 | Mad-looking W poses | W always friendly; w-cheer / w-lean retired |
| 10-02 | Outlined stat boxes in the widgets ("bolt on") | No bordered boxes anywhere |
| 10-03 | A gray person circle on guest Stats | No placeholder states; sweep every state ×3 |
| 10-03 | Good Morning hero reported done on numbers alone, with a hole for guests | Look at a screenshot of every state before "done" |
| 10-04 | Off-model Halloween cast (C especially) | Layer costumes on the hero; face check every redraw |
| 10-05 | Chain drawn "like a hula hoop" through the arms, and it passed the numeric audit | Looked-at "worn, not bolted" check on every body |
| 10-05 | Pale lavender Halloween walls "don't look halloweeny" | Season art reads in one second; a season skins the windows too |
| 10-06 | Unreadable text in the Halloween skin | Readability gate per season (WCAG AA on real pixels) |
| 10-09 | D and a cake clipped side by side on the age check | Composition gate: one scene, never pasted |
| 10-10 | Faded boards at night ("can barely see this") | Dark boards mix 65–80%; check light and dark |
| 10-16 | Time-of-day stages made as code recolors ("faded copies") | Custom ChatGPT designs per time, aligned to the night original |
| 10-16 | Lossy HEVC made every keyboard key unreadable in 2.9 (265) | Lossless by default; per-image visual gate for any compression change |
| 10-16 | A full `ship-art.py` re-run resurrected retired titles and overwrote 122 images | Ship only the pages being changed; check `git status` after every ship |
