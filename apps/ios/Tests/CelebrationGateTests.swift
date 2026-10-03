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
}
