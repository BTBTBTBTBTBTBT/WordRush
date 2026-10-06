You're working on Wordocious, a word-game app with a mascot maker. It runs on iOS (SwiftUI), Android (Compose) and web (Next.js), with a shared TypeScript core.

Start from the branch `claude/wordocious-store-text-audit-f32609`. Create a NEW branch named `cloud/landmark-fitting` and push only to it. Never push to main or to the starting branch. Don't change app code, shipped assets or version numbers. This job is a pipeline, a prototype and a report.

GOAL: a landmark-based fitting system for mascot-maker items. The idea is to measure each body's shoulders, arms, hands, waist, hips, feet, face and letter area, and let items place themselves from those measurements instead of being hand-fitted to each body.

READ FIRST:
- docs/design/brand/avatar/NEXT-ROUND-INK-AND-BLING.md, the "STEP ONE — landmark fitting system" section
- docs/design/brand/avatar/integration/INTEGRATION.md
- The integration scripts: build.py, build_new.py, ship-integrated.py, ship-seasonal.py, pieces (incl. drape_path and arm_mask), fit-*.json, audit.py (incl. --wraps), contact-integrated.py
- packages/core/src/avatar-parts.json (v3), avatar-layout.ts, avatar-config.ts

There are 12 bodies today: classic, tall, wide, round, bean, star, drop, cone, cloud, block, mini, hex. About 100 items are fitted, partly by hand per body. A recent bug: a gold chain drew as a straight band over both arms (a "hula hoop") and still passed the audit. It was fixed with a necklace drape path.

BUILD:
1. Landmark extraction per body, as a script. From each body's art and the existing fit data, measure:
   - the outline contour and the head-top curve;
   - the face box (eyes + mouth) and the letter box;
   - the shoulder line and points;
   - the arm regions (start/end, hand centers);
   - the waist and hip lines, the feet and the floor line;
   - the torso width per row.
   Save it as docs/design/brand/avatar/integration/landmarks.json, plus a debug overlay image per body. Look at the overlays and fix anything wrong.
2. Attachment rules per item, instead of per-body hand fits. Each rule names the anchor(s), the scale rule, the front/back split, the allowed zone and an optional curve to follow:
   - necklaces: a U between the shoulder points, under the mouth, inside the arm-free band (reuse drape_path);
   - belts: the waist line;
   - hats: the head-top curve, with width = head width × k;
   - held items: the hand center;
   - buddies: beside the feet or the shoulder;
   - capes: behind the body, peeking out at the sides.
   Move EVERY existing item onto a rule. If today's hand fit is clearly better for an item, keep it as an override and note why. Build a rule-driven renderer that outputs the same per-body layers ship-integrated.py ships today.
3. Automatic guards in audit.py. FAIL any item that:
   - crosses an arm region;
   - is wider than the torso at its height (waist garments exempt);
   - leaves the body outline;
   - covers the face or letter beyond the existing limits;
   - floats off its anchor.
4. Sizes from the same art. Prototype body size variants XS, S, L and XL, plus "chunky" (wider) and "lanky" (taller), derived from the 12 bodies. Recompute the landmarks, re-fit every item by rule and run the guards. Make contact sheets of every item on every body × size and look at them. Prototype only; don't ship it into the apps.
5. A comparison sheet: for every item on each of the 12 bodies, today's shipped fit next to the rule-based fit. Then a table saying, per item, whether the rule-based fit is equal, better or worse.
6. Update INTEGRATION.md with:
   - "How to add a new body" (goal: drop the art in, run one script, look at one sheet);
   - "How to add a new item" (write one rule);
   - "Sizes".

Install Python dependencies if they're missing (Pillow, numpy, opencv-python).

DELIVER (commit to the branch, then push):
- the scripts, landmarks.json and the overlays;
- the contact sheets as reasonably sized JPGs under docs/design/brand/avatar/integration/out/landmarks/;
- REPORT-LANDMARKS.md: what works, the item-by-item comparison table, failures, and what it would take to ship this into the apps.

Finish with a short summary and the branch name.
