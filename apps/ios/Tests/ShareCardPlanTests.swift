import XCTest
@testable import WordociousCore

/// Founder 10-06: the CLASSIC title was cut off at the top of the Classic 4/6 share card.
/// Every game's card keeps its whole title box on the canvas, inside the side margins,
/// at every board size (web share-fit.test.ts, Android ShareCardLayoutTest).
final class ShareCardPlanTests: XCTestCase {
    /// Title art aspects (web lib/art.ts ART_SIZE — the same PNGs ship ×3).
    private let titles: [String: Double] = [
        "classic": 1200.0 / 305, "gauntlet": 1200.0 / 273, "quadword": 1200.0 / 275,
        "octoword": 1200.0 / 255, "succession": 1200.0 / 290, "deliverance": 1200.0 / 254,
        "six": 1200.0 / 268, "seven": 1200.0 / 239, "propernoundle": 1200.0 / 210,
        "sudocious": 1200.0 / 436, "muddle": 1200.0 / 329, "hubbub": 1200.0 / 325,
        "crosswordocious": 1200.0 / 302, "kindred": 1200.0 / 321, "letterladder": 1200.0 / 252,
        "codebreaker": 1200.0 / 237, "spyglass": 1200.0 / 314, "starsweep": 1200.0 / 271,
        "vs": 572.0 / 95, "dailies": 894.0 / 260, "puzzles": 909.0 / 251, "stats": 740.0 / 273,
    ]

    /// Board natural sizes from small to the biggest each game draws (ShareCardView.boardBox
    /// estimates, a full OctoWord, a 9 × 9, a long Gauntlet, a tiny board).
    private let boards: [ShareCardPlan.Size] = [
        .init(width: 700, height: 880), .init(width: 742, height: 1240), .init(width: 934, height: 1160),
        .init(width: 960, height: 560), .init(width: 780, height: 790), .init(width: 600, height: 790),
        .init(width: 960, height: 730), .init(width: 300, height: 2600), .init(width: 120, height: 60),
    ]

    /// ShareCardView's non-board blocks below the title (info, gaps, stats, cast, bottom pad).
    private let rest: Double = 18 + 50 + 30 + 34 + 124 + 40 + 146.6 + 40

    func testTitleFitsWidthInsideMargins() {
        XCTAssertEqual(ShareCardPlan.titleMaxW, 900)
        for (name, a) in titles {
            let t = ShareCardPlan.titleSize(aspect: a)
            XCTAssertLessThanOrEqual(t.width, ShareCardPlan.titleMaxW + 1e-9, name)
            XCTAssertLessThanOrEqual(t.height, ShareCardPlan.titleMaxH + 1e-9, name)
            // The whole art: same aspect, no crop or stretch, and one side at its cap.
            XCTAssertEqual(t.width / t.height, a, accuracy: 1e-6, name)
            XCTAssertEqual(max(t.width / ShareCardPlan.titleMaxW, t.height / ShareCardPlan.titleMaxH), 1, accuracy: 1e-9, name)
        }
        XCTAssertEqual(ShareCardPlan.titleSize(aspect: nil).height, ShareCardPlan.titleFallbackH)
    }

    func testEveryGameTitleSitsOnItsCard() {
        for (name, a) in titles {
            for aspect in [a, nil] as [Double?] {
                for b in boards {
                    let fixed = ShareCardPlan.fixedHeight(titleAspect: aspect, rest: rest)
                    let card = ShareCardPlan.plan(titleAspect: aspect, fixed: fixed, board: b)
                    XCTAssertTrue(ShareCardPlan.titleFits(card), "\(name) \(b)")
                    XCTAssertEqual(card.titleTop, ShareCardPlan.topPad, name)
                    XCTAssertGreaterThanOrEqual(card.height, ShareCardPlan.minHeight, name)
                    XCTAssertLessThanOrEqual(card.height, ShareCardPlan.maxHeight, name)
                    // The column (title → cast) fits the canvas: nothing runs off either edge.
                    XCTAssertLessThanOrEqual(card.columnHeight(fixed: fixed), card.height + 1, "\(name) \(b)")
                    XCTAssertEqual(card.titleX + card.title.width / 2, ShareCardPlan.width / 2, accuracy: 1e-9)
                }
            }
        }
    }

    func testTallBoardsScaleDownInsteadOfPushingTheTitle() {
        let fixed = ShareCardPlan.fixedHeight(titleAspect: titles["octoword"], rest: rest)
        let card = ShareCardPlan.plan(titleAspect: titles["octoword"], fixed: fixed, board: .init(width: 934, height: 2400))
        XCTAssertEqual(card.height, ShareCardPlan.maxHeight)
        XCTAssertLessThan(card.boardScale, 950.0 / 934)
        XCTAssertEqual(fixed + card.boardH, ShareCardPlan.maxHeight, accuracy: 1)
    }

    func testShortCardsKeepTheFloorAndCenterTheBoard() {
        let fixed = ShareCardPlan.fixedHeight(titleAspect: titles["kindred"], rest: rest)
        let card = ShareCardPlan.plan(titleAspect: titles["kindred"], fixed: fixed, board: .init(width: 960, height: 300))
        XCTAssertEqual(card.height, ShareCardPlan.minHeight)
        XCTAssertGreaterThan(card.slack, 0)
        XCTAssertEqual(card.columnHeight(fixed: fixed), card.height, accuracy: 1)
    }
}
