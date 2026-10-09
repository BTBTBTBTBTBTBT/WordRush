import XCTest
@testable import WordociousCore

/// Live pocket games: the same cases as packages/core/src/friendly-live.test.ts.
final class FriendlyLiveTests: XCTestCase {
    private let t1 = "2026-10-09T12:00:00.000+00:00"
    private let t2 = "2026-10-09T12:00:01.000+00:00"
    private let t3 = "2026-10-09T12:00:02.000+00:00"

    private func view(_ state: FriendlyState, _ at: String, status: String = "active", yourTurn: Bool = true) -> FriendlyGameView {
        FriendlyGameView(id: "g1", kind: state.kind, title: "T", me: .a,
                         opponent: .init(id: "u2", username: "J", avatarUrl: nil, avatarEmoji: nil),
                         state: state, status: status, yourTurn: yourTurn, result: nil, line: "", answer: nil,
                         createdAt: t1, updatedAt: at)
    }

    func testPollAndTopic() {
        XCTAssertEqual(FriendlyLive.pollIntervalMs(liveOn: false, socketUp: true), 2000)
        XCTAssertEqual(FriendlyLive.pollIntervalMs(liveOn: true, socketUp: true), 20000)
        XCTAssertEqual(FriendlyLive.pollIntervalMs(liveOn: true, socketUp: false), 4000)
        XCTAssertEqual(FriendlyLive.topic("abc"), "fg:abc")
    }

    func testPresence() {
        XCTAssertEqual(FriendlyLive.presenceLabel(peerPresent: true, everSeen: true, theirTurn: false), .here)
        XCTAssertEqual(FriendlyLive.presenceLabel(peerPresent: true, everSeen: true, theirTurn: true), .thinking)
        XCTAssertEqual(FriendlyLive.presenceLabel(peerPresent: false, everSeen: true, theirTurn: true), .left)
        XCTAssertEqual(FriendlyLive.presenceLabel(peerPresent: false, everSeen: false, theirTurn: true), .away)
    }

    func testStaleness() {
        XCTAssertTrue(FriendlyLive.isNewer(nil, t1))
        XCTAssertFalse(FriendlyLive.isNewer(t2, t1))
        XCTAssertFalse(FriendlyLive.isNewer(t1, t1))
        XCTAssertTrue(FriendlyLive.isNewer("2026-10-09T12:00:00.000Z", "2026-10-09T12:00:00.500+00:00"))
    }

    func testPredictMove() {
        let ttt = FriendlyGames.newState(.ttt)
        guard case .ttt(let t)? = FriendlyLive.predictMove(ttt, side: .a, .ttt(4)) else { return XCTFail("ttt predicts") }
        XCTAssertEqual(t.board[4], .a)
        XCTAssertNil(FriendlyLive.predictMove(ttt, side: .b, .ttt(4)))
        XCTAssertNotNil(FriendlyLive.predictMove(FriendlyGames.newState(.rps), side: .a, .rps(.rock)))
        XCTAssertNotNil(FriendlyLive.predictMove(FriendlyGames.newState(.chain), side: .a, .chain("PLANE")))
        XCTAssertNil(FriendlyLive.predictMove(FriendlyGames.newState(.chain), side: .a, .chain("NO")))
        XCTAssertNil(FriendlyLive.predictMove(FriendlyGames.newState(.coin), side: .a, .coin(.heads)))
        XCTAssertNil(FriendlyLive.predictMove(FriendlyGames.newState(.pass), side: .a, .pass("CRANE")))
        XCTAssertNil(FriendlyLive.predictMove(FriendlyGames.newState(.ghost), side: .a, .ghost("Q")))
    }

    func testOptimisticBeginConfirmReject() {
        var s = FriendlyLive.Snapshot(confirmed: view(FriendlyGames.newState(.ttt), t1))
        XCTAssertTrue(s.beginMove(.ttt(0)))
        XCTAssertEqual(s.displayed?.yourTurn, false)
        XCTAssertFalse(s.beginMove(.ttt(1)), "one in flight at a time")
        // reject rolls back
        XCTAssertTrue(s.rejectMove())
        if case .ttt(let t)? = s.displayed?.state { XCTAssertEqual(t.board[0], nil) } else { XCTFail() }
        XCTAssertFalse(s.rejectMove())
        // server-decided game: no prediction
        var coin = FriendlyLive.Snapshot(confirmed: view(FriendlyGames.newState(.coin), t1))
        XCTAssertFalse(coin.beginMove(.coin(.heads)))
        XCTAssertNil(coin.pending)
    }

    func testLateReplyNeverReplacesNewerBroadcast() {
        var s = FriendlyLive.Snapshot(confirmed: view(FriendlyGames.newState(.ttt), t1))
        s.beginMove(.ttt(0))
        _ = s.receive(view(FriendlyGames.newState(.ttt), t3))
        s.confirmMove(view(FriendlyGames.newState(.ttt), t2))
        XCTAssertEqual(s.confirmed?.updatedAt, t3)
        XCTAssertNil(s.pending)
    }

    func testReceive() {
        var s = FriendlyLive.Snapshot(confirmed: view(FriendlyGames.newState(.ttt), t2, yourTurn: false))
        XCTAssertFalse(s.receive(view(FriendlyGames.newState(.ttt), t1)).applied)
        XCTAssertFalse(s.receive(view(FriendlyGames.newState(.ttt), t2)).applied)
        guard case .ttt(var t) = FriendlyGames.newState(.ttt) else { return XCTFail() }
        t.board[1] = .b
        let r = s.receive(view(.ttt(t), t3, yourTurn: true))
        XCTAssertTrue(r.applied)
        XCTAssertEqual(r.change, FriendlyLive.Change(moved: true, yourTurnStarted: true, ended: false))
        let over = s.receive(view(.ttt(t), "2026-10-09T12:00:09.000+00:00", status: "resigned", yourTurn: false))
        XCTAssertTrue(over.change.ended)
    }

    func testTheirMoveWhileMineInFlightDropsPrediction() {
        var s = FriendlyLive.Snapshot(confirmed: view(FriendlyGames.newState(.rps), t1))
        s.beginMove(.rps(.rock))
        XCTAssertNotNil(s.pending)
        _ = s.receive(view(FriendlyGames.newState(.rps), t2))
        XCTAssertNil(s.pending)
    }
}
