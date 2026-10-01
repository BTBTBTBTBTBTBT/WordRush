import XCTest
@testable import WordociousCore

/// VS lobby parity guard (iOS side): VsLobby must produce the same words,
/// outcomes and ladder steps as packages/core/src/vs-lobby.ts for every fixture
/// case, so the VS page reads identically on web, iOS and Android.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class VsLobbyFixtureTests: XCTestCase {
    private struct Banner: Decodable {
        let name: String
        let battle: VsDayResult
        let botOfDay: VsDayResult
        let incomingFrom: String?
        let streak: Int
        let free: Bool
        let headline: String
        let clock: String
        let status: String
    }
    private struct Record: Decodable {
        let people: WinLoss
        let bots: WinLoss
        let ladder: Int?
        let line: String
    }
    private struct Outcome: Decodable {
        let me: VsRun
        let them: VsRun
        let outcome: VsOutcome
        let margin: String
        let headline: String
    }
    private struct LadderStep: Decodable {
        let bot: String
        let won: Bool
        let after: BotLadderState
        let rungs: [LadderRung]
    }
    private struct Fixtures: Decodable {
        let banners: [Banner]
        let records: [Record]
        let outcomes: [Outcome]
        let ladder: [LadderStep]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "vs-lobby-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testBannersMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.banners.isEmpty)
        for (i, c) in f.banners.enumerated() {
            let input = VsBannerInput(name: c.name, battle: c.battle, botOfDay: c.botOfDay, incomingFrom: c.incomingFrom, streak: c.streak)
            XCTAssertEqual(VsLobby.vsBannerHeadline(input), c.headline, "headline #\(i)")
            // The generator's clock is "07:12:40" and the open challenge has "17H" left.
            XCTAssertEqual(VsLobby.vsBannerClockLine(input, clock: "07:12:40", free: c.free, challengeLeft: "17H"), c.clock, "clock #\(i)")
            XCTAssertEqual(VsLobby.vsTodayStatus(battle: c.battle, botOfDay: c.botOfDay), c.status, "status #\(i)")
        }
    }

    func testRecordLinesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.records.isEmpty)
        for (i, c) in f.records.enumerated() {
            XCTAssertEqual(VsLobby.vsRecordLine(people: c.people, bots: c.bots, ladder: c.ladder), c.line, "record #\(i)")
        }
    }

    func testOutcomesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.outcomes.isEmpty)
        for (i, c) in f.outcomes.enumerated() {
            XCTAssertEqual(VsLobby.vsOutcome(c.me, c.them), c.outcome, "outcome #\(i)")
            XCTAssertEqual(VsLobby.vsMargin(c.me, c.them), c.margin, "margin #\(i)")
            XCTAssertEqual(VsLobby.challengeHeadline(c.outcome, from: "Doug"), c.headline, "headline #\(i)")
        }
    }

    func testLadderMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.ladder.isEmpty)
        // The fixtures are one run folded game by game from an empty ladder.
        var s = BotLadderState(cleared: 0, run: 0)
        for (i, c) in f.ladder.enumerated() {
            s = VsLobby.ladderAfterGame(s, botId: c.bot, won: c.won)
            XCTAssertEqual(s, c.after, "after #\(i)")
            XCTAssertEqual(VsLobby.ladderRungs(s), c.rungs, "rungs #\(i)")
        }
    }

    func testClockAndNames() {
        XCTAssertEqual(VsLobby.vsClock(65_000), "1:05")
        XCTAssertEqual(VsLobby.vsClock(500), "0:01")
        XCTAssertEqual(VsLobby.vsClock(-3_000), "0:00")
        XCTAssertEqual(VsLobby.challengeHeadline(.loss, from: "  "), "THEIR’S RUN HELD!")
        XCTAssertEqual(VsLobby.botName("adapt"), "Adapt")
        XCTAssertEqual(VsLobby.modeOrder.count, 9)
    }
}
