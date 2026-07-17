import XCTest
@testable import WordociousCore

/// Pins ProperNoundleCore.rebuildRow — the iOS half of the hint-row
/// reconstruction fix (web mirror: components/propernoundle/reconstruct.test.ts,
/// Android mirror: core ProperNoundleTest.kt). The shipped bug: a "Sam Smith"
/// daily played on one platform and viewed on another rendered the revealed
/// I and H stacked at slot 0 in gray, because the recorded positional padding
/// was normalized away before evaluation.
final class ProperNoundleReconstructTests: XCTestCase {
    private let answer = "Sam Smith" // normalizes to "samsmith" — i@5, h@7

    private func correctIdxs(_ tiles: [NTile]) -> [Int] {
        tiles.enumerated().compactMap { $0.element == .correct ? $0.offset : nil }
    }

    func testSpacePaddedHintRowKeepsItsSlot() {
        // The shape this app records (ProperNoundleView.reveal).
        let row = ProperNoundleCore.rebuildRow(recorded: "     i  ", answer: answer)
        XCTAssertEqual(correctIdxs(row.tiles), [5])
        XCTAssertEqual(row.letters[5], "I")
        XCTAssertEqual(row.letters[0], "")          // the bug put "I" here
        XCTAssertEqual(row.tiles[0], .hintUsed)
        XCTAssertEqual(row.letters.count, 8)
    }

    func testUnderscorePaddedHintRowKeepsItsSlot() {
        // The shape the web records (use-hints.ts).
        let row = ProperNoundleCore.rebuildRow(recorded: "_____i__", answer: answer)
        XCTAssertEqual(correctIdxs(row.tiles), [5])
        XCTAssertEqual(row.letters[5], "I")
    }

    func testRepeatedRevealedLetterMarksEveryOccurrence() {
        // "samsmith": s@0,3.
        let row = ProperNoundleCore.rebuildRow(recorded: "s  s    ", answer: answer)
        XCTAssertEqual(correctIdxs(row.tiles), [0, 3])
    }

    func testClueRowIsFullHintUsedRow() {
        // The clue hint records "" — must render a gray row, not an empty one.
        let row = ProperNoundleCore.rebuildRow(recorded: "", answer: answer)
        XCTAssertEqual(row.tiles, Array(repeating: NTile.hintUsed, count: 8))
        XCTAssertTrue(row.letters.allSatisfy { $0.isEmpty })
    }

    func testRealGuessesStillGoThroughTheEvaluator() {
        let win = ProperNoundleCore.rebuildRow(recorded: "samsmith", answer: answer)
        XCTAssertEqual(win.tiles, Array(repeating: NTile.correct, count: 8))
        XCTAssertEqual(win.letters.joined(), "SAMSMITH")

        let display = ProperNoundleCore.rebuildRow(recorded: "Sam Smith", answer: answer)
        XCTAssertEqual(display.tiles, Array(repeating: NTile.correct, count: 8))

        let wrong = ProperNoundleCore.rebuildRow(recorded: "mithsams", answer: answer)
        XCTAssertFalse(wrong.tiles.contains(.hintUsed))
        XCTAssertFalse(wrong.tiles.allSatisfy { $0 == .correct })
    }

    func testHintRowsAreIdentifiableForHintCounting() {
        // The completed cards count hints by 'hintUsed' tiles — only a hint row
        // can contain one, since the evaluator never emits it.
        XCTAssertTrue(ProperNoundleCore.rebuildRow(recorded: "     i  ", answer: answer).tiles.contains(.hintUsed))
        XCTAssertFalse(ProperNoundleCore.rebuildRow(recorded: "samsmith", answer: answer).tiles.contains(.hintUsed))
    }
}
