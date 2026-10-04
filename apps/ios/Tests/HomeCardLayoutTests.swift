import XCTest
@testable import WordociousCore

final class HomeCardLayoutTests: XCTestCase {
    func testCompactCardMeasures() {
        // BH2 + founder 10-03: ~64–70 tall (was ~104), icon 40, name 17, one 13 subtitle line.
        XCTAssertTrue((64...70).contains(HomeCardSpec.height))
        XCTAssertEqual(HomeCardSpec.icon, 40)
        XCTAssertEqual(HomeCardSpec.name, 17)
        XCTAssertEqual(HomeCardSpec.desc, 13)
        // The card hugs the top row: band + top pad + max(icon, name line + gap + one line) + bottom pad.
        let content = max(HomeCardSpec.icon, 21 + HomeCardSpec.descGap + 16)
        XCTAssertLessThanOrEqual(CardTrimGeometry.band + HomeCardSpec.padTop + content + HomeCardSpec.padBottom, HomeCardSpec.height + 1)
        XCTAssertGreaterThanOrEqual(HomeCardSpec.height, 44)
    }

    func testTrimIsOneRowOfDrips() {
        let segs = CardTrimGeometry.segments(width: 176)
        XCTAssertEqual(segs.count, CardTrimGeometry.bumps)
        // Right → left, ending at the card's left edge on the band line.
        XCTAssertEqual(segs.first?.end, CGPoint(x: 154, y: 9))
        XCTAssertEqual(segs.last?.end, CGPoint(x: 0, y: 9))
        // Each drip peaks exactly `drip` below the band (quadratic control at 2·drip).
        XCTAssertEqual(segs[0].control, CGPoint(x: 165, y: 17))
        XCTAssertLessThanOrEqual(CardTrimGeometry.band + CardTrimGeometry.drip, HomeCardSpec.height / 5)
    }

    func testLongResultStaysOneLine() {
        XCTAssertEqual(CardLine.compact("3 guesses · 23s"), "3 guesses · 23s")
        XCTAssertEqual(CardLine.compact("38 guesses · 10m 46s"), "38g · 10m 46s")
        XCTAssertEqual(CardLine.compact("12 mistakes · 10m 46s"), "12 miss · 10m 46s")
    }

    /// BJ18: one name size per grid — the widest name decides it; floored at 13 (then per-card shrink).
    func testUniformNameSizeFitsTheWidestName() {
        XCTAssertEqual(HomeCardSpec.uniformNameSize(widths: [60, 70], slot: 80), 17)
        XCTAssertEqual(HomeCardSpec.uniformNameSize(widths: [60, 85], slot: 80), 16)       // 17 × 80/85 = 16.0
        XCTAssertEqual(HomeCardSpec.uniformNameSize(widths: [60, 200], slot: 80), 13)      // the floor
        XCTAssertEqual(HomeCardSpec.uniformNameSize(widths: [], slot: 80), 17)
        XCTAssertEqual(HomeCardSpec.nameSlot(gridWidth: 350), 170 - 94)
    }
}
