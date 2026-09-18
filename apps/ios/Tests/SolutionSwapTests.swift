import XCTest
@testable import WordociousCore

/// §265: proper-noun-reading answers are swapped IN PLACE from a dated cutover.
/// Mirrors packages/core/src/solution-swaps.test.ts and Android SolutionSwapTest.
final class SolutionSwapTests: XCTestCase {
    private func loadList(_ name: String) -> [String] {
        let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures")!
        return (try! JSONDecoder().decode([String].self, from: Data(contentsOf: url))).map { $0.uppercased() }
    }

    override func setUp() {
        super.setUp()
        let d = GameDictionary.shared
        d.initDictionary(allowed: loadList("allowed"), solutions: loadList("solutions"), legacySolutions: loadList("solutions-legacy"))
        d.initDictionaryForLength(6, allowed: loadList("allowed-6"), solutions: loadList("solutions-6"), legacySolutions: loadList("solutions-6-legacy"))
        d.initDictionaryForLength(7, allowed: loadList("allowed-7"), solutions: loadList("solutions-7"), legacySolutions: loadList("solutions-7-legacy"))
        d.todayOverrideForTests = "2026-09-01"
    }

    func testTableShape() {
        XCTAssertEqual(SOLUTION_SWAP_CUTOVER_DATE, "2026-10-05")
        XCTAssertEqual(SOLUTION_SWAPS.count, 23)
        XCTAssertEqual(Set(SOLUTION_SWAPS.values).count, 23)
        XCTAssertEqual(SOLUTION_SWAPS["JAPAN"], "ALOOF")
        XCTAssertEqual(SOLUTION_SWAPS["ASPEN"], "DUVET")
        XCTAssertEqual(SOLUTION_SWAPS["MOROCCO"], "ENTWINE")
        for (o, n) in SOLUTION_SWAPS { XCTAssertEqual(o.count, n.count, "\(o)→\(n)") }
    }

    func testPoolsUntouchedBeforeCutoverAndSwappedInPlaceAfter() {
        let d = GameDictionary.shared
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let raw = loadList(file)
            let before = len == 5 ? d.solutionPool(forDateKey: "2026-10-04") : d.solutionPool(forLength: len, dateKey: "2026-10-04")
            let after = len == 5 ? d.solutionPool(forDateKey: "2026-10-05") : d.solutionPool(forLength: len, dateKey: "2026-10-05")
            XCTAssertEqual(before, raw)
            XCTAssertEqual(after, applySolutionSwaps(raw))
            XCTAssertEqual(after.count, raw.count)
            for o in SOLUTION_SWAPS.keys { XCTAssertFalse(after.contains(o), o) }
        }
    }

    func testUndatedSeedsGateOnWallClock() {
        let d = GameDictionary.shared
        d.todayOverrideForTests = "2026-10-04"
        XCTAssertTrue(d.solutionPool(forDateKey: nil).contains("JAPAN"))
        d.todayOverrideForTests = "2026-10-05"
        XCTAssertFalse(d.solutionPool(forDateKey: nil).contains("JAPAN"))
        XCTAssertTrue(d.solutionPool(forDateKey: nil).contains("ALOOF"))
        d.todayOverrideForTests = "2026-09-01"
    }

    func testPinnedPostCutoverDeals() {
        XCTAssertEqual(generateSolutionsFromSeed("daily-2026-10-07-SEQUENCE", count: 4), ["SLUSH", "WHOSE", "RULER", "HORSE"])
        XCTAssertEqual(Array(generateSolutionsFromSeed("daily-2026-10-06-GAUNTLET", count: 21).prefix(3)), ["VOWEL", "DUVET", "TENTH"])
    }
}
