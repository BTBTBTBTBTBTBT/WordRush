import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AJ: the footer Home tab always lands on Home's root, at the top.
final class TabRouterTests: XCTestCase {
    func testHomeFromThreeLevelsDeepLandsOnRootWithNoOverlay() {
        // Stats → a profile → records (2 pushed) with a sheet over it.
        let s = TabRouterState(tab: .stats, depth: [.stats: 2, .leaderboard: 1], overlays: 1)
        let actions = TabRouter.tap(.home, in: s)
        XCTAssertEqual(actions.first, .dismissOverlays)
        let after = TabRouter.apply(actions, to: s)
        XCTAssertEqual(after.tab, .home)
        XCTAssertEqual(after.overlays, 0)
        XCTAssertTrue(AppTab.allCases.allSatisfy { after.atRoot($0) })
        XCTAssertEqual(after.scrolledToTop[.home], true)
    }

    func testHomeOnHomeRootScrollsToTop() {
        let s = TabRouterState(tab: .home)
        XCTAssertEqual(TabRouter.tap(.home, in: s), [.scrollToTop(.home)])
    }

    func testRetapCurrentTabPopsItToRoot() {
        let s = TabRouterState(tab: .friends, depth: [.friends: 3])
        let actions = TabRouter.tap(.friends, in: s)
        XCTAssertEqual(actions, [.popToRoot(.friends), .scrollToTop(.friends)])
        XCTAssertTrue(TabRouter.apply(actions, to: s).atRoot(.friends))
    }

    func testOtherTabJustSwitches() {
        let s = TabRouterState(tab: .home, depth: [.leaderboard: 1])
        XCTAssertEqual(TabRouter.tap(.leaderboard, in: s), [.select(.leaderboard)])
    }

    func testLiveVSMatchAsksFirst() {
        let s = TabRouterState(tab: .home, overlays: 1, liveVSMatch: true)
        XCTAssertEqual(TabRouter.tap(.home, in: s), [.confirmForfeit])
    }
}
