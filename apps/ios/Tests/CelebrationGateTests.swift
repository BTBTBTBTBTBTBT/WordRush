import XCTest
@testable import WordociousCore

/// FINISH_SPEC BI16: late celebrations wait for calm; a transient refresh
/// failure never signs the player out.
final class CelebrationGateTests: XCTestCase {
    func testCalmNeedsHomeRootNothingPresentedNoPopup() {
        XCTAssertTrue(CelebrationGate.isCalm(onHomeRoot: true, anythingPresented: false, popupUp: false))
        XCTAssertFalse(CelebrationGate.isCalm(onHomeRoot: false, anythingPresented: false, popupUp: false))
        XCTAssertFalse(CelebrationGate.isCalm(onHomeRoot: true, anythingPresented: true, popupUp: false))
        XCTAssertFalse(CelebrationGate.isCalm(onHomeRoot: true, anythingPresented: false, popupUp: true))
    }

    func testReplayAndSyncAreAlwaysLate() {
        XCTAssertTrue(CelebrationGate.isLate(source: .replay, startedAt: nil))
        XCTAssertTrue(CelebrationGate.isLate(source: .sync, startedAt: Date()))
    }

    func testLiveIsLateOnlyPastThreshold() {
        let start = Date(timeIntervalSince1970: 1_000)
        XCTAssertFalse(CelebrationGate.isLate(source: .live, startedAt: start, now: start.addingTimeInterval(2)))
        XCTAssertFalse(CelebrationGate.isLate(source: .live, startedAt: start, now: start.addingTimeInterval(6)))
        XCTAssertTrue(CelebrationGate.isLate(source: .live, startedAt: start, now: start.addingTimeInterval(6.5)))
        XCTAssertFalse(CelebrationGate.isLate(source: .live, startedAt: nil))
    }

    func testPastDaySweepIsDropped() {
        XCTAssertTrue(CelebrationGate.shouldDrop(celebrationDay: "2026-10-02", today: "2026-10-03"))
        XCTAssertFalse(CelebrationGate.shouldDrop(celebrationDay: "2026-10-03", today: "2026-10-03"))
    }

    func testNextWaitsForCalmAndDropsYesterday() {
        struct C { let name: String; let day: String? }
        var q = [C(name: "yesterday-sweep", day: "2026-10-02"),
                 C(name: "badge", day: nil),
                 C(name: "today-sweep", day: "2026-10-03")]
        // Not calm: nothing presents, but yesterday's sweep is already gone.
        XCTAssertNil(CelebrationGate.next(&q, day: \.day, today: "2026-10-03", calm: false))
        XCTAssertEqual(q.map(\.name), ["badge", "today-sweep"])
        XCTAssertEqual(CelebrationGate.next(&q, day: \.day, today: "2026-10-03", calm: true)?.name, "badge")
        XCTAssertEqual(CelebrationGate.next(&q, day: \.day, today: "2026-10-03", calm: true)?.name, "today-sweep")
        XCTAssertNil(CelebrationGate.next(&q, day: \.day, today: "2026-10-03", calm: true))
    }
}

final class AuthSessionPolicyTests: XCTestCase {
    /// The founder's outage case: the refresh timed out / auth answered 5xx.
    func testTransientRefreshErrorKeepsUserSignedIn() {
        let timeout = AuthSessionPolicy.classify(isSessionMissing: false, errorCode: nil, httpStatus: nil)
        let serverError = AuthSessionPolicy.classify(isSessionMissing: false, errorCode: "unexpected_failure", httpStatus: 500)
        let gateway = AuthSessionPolicy.classify(isSessionMissing: false, errorCode: nil, httpStatus: 503,
                                                 message: "connection to database not available")
        let throttled = AuthSessionPolicy.classify(isSessionMissing: false, errorCode: "over_request_rate_limit", httpStatus: 429)
        for outcome in [timeout, serverError, gateway, throttled] {
            XCTAssertEqual(outcome, .transient)
            XCTAssertTrue(AuthSessionPolicy.keepsUserSignedIn(outcome, hasStoredSession: true))
        }
    }

    func testRevokedRefreshTokenSignsOut() {
        for code in ["refresh_token_not_found", "refresh_token_already_used", "session_not_found",
                     "session_expired", "user_not_found", "user_banned"] {
            let o = AuthSessionPolicy.classify(isSessionMissing: false, errorCode: code, httpStatus: 400)
            XCTAssertEqual(o, .revoked, code)
            XCTAssertFalse(AuthSessionPolicy.keepsUserSignedIn(o, hasStoredSession: true))
        }
        let legacy = AuthSessionPolicy.classify(isSessionMissing: false, errorCode: nil, httpStatus: 400,
                                                message: "Invalid Refresh Token: Already Used")
        XCTAssertEqual(legacy, .revoked)
    }

