import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Spyglass engine (More Games §17): bank
/// lookups, line geometry, the reducer and the matches-row round trip must
/// match packages/core/src/games/wordsearch.ts byte for byte.
final class WordsearchFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct Act: Decodable { let type: String; let from: Int?; let to: Int? }
    private struct Expect: Decodable {
        let found: [String]; let misses: Int; let hintsUsed: Int; let hinted: [String]; let events: [String]
        let status: String; let endTime: Double?; let guessCount: Int
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable { let found: [String]; let misses: Int; let hintsUsed: Int; let revealed: Bool; let solved: Bool; let title: String }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Geo: Decodable { let from: Int; let to: Int; let line: [Int]? }
    private struct Place: Decodable { let w: String; let r: Int; let c: Int; let d: String; let cells: [Int] }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let days: [DayCase]; let seeds: [SeedCase]
        let puzzle: WordsearchPuzzle; let reducer: [Script]; let geometry: [Geo]; let placements: [Place]; let malformed: Recon?
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else {
            throw XCTSkip("Missing fixture: \(name).json")
        }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("wordsearch-fixtures")) }
    private func bank() throws -> WordsearchBank {
        guard let b = WordsearchBank.load(from: try fixtureData("wordsearch-puzzles")) else { throw XCTSkip("bank unreadable") }
        return b
    }
    private func action(_ a: Act) -> WordsearchAction {
        switch a.type {
        case "SELECT": return .select(from: a.from!, to: a.to!)
        case "HINT": return .hint
        case "REVEAL": return .reveal
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testBankAndGeometryMatchSharedFixtures() throws {
        let f = try load(); let b = try bank()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        for c in f.days {
            XCTAssertEqual(wordsearchPuzzleForDay(b, day: c.day)?.id, c.id, "day \(c.day)")
            XCTAssertEqual(wordsearchDailyNumber(c.day), c.number, "number \(c.day)")
        }
        for c in f.seeds { XCTAssertEqual(wordsearchPuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
        for g in f.geometry { XCTAssertEqual(wordsearchLine(10, from: g.from, to: g.to), g.line, "line \(g.from)→\(g.to)") }
        for p in f.placements { XCTAssertEqual(wordsearchCells(10, WordsearchPlacement(w: p.w, r: p.r, c: p.c, d: p.d)), p.cells, "cells \(p.w)") }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            var s = WordsearchState(puzzle: f.puzzle, seed: "fixture", startTime: 0)
            for a in sc.actions { s = wordsearchReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.found, sc.expect.found, "\(sc.name) found")
            XCTAssertEqual(s.misses, sc.expect.misses, "\(sc.name) misses")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.hinted, sc.expect.hinted, "\(sc.name) hinted")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(s.guessCount, sc.expect.guessCount, "\(sc.name) guessCount")
            let row = wordsearchMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions); XCTAssertEqual(row.guesses, sc.row.guesses)
            let r = reconstructWordsearch(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.found, sc.reconstruct?.found); XCTAssertEqual(r?.misses, sc.reconstruct?.misses)
            XCTAssertEqual(r?.hintsUsed, sc.reconstruct?.hintsUsed); XCTAssertEqual(r?.revealed, sc.reconstruct?.revealed)
            XCTAssertEqual(r?.solved, sc.reconstruct?.solved); XCTAssertEqual(r?.title, sc.reconstruct?.title)
        }
        XCTAssertNil(f.malformed); XCTAssertNil(reconstructWordsearch(solutions: ["nope"], guesses: []))
    }
}
