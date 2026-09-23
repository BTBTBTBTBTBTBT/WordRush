import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Crosswordocious engine (More Games §13):
/// bank lookups (including the §20 holiday calendar), the layout helpers, the
/// reducer and the matches-row round trip must match
/// packages/core/src/games/crossword.ts byte for byte.
final class CrosswordFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let plainId: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct CellsCase: Decodable { let n: Int; let dir: CrosswordDir; let cells: [Int] }
    private struct GuessCount: Decodable { let checks: Int; let guessCount: Int }
    private struct Act: Decodable { let type: String; let cell: Int?; let letter: String?; let n: Int?; let dir: CrosswordDir? }
    private struct Expect: Decodable {
        let fill: String; let locked: String; let revealed: String; let checks: Int; let hintsUsed: Int; let lastWrong: [Int]; let events: [String]
        let status: String; let ended: Bool; let endTime: Double?; let guessCount: Int; let correct: Int; let total: Int
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable {
        let id: String; let title: String; let w: Int; let h: Int; let solution: String; let answers: [String]
        let fill: String; let revealed: String; let checks: Int; let correct: Int; let total: Int; let hintsUsed: Int; let revealedPuzzle: Bool; let solved: Bool
    }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let holidayKeys: [String]; let days: [DayCase]; let seeds: [SeedCase]
        let puzzle: CrosswordPuzzle; let solution: String; let entryCells: [CellsCase]; let guessCounts: [GuessCount]; let reducer: [Script]; let malformed: [Recon?]
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else { throw XCTSkip("Missing fixture: \(name).json") }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("crossword-fixtures")) }
    private func bank() throws -> CrosswordBank { guard let b = CrosswordBank.load(from: try fixtureData("crossword-puzzles")) else { throw XCTSkip("bank unreadable") }; return b }
    private func holidays() throws -> HolidayTable { guard let t = HolidayTable.load(from: try fixtureData("holiday-days")) else { throw XCTSkip("holiday table unreadable") }; return t }
    private func action(_ a: Act) -> CrosswordAction {
        switch a.type {
        case "SET": return .set(cell: a.cell!, letter: a.letter!)
        case "CLEAR": return .clear(cell: a.cell!)
        case "CHECK": return .check
        case "REVEAL_LETTER": return .revealLetter(cell: a.cell!)
        case "REVEAL_WORD": return .revealWord(n: a.n!, dir: a.dir!)
        case "REVEAL_PUZZLE": return .revealPuzzle
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }
    private func assertRecon(_ r: CrosswordReconstruction?, _ e: Recon?, _ name: String) {
        XCTAssertEqual(r?.id, e?.id, "\(name) recon id")
        XCTAssertEqual(r?.title, e?.title, "\(name) recon title")
        XCTAssertEqual(r?.w, e?.w, "\(name) recon w")
        XCTAssertEqual(r?.h, e?.h, "\(name) recon h")
        XCTAssertEqual(r?.solution, e?.solution, "\(name) recon solution")
        XCTAssertEqual(r?.answers, e?.answers, "\(name) recon answers")
        XCTAssertEqual(r?.fill, e?.fill, "\(name) recon fill")
        XCTAssertEqual(r?.revealed, e?.revealed, "\(name) recon revealed")
        XCTAssertEqual(r?.checks, e?.checks, "\(name) recon checks")
        XCTAssertEqual(r?.correct, e?.correct, "\(name) recon correct")
        XCTAssertEqual(r?.total, e?.total, "\(name) recon total")
        XCTAssertEqual(r?.hintsUsed, e?.hintsUsed, "\(name) recon hintsUsed")
        XCTAssertEqual(r?.revealedPuzzle, e?.revealedPuzzle, "\(name) recon revealedPuzzle")
        XCTAssertEqual(r?.solved, e?.solved, "\(name) recon solved")
    }

    func testBankAndLayoutMatchSharedFixtures() throws {
        let f = try load(); let b = try bank(); let table = try holidays()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        XCTAssertEqual(Set(b.holiday?.keys.map { $0 } ?? []), Set(f.holidayKeys)); XCTAssertEqual(b.holiday?.count, f.holidayKeys.count)
        for c in f.days {
            XCTAssertEqual(crosswordPuzzleForDay(b, day: c.day, holidays: table)?.id, c.id, "day \(c.day)")
            XCTAssertEqual(crosswordPuzzleForDay(b, day: c.day, holidays: nil)?.id, c.plainId, "plain day \(c.day)")
            XCTAssertEqual(crosswordDailyNumber(c.day), c.number, "number \(c.day)")
        }
        for c in f.seeds { XCTAssertEqual(crosswordPuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
        XCTAssertEqual(crosswordSolution(f.puzzle), f.solution)
        XCTAssertEqual(f.puzzle.w * f.puzzle.h, f.solution.count)
        XCTAssertFalse(f.entryCells.isEmpty)
        XCTAssertEqual(f.entryCells.count, f.puzzle.entries.count)
        for c in f.entryCells {
            guard let e = f.puzzle.entries.first(where: { $0.n == c.n && $0.dir == c.dir }) else { XCTFail("no entry \(c.n)\(c.dir.rawValue)"); continue }
            XCTAssertEqual(crosswordEntryCells(f.puzzle, e), c.cells, "cells \(c.n)\(c.dir.rawValue)")
            for cell in c.cells { XCTAssertTrue(crosswordEntriesAt(f.puzzle, cell: cell).contains(e), "entriesAt \(cell) has \(c.n)\(c.dir.rawValue)") }
        }
        XCTAssertFalse(f.guessCounts.isEmpty)
        for g in f.guessCounts { XCTAssertEqual(crosswordGuessCount(g.checks), g.guessCount, "guessCount \(g.checks)") }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            XCTAssertEqual(sc.id, f.puzzle.id)
            var s = createCrosswordState(f.puzzle, seed: "fixture", startTime: 0)
            XCTAssertEqual(s.solution, f.solution, "\(sc.name) solution")
            for a in sc.actions { s = crosswordReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.fill, sc.expect.fill, "\(sc.name) fill")
            XCTAssertEqual(s.locked, sc.expect.locked, "\(sc.name) locked")
            XCTAssertEqual(s.revealed, sc.expect.revealed, "\(sc.name) revealed")
            XCTAssertEqual(s.checks, sc.expect.checks, "\(sc.name) checks")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.lastWrong, sc.expect.lastWrong, "\(sc.name) lastWrong")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.ended, sc.expect.ended, "\(sc.name) ended")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(crosswordGuessCount(s.checks), sc.expect.guessCount, "\(sc.name) guessCount")
            XCTAssertEqual(crosswordCorrectCount(s), sc.expect.correct, "\(sc.name) correct")
            XCTAssertEqual(crosswordLetterCount(s), sc.expect.total, "\(sc.name) total")
            XCTAssertEqual(crosswordIsSolved(s), sc.expect.correct == sc.expect.total, "\(sc.name) isSolved")
            let row = crosswordMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions, "\(sc.name) solutions"); XCTAssertEqual(row.guesses, sc.row.guesses, "\(sc.name) guesses")
            assertRecon(reconstructCrossword(solutions: row.solutions, guesses: row.guesses), sc.reconstruct, sc.name)
        }
        XCTAssertEqual(f.malformed.count, 3)
        XCTAssertNil(f.malformed[0]); XCTAssertNil(f.malformed[1]); XCTAssertNotNil(f.malformed[2])
        XCTAssertNil(reconstructCrossword(solutions: ["x|y", "ABC"], guesses: []))
        XCTAssertNil(reconstructCrossword(solutions: ["x|y|2x2", "ABC", "AB"], guesses: []))
        assertRecon(reconstructCrossword(solutions: ["x|y|1x2", "AB", "AB"], guesses: ["=A_", "hl.", "c2"]), f.malformed[2], "malformed[2]")
        XCTAssertNil(reconstructCrossword(solutions: nil, guesses: nil))
        XCTAssertNil(reconstructCrossword(solutions: ["x|y|1x2", "AB"], guesses: []))
    }
}
