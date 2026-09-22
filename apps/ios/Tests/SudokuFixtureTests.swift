import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Sudoku engine (More Games §4): the
/// generator, reducer and matches-row round trip must match
/// packages/core/src/games/sudoku.ts byte for byte, or two platforms would
/// serve different givens on the same date.
final class SudokuFixtureTests: XCTestCase {
    private struct Gen: Decodable {
        let seed: String; let difficulty: String; let givens: String; let solution: String
        let clues: Int; let rerolls: Int; let unique: Bool; let singles: Bool
    }
    private struct Act: Decodable { let type: String; let cell: Int?; let digit: Int?; let value: Bool?; let now: Double? }
    private struct Expect: Decodable {
        let board: String; let notes: [Int]; let hintMask: String; let wrongMask: String
        let mistakes: Int; let hintsUsed: Int; let status: String; let notesMode: Bool; let historyLength: Int; let endTime: Double?
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable { let solution: String; let givens: String; let board: String; let hintMask: String; let solved: Bool }
    private struct Script: Decodable {
        let name: String; let seed: String; let difficulty: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon?
    }
    private struct Fixtures: Decodable { let generation: [Gen]; let reducer: [Script]; let malformed: Recon? }

    private func load() throws -> Fixtures {
        guard let url = Bundle.module.url(forResource: "sudoku-fixtures", withExtension: "json", subdirectory: "Fixtures") else {
            throw XCTSkip("Missing fixture: sudoku-fixtures.json")
        }
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    private func action(_ a: Act) -> SudokuAction {
        switch a.type {
        case "PLACE": return .place(cell: a.cell!, digit: a.digit!)
        case "ERASE": return .erase(cell: a.cell!)
        case "UNDO": return .undo
        case "HINT": return .hint(cell: a.cell)
        case "TOGGLE_NOTES": return .toggleNotes
        case "NOTE_TOGGLE": return .noteToggle(cell: a.cell!, digit: a.digit!)
        case "SET_AUTO_CLEAR": return .setAutoClear(a.value!)
        case "FINISH": return .finish(now: a.now ?? 0)
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testGenerationMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.generation.isEmpty)
        for c in f.generation {
            let p = generateSudoku(c.seed, difficulty: SudokuDifficulty(rawValue: c.difficulty)!)
            XCTAssertEqual(p.givens, c.givens, "givens(\(c.seed), \(c.difficulty))")
            XCTAssertEqual(p.solution, c.solution, "solution(\(c.seed))")
            XCTAssertEqual(p.clues, c.clues, "clues(\(c.seed))")
            XCTAssertEqual(p.rerolls, c.rerolls, "rerolls(\(c.seed))")
            XCTAssertEqual(countSudokuSolutions(sudokuCells(p.givens), limit: 2) == 1, c.unique)
            XCTAssertEqual(sudokuSolvableBySingles(sudokuCells(p.givens)), c.singles)
        }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            let p = generateSudoku(sc.seed, difficulty: SudokuDifficulty(rawValue: sc.difficulty)!)
            var s = SudokuState(puzzle: p, startTime: 0)
            for a in sc.actions { s = sudokuReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.board, sc.expect.board, "\(sc.name) board")
            XCTAssertEqual(s.notes, sc.expect.notes, "\(sc.name) notes")
            XCTAssertEqual(s.hintMask, sc.expect.hintMask, "\(sc.name) hintMask")
            XCTAssertEqual(s.wrongMask, sc.expect.wrongMask, "\(sc.name) wrongMask")
            XCTAssertEqual(s.mistakes, sc.expect.mistakes, "\(sc.name) mistakes")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.notesMode, sc.expect.notesMode, "\(sc.name) notesMode")
            XCTAssertEqual(s.history.count, sc.expect.historyLength, "\(sc.name) history")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            let row = sudokuMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions); XCTAssertEqual(row.guesses, sc.row.guesses)
            let r = reconstructSudoku(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.board, sc.reconstruct?.board); XCTAssertEqual(r?.solved, sc.reconstruct?.solved)
            XCTAssertEqual(r?.hintMask, sc.reconstruct?.hintMask)
        }
        XCTAssertNil(reconstructSudoku(solutions: ["nope"], guesses: []))
        XCTAssertNil(f.malformed)
    }
}
