import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AT2: multi-board recaps share one tile + board size, win or loss.
final class RecapSizingTests: XCTestCase {
    func testSharedRowsFromTheLargestBoard() {
        // Deliverance loss: a solved board (4 guesses) and lost boards (budget 9, 9 guesses).
        XCTAssertEqual(RecapSizing.sharedRows(guessCounts: [4, 9, 9, 6], budgets: [9, 9, 9, 9]), 9)
        // A board that played past the shared budget sets the height for all.
        XCTAssertEqual(RecapSizing.sharedRows(guessCounts: [3, 11], budgets: [9, 9]), 11)
        XCTAssertEqual(RecapSizing.sharedRows(guessCounts: [], budgets: [], floor: 6), 6)
        XCTAssertEqual(RecapSizing.sharedRows(guessCounts: [], budgets: []), 1)
    }

    func testEveryBoardSameSizeWinOrLoss() {
        let rows = RecapSizing.sharedRows(guessCounts: [2, 9, 13, 5], budgets: [13, 13, 13, 13])
        let tile = 14.0
        // One size per recap: the same inputs for every board (solved, lost, short) — the
        // answer slot is reserved on all of them when the recap reveals missed answers.
        for reveal in [false, true] {
            let sizes = (0..<4).map { _ in RecapSizing.boardSize(tile: tile, columns: 5, rows: rows, revealMissed: reveal) }
            XCTAssertTrue(sizes.allSatisfy { $0.width == sizes[0].width && $0.height == sizes[0].height })
        }
        let plain = RecapSizing.boardSize(tile: tile, columns: 5, rows: rows, revealMissed: false)
        XCTAssertEqual(plain.width, 5 * 14 + 4 * 1.4, accuracy: 1e-9)
        XCTAssertEqual(plain.height, 13 * 14 + 12 * 1.4, accuracy: 1e-9)
        let revealed = RecapSizing.boardSize(tile: tile, columns: 5, rows: rows, revealMissed: true)
        XCTAssertGreaterThan(revealed.height, plain.height)
        XCTAssertEqual(revealed.width, plain.width)
    }
}
