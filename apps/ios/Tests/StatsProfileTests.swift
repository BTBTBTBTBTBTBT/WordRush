import XCTest
@testable import WordociousCore

/// Wave 4 parity guard (iOS side): StatsProfile must decide exactly like packages/core/src/stats-profile.ts
/// (the same cases as stats-profile.test.ts).
final class StatsProfileTests: XCTestCase {
    func testPickerSplitFiveOverFour() {
        let s = StatsProfile.pickerSplit([1, 2, 3, 4, 5, 6, 7, 8, 9])
        XCTAssertEqual(s.top, [1, 2, 3, 4, 5])
        XCTAssertEqual(s.bottom, [6, 7, 8, 9])
        XCTAssertEqual(StatsProfile.pickerSplit([1, 2, 3]).bottom, [])
        XCTAssertEqual(StatsProfile.pickerSplit([1, 2, 3, 4, 5, 6]).top.count, 3)
    }

    func testHeroStats() {
        let h = StatsProfile.heroStats(wins: 3, losses: 2, streak: 2, bestStreak: 4, fastestSeconds: 16)
        XCTAssertEqual(h.map { $0.value }, ["3–2", "60%", "2", "16s"])
        XCTAssertEqual(h[2].sub, "Best 4")
        XCTAssertEqual(h[0].icon, "crown")
        let none = StatsProfile.heroStats(wins: 0, losses: 0, streak: 0, bestStreak: 0, fastestSeconds: 0)
        XCTAssertEqual(none.map { $0.value }, ["0–0", "—", "0", "—"])
        XCTAssertNil(none[2].sub)
    }

    func testFormatsAndRates() {
        XCTAssertEqual(StatsProfile.formatFastest(65), "1m 5s")
        XCTAssertEqual(StatsProfile.formatFastest(120), "2m")
        XCTAssertEqual(StatsProfile.formatFastest(0), "—")
        XCTAssertEqual(StatsProfile.winRatePct(26, 17), 60)
        XCTAssertEqual(StatsProfile.winRatePct(0, 0), 0)
    }

    func testGuessChartHiddenUntilAWin() {
        XCTAssertFalse(StatsProfile.showGuessDistribution([0, 0]))
        XCTAssertFalse(StatsProfile.showGuessDistribution([]))
        XCTAssertTrue(StatsProfile.showGuessDistribution([0, 2]))
    }

    func testRecordBarAndBotsLine() {
        let b = StatsProfile.recordBar(wins: 3, losses: 1)
        XCTAssertEqual(b.winFrac, 0.75, accuracy: 0.0001)
        XCTAssertEqual(b.lossFrac, 0.25, accuracy: 0.0001)
        XCTAssertTrue(StatsProfile.recordBar(wins: 0, losses: 0).empty)
        XCTAssertEqual(StatsProfile.botsLine(wins: 26, losses: 17), "26–17 · 60%")
        XCTAssertEqual(StatsProfile.botsLine(wins: 0, losses: 0), "Beat a bot to start")
    }

    func testPocketRecords() {
        typealias R = StatsProfile.PocketGameRow
        let rows = [
            R(kind: .ghost, playerA: "me", playerB: "jo", status: "done", winner: "me"),
            R(kind: .ghost, playerA: "jo", playerB: "me", status: "done", winner: "jo"),
            R(kind: .ghost, playerA: "me", playerB: "jo", status: "resigned", winner: "me"),
            R(kind: .rps, playerA: "me", playerB: "al", status: "done", winner: nil),
            R(kind: .chain, playerA: "me", playerB: "al", status: "done", winner: "me", chainWords: 14),
            R(kind: .chain, playerA: "me", playerB: "al", status: "done", winner: "me", chainWords: 9),
            R(kind: .coin, playerA: "me", playerB: "al", status: "active", winner: nil),
            R(kind: .coin, playerA: "me", playerB: "al", status: "expired", winner: nil),
            R(kind: .ttt, playerA: "x", playerB: "y", status: "done", winner: "x"),
        ]
        let r = StatsProfile.pocketRecords(rows, me: "me")
        XCTAssertEqual(r.byKind.map { $0.kind }, [.rps, .ttt, .coin, .pass, .ghost, .chain])
        let ghost = r.byKind.first { $0.kind == .ghost }!
        XCTAssertEqual([ghost.wins, ghost.losses, ghost.draws], [2, 1, 0])
        XCTAssertEqual(StatsProfile.pocketLine(ghost.record), "2–1")
        XCTAssertEqual(r.byKind.first { $0.kind == .rps }!.draws, 1)
        XCTAssertEqual(r.byKind.first { $0.kind == .coin }!.wins, 0)
        XCTAssertEqual(r.byKind.first { $0.kind == .ttt }!.wins, 0)
        XCTAssertEqual(r.total, StatsProfile.PocketRecord(wins: 4, losses: 1, draws: 1))
        XCTAssertEqual(r.byFriend["jo"]!.total, StatsProfile.PocketRecord(wins: 2, losses: 1, draws: 0))
        XCTAssertEqual(r.byFriend["al"]!.byKind["chain"], StatsProfile.PocketRecord(wins: 2, losses: 0, draws: 0))
        XCTAssertEqual(StatsProfile.pocketTileLine(r.byKind.first { $0.kind == .chain }!), "2–0 · best 14")
        XCTAssertEqual(StatsProfile.pocketTileLine(r.byKind.first { $0.kind == .pass }!), "No games yet")
        XCTAssertEqual(StatsProfile.pocketLine(StatsProfile.PocketRecord(wins: 1, losses: 1, draws: 2)), "1–1–2")
    }

