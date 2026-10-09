# Re-ship through the rule-based fit (10-06)

This is step 1 of "What it would take to ship" in `REPORT-LANDMARKS.md`. Every existing mascot item now ships with the
rule-based fit, which runs on the measured landmarks. The letter guard is the letter box the apps actually draw:
Nunito 900 at `min(h / 0.74, w / 0.9) × 0.94`, about 20% bigger than the box the 10-05 ship scripts guarded.

Branch `cloud/reship-rules`, on top of the landmark prototype (`cloud/landmark-fitting`). No app version numbers
changed. Renderer code didn't change on any platform: web `avatar-render.ts`, iOS `MascotAvatar.swift` and Android
`MascotComposer.kt` already draw whatever the core layout returns, in order, with the letter at `letterIndex`.

## What changed

| area | change |
|---|---|
| **Core layout** (TS `avatar-layout.ts`, Swift `AvatarLayout.swift`, Kotlin `AvatarLayout.kt`) | `bodies.<id>.overrides[key]` gains two optional fields. `layer` draws a one-art item on another layer on that body: the medal and bow tie go `under`, so they're drawn before the letter and the face, and the letter shows on top. `withheld: true` means no room on that body: the part is dropped silently, so a saved config that wears it just shows the body without it, with no crash and no broken layer. `dx` / `dy` / `scale` work as before. |
| **Per-body art** ×3 (web `public/art`, Android `drawable-nodpi`, iOS image sets) | 652 layer arts re-rendered through `rules.render` + the existing `ship-integrated.ship_layers` (contact shadows, AO, the hand-over cut, now at the MEASURED mittens) and `save_art`. 24 stale arts × 4 files deleted (list below). |
| **avatar-parts.json** ×3 | `pieces` re-written for every per-body item. The scarf moves from its one-layer `perBody` art to `pieces` (a `wrap` layer, like the other drapes). Rule rects for the one-art items become `bodies.<id>.overrides`. Two dead hand overrides were removed: tall backpack ×1.3 and bean supercape ×1.2, both items that now ship as `pieces`, which ignore anchors. |
| **apps/web/lib** | `art-av-pieces.ts` regenerated (`write_web_sizes`). `art.ts` lost the 12 old per-body scarf sizes. |
| **Parity fixtures** | `avatar-layout-fixtures.json` (iOS + Android copies) regenerated, with 5 new cases: the medal withheld on wide, the bow tie under the letter, the medal on drop, scarf + bandana withheld on cloud, and the bow tie + apron on tall. |
| **Tests** | TS: per-body `withheld` / `layer` overrides on a cloned manifest; the shipped bow tie and medal are under the letter where they overlap it and withheld without room; **saved configs on every body × every head / face / neck / integrated option lay out, and every drawn layer's art is a shipped art**. Withheld integrated options draw nothing. Swift `testOverridesWithheldAndLayer` and Kotlin `overrides_withheld_and_layer` cover the same core behavior, plus the fixture parity. |
| **Pipeline** | `ship-rules.py` is the new ship driver; `reship-sheets.py` makes BEFORE/AFTER sheets plus the guards. `audit.py --wraps` now measures arm overlap against the measured arms (see the audit section). Rule fixes: the apron drops its neck strap where it can't clear (decision 2); backpack straps tuck around the torso edge (tall / bean); the medal fallback hangs under the letter at the biggest size that stays on the body. `ship-integrated.py` / `ship-seasonal.py` warn that they would re-ship the 10-05 hand fits; `ship-scarf.py` refuses to run without `--force`. |

## Per item

Item verdicts come from the landmark comparison (`out/landmarks/compare-*.jpg`, table in `REPORT-LANDMARKS.md` §4).
BEFORE vs AFTER sheets: `out/reship/reship-01…10.jpg`. Each pair is LEFT = 10-05 hand fit, RIGHT = what ships now;
a red frame means a guard fails; "—" means withheld. I looked at every sheet.

| items | what ships now |
|---|---|
| 37 hats (incl. 4 seasonal) | rule fit (opening on the measured head-top curve, width = head width × k) as per-body `overrides` on all 12 bodies, scale 0.85–1.06 vs today. Cloud keeps its hand-placed head band (landmark override, `REPORT-LANDMARKS.md` §1). Visually equal. |
| headphones | rule fit: the cups clamp the head above the eyes (scale up to 1.52). Today's cups covered the eyes on 7 bodies: **better**. |
| 9 face items, 6 brows, 4 extras | unchanged: the rule equals the core anchor placement, so no overrides were written. |
| bow tie | **override, today's hand fit kept** (`rules.OVERRIDES`). It needs flatter art: there is no room for a readable bow tie between the mouth and the letter on 10 of 12 bodies. On those 10 it now draws **under** the letter and face (`layer: 'under'`); on tall and pear it stays in front. |
| medal | rule fit: from the drape bottom, under the letter where it overlaps it (classic, blob, bean, star, chunky, mini, hex), beside the letter on tall, drop and pear. **Withheld on wide + cloud.** Today's ribbon covered the mouth on every body: **better**. |
| chain | rule drape. **Withheld on wide, mini** (as before) **+ cloud** (it covered the real letter). |
| scarf, bandana | rule drape (the scarf now as `pieces`). **Withheld on wide + cloud.** |
| lei | rule drape. **Withheld on wide.** |
| cape, supercape, vampire collar, cape-drape | rule fit; the same look. On wide (and cloud for the collar and cape-drape) the front cord / clasp / collar is dropped (no room between the mouth and the letter); the cape still hangs behind. |
| apron | rule fit: torso-wide, so no longer over the arms on classic, bean and chunky, with the neck strap on the drape. On wide and cloud it ships as the panel only, under the letter (decision 2: exempt from letter coverage). |
| belt | rule fit on the measured waist line (under the letter where there is no room below it). |
| backpack | rule fit (measured hands), straps tucked around the torso edge. Today's straps sat on the arms on classic, blob and chunky. |
| wings, fairy wings, bat wings, cat tail | rule fit (`overrides` for wings / fairy wings, `pieces` for bat wings / cat tail). Equal look; wings a little bigger on the narrow bodies. |
| 16 held items | rule fit at the measured hands. Tall items go to the hand with room (the bean case is now a rule). Equal look; on wide ~20% smaller (its mitten measures narrower than the hand fit). |
| 4 shoes, 7 buddies | rule fit (measured feet / floor / head curve). Equal look; mini's buddies a little smaller. |

