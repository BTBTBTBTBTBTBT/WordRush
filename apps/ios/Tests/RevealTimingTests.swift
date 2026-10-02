import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AQ1: fast play — the reveal clock and the key-color-per-tile rule.
final class RevealTimingTests: XCTestCase {
    func testSpecBounds() {
        XCTAssertLessThanOrEqual(RevealTiming.flip, 0.22)
        XCTAssertLessThanOrEqual(RevealTiming.flipStagger, 0.07)
        XCTAssertLessThanOrEqual(RevealTiming.finishHoldMax, 1.2)
        // Every word length's finish hold (win or loss) stays within 1.2 s.
        for cols in 1...8 {
            XCTAssertLessThanOrEqual(RevealTiming.finishHold(columns: cols, winHop: true), 1.2 + 1e-9)
            XCTAssertLessThanOrEqual(RevealTiming.finishHold(columns: cols, winHop: false), 1.2 + 1e-9)
            XCTAssertGreaterThanOrEqual(RevealTiming.finishHold(columns: cols, winHop: false),
                                        RevealTiming.rowReveal(columns: cols) - 1e-9)
        }
    }

    func testRowReveal() {
        XCTAssertEqual(RevealTiming.rowReveal(columns: 5), 0.22 + 4 * 0.07, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.rowReveal(columns: 1), 0.22, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.tileLands(column: 2), 0.22 + 2 * 0.07, accuracy: 1e-9)
        // The old row took 1.92 s at 5 columns; the new one is well under a third of that.
        XCTAssertLessThan(RevealTiming.rowReveal(columns: 5), 0.64)
    }

    func testTilesLanded() {
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 0, columns: 5), 0)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 0.21, columns: 5), 0)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: RevealTiming.tileLands(column: 0), columns: 5), 1)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: RevealTiming.tileLands(column: 2), columns: 5), 3)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: RevealTiming.rowReveal(columns: 5), columns: 5), 5)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 10, columns: 5), 5)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 10, columns: 0), 0)
        // Monotonic: never fewer tiles later.
        var last = 0
        for k in 0...100 {
            let n = RevealTiming.tilesLanded(elapsed: Double(k) * 0.01, columns: 6)
            XCTAssertGreaterThanOrEqual(n, last)
            last = n
        }
    }

    private func row(_ word: String, _ states: [TileState]) -> GuessResult {
        GuessResult(tiles: zip(word, states).map { TileResult(letter: String($0), state: $1) },
                    isCorrect: states.allSatisfy { $0 == .correct })
    }

    func testKeyColorsPerTile() {
        let settled = row("CRANE", [.absent, .present, .absent, .absent, .correct])
        let fresh = row("ROUTE", [.correct, .absent, .absent, .present, .correct])
        // The fresh row with two tiles landed: R and O take their colors, U / T don't yet.
        let s = KeyReveal.letterStates([settled, fresh], visible: { $0 == 1 ? 2 : .max })
        XCTAssertEqual(s["R"], .correct)       // upgraded from present by the landed R
        XCTAssertEqual(s["O"], .absent)
        XCTAssertNil(s["U"])
        XCTAssertNil(s["T"])
        XCTAssertEqual(s["E"], .correct)       // from the settled row
        XCTAssertEqual(s["C"], .absent)
        // Fully landed = the plain merge of every row.
        let all = KeyReveal.letterStates([settled, fresh])
        XCTAssertEqual(all["T"], .present)
        XCTAssertEqual(all["U"], .absent)
        // Nothing landed: only the settled row.
        let none = KeyReveal.letterStates([settled, fresh], visible: { $0 == 1 ? 0 : .max })
        XCTAssertEqual(none["R"], .present)
        XCTAssertNil(none["O"])
    }

    func testMergeNeverDowngrades() {
        XCTAssertEqual(KeyReveal.merge(.correct, .absent), .correct)
        XCTAssertEqual(KeyReveal.merge(.present, .correct), .correct)
        XCTAssertEqual(KeyReveal.merge(nil, .absent), .absent)
        XCTAssertEqual(KeyReveal.merge(.absent, .present), .present)
    }
}
