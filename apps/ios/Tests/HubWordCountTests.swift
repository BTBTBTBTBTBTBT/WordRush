import XCTest
@testable import WordociousCore

/// Doug (Android 2.7, 2026-10-05): the Hubbub header said "8/31 words" while the found-words
/// strip said "18 WORDS" — the strip counted the rarer (bonus) finds too. Every surface now takes
/// its word count from hubWordCount / hubWordsLabel, the strip is headed by a count-free label,
/// and rarer words score but never move the count. Mirrors hub.test.ts and HubWordCountTest.kt.
final class HubWordCountTests: XCTestCase {
    private let puzzle = HubPuzzle(id: "t", letters: "OFAMYLR", words: ["FOAL", "FORM", "FORMAL", "FORMALLY"], bonus: ["MORA", "MARO"], pangrams: ["FORMALLY"], max: 26)

    private func play(_ words: String...) -> HubState {
        words.reduce(HubState(puzzle: puzzle, seed: "t", startTime: 0)) { hubReduce($0, .submit($1)) }
    }

    func testHeaderAndStripShareOneCount() {
        let s = play("FORMALLY", "MORA", "FOAL", "MARO")
        XCTAssertEqual(s.found, ["FORMALLY", "FOAL"])
        XCTAssertEqual(s.bonusFound, ["MORA", "MARO"])
        XCTAssertEqual(hubWordCount(s), HubWordCount(found: 2, total: 4))
        XCTAssertEqual(hubWordsLabel(s), "2/4 words")
        // The strip's heading carries no number, so it can never disagree with the header.
        XCTAssertFalse(HUB_FOUND_LABEL.contains { $0.isNumber })
    }

    func testBonusWordsScoreButNeverMoveTheCount() {
        let before = play("FOAL")
        let after = hubReduce(before, .submit("MORA"))
        XCTAssertGreaterThan(after.points, before.points)
        XCTAssertEqual(hubWordsLabel(before), hubWordsLabel(after))
        XCTAssertTrue(hubIsBonus(after.bonusFound, "MORA"))
        XCTAssertFalse(hubIsBonus(after.bonusFound, "FOAL"))
    }
}
