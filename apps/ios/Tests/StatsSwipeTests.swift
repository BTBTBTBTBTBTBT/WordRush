import XCTest
@testable import WordociousCore

/// Stats scroll-jump regression: a vertical scroll never changes the game page.
final class StatsSwipeTests: XCTestCase {
    func testOnlyClearlyHorizontalSwipesPage() {
        XCTAssertEqual(StatsSwipe.step(dx: -120, dy: 10), 1)
        XCTAssertEqual(StatsSwipe.step(dx: 90, dy: -20), -1)
        // A diagonal vertical scroll past Achievements: never a page change.
        XCTAssertNil(StatsSwipe.step(dx: -80, dy: -300))
        XCTAssertNil(StatsSwipe.step(dx: 75, dy: 45))      // less than 2:1
        XCTAssertNil(StatsSwipe.step(dx: -60, dy: 0))      // too short
        XCTAssertNil(StatsSwipe.step(dx: 0, dy: -500))
        XCTAssertEqual(StatsSwipe.step(dx: -70, dy: 35), 1) // exactly 2:1 at the minimum
    }
}
