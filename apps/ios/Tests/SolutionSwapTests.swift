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
        // Batch 4 started earlier (2026-10-13), so its words have already moved by both dates.
        let bothOld = Array(SOLUTION_SWAPS.keys) + Array(SOLUTION_SWAPS_2.keys) + Array(SOLUTION_SWAPS_4.keys)
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let raw = loadList(file)
            let between = len == 5 ? d.solutionPool(forDateKey: "2026-11-15") : d.solutionPool(forLength: len, dateKey: "2026-11-15")
            let after = len == 5 ? d.solutionPool(forDateKey: "2026-11-16") : d.solutionPool(forLength: len, dateKey: "2026-11-16")
            XCTAssertEqual(between, applySolutionSwapBatches(raw, 1 | 8))
            // Batch 3 shares this date while SOLUTION_SWAP_3_CUTOVER_DATE == SOLUTION_SWAP_2_CUTOVER_DATE.
            let sameDay3 = SOLUTION_SWAP_3_CUTOVER_DATE == SOLUTION_SWAP_2_CUTOVER_DATE
            XCTAssertEqual(after, applySolutionSwapBatches(raw, sameDay3 ? 15 : 11))
            XCTAssertEqual(after.count, raw.count)
            for o in bothOld { XCTAssertFalse(after.contains(o), o) }
            let moved = zip(raw, after).filter { $0 != $1 }.map { $0.0 }.sorted()
            let expected = (bothOld + (sameDay3 ? Array(SOLUTION_SWAPS_3.keys) : [])).filter { $0.count == len && raw.contains($0) }
            XCTAssertEqual(moved, expected.sorted())
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
        // Between the cutovers the batch-2 original still deals (V******; LUNATIC's slot already holds
        // batch 4's DIEHARD); from the second cutover the replacement takes the slot.
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2026-10-28-DUEL_7", count: 8, wordLength: 7),
                       ["PRESSED", "DENOTED", "PALETTE", "FAILING", "DIEHARD", "BREEDER", "WAITING", String(data: Data(base64Encoded: "VkFHSU5BTA==")!, encoding: .utf8)!])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2026-11-27-DUEL_6", count: 8, wordLength: 6),
                       ["JAGGED", "OPENER", "FESTER", "QUARTZ", "MARVEL", "SALUTE", "FONDUE", "ONWARD"])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2027-02-23-DUEL_7", count: 1, wordLength: 7), ["CROWBAR"])
    }

    // MARK: - Batch 3 (British answers — COLOUR, THEATRE, YOGHURT, BLOKE…, plus batch 2's CRUMPET),
    // applied AFTER batch 2, its own cutover constant. Batches 1 and 2 never grow.

    func testBatch3TableShapeAndGate() {
        XCTAssertEqual(SOLUTION_SWAP_3_CUTOVER_DATE, "2026-11-16")
        XCTAssertTrue(SOLUTION_SWAP_3_CUTOVER_DATE >= SOLUTION_SWAP_2_CUTOVER_DATE)
        XCTAssertEqual(SOLUTION_SWAPS.count, 23)
        XCTAssertEqual(SOLUTION_SWAPS_2.count, 13)
        XCTAssertEqual(SOLUTION_SWAPS_3.count, 46)
        XCTAssertEqual(Set(SOLUTION_SWAPS_3.values).count, 46)
        XCTAssertEqual(SOLUTION_SWAPS_3["COLOUR"], "SORBET")
        XCTAssertEqual(SOLUTION_SWAPS_3["CRUMPET"], "WALLABY")
        XCTAssertEqual(solutionSwapBatchesFor("2026-10-04"), 0)
        XCTAssertEqual(solutionSwapBatchesFor("2026-11-15"), 1 | 8)
        XCTAssertEqual(solutionSwapBatchesFor("2026-11-16"), ALL_SOLUTION_SWAP_BATCHES)
        let earlier = Set(SOLUTION_SWAPS.values).union(SOLUTION_SWAPS_2.values)
        for (o, n) in SOLUTION_SWAPS_3 {
            XCTAssertEqual(o.count, n.count, "\(o)→\(n)")
            XCTAssertFalse(earlier.contains(n), "\(n) is already a batch-1/2 replacement")
            XCTAssertNil(SOLUTION_SWAPS[o] ?? SOLUTION_SWAPS_2[o], "\(o) is an earlier batch's key")
        }
    }

    func testBatch3WordsLeaveDealtPoolEnterFromAllowed() {
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let dealt = Set(applySolutionSwapBatches(loadList(file), 1 | 2))
            let allowed = Set(loadList(len == 5 ? "allowed" : "allowed-\(len)"))
            for (o, n) in SOLUTION_SWAPS_3 where o.count == len {
                XCTAssertTrue(dealt.contains(o), o)
                XCTAssertFalse(dealt.contains(n), "\(n) must not already be an answer")
                XCTAssertTrue(allowed.contains(n), "\(n) must be guessable")
            }
        }
    }

    func testBatch3InPlaceFromItsCutover() {
        let d = GameDictionary.shared
        let allOld = Array(SOLUTION_SWAPS.keys) + Array(SOLUTION_SWAPS_2.keys) + Array(SOLUTION_SWAPS_3.keys) + Array(SOLUTION_SWAPS_4.keys)
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let raw = loadList(file)
            let after = len == 5 ? d.solutionPool(forDateKey: SOLUTION_SWAP_3_CUTOVER_DATE) : d.solutionPool(forLength: len, dateKey: SOLUTION_SWAP_3_CUTOVER_DATE)
            XCTAssertEqual(after, applyAllSolutionSwaps(raw))
            for o in allOld { XCTAssertFalse(after.contains(o), o) }
        }
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: "2026-11-15").contains("COLOUR"))
        d.todayOverrideForTests = "2026-11-15"
        XCTAssertTrue(d.solutionPool(forDateKey: nil).contains("BLOKE"))
        d.todayOverrideForTests = "2026-11-16"
        XCTAssertFalse(d.solutionPool(forDateKey: nil).contains("BLOKE"))
        XCTAssertTrue(d.solutionPool(forDateKey: nil).contains("LLAMA"))
        XCTAssertTrue(d.solutionPool(forLength: 7, dateKey: nil).contains("WALLABY"))
        XCTAssertFalse(d.solutionPool(forLength: 7, dateKey: nil).contains("CRUMPET"))
        d.todayOverrideForTests = "2026-09-01"
        for o in SOLUTION_SWAPS_3.keys { XCTAssertTrue(d.isValidWord(o), o) }
    }

    func testBatch3PinnedDeals() {
        XCTAssertEqual(generateSolutionsFromSeed("daily-2026-10-15-DUEL", count: 8),
                       ["ADORE", "LITRE", "RIDGE", "CUMIN", "ETHIC", "VALID", "THICK", "STORY"])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2026-11-16-DUEL_7", count: 8, wordLength: 7),
                       ["OVARIAN", "DEFLECT", "IGNORED", "ALGEBRA", "MARACAS", "CLIPPER", "LAUGHED", "EMPATHY"])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2027-01-22-DUEL_6", count: 8, wordLength: 6),
                       ["FILMED", "SMILED", "WIGGLE", "OPENLY", "SITTER", "SORBET", "SPRITE", "SUNSET"])
    }

    // MARK: - Batch 4 (content audit 2026-10-06: profanity, slurs, sexual/drug words, political and
    // brand names, proper nouns, British and obscure answers). Earliest pending cutover (2026-10-13,
    // before batches 2–3), so solutionSwapBatchesFor is a bitmask. Keys are original pool words.

    func testBatch4TableShapeAndGate() {
        XCTAssertEqual(SOLUTION_SWAP_4_CUTOVER_DATE, "2026-10-13")
        XCTAssertTrue(SOLUTION_SWAP_4_CUTOVER_DATE < SOLUTION_SWAP_2_CUTOVER_DATE)
        XCTAssertEqual(SOLUTION_SWAPS.count, 23)
        XCTAssertEqual(SOLUTION_SWAPS_2.count, 13)
        XCTAssertEqual(SOLUTION_SWAPS_3.count, 46)
        XCTAssertEqual(SOLUTION_SWAPS_4.count, 283)
        XCTAssertEqual(Set(SOLUTION_SWAPS_4.values).count, 283)
        XCTAssertEqual(SOLUTION_SWAPS_4["TOGGLE"], "BEANIE")
        XCTAssertEqual(SOLUTION_SWAPS_4["LATINO"], "SUITOR")
        XCTAssertEqual(solutionSwapBatchesFor("2026-10-12"), 1)
        XCTAssertEqual(solutionSwapBatchesFor("2026-10-13"), 1 | 8)
        let earlier = Set(SOLUTION_SWAPS.keys).union(SOLUTION_SWAPS_2.keys).union(SOLUTION_SWAPS_3.keys)
            .union(SOLUTION_SWAPS.values).union(SOLUTION_SWAPS_2.values).union(SOLUTION_SWAPS_3.values)
        for (o, n) in SOLUTION_SWAPS_4 {
            XCTAssertEqual(o.count, n.count, "\(o)→\(n)")
            XCTAssertFalse(earlier.contains(o), "\(o) belongs to an earlier batch")
            XCTAssertFalse(earlier.contains(n), "\(n) belongs to an earlier batch")
        }
    }

    func testBatch4WordsLeaveRawPoolEnterFromAllowedAndNotLegacy() {
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let raw = loadList(file)
            let legacy = Set(loadList("\(file)-legacy"))
            let allowed = Set(loadList(len == 5 ? "allowed" : "allowed-\(len)"))
            for (o, n) in SOLUTION_SWAPS_4 where o.count == len {
                XCTAssertEqual(raw.filter { $0 == o }.count, 1, o)
                XCTAssertFalse(raw.contains(n), "\(n) must not be in the raw pool")
                XCTAssertFalse(legacy.contains(n), "\(n) must not be a legacy answer")
                XCTAssertTrue(allowed.contains(n), "\(n) must be guessable")
            }
        }
    }

    func testBatch4InPlaceFromItsCutover() {
        let d = GameDictionary.shared
        for (len, file) in [(5, "solutions"), (6, "solutions-6"), (7, "solutions-7")] {
            let raw = loadList(file)
            let dayBefore = len == 5 ? d.solutionPool(forDateKey: "2026-10-12") : d.solutionPool(forLength: len, dateKey: "2026-10-12")
            let after = len == 5 ? d.solutionPool(forDateKey: SOLUTION_SWAP_4_CUTOVER_DATE) : d.solutionPool(forLength: len, dateKey: SOLUTION_SWAP_4_CUTOVER_DATE)
            XCTAssertEqual(dayBefore, applySolutionSwaps(raw))
            XCTAssertEqual(after, applySolutionSwaps4(applySolutionSwaps(raw)))
            let old = (Array(SOLUTION_SWAPS.keys) + Array(SOLUTION_SWAPS_4.keys)).filter { $0.count == len }
            for o in old { XCTAssertFalse(after.contains(o), o) }
            let moved = zip(raw, after).filter { $0 != $1 }.map { $0.0 }.sorted()
            XCTAssertEqual(moved, old.filter { raw.contains($0) }.sorted())
        }
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: "2026-10-12").contains("TOGGLE"))
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: SOLUTION_SWAP_4_CUTOVER_DATE).contains("COLOUR"))
        d.todayOverrideForTests = "2026-10-12"
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: nil).contains("TOGGLE"))
        d.todayOverrideForTests = "2026-10-13"
        XCTAssertFalse(d.solutionPool(forLength: 6, dateKey: nil).contains("TOGGLE"))
        XCTAssertTrue(d.solutionPool(forLength: 6, dateKey: nil).contains("BEANIE"))
        XCTAssertFalse(d.solutionPool(forDateKey: nil).contains("DUCHY"))
        d.todayOverrideForTests = "2026-09-01"
        for o in SOLUTION_SWAPS_4.keys { XCTAssertTrue(d.isValidWord(o), o) }
    }

    func testBatch4PinnedDeals() {
        XCTAssertEqual(Array(generateSolutionsFromSeed("daily-2026-10-12-GAUNTLET", count: 21)[9..<13]),
                       ["NURSE", "LOCAL", "AMINO", "AGENT"])
        XCTAssertEqual(generateSolutionsFromSeedForLength("daily-2026-10-14-DUEL_6", count: 1, wordLength: 6), ["SUITOR"])
        XCTAssertEqual(Array(generateSolutionsFromSeed("daily-2026-11-03-GAUNTLET", count: 21)[14..<18]),
                       ["SLANG", "TRICK", "PHASE", "TORSO"])
    }
}
