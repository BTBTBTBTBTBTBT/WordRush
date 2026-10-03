import XCTest
@testable import WordociousCore

/// FINISH_SPEC BI19: instant W/L + leaderboard from local results; cache-first pages.
final class OptimisticResultsTests: XCTestCase {
    struct R: Codable, Equatable { let won: Bool; let score: Double }
    struct Row: Equatable { let user: String; let score: Double; let time: Double }

    private func ledger(_ day: String = "2026-10-03") -> CompletionLedger<R> {
        CompletionLedger<R>(day: day, isWin: { $0.won })
    }

    func testFinishShowsOnHomeSynchronously() {
        var l = ledger()
        l.apply(mode: "CLASSIC", result: R(won: true, score: 812), today: "2026-10-03")
        // No await, no network: the W is in the map the moment the finish applies.
        XCTAssertEqual(l.byMode["CLASSIC"], R(won: true, score: 812))
        l.apply(mode: "OCTORDLE", result: R(won: false, score: 0), today: "2026-10-03")
        XCTAssertEqual(l.byMode["OCTORDLE"]?.won, false)   // an L shows as instantly
    }

    func testReplayNeverDowngradesAWin() {
        var l = ledger()
        l.apply(mode: "CLASSIC", result: R(won: true, score: 800), today: "2026-10-03")
        XCTAssertFalse(l.apply(mode: "CLASSIC", result: R(won: false, score: 0), today: "2026-10-03"))
        XCTAssertEqual(l.byMode["CLASSIC"]?.won, true)
    }

    func testFinishAfterMidnightStartsAFreshDay() {
        var l = ledger("2026-10-02")
        l.apply(mode: "CLASSIC", result: R(won: true, score: 800), today: "2026-10-02")
        l.apply(mode: "QUORDLE", result: R(won: true, score: 700), today: "2026-10-03")
        XCTAssertEqual(Array(l.byMode.keys), ["QUORDLE"])
        XCTAssertEqual(l.day, "2026-10-03")
    }

    func testServerReconcileReplacesLocal() {
        var l = ledger()
        l.apply(mode: "CLASSIC", result: R(won: true, score: 800), today: "2026-10-03")
        l.apply(mode: "QUORDLE", result: R(won: true, score: 650), today: "2026-10-03")
        // Server has CLASSIC with a different score (it wins, silently); QUORDLE's
        // write is still queued, so the local one stays until it lands.
        l.reconcile(server: ["CLASSIC": R(won: true, score: 795)],
                    stillPending: ["QUORDLE": R(won: true, score: 650)], today: "2026-10-03")
        XCTAssertEqual(l.byMode["CLASSIC"], R(won: true, score: 795))
        XCTAssertEqual(l.byMode["QUORDLE"], R(won: true, score: 650))
        // Once it lands and nothing is pending, only the server's rows remain.
        l.reconcile(server: ["CLASSIC": R(won: true, score: 795)], stillPending: [:], today: "2026-10-03")
        XCTAssertNil(l.byMode["QUORDLE"])
    }

    func testLedgerSurvivesRelaunch() throws {
        let suite = "bi19-ledger-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        var l = ledger()
        l.apply(mode: "CLASSIC", result: R(won: true, score: 812), today: "2026-10-03")
        l.save(to: defaults, key: "k")
        // "Relaunch": a fresh read of the same store.
        let reread = try XCTUnwrap(UserDefaults(suiteName: suite))
        XCTAssertEqual(CompletionLedger<R>.load(from: reread, key: "k", today: "2026-10-03")?["CLASSIC"],
                       R(won: true, score: 812))
        // Tomorrow it is gone (yesterday's W never shows as today's).
        XCTAssertNil(CompletionLedger<R>.load(from: reread, key: "k", today: "2026-10-04"))
    }

    // MARK: Leaderboard merge

