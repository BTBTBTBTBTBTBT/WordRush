import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Kindred engine (More Games §14): bank
/// lookups (including the §20 holiday calendar), the seeded tile deal, the
/// reducer and the matches-row round trip must match
/// packages/core/src/games/groups.ts byte for byte.
final class GroupsFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let plainId: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct OrderCase: Decodable { let seed: String; let tiles: [String] }
    private struct Act: Decodable { let type: String; let word: String? }
    private struct PairT: Decodable { let tier: Int; let pair: [String] }
    private struct Expect: Decodable {
        let tiles: [String]; let solvedTiers: [Int]; let selected: [String]; let mistakes: Int; let submissions: Int; let hintsUsed: Int
        let revealedTiers: [Int]; let pairs: [[String]]; let wrongSets: [String]; let shuffles: Int; let lastResult: String?; let events: [String]
        let status: String; let ended: Bool; let endTime: Double?; let guessCount: Int; let boardsSolved: Int; let labelTarget: Int?; let pairTarget: PairT?
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable {
        let groups: [GroupsGroup]; let solvedTiers: [Int]; let mistakes: Int; let oneAways: Int; let submissions: Int; let hintsUsed: Int
        let revealedTiers: [Int]; let pairs: [[String]]; let solved: Bool
    }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let holidayKeys: [String]; let days: [DayCase]; let seeds: [SeedCase]
        let puzzle: GroupsPuzzle; let orders: [OrderCase]; let reducer: [Script]; let malformed: [Recon?]
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else { throw XCTSkip("Missing fixture: \(name).json") }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("groups-fixtures")) }
    private func bank() throws -> GroupsBank { guard let b = GroupsBank.load(from: try fixtureData("groups-puzzles")) else { throw XCTSkip("bank unreadable") }; return b }
    private func holidays() throws -> HolidayTable { guard let t = HolidayTable.load(from: try fixtureData("holiday-days")) else { throw XCTSkip("holiday table unreadable") }; return t }
    private func action(_ a: Act) -> GroupsAction {
        switch a.type {
        case "TOGGLE": return .toggle(word: a.word!)
        case "DESELECT": return .deselect
        case "SHUFFLE": return .shuffle
        case "SUBMIT": return .submit
        case "HINT_LABEL": return .hintLabel
        case "HINT_PAIR": return .hintPair
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testBankAndDealMatchSharedFixtures() throws {
        let f = try load(); let b = try bank(); let table = try holidays()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        XCTAssertEqual(Set(b.holiday?.keys.map { $0 } ?? []), Set(f.holidayKeys)); XCTAssertEqual(b.holiday?.count, f.holidayKeys.count)
        for c in f.days {
            XCTAssertEqual(groupsPuzzleForDay(b, day: c.day, holidays: table)?.id, c.id, "day \(c.day)")
            XCTAssertEqual(groupsPuzzleForDay(b, day: c.day, holidays: nil)?.id, c.plainId, "plain day \(c.day)")
            XCTAssertEqual(groupsDailyNumber(c.day), c.number, "number \(c.day)")
        }
        for c in f.seeds { XCTAssertEqual(groupsPuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
        XCTAssertFalse(f.orders.isEmpty)
        for o in f.orders {
            XCTAssertEqual(groupsTileOrder(f.puzzle, seed: o.seed), o.tiles, "order \(o.seed)")
            XCTAssertEqual(createGroupsState(f.puzzle, seed: o.seed, startTime: 0).tiles, o.tiles, "state tiles \(o.seed)")
        }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            XCTAssertEqual(sc.id, f.puzzle.id)
            var s = createGroupsState(f.puzzle, seed: "fixture", startTime: 0)
            for a in sc.actions { s = groupsReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.tiles, sc.expect.tiles, "\(sc.name) tiles")
            XCTAssertEqual(s.solved.map { $0.tier }, sc.expect.solvedTiers, "\(sc.name) solvedTiers")
            XCTAssertEqual(s.selected, sc.expect.selected, "\(sc.name) selected")
            XCTAssertEqual(s.mistakes, sc.expect.mistakes, "\(sc.name) mistakes")
            XCTAssertEqual(s.submissions, sc.expect.submissions, "\(sc.name) submissions")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.revealedTiers, sc.expect.revealedTiers, "\(sc.name) revealedTiers")
            XCTAssertEqual(s.pairs, sc.expect.pairs, "\(sc.name) pairs")
            XCTAssertEqual(s.wrongSets, sc.expect.wrongSets, "\(sc.name) wrongSets")
            XCTAssertEqual(s.shuffles, sc.expect.shuffles, "\(sc.name) shuffles")
            XCTAssertEqual(s.lastResult?.rawValue, sc.expect.lastResult, "\(sc.name) lastResult")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.ended, sc.expect.ended, "\(sc.name) ended")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(groupsGuessCount(s), sc.expect.guessCount, "\(sc.name) guessCount")
            XCTAssertEqual(groupsBoardsSolved(s), sc.expect.boardsSolved, "\(sc.name) boardsSolved")
            XCTAssertEqual(groupsLabelTarget(s)?.tier, sc.expect.labelTarget, "\(sc.name) labelTarget")
            let pt = groupsPairTarget(s)
            XCTAssertEqual(pt?.tier, sc.expect.pairTarget?.tier, "\(sc.name) pairTarget tier")
            XCTAssertEqual(pt?.pair, sc.expect.pairTarget?.pair, "\(sc.name) pairTarget pair")
            let row = groupsMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions, "\(sc.name) solutions"); XCTAssertEqual(row.guesses, sc.row.guesses, "\(sc.name) guesses")
            let r = reconstructGroups(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.groups, sc.reconstruct?.groups, "\(sc.name) recon groups")
            XCTAssertEqual(r?.solvedTiers, sc.reconstruct?.solvedTiers, "\(sc.name) recon solvedTiers")
            XCTAssertEqual(r?.mistakes, sc.reconstruct?.mistakes, "\(sc.name) recon mistakes")
            XCTAssertEqual(r?.oneAways, sc.reconstruct?.oneAways, "\(sc.name) recon oneAways")
            XCTAssertEqual(r?.submissions, sc.reconstruct?.submissions, "\(sc.name) recon submissions")
            XCTAssertEqual(r?.hintsUsed, sc.reconstruct?.hintsUsed, "\(sc.name) recon hintsUsed")
            XCTAssertEqual(r?.revealedTiers, sc.reconstruct?.revealedTiers, "\(sc.name) recon revealedTiers")
            XCTAssertEqual(r?.pairs, sc.reconstruct?.pairs, "\(sc.name) recon pairs")
            XCTAssertEqual(r?.solved, sc.reconstruct?.solved, "\(sc.name) recon solved")
        }
        XCTAssertEqual(f.malformed.count, 2)
        for m in f.malformed { XCTAssertNil(m) }
        XCTAssertNil(reconstructGroups(solutions: ["1|a|A,B,C"], guesses: []))
        XCTAssertNil(reconstructGroups(solutions: ["1|a|A,B,C,D", "2|b|E,F,G,H", "3|c|I,J,K,L"], guesses: []))
    }
}
