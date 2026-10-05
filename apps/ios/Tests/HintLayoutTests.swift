import XCTest
@testable import WordociousCore

/// FINISH_SPEC §BI22: a hint never changes the board's size.
final class HintLayoutTests: XCTestCase {
    func testKindredTilesIdenticalWithAndWithoutNamedCategories() {
        for band in stride(from: 300.0, through: 700.0, by: 37.0) {
            for bars in 0...3 {
                let tiles = 16 - bars * 4
                let none = HintLayout.kindredTileHeight(band: band, tiles: tiles, solvedBars: bars, revealedCategories: 0, trayLip: 4)
                for named in 1...(4 - bars) {
                    XCTAssertEqual(none, HintLayout.kindredTileHeight(band: band, tiles: tiles, solvedBars: bars,
                                                                       revealedCategories: named, trayLip: 4),
                                   "band \(band), \(bars) solved, \(named) named")
                }
            }
        }
    }

    func testKindredTilesStayInRange() {
        XCTAssertEqual(HintLayout.kindredTileHeight(band: 100, tiles: 16, solvedBars: 0, revealedCategories: 0, trayLip: 4),
                       HintLayout.kindredTileMin)
        XCTAssertEqual(HintLayout.kindredTileHeight(band: 2000, tiles: 4, solvedBars: 3, revealedCategories: 1, trayLip: 4),
                       HintLayout.kindredTileMax)
    }

    func testCountBadgeText() {
        XCTAssertEqual(HintLayout.countText(0), "")
        XCTAssertEqual(HintLayout.countText(-3), "")
        XCTAssertEqual(HintLayout.countText(1), "1")
        XCTAssertEqual(HintLayout.countText(99), "99")
        XCTAssertEqual(HintLayout.countText(100), "99+")
    }

    /// Doug 10-05: a two-line slot cut the ProperNoundle clue at "His…". Three lines, four on tall screens (Android/web parity).
    func testNoundleClueWrapsThreeLinesAndFourOnTallScreens() {
        XCTAssertEqual(HintLayout.noundleClueLines(screenHeight: 667), 3)
        XCTAssertEqual(HintLayout.noundleClueLines(screenHeight: 759), 3)
        XCTAssertEqual(HintLayout.noundleClueLines(screenHeight: 852), 4)
        XCTAssertGreaterThanOrEqual(HintLayout.noundleClueFontSize, 13)
    }
}
