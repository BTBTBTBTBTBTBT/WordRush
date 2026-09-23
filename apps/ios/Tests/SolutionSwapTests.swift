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

    // MARK: - Batch 2 (profanity — FUCKER, BLOWJOB…), its own later cutover.
    // Store builds carrying batch 1 are already out, so batch 1 never grows.

    func testBatch2TableShape() {
        XCTAssertEqual(SOLUTION_SWAP_2_CUTOVER_DATE, "2026-11-16")
        XCTAssertTrue(SOLUTION_SWAP_2_CUTOVER_DATE > SOLUTION_SWAP_CUTOVER_DATE)
        XCTAssertEqual(SOLUTION_SWAPS.count, 23, "batch 1 must not grow")
        XCTAssertEqual(SOLUTION_SWAPS_2.count, 13)
        XCTAssertEqual(Set(SOLUTION_SWAPS_2.values).count, 13)
        XCTAssertEqual(SOLUTION_SWAPS_2["FUCKER"], "CASHEW")
        XCTAssertEqual(SOLUTION_SWAPS_2["BLOWJOB"], "APRICOT")
        XCTAssertEqual(SOLUTION_SWAPS_2["BONDAGE"], "CROWBAR")
        let batch1Replacements = Set(SOLUTION_SWAPS.values)
        for (o, n) in SOLUTION_SWAPS_2 {
            XCTAssertEqual(o.count, n.count, "\(o)→\(n)")
            XCTAssertFalse(batch1Replacements.contains(n), "\(n) is already a batch-1 replacement")
            XCTAssertNil(SOLUTION_SWAPS[o], "\(o) is in both batches")
        }
    }

    func testBatch2WordsLeaveCurrentPoolEnterFromAllowedAndNotLegacy() {
        for (len, file) in [(6, "solutions-6"), (7, "solutions-7")] {
            let pool = Set(loadList(file)), legacy = Set(loadList("\(file)-legacy")), allowed = Set(loadList("allowed-\(len)"))
            for (o, n) in SOLUTION_SWAPS_2 where o.count == len {
                XCTAssertTrue(pool.contains(o), o)
                XCTAssertFalse(pool.contains(n), "\(n) must not already be an answer")
                XCTAssertFalse(legacy.contains(n), "\(n) must not be a legacy answer")
                XCTAssertTrue(allowed.contains(n), "\(n) must be guessable")
            }
        }
        XCTAssertTrue(SOLUTION_SWAPS_2.keys.allSatisfy { $0.count == 6 || $0.count == 7 })
    }

    func testOnlyBatch1BetweenCutovers_BothFromSecondCutover() {
        let d = GameDictionary.shared
        let bothOld = Array(SOLUTION_SWAPS.keys) + Array(SOLUTION_SWAPS_2.keys)
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let raw = loadList(file)
            let between = len == 5 ? d.solutionPool(forDateKey: "2026-11-15") : d.solutionPool(forLength: len, dateKey: "2026-11-15")
            let after = len == 5 ? d.solutionPool(forDateKey: "2026-11-16") : d.solutionPool(forLength: len, dateKey: "2026-11-16")
            XCTAssertEqual(between, applySolutionSwaps(raw))
            XCTAssertEqual(after, applyAllSolutionSwaps(raw))
            XCTAssertEqual(after.count, raw.count)
            for o in bothOld { XCTAssertFalse(after.contains(o), o) }
            let moved = zip(raw, after).filter { $0 != $1 }.map { $0.0 }.sorted()
            XCTAssertEqual(moved, bothOld.filter { $0.count == len }.sorted())
        }
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: "2026-11-15").contains("FUCKER"))
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: "2026-11-16").contains("CASHEW"))
    }

    func testBatch2UndatedSeedsGateOnWallClock() {
        let d = GameDictionary.shared
        d.todayOverrideForTests = "2026-11-15"
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: nil).contains("FUCKER"))
        d.todayOverrideForTests = "2026-11-16"
        XCTAssertFalse(d.solutionPool(forLength: 6, dateKey: nil).contains("FUCKER"))
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: nil).contains("CASHEW"))
        XCTAssertTrue(d.solutionPool(forLength: 7, dateKey: nil).contains("APRICOT"))
        d.todayOverrideForTests = "2026-09-01"
    }

    func testBatch2SwappedOutWordsStayValidGuesses() {
        for o in SOLUTION_SWAPS_2.keys { XCTAssertTrue(GameDictionary.shared.isValidWord(o), o) }
    }

    func testBatch2PinnedDeals() {
        // Between the cutovers the original still deals; from the second cutover the replacement takes the slot.
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2026-10-28-DUEL_7", count: 8, wordLength: 7),
                       ["PRESSED", "DENOTED", "PALETTE", "FAILING", "LUNATIC", "BREEDER", "WAITING", "VAGINAL"])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2026-11-27-DUEL_6", count: 8, wordLength: 6),
                       ["JAGGED", "OPENER", "FESTER", "QUARTZ", "MARVEL", "SALUTE", "FONDUE", "ONWARD"])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2027-02-23-DUEL_7", count: 1, wordLength: 7), ["CROWBAR"])
    }
}
