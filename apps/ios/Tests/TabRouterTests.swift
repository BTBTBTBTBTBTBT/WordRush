import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AJ: the footer Home tab always lands on Home's root (BI11: at the position
/// the player left; only a re-tap on a tab's root scrolls it to the top).
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
        // BI11: coming back from another tab keeps Home where the player left it.
        XCTAssertNil(after.scrolledToTop[.home])
        XCTAssertFalse(actions.contains(.scrollToTop(.home)))
    }

    func testHomeFromAnotherTabKeepsScrollPosition() {
        // BI11: Home → (scrolled halfway) → Leaderboard → Home: no scroll to the top.
        XCTAssertEqual(TabRouter.tap(.home, in: TabRouterState(tab: .leaderboard)), [.select(.home)])
        // Every tab: switching back keeps its position.
        XCTAssertEqual(TabRouter.tap(.stats, in: TabRouterState(tab: .home)), [.select(.stats)])
        XCTAssertEqual(TabRouter.tap(.friends, in: TabRouterState(tab: .stats)), [.select(.friends)])
    }

    func testRetapAtRootScrollsEveryTabToTop() {
        for t in AppTab.allCases {
            XCTAssertEqual(TabRouter.tap(t, in: TabRouterState(tab: t)), [.scrollToTop(t)])
        }
    }

    func testHomeOnHomeRootScrollsToTop() {
        let s = TabRouterState(tab: .home)
        XCTAssertEqual(TabRouter.tap(.home, in: s), [.scrollToTop(.home)])
    }

    func testRetapCurrentTabPopsItToRoot() {
        let s = TabRouterState(tab: .friends, depth: [.friends: 3])
        let actions = TabRouter.tap(.friends, in: s)
        // BI11: the pop lands on the root where it was; the NEXT re-tap scrolls to the top.
        XCTAssertEqual(actions, [.popToRoot(.friends)])
        let after = TabRouter.apply(actions, to: s)
        XCTAssertTrue(after.atRoot(.friends))
        XCTAssertEqual(TabRouter.tap(.friends, in: after), [.scrollToTop(.friends)])
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
