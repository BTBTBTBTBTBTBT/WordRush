import XCTest
@testable import WordociousCore

/// The Stats page's eager grids (scroll-jump fix): every item exactly once, in order.
final class GridRowsTests: XCTestCase {
    func testChunks() {
        XCTAssertEqual(GridRows.chunk(7, columns: 3), [[0, 1, 2], [3, 4, 5], [6]])
        XCTAssertEqual(GridRows.chunk(8, columns: 4), [[0, 1, 2, 3], [4, 5, 6, 7]])
        XCTAssertEqual(GridRows.chunk(0, columns: 3), [])
        XCTAssertEqual(GridRows.chunk(2, columns: 0), [[0], [1]])
        for n in 0..<40 { for c in 1...5 { XCTAssertEqual(GridRows.chunk(n, columns: c).flatMap { $0 }, Array(0..<n)) } }
    }
}
