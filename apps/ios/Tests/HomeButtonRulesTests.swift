import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AY: the Home button always lands on Home's root.
final class HomeButtonRulesTests: XCTestCase {
    func testNextDailyThenHomeLandsOnHomeRoot() {
        // Game A (a cover from Home) → "Next daily" → game B (a cover from the root):
        // one overlay up. Home must leave NO game presented and Home at its root.
        let fromHome = TabRouterState(tab: .home, overlays: 1)
        let a1 = HomeButtonRules.route(from: fromHome)
        XCTAssertEqual(a1.first, .dismissOverlays)
        let end1 = TabRouter.apply(a1, to: fromHome)
        XCTAssertTrue(end1.atRoot(.home))
        XCTAssertEqual(end1.tab, .home)

        // The same from the Leaderboard tab (game opened there), with Home's VS lobby
        // still pushed: every stack pops and the Home tab is selected.
        let fromLb = TabRouterState(tab: .leaderboard, depth: [.home: 1, .leaderboard: 2], overlays: 1)
        let a2 = HomeButtonRules.route(from: fromLb)
        let end2 = TabRouter.apply(a2, to: fromLb)
        XCTAssertTrue(end2.atRoot(.home))
        XCTAssertEqual(end2.tab, .home)
        XCTAssertEqual(end2.depth[.leaderboard], 0)
        XCTAssertTrue(a2.contains(.select(.home)))

        // A pushed live VS match: the game's own Home already confirmed the forfeit,
        // so the button route never asks again.
        let vs = TabRouterState(tab: .home, depth: [.home: 2], liveVSMatch: true)
        let end3 = TabRouter.apply(HomeButtonRules.route(from: vs), to: vs)
        XCTAssertTrue(end3.atRoot(.home))
    }

    func testCardGuardAndDebounce() {
        let t0 = Date(timeIntervalSince1970: 1_000)
        XCTAssertTrue(HomeButtonRules.acceptsCardTap(at: t0, lastHome: nil))
        XCTAssertFalse(HomeButtonRules.acceptsCardTap(at: t0.addingTimeInterval(0.1), lastHome: t0))
        XCTAssertFalse(HomeButtonRules.acceptsCardTap(at: t0.addingTimeInterval(0.39), lastHome: t0))
        XCTAssertTrue(HomeButtonRules.acceptsCardTap(at: t0.addingTimeInterval(0.41), lastHome: t0))
        XCTAssertTrue(HomeButtonRules.homeFires(at: t0, lastFire: nil))
        XCTAssertFalse(HomeButtonRules.homeFires(at: t0.addingTimeInterval(0.2), lastFire: t0))
        XCTAssertTrue(HomeButtonRules.homeFires(at: t0.addingTimeInterval(1), lastFire: t0))
    }
}
