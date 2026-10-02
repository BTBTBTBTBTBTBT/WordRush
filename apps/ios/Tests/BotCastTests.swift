import XCTest
@testable import WordociousCore

/// FINISH_SPEC §D1–D2: the bot cast table, the old-id / ladder migration and the
/// Bot of the Day rotation (mirrors the packages/core table).
final class BotCastTests: XCTestCase {
    func testLadderIsTheTenCastBotsInOrder() {
        XCTAssertEqual(BotCast.ladderIds, ["rip", "ivy", "ollie", "opal", "cosmo", "umi", "ozzy", "dewey", "scoot", "webster"])
        XCTAssertEqual(VsLobby.ladderBots, BotCast.ladderIds)
        XCTAssertEqual(BotCast.members.map(\.rung), Array(1...10))
        XCTAssertEqual(BotCast.members.map(\.mascot), ["r", "i", "o1", "o2", "c", "u", "o3", "d", "s", "w"])
        XCTAssertEqual(BotCast.members.map(\.name), ["Rip", "Ivy", "Ollie", "Opal", "Cosmo", "Umi", "Ozzy", "Dewey", "Scoot", "Webster"])
    }

    func testGuessRangesAndSpeedTiers() {
        let ranges = BotCast.members.map { m -> String in
            guard let lo = m.minGuesses, let hi = m.maxGuesses else { return "adaptive" }
            return "\(lo)-\(hi)"
        }
        XCTAssertEqual(ranges, ["6-6", "5-6", "5-5", "4-5", "4-5", "adaptive", "4-5", "3-4", "2-4", "2-3"])
        let speeds = Dictionary(grouping: BotCast.members, by: \.speed).mapValues { $0.map(\.id) }
        XCTAssertEqual(speeds[.easy], ["rip", "ivy", "ollie"])
        XCTAssertEqual(speeds[.medium], ["opal", "cosmo", "ozzy"])
        XCTAssertEqual(speeds[.hard], ["dewey", "scoot", "webster"])
        XCTAssertEqual(speeds[.adaptive], ["umi"])
        XCTAssertEqual(BotCast.member("rip")?.solveLine, "Solves in 6")
        XCTAssertEqual(BotCast.member("scoot")?.solveLine, "Solves in 2–4")
        XCTAssertEqual(BotCast.member("umi")?.solveLine, "Matches your form")
    }

    func testOldIdsMapByDifficulty() {
        XCTAssertEqual(BotCast.canonicalId("rook"), "ivy")
        XCTAssertEqual(BotCast.canonicalId("lexi"), "opal")
        XCTAssertEqual(BotCast.canonicalId("nova"), "dewey")
        XCTAssertEqual(BotCast.canonicalId("adapt"), "umi")
        XCTAssertEqual(BotCast.canonicalId("webster"), "webster")
        XCTAssertEqual(BotCast.canonicalId("ghost"), "ghost")
        XCTAssertEqual(BotCast.member("nova")?.id, "dewey")
        XCTAssertNil(BotCast.member("ghost"))
        XCTAssertNil(BotCast.member("daily"))
    }

    func testOldLadderProgressMigrates() {
        XCTAssertEqual((0...4).map(BotCast.migratedLadderCleared), [0, 2, 4, 7, 10])
        XCTAssertEqual(BotCast.migratedLadderCleared(-1), 0)
        XCTAssertEqual(BotCast.migratedLadderCleared(9), 10)
        // Old N cleared → the next rung is the cast bot just past the mapped old bot.
        XCTAssertEqual(BotCast.ladderIds[BotCast.migratedLadderCleared(1)], "ollie")   // Rook (→ Ivy) cleared
        XCTAssertEqual(BotCast.ladderIds[BotCast.migratedLadderCleared(2)], "cosmo")   // Lexi (→ Opal) cleared
        XCTAssertEqual(BotCast.ladderIds[BotCast.migratedLadderCleared(3)], "dewey")   // Nova cleared, Dewey next
    }