    func testProfileActions() {
        func a(_ isSelf: Bool = false, friend: Bool = false, incoming: Bool = false, requested: Bool = false) -> (row: [StatsProfile.ProfileAction], menu: [StatsProfile.ProfileMenuAction]) {
            StatsProfile.profileActions(StatsProfile.friendshipState(isSelf: isSelf, isFriend: friend, incoming: incoming, requested: requested))
        }
        XCTAssertEqual(a(friend: true).row, [.challenge, .pocket, .react])
        XCTAssertEqual(a(friend: true).menu, [.unfriend, .block, .report])
        XCTAssertEqual(a().row, [.addFriend])
        XCTAssertEqual(a().menu, [.block, .report])
        XCTAssertEqual(a(requested: true).row, [.requested])
        XCTAssertEqual(a(incoming: true).row, [.accept, .decline])
        XCTAssertEqual(a(true).row, [])
        XCTAssertEqual(a(true).menu, [])
    }

    func testFriendsSinceAndLayout() {
        XCTAssertEqual(StatsProfile.friendsSinceLine("2026-09-14T12:00:00Z"), "Friends since Sep 2026")
        XCTAssertNil(StatsProfile.friendsSinceLine(nil))
        XCTAssertNil(StatsProfile.friendsSinceLine("nope"))
        XCTAssertTrue(StatsProfile.highlightsLayout(count: 0).fold)
        XCTAssertTrue(StatsProfile.highlightsLayout(count: 1).fold)
        XCTAssertEqual(StatsProfile.highlightsLayout(count: 3).shown, 2)
        XCTAssertEqual(StatsProfile.highlightsLayout(count: 6).shown, 4)
        XCTAssertEqual(StatsProfile.highlightsLayout(count: 2).shown, 2)
    }

    func testHeadToHeadLineAndColors() {
        typealias P = StatsProfile.PocketRecord
        XCTAssertEqual(StatsProfile.headToHeadLine(vs: P(wins: 3, losses: 1), pocket: P(wins: 2, losses: 2)), "Daily scores 3–1 · Pocket games 2–2")
        XCTAssertEqual(StatsProfile.headToHeadLine(vs: P(), pocket: P(wins: 1)), "Pocket games 1–0")
        XCTAssertEqual(StatsProfile.headToHeadLine(vs: P(), pocket: P()), "No games together yet")
        XCTAssertEqual(StatsProfile.sectionTitleColor("Head to Head"), "#2563eb")
        XCTAssertEqual(StatsProfile.sectionTitleColor("unknown"), "#7c3aed")
    }

    func testGoProScenes() {
        XCTAssertEqual(StatsProfile.proBenefit(forReason: "Pro mascot styles"), .items)
        XCTAssertEqual(StatsProfile.proBenefit(forReason: "Unlimited QuadWord"), .unlimited)
        XCTAssertEqual(StatsProfile.proBenefit(forReason: "Unlimited play"), .unlimited)
        XCTAssertEqual(StatsProfile.proBenefit(forReason: "VS Bots"), .vsBots)
        XCTAssertEqual(StatsProfile.proBenefit(forReason: "Extended stats"), .stats)
        XCTAssertEqual(StatsProfile.proBenefit(forReason: nil), .unlimited)
        XCTAssertEqual(Set(StatsProfile.proBenefitOrder.compactMap { StatsProfile.proScenes[$0] }).count, 5)
    }
}