    func testNoStoredSessionIsSignedOut() {
        let o = AuthSessionPolicy.classify(isSessionMissing: true, errorCode: nil, httpStatus: nil)
        XCTAssertEqual(o, .noSession)
        XCTAssertFalse(AuthSessionPolicy.keepsUserSignedIn(o, hasStoredSession: false))
        // A transient error with nothing stored has nothing to keep.
        XCTAssertFalse(AuthSessionPolicy.keepsUserSignedIn(.transient, hasStoredSession: false))
    }

    func testRetryBackoff() {
        XCTAssertEqual((0..<6).map(AuthSessionPolicy.retryDelay), [5, 15, 30, 60, 60, 60])
    }

    // MARK: 2.8 item 52 — the celebration fires at the right moment

    private let daily = ["DUEL", "QUORDLE", "OCTORDLE", "SEQUENCE", "RESCUE", "GAUNTLET", "PROPERNOUNDLE_SWEEP", "DUEL6"]
    private let more = ["SUDOKU", "REGIONS", "LADDER", "WORDSEARCH", "HUB", "CRYPTOGRAM", "GROUPS", "CROSSWORD", "SCRAMBLE", "PROPERNOUNDLE"]
    private let today = "2026-10-09"

    private func results(_ keys: [String], lost: [String] = []) -> [String: Bool] {
        Dictionary(uniqueKeysWithValues: keys.map { ($0, !lost.contains($0)) })
    }
    private func due(_ r: [String: Bool], seen: @escaping (CelebrationGate.Group) -> CelebrationGate.Tier? = { _ in nil },
                     dataDay: String? = nil) -> [CelebrationGate.Due] {
        CelebrationGate.due(results: r, dailyKeys: daily, moreKeys: more, today: today, dataDay: dataDay ?? today, seen: seen)
    }

    func testLastDailyFinishMakesFlawlessDueImmediatelyFromLocalResults() {
        XCTAssertEqual(due(results(Array(daily.prefix(7)))), [])
        XCTAssertEqual(due(results(daily)), [CelebrationGate.Due(group: .daily, tier: .flawless, token: "\(today):daily:flawless")])
        XCTAssertEqual(due(results(daily, lost: ["GAUNTLET"])).map(\.tier), [.sweep])
    }

    func testPuzzlesCelebrationAfterTheTenthAndNeverRepeatsTheDailies() {
        let seenDaily: (CelebrationGate.Group) -> CelebrationGate.Tier? = { $0 == .daily ? .flawless : nil }
        XCTAssertEqual(due(results(daily + more), seen: seenDaily).map(\.group), [.more])
        XCTAssertEqual(due(results(daily + Array(more.prefix(9))), seen: seenDaily), [])
    }

    func testNeverTwiceAndFlawlessUpgradeAndRestart() {
        XCTAssertEqual(due(results(daily), seen: { $0 == .daily ? .flawless : nil }), [])
        XCTAssertEqual(due(results(daily, lost: ["DUEL"]), seen: { $0 == .daily ? .sweep : nil }), [])
        XCTAssertEqual(due(results(daily), seen: { $0 == .daily ? .sweep : nil }).map(\.tier), [.flawless])
        // restart mid-day: the restored set is due until its token is stored
        XCTAssertEqual(due(results(daily)).count, 1)
    }

    func testStaleDayAndZeroWinsNeverCelebrate() {
        XCTAssertEqual(due(results(daily), dataDay: "2026-10-08"), [])
        XCTAssertEqual(due(results(daily, lost: daily)), [])
    }

    func testActionPresentsGoesHomeWaitsOrDrops() {
        func act(_ source: CelebrationGate.Source = .live, home: Bool = true, open: Bool = false, popup: Bool = false, day: String = "2026-10-09") -> CelebrationGate.Action {
            CelebrationGate.action(source: source, onHomeRoot: home, anythingPresented: open, popupUp: popup, celebrationDay: day, today: today)
        }
        XCTAssertEqual(act(), .present)
        XCTAssertEqual(act(home: false), .goHomeThenPresent)
        XCTAssertEqual(act(open: true), .wait)
        XCTAssertEqual(act(popup: true), .wait)
        XCTAssertEqual(act(home: false, open: true), .wait)
        XCTAssertEqual(act(.replay, home: false), .wait)
        XCTAssertEqual(act(.sync, home: true), .present)
        XCTAssertEqual(act(day: "2026-10-08"), .drop)
        XCTAssertEqual(act(open: true, day: "2026-10-08"), .drop)
    }

    func testNextDefersWhileACelebrationIsPending() {
        XCTAssertTrue(CelebrationGate.shouldDeferHandoff(pending: 1))
        XCTAssertFalse(CelebrationGate.shouldDeferHandoff(pending: 0))
    }
}
