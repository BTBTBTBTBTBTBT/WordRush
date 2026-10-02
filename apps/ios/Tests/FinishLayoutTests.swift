import XCTest
@testable import WordociousCore

/// FINISH_SPEC §B5 (one board-sizing rule) and §A5 (the living cast header's move
/// picker and keyframes).
final class BoardSizingTests: XCTestCase {
    func testBoardColumnsAndRows() {
        XCTAssertEqual(BoardSizing.boardColumns(boardCount: 1), 1)
        XCTAssertEqual(BoardSizing.boardColumns(boardCount: 2), 2)
        XCTAssertEqual(BoardSizing.boardColumns(boardCount: 4), 2)
        XCTAssertEqual(BoardSizing.boardColumns(boardCount: 8), 4)
        XCTAssertEqual(BoardSizing.boardRows(boardCount: 1), 1)
        XCTAssertEqual(BoardSizing.boardRows(boardCount: 2), 1)
        XCTAssertEqual(BoardSizing.boardRows(boardCount: 4), 2)
        XCTAssertEqual(BoardSizing.boardRows(boardCount: 8), 2)
    }

    func testSquareTileWidthBound() {
        // Wide-open height: 5 columns on a 400-pt area fill 96% of the width.
        let t = BoardSizing.squareTile(columns: 5, rows: 6, width: 400, height: 2000, maxTile: 500)
        XCTAssertEqual(t, 400 * 0.96 / (5 + 4 * 0.1), accuracy: 1e-9)
        let boardWidth = 5 * t + 4 * 0.1 * t
        XCTAssertLessThanOrEqual(boardWidth, 400)
        XCTAssertEqual(boardWidth, 384, accuracy: 1e-9)   // 2% margin each side
    }

    func testSquareTileHeightBound() {
        // A short area: the six rows set the size and fit 98% of the height.
        let t = BoardSizing.squareTile(columns: 5, rows: 6, width: 400, height: 300)
        XCTAssertEqual(t, 300 * 0.98 / (6 + 5 * 0.1), accuracy: 1e-9)
        XCTAssertLessThanOrEqual(6 * t + 5 * 0.1 * t, 300)
        XCTAssertLessThan(5 * t + 4 * 0.1 * t, 400 * 0.96)
    }

    func testSquareTileWidthOnlyAndClamps() {
        XCTAssertEqual(BoardSizing.squareTile(columns: 5, rows: 6, width: 400, height: nil, maxTile: 60), 60)
        XCTAssertEqual(BoardSizing.squareTile(columns: 5, rows: 6, width: 10, height: 10), 8)   // min clamp
        XCTAssertEqual(BoardSizing.squareTile(columns: 9, rows: 9, width: 360, height: .infinity, gapRatio: 0, maxTile: 500),
                       360 * 0.96 / 9, accuracy: 1e-9)
    }

    func testFitTileWithFixedGaps() {
        // ProperNoundle-style rows: 9 letters in two words (4 + 5), 4-pt gaps inside a
        // word and a 14-pt gap between words, six rows with 4-pt gaps.
        let fixedW = 4.0 * 7 + 14
        let t = BoardSizing.fitTile(widthUnits: 9, fixedWidth: fixedW, heightUnits: 6, fixedHeight: 20,
                                    width: 380, height: 500, maxTile: 500)
        XCTAssertEqual(t, (380 * 0.96 - fixedW) / 9, accuracy: 1e-9)
        XCTAssertLessThanOrEqual(9 * t + fixedW, 380 * 0.96 + 1e-9)
        let short = BoardSizing.fitTile(widthUnits: 9, fixedWidth: fixedW, heightUnits: 6, fixedHeight: 20,
                                        width: 380, height: 200, maxTile: 500)
        XCTAssertEqual(short, (200 * 0.98 - 20) / 6, accuracy: 1e-9)
    }

    func testMultiFillsTheArea() throws {
        let m = BoardSizing.multi(boardCount: 4, wordLength: 5, rowsPerBoard: 9, width: 400, height: 320)
        XCTAssertEqual(m.boardColumns, 2)
        XCTAssertEqual(m.boardRows, 2)
        XCTAssertEqual(m.gridWidth, 384, accuracy: 1e-9)
        XCTAssertEqual(m.cellWidth, (384 - 8) / 2, accuracy: 1e-9)
        // The tiles fill each cell exactly (frame padding + fixed 2-pt gaps).
        XCTAssertEqual(5 * m.tileWidth + 4 * 2 + 8, m.cellWidth, accuracy: 1e-9)
        let cellH = try XCTUnwrap(m.cellHeight)
        XCTAssertEqual(9 * m.tileHeight + 8 * 2 + 8, cellH, accuracy: 1e-9)
        XCTAssertLessThanOrEqual(2 * cellH + 8, 320)
    }

