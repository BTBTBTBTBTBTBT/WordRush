import XCTest
@testable import WordociousCore

/// FINISH_SPEC BJ1: no Today | All-time toggle — every view is ONE scroll, Today first, All-time beneath.
final class StatsSelectionTests: XCTestCase {
    func testOverviewShowsTodayThenAllTime() {
        XCTAssertEqual(StatsSelection.initial.game, nil)
        XCTAssertEqual(StatsSelection.initial.sections, [.todayOverview, .allTimeOverview])
    }

    func testAGameShowsItsTodayThenItsAllTime() {
        XCTAssertEqual(StatsSelection(game: "QUORDLE").sections, [.todayGame("QUORDLE"), .allTimeGame("QUORDLE")])
        XCTAssertEqual(StatsSelection(game: StatsSelection.sweepKey).sections, [.todaySweep, .allTimeSweep])
        for g in [nil, "DUEL", StatsSelection.sweepKey] as [String?] {
            let s = StatsSelection(game: g).sections
            XCTAssertEqual(s.count, 2)
            XCTAssertTrue(s[0].isToday)
            XCTAssertFalse(s[1].isToday)
        }
    }

    func testPickSwapsTheGameRetapClearsJumpNeverToggles() {
        let quad = StatsSelection.initial.picking("QUORDLE")
        XCTAssertEqual(quad.sections, [.todayGame("QUORDLE"), .allTimeGame("QUORDLE")])
        XCTAssertEqual(quad.picking("SUDOKU").game, "SUDOKU")
        XCTAssertEqual(quad.picking("QUORDLE"), .initial)
        XCTAssertEqual(quad.opening("QUORDLE"), quad)
        XCTAssertEqual(quad.opening(nil), .initial)
    }

    func testSwipeWalksTheGames() {
        let order = ["DUEL", "QUORDLE", "sweep"]
        var s = StatsSelection.initial
        s = s.swiped(1, order: order)
        XCTAssertEqual(s, StatsSelection(game: "DUEL"))
        s = s.swiped(1, order: order)
        XCTAssertEqual(s.sections, [.todayGame("QUORDLE"), .allTimeGame("QUORDLE")])
        XCTAssertEqual(s.swiped(-2, order: order), .initial)
        XCTAssertEqual(s.swiped(5, order: order), s)            // off the end: unchanged
        XCTAssertEqual(StatsSelection.initial.swiped(-1, order: order), .initial)
        XCTAssertEqual(StatsSelection(game: "GONE").swiped(1, order: order).game, "GONE")   // unknown: unchanged
    }

    func testTheDiagonalScrollGuardStillHolds() {
        XCTAssertNil(StatsSwipe.step(dx: 80, dy: 45))     // diagonal: a scroll, not a swipe
        XCTAssertNotNil(StatsSwipe.step(dx: -120, dy: 30))
        XCTAssertNil(StatsSwipe.step(dx: 60, dy: 0))      // under 70
    }
}