    private func merge(_ rows: [Row], me: String = "me", score: Double, time: Double, count: Int? = nil) -> ([Row], Int, (rank: Int, total: Int)?) {
        let r = OptimisticResults.merge(
            rows: rows, playerCount: count ?? rows.count, local: Row(user: me, score: score, time: time),
            userId: me, score: score, time: time,
            rowUserId: \.user, rowScore: \.score, rowTime: \.time)
        return (r.rows, r.playerCount, r.rank)
    }

    func testMergePlacesLocalRowInRankOrder() {
        let board = [Row(user: "a", score: 900, time: 60), Row(user: "b", score: 800, time: 50),
                     Row(user: "c", score: 800, time: 90), Row(user: "d", score: 500, time: 40)]
        let (rows, count, rank) = merge(board, score: 800, time: 70)
        XCTAssertEqual(rows.map(\.user), ["a", "b", "me", "c", "d"])   // ties broken by time
        XCTAssertEqual(count, 5)
        XCTAssertEqual(rank?.rank, 3)
        // An empty board ("No daily results yet") shows the player alone, ranked #1.
        let (solo, _, soloRank) = merge([], score: 300, time: 100)
        XCTAssertEqual(solo.map(\.user), ["me"])
        XCTAssertEqual(soloRank?.rank, 1)
    }

    func testServerRowReplacesLocalRow() {
        // The write landed: the server's row (its values, even if they differ) wins.
        let board = [Row(user: "a", score: 900, time: 60), Row(user: "ME", score: 780, time: 75)]
        let (rows, count, rank) = merge(board, score: 800, time: 70)
        XCTAssertEqual(rows, board)
        XCTAssertEqual(count, 2)
        XCTAssertNil(rank)
    }

    func testNoScoreOrPastTheListIsNotInserted() {
        XCTAssertNil(merge([Row(user: "a", score: 1, time: 1)], score: 0, time: 10).2)
        let full = (0..<50).map { Row(user: "u\($0)", score: Double(1000 - $0), time: 10) }
        let (rows, _, rank) = merge(full, score: 1, time: 10)
        XCTAssertEqual(rows.count, 50)   // past the top 50 → the rank window owns it
        XCTAssertNil(rank)
    }

    // MARK: Cache-first

    func testCacheFirstNeverBlanks() {
        XCTAssertEqual(CacheFirst.keep(fresh: [Int](), cached: [1, 2]), [1, 2])
        XCTAssertEqual(CacheFirst.keep(fresh: [3], cached: [1, 2]), [3])
        XCTAssertEqual(CacheFirst.keep(fresh: [Int](), cached: []), [])
        XCTAssertEqual(CacheFirst.keep(fresh: nil, cached: 7), 7)
        XCTAssertEqual(CacheFirst.keep(fresh: 8, cached: 7), 8)
        XCTAssertFalse(CacheFirst.changed([1, 2], from: [1, 2]))
    }

    func testPersistentMemoSurvivesRelaunch() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("bi19-memo-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let a = PersistentMemoStore(url: url)
        a.set("statRows:u1", ["CLASSIC": 41, "QUORDLE": 12])
        a.set("medals:u1", ["gold", "silver"])
        a.flush()
        let b = PersistentMemoStore(url: url)   // relaunch
        XCTAssertEqual(b.get("statRows:u1", as: [String: Int].self), ["CLASSIC": 41, "QUORDLE": 12])
        XCTAssertEqual(b.get("medals:u1", as: [String].self), ["gold", "silver"])
        XCTAssertNil(b.get("missing", as: [String].self))
    }

    func testPersistentMemoIsSizeBounded() {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("bi19-memo-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let a = PersistentMemoStore(url: url, maxBytes: 300)
        a.set("old", String(repeating: "x", count: 200))
        Thread.sleep(forTimeInterval: 0.01)
        a.set("new", String(repeating: "y", count: 200))
        a.flush()
        let b = PersistentMemoStore(url: url, maxBytes: 300)
        XCTAssertNil(b.get("old", as: String.self))
        XCTAssertNotNil(b.get("new", as: String.self))
    }
}