**Overrides (hand fit kept): 1** — `acc:bowtie`, for the reason above. Everything else is rule-based, because the
comparison judged every other item equal or better.

**Withholds (all intentional, all "no room for it without covering the real letter or the face"):**

| body | withheld |
|---|---|
| wide | chain, medal, scarf, bandana, lei |
| cloud | chain, medal, scarf, bandana |
| mini | chain (unchanged from 10-05) |

Stale art removed (×4 files each: web, Android, iOS PNG + `Contents.json`):
- the 12 old `art-av-acc-scarf-<body>`;
- the `-wrap` layers of apron, bandana, cape-drape, chain and vampirecollar on cloud + wide, and of cape, lei and
  supercape on wide.

## Audit (final shipped set)

| check | result |
|---|---|
| `audit.py --guards shipped` (arm, torso width, outline, face, letter, float; the real letter) | **0 failures** on 1,178 item × body fits. Before: 84 (70 letter, 21 face, 6 arm, 5 outline, 3 torso). |
| `audit.py --wraps` (straps / wraps over the arms or a straight hoop band) | **0 failures** on 116 wrap layers |
| `audit.py --hoop-regression` (the 10-05 "hula hoop" art) | still fails: the chain on 9/10 bodies, the straight cape, collar and scarf bands on 11–12/12 |
| art coverage (every layer the manifest can draw, ×3 platforms) | all 810 arts present on web, Android and iOS; 0 missing |

`--wraps` now measures arm overlap against the MEASURED arm regions (`landmarks.py`). These are the same mittens
the re-shipped hand-over cut uses; before, it used the hand-fit ellipses. On the hand-fit ellipses the new straps
would show 333–1,550 px "on the arms", because their cut follows the measured mitten. On the measured arms they touch
≤ 98 px (an anti-aliased edge; the limit is 245). The check still catches what it should: the 10-05 hoop art fails
on 80 layers, and today's (BEFORE) backpack straps fail on classic, blob and chunky.

The plain `audit.py` run (no flag) also redraws the old 4-body `audit-*.png` sheets with macOS fonts. I didn't
regenerate those in the cloud run; the BEFORE/AFTER sheets above replace them for this re-ship.

## Tests

| suite | result |
|---|---|
| core `vitest` (packages/core) | **393 / 393 pass**, incl. the parity-fixture freshness test and the new override / saved-config tests |
| web `npx tsc --noEmit` | **clean** |
| web `vitest` | **1,581 / 1,581 pass** (148 files, incl. web avatar art coverage) |
| iOS `swift test` | **not run here**: the cloud container has no Swift toolchain. Run locally before shipping: `AvatarLayoutTests` (fixture parity + `testOverridesWithheldAndLayer`) and `AvatarArtCoverageTests`. |
| Android `./gradlew :core:test :app:testDebugUnitTest` | **not run here**: the environment's network policy denies `dl.google.com` (Google's Maven, where the Android Gradle plugin lives), and there is no Android SDK. Run locally before shipping: `AvatarLayoutFixtureTest` (fixture parity + `overrides_withheld_and_layer`), `AvatarArtCoverageTest`. |

The Swift and Kotlin changes mirror the TS change line for line (decode two optional override fields; skip on
`withheld`; `layer` falls back to the item's layer). The new native tests use only APIs the existing tests already
use, but they have not been compiled.

## Needs a human look

1. **The bow tie under the mouth** (`out/reship/reship-06.jpg`, first row). On the 10 bodies where today's bow tie
   overlapped the mouth and letter, it now draws under both. Nothing covers the face or the letter any more, but the
   smile now draws across the red bow on most bodies, which can read like a red patch behind the mouth. It's the
   right call until flatter bow-tie art exists. If it reads wrong, the alternative is withholding the bow tie on those
   10 bodies until the new art lands.
2. **The wide body loses five neck items** (chain, medal, scarf, bandana, lei) and **cloud four**. Players who saved
   one of them on wide or cloud will see the body without it (by design, decision 2). Consider a short note in the
   maker ("no room on this body").
3. **Held items on wide are ~20% smaller** than before (the measured mitten is smaller than the old ellipse). They
   look right on the sheets, but it's a visible change for wide players.
4. Run the native tests locally (above) before shipping.

## How to re-ship again

```
python3 docs/design/brand/avatar/integration/ship-rules.py        # art ×3 + manifests ×3 + sizes + art-av-pieces.ts
apps/server/node_modules/.bin/tsx packages/core/scripts/gen-parity-fixtures.ts
python3 docs/design/brand/avatar/integration/audit.py --guards shipped && python3 docs/design/brand/avatar/integration/audit.py --wraps
python3 docs/design/brand/avatar/integration/reship-sheets.py     # BEFORE/AFTER sheets: look at them
```
