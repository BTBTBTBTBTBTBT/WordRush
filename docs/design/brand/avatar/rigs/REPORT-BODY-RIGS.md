# Body rigs, poses and the living mascot (10-06, cloud prompt 06)

Branch `cloud/body-rigs`, from `cloud/reship-rules`, with a draft PR into `claude/wordocious-store-text-audit-f32609`.
No version numbers were changed.

**Everything new is behind `AVATAR_LIVE_CONFIG.livingMascot` in packages/core/src/avatar-pose.ts. It is `false`.**
With the flag off:
- the default layout ignores a saved pose;
- the Pose tab is hidden;
- the moment events are no-ops;
- every mascot renders exactly as before.

The existing layout fixtures pass unchanged, and `apps/web/lib/living-mascot.test.ts` pins this. To try it, flip the
flag to `true` in core. The ports read it on each platform: Swift `AvatarLiveConfig`, Kotlin `AvatarLiveConfig`.

## 1. Rigging: one command, any body
`python3 docs/design/brand/avatar/integration/rig-body.py <bodyId>` (`--all`, `--sizes`, `--ship`, `--guards`).
It reads only the body's art and its landmarks (landmarks.py). Then it does the following:
- **Arms:** cuts each mitten at the landmark arm region, widened over the torso so the thumb comes along. The cut is
  grown 7 px into plain body, so it never runs through the mitten's own outline. On the torso side the arm layer
  fades in over 4 px, and the base keeps the art under that fade.
- **Torso under each arm:** the edge is continued from the body's own silhouette, using a quadratic through the
  edge rows just above and below the arm. The inside is inpainted (Telea) from the body's neighboring pixels.
  This removed the "flaps" the first cut left.
- **Thin slivers:** 1–2 px anti-aliased slivers left beside a cut are dropped. This costs about 0.01/255 of rest
  diff.
- **Feet:** the feet are the two biggest pieces of silhouette under the hip line, hard-cut and drawn behind the base.
  The base fades out over the feet tops. The body squashes about the middle of the hip line, so the base and the
  feet never part.
- **Pivots:** the shoulder is the upper notch of the arm, pulled 30% of the mitten width into the torso. The hand is
  the center of the hand ellipse. The feet pivot is the middle of the hip line, and the floor comes from the
  landmarks.
- **Rest check and outputs:** the rest-pose diff goes to `rigs/<id>/diff.png`. Each body also gets a pose sheet
  (`rigs/<id>/sheet.jpg`) and its layers (`rigs/<id>/layers/`).
- **Tint:** the layers are cut from the WHITE art and tinted at runtime like the body, so flat, gradient and Pro
  colors all keep working (see `sheets/bare.jpg`).

**Hand overrides: none.** All 12 bodies came out of the command as is. `OVERRIDES` in rig-body.py is empty.

### Rest-pose diff
Mean |Δ| of premultiplied RGB over the body pixels; the target is under 2/255. p99 is 0.0 on every body.

| body | RGB | alpha | | body | RGB | alpha |
|---|---|---|---|---|---|---|
| classic | 0.057 | 0.084 | | drop | 0.063 | 0.096 |
| tall | 0.056 | 0.090 | | pear | 0.068 | 0.120 |
| wide | 0.050 | 0.080 | | cloud | 0.069 | 0.117 |
| blob | 0.044 | 0.070 | | chunky | 0.046 | 0.068 |
| bean | 0.051 | 0.082 | | mini | 0.083 | 0.128 |
| star | 0.048 | 0.064 | | hex | 0.065 | 0.080 |

### It generalizes: the six size variants
`rig-body.py --sizes classic,star,bean` rigs XS, S, L, XL, chunky and lanky (from sizes.py), 18 variant bodies, with
no changes. Results are in SIZES below. Their sheets are in `rigs/<body>-<size>/sheet.jpg`, and
`sheets/sizes.jpg` puts them together. To add a body, follow "How to rig a new body" in `../INTEGRATION.md`.

## 2. Poses are shared data
`packages/core/src/avatar-poses.json`:
- each limb gets an outward-positive rotation about its shoulder, plus dx / dy;
- the body gets a small squash / tilt / lift;
- living extras: a waving arm on Wave, a bounce on Cheer.

Shipped: **Wave, Cheer, Hands on hips, Shrug, Flex, Hug-self, Sitting, Jump.** A new body gets all of them for free.

**These need ChatGPT hand art (not shipped):** peace sign, point, thumbs up, and thinking (hand to chin). Each needs
one limb drawing, color-matched like the I wave and the S fist pump.

## 3. Items follow the pose
- **Held items** ride the HAND landmark. They follow the hand's position and tilt with it by at most ±30°, so a
  raised mug or balloon stays upright. They draw just over that hand.
- **Shoes** ride the feet.
- **Buddies** stay on the floor and draw just behind a moving arm.
- **Everything else** rides the body. That includes hats, the face, the white letter and the pattern.
- **Wrist items** would ride the whole arm, but the catalog has none yet.
- **Layer order:** the arms draw in front of hats (a raised hand passes in front of a brim) and behind the neck
  pieces.

**Per-pose guards** (`rig-body.py --guards`, run on the shipped core layout for every pose × body × item, 9,424
cases):
- an item drawn above the arms may not hide a moved arm (more than 15% of it);
- a held item may not swing over the face or the letter (more than 2% of the item).

A failing item is **withheld in that pose on that body**: it is listed in `avatar-poses.json` `withheld`, and the
reason is logged in `rigs/guards.json`. 165 are withheld in total:

