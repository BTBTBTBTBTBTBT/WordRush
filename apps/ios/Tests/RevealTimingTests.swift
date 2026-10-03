import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AQ1 / §BI5: the reveal clock (the pre-overhaul pacing) and the
/// key-color-per-tile rule.
final class RevealTimingTests: XCTestCase {
    func testRestoredPacing() {
        // §BI5: single board 0.5 s / 150 ms; multi-board (mini) 0.3 s / 80 ms.
        XCTAssertEqual(RevealTiming.flip, 0.5, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.flipStagger, 0.15, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.miniFlip, 0.3, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.miniFlipStagger, 0.08, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.flipDuration(mini: false), 0.5, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.flipDuration(mini: true), 0.3, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.stagger(mini: false), 0.15, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.stagger(mini: true), 0.08, accuracy: 1e-9)
    }

    func testFinishHoldWaitsForTheRow() {
        // The popup never springs in before the final row (and a win's hop wave) is done.
        for cols in 1...8 {
            for mini in [false, true] {
                let row = RevealTiming.rowReveal(columns: cols, mini: mini)
                let loss = RevealTiming.finishHold(columns: cols, winHop: false, mini: mini)
                let win = RevealTiming.finishHold(columns: cols, winHop: true, mini: mini)
                XCTAssertEqual(loss, row + 0.2, accuracy: 1e-9)
                XCTAssertEqual(win, row + RevealTiming.hopWave(columns: cols) + 0.2, accuracy: 1e-9)
            }
        }
        // Classic (5 letters) win: 1.1 s row + 0.64 s hop wave + 0.2 s beat.
        XCTAssertEqual(RevealTiming.finishHold(columns: 5, winHop: true), 1.94, accuracy: 1e-9)
    }

    func testRowReveal() {
        // A 5-letter row ≈ 1.1 s on a single board (the pre-overhaul feel), 0.62 s mini.
        XCTAssertEqual(RevealTiming.rowReveal(columns: 5), 0.5 + 4 * 0.15, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.rowReveal(columns: 5), 1.1, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.rowReveal(columns: 5, mini: true), 0.3 + 4 * 0.08, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.rowReveal(columns: 1), 0.5, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.tileLands(column: 2), 0.5 + 2 * 0.15, accuracy: 1e-9)
        XCTAssertEqual(RevealTiming.tileLands(column: 2, mini: true), 0.3 + 2 * 0.08, accuracy: 1e-9)
    }

    func testTilesLanded() {
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 0, columns: 5), 0)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 0.49, columns: 5), 0)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: 0.29, columns: 5, mini: true), 0)
        XCTAssertEqual(RevealTiming.tilesLanded(elapsed: RevealTiming.tileLands(column: 3, mini: true), columns: 5, mini: true), 4)
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
