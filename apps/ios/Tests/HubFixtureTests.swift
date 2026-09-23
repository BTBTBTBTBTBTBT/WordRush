import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Hubbub engine (More Games §12): bank
/// lookups, the integer rank maths, the reducer and the matches-row round trip
/// must match packages/core/src/games/hub.ts byte for byte.
final class HubFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct Scoring: Decodable { let points: Int; let max: Int; let rank: Int; let guessCount: Int; let boards: Int }
    private struct WordScore: Decodable { let w: String; let score: Int }
    private struct Act: Decodable { let type: String; let word: String? }
    private struct Expect: Decodable {
        let found: [String]; let bonusFound: [String]; let revealed: [String]; let hinted: [String]; let points: Int; let hintsUsed: Int
        let events: [String]; let status: String; let ended: Bool; let reject: String?; let endTime: Double?; let rank: Int; let guessCount: Int; let boardsSolved: Int
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable { let found: [String]; let bonusFound: [String]; let revealed: [String]; let points: Int; let hintsUsed: Int; let rank: Int; let rankName: String; let ended: Bool; let solved: Bool }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let days: [DayCase]; let seeds: [SeedCase]; let puzzle: HubPuzzle
        let scoring: [Scoring]; let thresholds: [Int]; let scores: [WordScore]; let reducer: [Script]; let malformed: Recon?
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else { throw XCTSkip("Missing fixture: \(name).json") }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("hub-fixtures")) }
    private func bank() throws -> HubBank { guard let b = HubBank.load(from: try fixtureData("hub-puzzles")) else { throw XCTSkip("bank unreadable") }; return b }
    private func action(_ a: Act) -> HubAction {
        switch a.type {
        case "SUBMIT": return .submit(a.word!)
        case "HINT_START": return .hintStart
        case "HINT_REVEAL": return .hintReveal
        case "END": return .end
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testBankAndScoringMatchSharedFixtures() throws {
        let f = try load(); let b = try bank()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        for c in f.days { XCTAssertEqual(hubPuzzleForDay(b, day: c.day)?.id, c.id, "day \(c.day)"); XCTAssertEqual(hubDailyNumber(c.day), c.number) }
        for c in f.seeds { XCTAssertEqual(hubPuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
        for s in f.scoring {
            XCTAssertEqual(hubRankIndex(points: s.points, max: s.max), s.rank, "rank \(s.points)/\(s.max)")
            XCTAssertEqual(hubGuessCount(hubRankIndex(points: s.points, max: s.max)), s.guessCount)
            XCTAssertEqual(hubBoardsSolved(points: s.points, max: s.max), s.boards, "boards \(s.points)/\(s.max)")
        }
        XCTAssertEqual((0..<10).map { hubRankThreshold($0, max: f.puzzle.max) }, f.thresholds)
        for w in f.scores { XCTAssertEqual(hubWordScore(w.w, letters: f.puzzle.letters), w.score, "score \(w.w)") }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            var s = HubState(puzzle: f.puzzle, seed: "fixture", startTime: 0)
            for a in sc.actions { s = hubReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.found, sc.expect.found, "\(sc.name) found")
            XCTAssertEqual(s.bonusFound, sc.expect.bonusFound, "\(sc.name) bonusFound")
            XCTAssertEqual(s.revealed, sc.expect.revealed, "\(sc.name) revealed")
            XCTAssertEqual(s.hinted, sc.expect.hinted, "\(sc.name) hinted")
            XCTAssertEqual(s.points, sc.expect.points, "\(sc.name) points")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.ended, sc.expect.ended, "\(sc.name) ended")
            XCTAssertEqual(s.reject?.rawValue, sc.expect.reject, "\(sc.name) reject")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(s.rank, sc.expect.rank); XCTAssertEqual(s.guessCount, sc.expect.guessCount); XCTAssertEqual(s.boardsSolved, sc.expect.boardsSolved)
            let row = hubMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions); XCTAssertEqual(row.guesses, sc.row.guesses)
            let r = reconstructHub(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.found, sc.reconstruct?.found); XCTAssertEqual(r?.bonusFound, sc.reconstruct?.bonusFound); XCTAssertEqual(r?.revealed, sc.reconstruct?.revealed)
            XCTAssertEqual(r?.points, sc.reconstruct?.points); XCTAssertEqual(r?.hintsUsed, sc.reconstruct?.hintsUsed); XCTAssertEqual(r?.rank, sc.reconstruct?.rank)
            XCTAssertEqual(r?.rankName, sc.reconstruct?.rankName); XCTAssertEqual(r?.ended, sc.reconstruct?.ended); XCTAssertEqual(r?.solved, sc.reconstruct?.solved)
        }
        XCTAssertNil(f.malformed); XCTAssertNil(reconstructHub(solutions: ["x", "ABC", "1"], guesses: []))
    }
}