| pose | withheld | mostly |
|---|---|---|
| Hug-self | 120 | held items crossing the letter (the arms hug the belly) |
| Hands on hips | 14 | candy pail, book, trophy at the hip over the letter |
| Jump / Cheer | 8 / 7 | a few held items near the face; the bat / ghost over a raised arm |
| Sitting | 6 | low held items (ice cream, balloon string) |
| Wave / Shrug | 4 / 4 | the flashlight, mic, candy pail on some bodies |
| Flex | 2 | |

The first guard pass rotated held items fully with the arm and withheld 664 (everything upside down in Cheer and
Jump). Keeping them upright fixed that. Floating buddies were withheld only for overlapping an arm, so they now draw
behind it instead.

## 4. The living mascot
Core: `avatarLiveFrame` is pure and parity-tested. It reuses the cast player's feel:
- **Idle:** the 3.4 s breath, and the same blink LCG and timings.
- **Tap:** hop + laugh. Squash, hop, the arms fly up, the eyes squint happy and the mouth stretches open.
- **Press-and-hold:** squish.
- **Reactions:** win = cheer (with two hops), loss = shrug, streak +1 = a hop, level up = cheer. Each blends in and
  out of the saved pose over 0.22 s.
- **Reduce Motion:** holds the pose; a tap only shows the laugh.
- **Ambient off:** for Android between moves.

**Web.** The posed SVG marks each group (`data-lm`). `use-living-mascot.ts` only rewrites those groups'
`transform` on each frame: no re-render, no layout. The fit leaves room for the reactions and the hop
(`AVATAR_LIVE_ROOM`), so the mascot never rescales while it moves.
- **Taps:** play the existing cast giggles, pitched per body (`AVATAR_LAUGH_RATE`: mini is higher, chunky lower).
- **Moments:** `emitMascotMoment` fires from the victory and game-over animations and from the XP toast (level up,
  streak bonus).
- **Surfaces:**
  - the Edit Profile Stage (eyes follow the finger);
  - the Home host;
  - the Stats card avatar.
- **Performance rules:**
  - at most 3 mascots animate at once (`maxAnimated`), and the player's own takes a slot first;
  - lists never pass `living`;
  - offscreen (IntersectionObserver) and hidden tabs pause;
  - Reduce Motion means no loop.

**Eyes and squish (step 6).** The eyes follow the finger by offsetting the pupils only: the eye layer moves at most
1.2% × 0.8% of the content. Press-and-hold squish is a transform only.

**Pose tab.** It is in the Dressing Room, flag-on only. Its thumbnails are the mascot itself in each pose, and the
choice saves `pose` in the config. The tab icon borrows the body tab art until a pose icon is drawn.

**Static pose frames.** With the flag on, every renderer's default layout draws the saved pose. So widgets, share
images and leaderboard rows show it as a static frame with no extra code (small avatars, 28 px and under, never
pose).

## 5. Config, validation, parity
- **`pose`** is on the avatar config. `validateAvatar` writes it only when it is a known pose other than 'none', so
  old configs stay byte-identical.
- **New fixture** `avatar-pose-fixtures.json` covers:
  - the data;
  - every pose's matrices on every body;
  - 27 live frames: blink, tap, Reduce Motion, ambient off, press, each reaction;
  - 8 posed layouts (saved / small / live / none);
  - the withholds.
- **avatar-config fixtures** gain five pose cases.
- **Data files:** `avatar-poses.json` and the updated `avatar-parts.json` (48 rig art names) are copied to the iOS
  Resources and the Android assets.

## 6. Verification
- **Sheets, all looked at:**
  - `sheets/poses-1.jpg` and `poses-2.jpg`: every body × every pose with items, drawn by the shipped web renderer;
  - `sheets/bare.jpg`: seams, white plus a gradient Pro color;
  - `sheets/frames.jpg`: idle, tap and reaction strips, and a Reduce Motion tap;
  - `<id>/sheet.jpg`: the engine's own pose sheets.
- **Rebuild them:** `…/tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/pose-sheets.ts` then
  `python3 rigs/shoot.py`.
- **Tests:** core vitest 395/395. Web tsc is clean. Web vitest is 1580/1581 before the new art sizes, then all
  green after (see the PR for the final run).
- **iOS / Android:** see the next section.

## 7. iOS and Android
NATIVE

## 8. Honest notes and what needs on-device checks
- **Mittens are floating hands.** These bodies have no arms, so a raised mitten reads as a hand beside the head. In
  motion (Wave) it reads well. In a still frame, Cheer can look a little like ears on the square bodies.
- **Hands cover the letter in Hug and Hips.** In Hug-self the hands cover part of the letter on the narrow bodies
  (bean, tall). That is the pose: the arms hug the belly. Hands on hips was toned down so it no longer covers the
  letter.
- **The base edge under an arm is inpainted.** It is soft but clean at tile sizes. On the white cloud / hex bodies,
  a couple of pixel specks remain beside the arm at 640 px.
- **The pattern only covers the base.** The arms carry the body color but not the pattern.
- **The web animator has not been watched live in a browser or on a phone.** Every frame it draws is the same
  function the frame strips render (`avatarLiveTransforms`), and its budget / flag paths are unit-tested. Still
  needed:
  - an on-device check of smoothness on low-end Android;
  - a check that the laugh pitch sounds right;
  - a check that iOS Safari applies SVG `transform` attribute updates at 60 fps for 3 mascots.
- **Widgets:** the static pose frame is the layout change above. The widget flip-book timeline from the plan is not
  part of this job.
