import XCTest
@testable import WordociousCore

/// FINISH_SPEC BG: scope × game on the Stats page.
final class StatsSelectionTests: XCTestCase {
    func testTheFourCells() {
        XCTAssertEqual(StatsSelection.initial.view, .todayOverview)
        XCTAssertEqual(StatsSelection(scope: .today, game: "QUORDLE").view, .todayGame("QUORDLE"))
        XCTAssertEqual(StatsSelection(scope: .allTime).view, .allTimeOverview)
        XCTAssertEqual(StatsSelection(scope: .allTime, game: "QUORDLE").view, .allTimeGame("QUORDLE"))
    }

    func testToggleKeepsGamePickKeepsScopeRetapClears() {
        let quad = StatsSelection.initial.picking("QUORDLE")
        XCTAssertEqual(quad.view, .todayGame("QUORDLE"))
        // Today/QuadWord → All-time/QuadWord immediately.
        XCTAssertEqual(quad.withScope(.allTime).view, .allTimeGame("QUORDLE"))
        // Picking another game keeps All-time.
        XCTAssertEqual(quad.withScope(.allTime).picking("SUDOKU").view, .allTimeGame("SUDOKU"))
        // Re-tapping the picked game returns to Overview (scope kept).
        XCTAssertEqual(quad.withScope(.allTime).picking("QUORDLE").view, .allTimeOverview)
        // Back to Today keeps the game.
        XCTAssertEqual(quad.withScope(.allTime).withScope(.today).view, .todayGame("QUORDLE"))
    }

    func testSwipeChangesTheGameOnly() {
        let order = ["DUEL", "QUORDLE", "SWEEP"]
        var s = StatsSelection(scope: .allTime)
        s = s.swiped(1, order: order)
        XCTAssertEqual(s, StatsSelection(scope: .allTime, game: "DUEL"))
        s = s.swiped(1, order: order)
        XCTAssertEqual(s.view, .allTimeGame("QUORDLE"))
        XCTAssertEqual(s.swiped(-2, order: order).view, .allTimeOverview)
        XCTAssertEqual(s.swiped(5, order: order), s)            // off the end: unchanged
        XCTAssertEqual(StatsSelection.initial.swiped(-1, order: order), .initial)
        XCTAssertEqual(StatsSelection(game: "GONE").swiped(1, order: order).game, "GONE")   // unknown: unchanged
    }
}
