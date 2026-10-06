You're working on Wordocious (a word-game app with a mascot maker; iOS SwiftUI, Android Compose, web Next.js, shared TypeScript core).

Start from branch `cloud/landmark-fitting` (PR #41 — the landmark fitting prototype). Create a NEW branch `cloud/reship-rules` from it and push only there. Never push to main or any other branch. Don't change app version numbers. Open a draft PR into `claude/wordocious-store-text-audit-f32609` when done.

GOAL: ship today's existing mascot items through the new rule-based fitting (step 1 of "What shipping takes" in docs/design/brand/avatar/integration/REPORT-LANDMARKS.md), using the REAL letter size for the letter guard.

READ FIRST: REPORT-LANDMARKS.md, INTEGRATION.md (incl. the 4 new sections), rules.py, fits.py, compare.py, audit.py, ship-integrated.py, ship-seasonal.py, packages/core/src/avatar-parts.json, avatar-layout.ts, avatar-config.ts, and the Swift/Kotlin ports (apps/ios/Sources/Core/Avatar*.swift, apps/android/core/.../Avatar*.kt).

DECISIONS (already made — apply them):
1. Letter guard = the letter box the apps actually draw (not the ~20%-smaller one the old ship scripts used). Re-check every item × 12 bodies against it.
2. Wide (and cloud where it's also too tight): withhold any neck/wrap item that would cover the real letter (chain, medal, scarf, bandana, lei, and anything else the guard flags) — same "withheld" mechanism the chain already uses on wide/mini. The apron draws UNDER the letter by design, so it's exempt from letter coverage (the letter shows on top of it).
3. Bow tie: keep today's hand fit as an override (it needs flatter art later). Medal and bow tie should draw UNDER the letter where they overlap it (the small core change the report mentions), on all three platforms.
4. Everything else: rule-based fit replaces the hand fit where the comparison says equal or better; keep a hand override only where rule-based is worse, and list each one.
5. Saved player configs must keep working: a part that becomes withheld on a body is dropped silently when drawn (never crashes, never draws a broken layer). Add a test.

DO:
- Re-render the per-body layers through the rules and ship them ×3 with the existing ship scripts (web public/art, Android drawable-nodpi, iOS image sets), plus the regenerated avatar-parts.json and parity fixtures.
- Make the core change for medal/bow tie under the letter in TS core + Swift + Kotlin ports, with parity tests.
- Run audit.py (including --wraps and the new guards) on the final shipped set: zero failures except listed, intentional withholds.
- Contact sheets of every item on all 12 bodies, BEFORE vs AFTER, under docs/design/brand/avatar/integration/out/reship/ (reasonable JPG sizes). LOOK at them; nothing may look pasted on, cover the face, or cover the letter.
- Tests: run core vitest and web `npx tsc --noEmit` + web vitest. If the cloud environment can run Swift tests (`swift test` in apps/ios) or Gradle unit tests (apps/android: `./gradlew :core:test :app:testDebugUnitTest`), run them; if not, say so clearly — they'll be run locally before shipping.
- Write REPORT-RESHIP.md: what changed per item, every override and withhold with the reason, audit results, test results, and anything that needs a human look.

Don't change any unrelated app code. Finish with a short summary, the branch name and the draft PR link.