    func testTheCastLadderFoldsLikeBefore() {
        var s = BotLadderState(cleared: 0, run: 0)
        for _ in 0..<3 { s = VsLobby.ladderAfterGame(s, botId: "rip", won: true) }
        XCTAssertEqual(s, BotLadderState(cleared: 1, run: 0))
        // Games against another bot leave the ladder alone.
        XCTAssertEqual(VsLobby.ladderAfterGame(s, botId: "webster", won: true), s)
        let rungs = VsLobby.ladderRungs(s)
        XCTAssertEqual(rungs.count, 10)
        XCTAssertEqual(rungs[0].state, .cleared)
        XCTAssertEqual(rungs[1], LadderRung(id: "ivy", state: .next, line: "Win 3 in a row to clear · 0 so far"))
        XCTAssertEqual(rungs[2].line, "Clear Ivy to unlock")
        XCTAssertEqual(VsLobby.vsRecordLine(people: WinLoss(wins: 1, losses: 0), bots: WinLoss(wins: 2, losses: 1), ladder: 4),
                       "PEOPLE 1–0 · BOTS 2–1 · LADDER 4/10")
        XCTAssertEqual(VsLobby.vsRecordLine(people: WinLoss(wins: 0, losses: 0), bots: WinLoss(wins: 0, losses: 0), ladder: 10),
                       "PEOPLE 0–0 · BOTS 0–0 · LADDER CLEARED")
    }

    func testBotOfTheDayRotatesWithTheDayHost() {
        // Sunday first: Ozzy, Dewey, Ivy, Umi, Scoot, Opal, Ollie.
        XCTAssertEqual((0..<7).map { BotCast.botOfDay(weekday: $0).id },
                       ["ozzy", "dewey", "ivy", "umi", "scoot", "opal", "ollie"])
        XCTAssertEqual(BotCast.botOfDay(weekday: 7).id, "ozzy")
        XCTAssertEqual(BotCast.botOfDay(weekday: -1).id, "ollie")
        // 2026-10-02 is a Friday → Opal (O2); 2026-10-05 a Monday → Dewey (D).
        XCTAssertEqual(BotCast.weekday(of: "2026-10-02"), 5)
        XCTAssertEqual(BotCast.botOfDay(day: "2026-10-02").id, "opal")
        XCTAssertEqual(BotCast.botOfDay(day: "2026-10-05").id, "dewey")
        XCTAssertEqual(BotCast.botOfDay(day: "2026-10-04").id, "ozzy")
        XCTAssertEqual(BotCast.weekday(of: "2024-02-29"), 4)   // a leap-day Thursday
        XCTAssertEqual(BotCast.botOfDay(day: "2024-02-29").id, "scoot")
        XCTAssertEqual(BotCast.botOfDay(day: "garbage").id, "ozzy")
    }

    // MARK: Shared fixtures (packages/core bot-cast.ts via gen-parity-fixtures.ts)

    private struct CastRow: Decodable {
        let id: String, name: String, castId: String, rung: Int, tier: String
        let guesses: [Int]?
        let trait: String, color: String, solveLine: String
    }
    private struct Legacy: Decodable { let id: String; let canonical: String }
    private struct LegacyCleared: Decodable { let old: Int; let cleared: Int }
    private struct DayBot: Decodable { let day: String; let id: String }
    private struct Fixtures: Decodable {
        let cast: [CastRow]
        let legacy: [Legacy]
        let legacyCleared: [LegacyCleared]
        let botOfDay: [DayBot]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "vs-lobby-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testCastMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertEqual(f.cast.count, BotCast.members.count)
        for (row, m) in zip(f.cast, BotCast.members) {
            XCTAssertEqual(m.id, row.id)
            XCTAssertEqual(m.name, row.name)
            XCTAssertEqual(m.mascot, row.castId)
            XCTAssertEqual(m.rung, row.rung)
            XCTAssertEqual(m.speed.rawValue, row.tier)
            XCTAssertEqual(m.minGuesses.flatMap { lo in m.maxGuesses.map { [lo, $0] } }, row.guesses, row.id)
            XCTAssertEqual(m.trait, row.trait)
            XCTAssertEqual(m.color.lowercased(), row.color.lowercased())
            XCTAssertEqual(m.solveLine, row.solveLine)
        }
    }

    func testLegacyMappingMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.legacy.isEmpty)
        for c in f.legacy { XCTAssertEqual(BotCast.canonicalId(c.id), c.canonical, c.id) }
        for c in f.legacyCleared { XCTAssertEqual(BotCast.migratedLadderCleared(c.old), c.cleared, "old \(c.old)") }
    }

    func testBotOfDayMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.botOfDay.isEmpty)
        for c in f.botOfDay { XCTAssertEqual(BotCast.botOfDay(day: c.day).id, c.id, c.day) }
    }
}
