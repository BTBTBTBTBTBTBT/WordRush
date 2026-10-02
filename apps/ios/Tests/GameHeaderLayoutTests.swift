import XCTest
@testable import WordociousCore

/// FINISH_SPEC §Z: flipping Daily ⇄ Unlimited must never move a board — the
/// board's top edge and size are identical in both modes on every phone.
final class GameHeaderLayoutTests: XCTestCase {
    /// iPhone SE (667), iPhone 13 mini / X (812), iPhone 15 Pro Max (932).
    private let phones: [GameHeaderLayout.Screen] = [
        .init(width: 375, height: 667, safeTop: 20, safeBottom: 0),
        .init(width: 375, height: 812, safeTop: 47, safeBottom: 34),
        .init(width: 430, height: 932, safeTop: 59, safeBottom: 34),
    ]

    func testBoardFrameIsIdenticalInBothModes() {
        for screen in phones {
            for offersPicker in [true, false] {
                for (header, dock) in [(96.0, 220.0), (120.0, 260.0), (80.0, 180.0)] {
                    let daily = GameHeaderLayout.boardFrame(screen: screen, headerHeight: header, dockHeight: dock,
                                                            mode: .daily, offersPicker: offersPicker)
                    let unlimited = GameHeaderLayout.boardFrame(screen: screen, headerHeight: header, dockHeight: dock,
                                                                mode: .unlimited, offersPicker: offersPicker)
                    XCTAssertEqual(daily, unlimited, "board moved on a \(screen.height)-pt phone (picker: \(offersPicker))")
                    XCTAssertGreaterThan(daily.side, 0)
                    XCTAssertGreaterThanOrEqual(daily.top, screen.safeTop + header)
                }
            }
        }
    }

    func testSlotsReserveTheSameHeightInBothModes() {
        for offersPicker in [true, false] {
            let d = GameHeaderLayout.slots(mode: .daily, offersPicker: offersPicker)
            let u = GameHeaderLayout.slots(mode: .unlimited, offersPicker: offersPicker)
            XCTAssertEqual(d.reservedHeight, u.reservedHeight)
            XCTAssertEqual(d.pickerHeight, u.pickerHeight)
        }
        // The picker's content only shows in Unlimited, but its slot is there in Daily too.
        let daily = GameHeaderLayout.slots(mode: .daily, offersPicker: true)
        XCTAssertFalse(daily.showsPicker)
        XCTAssertEqual(daily.pickerHeight, GameHeaderLayout.pickerSlotHeight)
        XCTAssertTrue(GameHeaderLayout.slots(mode: .unlimited, offersPicker: true).showsPicker)
        XCTAssertEqual(GameHeaderLayout.slots(mode: .unlimited, offersPicker: false).pickerHeight, 0)
    }

    func testHomeBannerSlotsExistInBothModes() {
        let cases: [(GroupProgress, GroupProgress, GroupStreaks)] = [
            (GroupProgress(played: 0, won: 0, total: 8), GroupProgress(played: 0, won: 0, total: 10), GroupStreaks(sweep: 0, flawless: 0)),
            (GroupProgress(played: 3, won: 2, total: 8), GroupProgress(played: 1, won: 1, total: 10), GroupStreaks(sweep: 2, flawless: 0)),
            (GroupProgress(played: 8, won: 7, total: 8), GroupProgress(played: 10, won: 9, total: 10), GroupStreaks(sweep: 4, flawless: 1)),
            (GroupProgress(played: 8, won: 8, total: 8), GroupProgress(played: 10, won: 10, total: 10), GroupStreaks(sweep: 9, flawless: 6)),
        ]
        for (w, p, streaks) in cases {
            let d = HomeBannerSlots.compute(word: w, puzzles: p, wordStreaks: streaks, puzzleStreaks: streaks, mode: .daily)
            let u = HomeBannerSlots.compute(word: w, puzzles: p, wordStreaks: streaks, puzzleStreaks: streaks, mode: .unlimited)
            XCTAssertEqual(d.reserved, u.reserved, "a banner slot collapsed in one mode")
            XCTAssertTrue(d.showsShare || !d.hasShare)
            XCTAssertFalse(u.showsShare)
            XCTAssertFalse(u.showsFlames)
        }
    }
}
