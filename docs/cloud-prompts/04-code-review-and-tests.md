You're working on Wordocious (iOS SwiftUI, Android Compose, web Next.js 13.5, shared TypeScript core in packages/core). Start from branch `claude/wordocious-store-text-audit-f32609`, create a NEW branch `cloud/review-2-7-1`, push only there, and open a draft PR into the starting branch. Don't change version numbers.

GOAL: a careful review of the 2.7.1 changes plus automated tests that would have caught tonight's bugs.

1. Review the commits since the 2.7 release (git log from c1ed2fd3 "Release 2.7" to HEAD) for correctness bugs, crashes, parity gaps between iOS/Android/web, performance traps and state bugs. Focus areas: season system + Haunted glass surfaces, seasonal mascot items, mascot-maker integrated parts, cast puppet animation players, sounds (debounce/scope/intro quiet), Home host look cache, family action menus, Gauntlet multi-board staging, widgets deep links, guest saves.
2. Bugs found tonight that tests should have caught — add regression tests for each where a testable seam exists:
   - iOS Gauntlet stage 5 (OctoWord) drew only 4 of 8 boards (BoardLayout staged-build counter not re-staged on board-count change; fixed in 6f2cf42a).
   - Home didn't show finished games under the Halloween dark surfaces (fixed 370ee6e6).
   - Android finished-dock crash from an intrinsic-width query on a BoxWithConstraints label (fixed 3a04d181).
   - Neck items drew as a band across the arms (fixed c08582d9).
   - Home host popped from the default W to the player's look at launch (fixed 32488111).
   Prefer pure-logic tests (TS vitest, Swift XCTest in apps/ios/Tests, Kotlin JUnit). Where a bug is view-state only, add the closest logic-level test and say what UI test would be needed.
3. Fix only clear, low-risk bugs you're confident about (with a test each). List everything else as findings with file:line, severity and a suggested fix — don't refactor.
4. Run core vitest and web tsc + vitest; run Swift/Gradle tests if the environment allows, otherwise say so.
5. Deliver REPORT-REVIEW-2.7.1.md: findings table (severity, file:line, issue, fix status), tests added, test results.

Finish with a short summary, the branch name and the draft PR link.
