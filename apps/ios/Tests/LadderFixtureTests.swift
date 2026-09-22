import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Letter Ladder engine (More Games §15):
/// bank lookups, the reducer, the BFS hint and the matches-row round trip must
/// match packages/core/src/games/ladder.ts byte for byte.
final class LadderFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct Act: Decodable { let type: String; let word: String? }
    private struct Expect: Decodable {
        let words: [String]; let hintMask: String; let moves: Int; let hintsUsed: Int; let events: [String]
        let status: String; let reject: String?; let endTime: Double?; let guessCount: Int
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable { let words: [String]; let hintMask: String; let moves: Int; let hintsUsed: Int; let solved: Bool; let par: Int; let path: [String] }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct DictHint: Decodable { let id: String; let from: String; let end: String; let next: String? }
    private struct Neigh: Decodable { let word: String; let neighbours: [String] }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let days: [DayCase]; let seeds: [SeedCase]
        let allowed: [String]; let puzzle: LadderPuzzle; let reducer: [Script]; let dictHints: [DictHint]; let neighbours: [Neigh]; let malformed: Recon?
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else {
            throw XCTSkip("Missing fixture: \(name).json")
        }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("ladder-fixtures")) }
    private func bank() throws -> LadderBank {
        guard let b = LadderBank.load(from: try fixtureData("ladder-puzzles")) else { throw XCTSkip("bank unreadable") }
        return b
    }
    private func fullAllowed() throws -> Set<String> {
        let words = try JSONDecoder().decode([String].self, from: fixtureData("allowed"))
        return Set(words.map { $0.uppercased() }.filter { $0.count == 5 })
    }

    private func action(_ a: Act) -> LadderAction {
        switch a.type {
        case "SUBMIT": return .submit(a.word!)
        case "UNDO": return .undo
        case "HINT": return .hint
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testBankLookupsMatchSharedFixtures() throws {
        let f = try load(); let b = try bank()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        for c in f.days {
            XCTAssertEqual(ladderPuzzleForDay(b, day: c.day)?.id, c.id, "day \(c.day)")
            XCTAssertEqual(ladderDailyNumber(c.day), c.number, "number \(c.day)")
        }
        for c in f.seeds { XCTAssertEqual(ladderPuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        let allowed = Set(f.allowed)
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            var s = LadderState(puzzle: f.puzzle, seed: "fixture", startTime: 0)
            for a in sc.actions { s = ladderReduce(s, action(a), allowed: allowed, now: 1000) }
            XCTAssertEqual(s.words, sc.expect.words, "\(sc.name) words")
            XCTAssertEqual(s.hintMask, sc.expect.hintMask, "\(sc.name) hintMask")
            XCTAssertEqual(s.moves, sc.expect.moves, "\(sc.name) moves")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.reject?.rawValue, sc.expect.reject, "\(sc.name) reject")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(s.guessCount, sc.expect.guessCount, "\(sc.name) guessCount")
            let row = ladderMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions); XCTAssertEqual(row.guesses, sc.row.guesses)
            let r = reconstructLadder(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.words, sc.reconstruct?.words); XCTAssertEqual(r?.hintMask, sc.reconstruct?.hintMask)
            XCTAssertEqual(r?.moves, sc.reconstruct?.moves); XCTAssertEqual(r?.hintsUsed, sc.reconstruct?.hintsUsed)
            XCTAssertEqual(r?.solved, sc.reconstruct?.solved); XCTAssertEqual(r?.par, sc.reconstruct?.par); XCTAssertEqual(r?.path, sc.reconstruct?.path)
        }
        XCTAssertNil(f.malformed); XCTAssertNil(reconstructLadder(solutions: ["nope"], guesses: []))
    }

    func testHintsOverTheFullDictionaryMatchSharedFixtures() throws {
        let f = try load(); let allowed = try fullAllowed(); let b = try bank()
        for h in f.dictHints {
            let q = b.daily.first { $0.id == h.id }!
            let avoid: Set<String> = h.from == q.start ? [q.start] : Set(q.path.prefix(2))
            XCTAssertEqual(ladderNextStep(h.from, end: h.end, allowed: allowed, avoid: avoid), h.next, "hint \(h.id) from \(h.from)")
        }
        for n in f.neighbours { XCTAssertEqual(ladderNeighbours(n.word, allowed: allowed), n.neighbours, "neighbours \(n.word)") }
    }
}