    func testMultiWithoutHeightIsSquare() {
        let m = BoardSizing.multi(boardCount: 8, wordLength: 5, rowsPerBoard: 13, width: 360, height: nil)
        XCTAssertEqual(m.boardColumns, 4)
        XCTAssertNil(m.cellHeight)
        XCTAssertEqual(m.tileWidth, m.tileHeight)
    }
}

final class CastMovesTests: XCTestCase {
    /// A deterministic generator for the picker.
    private struct SeqRNG: RandomNumberGenerator {
        var state: UInt64
        mutating func next() -> UInt64 {
            state = state &* 6364136223846793005 &+ 1442695040888963407
            return state
        }
    }

    func testEveryCastMemberHasAMove() {
        XCTAssertEqual(CastMoves.ids.count, 10)
        for id in CastMoves.ids { XCTAssertNotNil(CastMoves.moves[id], id) }
        XCTAssertEqual(CastMoves.duration("o1"), 0.9)
        XCTAssertEqual(CastMoves.duration("r"), 1.6)
        XCTAssertEqual(CastMoves.duration("u"), 1.8)
        XCTAssertEqual(CastMoves.duration("s"), 0.7)
    }

    func testPickNeverRepeats() {
        var rng = SeqRNG(state: 42)
        var last: String? = nil
        var seen = Set<String>()
        for _ in 0..<2000 {
            let id = CastMoves.pick(after: last, using: &rng)
            XCTAssertNotEqual(id, last)
            XCTAssertTrue(CastMoves.ids.contains(id))
            seen.insert(id)
            last = id
        }
        XCTAssertEqual(seen.count, 10, "every character eventually moves")
    }

    func testIntervalRange() {
        XCTAssertEqual(CastMoves.interval(unit: 0), 2.6)
        XCTAssertEqual(CastMoves.interval(unit: 1), 5.0)
        XCTAssertEqual(CastMoves.interval(unit: 0.5), 3.8, accuracy: 1e-9)
        XCTAssertEqual(CastMoves.interval(unit: 7), 5.0)
    }

    func testPosesRestAtTheEnds() {
        for id in CastMoves.ids {
            XCTAssertEqual(CastMoves.pose(id, elapsed: 0), .identity, id)
            XCTAssertEqual(CastMoves.pose(id, elapsed: CastMoves.duration(id)), .identity, id)
            XCTAssertEqual(CastMoves.pose(id, elapsed: 99), .identity, id)
        }
    }

    func testKeyframePeaks() {
        // U levitates 14% at the halfway point.
        XCTAssertEqual(CastMoves.pose("u", elapsed: 0.9).ty, -0.14, accuracy: 1e-6)
        // W is up 22% at 45% of its hop.
        XCTAssertEqual(CastMoves.pose("w", elapsed: 0.7 * 0.45).ty, -0.22, accuracy: 1e-6)
        // O1 overshoots to 372° at 85%.
        XCTAssertEqual(CastMoves.pose("o1", elapsed: 0.9 * 0.85).rotation, 372, accuracy: 1e-6)
        // C holds its lean between 30% and 65%.
        XCTAssertEqual(CastMoves.pose("c", elapsed: 0.6).rotation, 9, accuracy: 1e-6)
    }

    func testCubicBezier() {
        XCTAssertEqual(CubicBezier.linear.value(at: 0.3), 0.3, accuracy: 1e-4)
        XCTAssertEqual(CubicBezier.easeInOut.value(at: 0.5), 0.5, accuracy: 1e-4)
        // The spring curve overshoots past 1 before settling.
        let spring = CubicBezier(0.3, 1.5, 0.5, 1)
        XCTAssertGreaterThan((1...9).map { spring.value(at: Double($0) / 10) }.max() ?? 0, 1)
    }
}

final class StreakWeekTests: XCTestCase {
    func testWeekFillsTheStreakEndingToday() {
        // Friday (4), played today, 82-day streak: Monday–Friday on.
        XCTAssertEqual(StreakWeek.days(streak: 82, playedToday: true, todayIndex: 4),
                       [true, true, true, true, true, false, false])
        // Not played yet today: the streak ends yesterday.
        XCTAssertEqual(StreakWeek.days(streak: 2, playedToday: false, todayIndex: 4),
                       [false, false, true, true, false, false, false])
        // Monday, not played: nothing this week yet.
        XCTAssertEqual(StreakWeek.days(streak: 5, playedToday: false, todayIndex: 0), Array(repeating: false, count: 7))
        XCTAssertEqual(StreakWeek.days(streak: 0, playedToday: true, todayIndex: 3), Array(repeating: false, count: 7))
    }

    func testMondayIndex() {
        XCTAssertEqual(StreakWeek.mondayIndex(weekday: 2), 0)   // Monday
        XCTAssertEqual(StreakWeek.mondayIndex(weekday: 1), 6)   // Sunday
        XCTAssertEqual(StreakWeek.mondayIndex(weekday: 7), 5)   // Saturday
    }
}
