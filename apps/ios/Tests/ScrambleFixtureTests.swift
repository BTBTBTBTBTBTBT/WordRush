import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Muddle engine (More Games §5): bank
/// lookups (including the §20 holiday calendar), the tray/target helpers, the
/// reducer and the matches-row round trip must match
/// packages/core/src/games/scramble.ts byte for byte.
final class ScrambleFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let plainId: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct RemainingCase: Decodable { let pool: String; let entry: String; let left: String }
    private struct Act: Decodable { let type: String; let row: Int?; let letter: String? }
    private struct Expect: Decodable {
        let entries: [String]; let solved: [Bool]; let revealed: [String]; let checks: Int; let mistakes: Int; let hintsUsed: Int
        let lastRow: Int?; let lastResult: String?; let events: [String]; let status: String; let ended: Bool; let endTime: Double?
        let guessCount: Int; let boardsSolved: Int; let activeRow: Int?; let finalOpen: Bool
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable {
        let words: [String]; let `final`: String; let solved: [Bool]; let checks: Int; let mistakes: Int; let hintsUsed: Int
        let solvedByHint: [Int]; let boardsSolved: Int; let lost: Bool; let won: Bool
    }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let holidayKeys: [String]; let days: [DayCase]; let seeds: [SeedCase]
        let puzzle: ScramblePuzzle; let finalLetters: String; let finalTray: String; let targets: [String]; let remaining: [RemainingCase]
        let reducer: [Script]; let malformed: [Recon?]
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else { throw XCTSkip("Missing fixture: \(name).json") }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("scramble-fixtures")) }
    private func bank() throws -> ScrambleBank { guard let b = ScrambleBank.load(from: try fixtureData("scramble-puzzles")) else { throw XCTSkip("bank unreadable") }; return b }
    private func holidays() throws -> HolidayTable { guard let t = HolidayTable.load(from: try fixtureData("holiday-days")) else { throw XCTSkip("holiday table unreadable") }; return t }
    private func action(_ a: Act) -> ScrambleAction {
        switch a.type {
        case "TYPE": return .type(row: a.row!, letter: a.letter!)
        case "BACK": return .back(row: a.row!)
        case "CLEAR": return .clear(row: a.row!)
        case "REVEAL_LETTER": return .revealLetter(row: a.row!)
        case "SOLVE_WORD": return .solveWord(row: a.row!)
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }
    private func assertRecon(_ r: ScrambleReconstruction?, _ e: Recon?, _ name: String) {
        XCTAssertEqual(r?.words, e?.words, "\(name) recon words")
        XCTAssertEqual(r?.final, e?.final, "\(name) recon final")
        XCTAssertEqual(r?.solved, e?.solved, "\(name) recon solved")
        XCTAssertEqual(r?.checks, e?.checks, "\(name) recon checks")
        XCTAssertEqual(r?.mistakes, e?.mistakes, "\(name) recon mistakes")
        XCTAssertEqual(r?.hintsUsed, e?.hintsUsed, "\(name) recon hintsUsed")
        XCTAssertEqual(r?.solvedByHint, e?.solvedByHint, "\(name) recon solvedByHint")
        XCTAssertEqual(r?.boardsSolved, e?.boardsSolved, "\(name) recon boardsSolved")
        XCTAssertEqual(r?.lost, e?.lost, "\(name) recon lost")
        XCTAssertEqual(r?.won, e?.won, "\(name) recon won")
    }

    func testBankAndHelpersMatchSharedFixtures() throws {
        let f = try load(); let b = try bank(); let table = try holidays()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        XCTAssertEqual(Set(b.holiday?.keys.map { $0 } ?? []), Set(f.holidayKeys)); XCTAssertEqual(b.holiday?.count, f.holidayKeys.count)
        XCTAssertFalse(f.days.isEmpty)
        for c in f.days {
            XCTAssertEqual(scramblePuzzleForDay(b, day: c.day, holidays: table)?.id, c.id, "day \(c.day)")
            XCTAssertEqual(scramblePuzzleForDay(b, day: c.day, holidays: nil)?.id, c.plainId, "plain day \(c.day)")
            XCTAssertEqual(scrambleDailyNumber(c.day), c.number, "number \(c.day)")
        }
        XCTAssertFalse(f.seeds.isEmpty)
        for c in f.seeds { XCTAssertEqual(scramblePuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
        XCTAssertNil(f.puzzle.cartoon)
        XCTAssertEqual(scrambleFinalLetters(f.puzzle), f.finalLetters)
        XCTAssertEqual(scrambleFinalTray(f.puzzle), f.finalTray)
        XCTAssertEqual(f.targets.count, SCRAMBLE_TOTAL_BOARDS)
        let s0 = createScrambleState(f.puzzle, seed: "fixture", startTime: 0)
        for (r, t) in f.targets.enumerated() {
            XCTAssertEqual(scrambleTarget(s0, r), t, "target \(r)")
            XCTAssertEqual(scrambleTarget(f.puzzle, r), t, "puzzle target \(r)")
        }
        XCTAssertEqual(scrambleTray(s0, SCRAMBLE_FINAL), f.finalTray)
        XCTAssertFalse(f.remaining.isEmpty)
        for c in f.remaining { XCTAssertEqual(scrambleRemaining(pool: c.pool, entry: c.entry), c.left, "remaining \(c.pool)-\(c.entry)") }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            XCTAssertEqual(sc.id, f.puzzle.id)
            var s = createScrambleState(f.puzzle, seed: "fixture", startTime: 0)
            for a in sc.actions { s = scrambleReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.entries, sc.expect.entries, "\(sc.name) entries")
            XCTAssertEqual(s.solved, sc.expect.solved, "\(sc.name) solved")
            XCTAssertEqual(s.revealed, sc.expect.revealed, "\(sc.name) revealed")
            XCTAssertEqual(s.checks, sc.expect.checks, "\(sc.name) checks")
            XCTAssertEqual(s.mistakes, sc.expect.mistakes, "\(sc.name) mistakes")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.lastRow, sc.expect.lastRow, "\(sc.name) lastRow")
            XCTAssertEqual(s.lastResult?.rawValue, sc.expect.lastResult, "\(sc.name) lastResult")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.ended, sc.expect.ended, "\(sc.name) ended")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(scrambleGuessCount(s), sc.expect.guessCount, "\(sc.name) guessCount")
            XCTAssertEqual(scrambleBoardsSolved(s), sc.expect.boardsSolved, "\(sc.name) boardsSolved")
            XCTAssertEqual(scrambleActiveRow(s), sc.expect.activeRow, "\(sc.name) activeRow")
            XCTAssertEqual(scrambleFinalOpen(s), sc.expect.finalOpen, "\(sc.name) finalOpen")
            let row = scrambleMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions, "\(sc.name) solutions"); XCTAssertEqual(row.guesses, sc.row.guesses, "\(sc.name) guesses")
            assertRecon(reconstructScramble(solutions: row.solutions, guesses: row.guesses), sc.reconstruct, sc.name)
        }
        XCTAssertEqual(f.malformed.count, 3)
        XCTAssertNil(f.malformed[0]); XCTAssertNil(f.malformed[1]); XCTAssertNotNil(f.malformed[2])
        XCTAssertNil(reconstructScramble(solutions: ["A", "B"], guesses: []))
        XCTAssertNil(reconstructScramble(solutions: ["ABCDE", "ABCDE", "ABCDE", "ABCDE", "ab"], guesses: []))
        assertRecon(reconstructScramble(solutions: ["MOTOR", "EXILED", "BATTEN", "FRAUD", "ABOUT TIME"], guesses: ["0✓MOTOR", "1✗XXXXXX", "2h__T___", "3H", "4✓ABOUTTIME", "junk"]), f.malformed[2], "malformed[2]")
        XCTAssertNil(reconstructScramble(solutions: nil, guesses: nil))
        XCTAssertNil(reconstructScramble(solutions: ["ABCDE", "ABCDE", "ABCDE", "ABCDE"], guesses: nil))
    }
}
