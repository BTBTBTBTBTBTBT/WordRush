import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Codebreaker engine (More Games §16): bank
/// lookups (including the §20 holiday calendar), the cipher helpers, the reducer
/// and the matches-row round trip must match packages/core/src/games/cryptogram.ts
/// byte for byte.
final class CryptogramFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let id: String?; let plainId: String?; let number: Int }
    private struct SeedCase: Decodable { let seed: String; let id: String? }
    private struct Initial: Decodable { let mapping: [String: String]; let locked: [String]; let hintTarget: String? }
    private struct GuessCount: Decodable { let checks: Int; let guessCount: Int }
    private struct Act: Decodable { let type: String; let code: String?; let plain: String? }
    private struct Expect: Decodable {
        let mapping: [String: String]; let locked: [String]; let hinted: [String]; let hintsUsed: Int; let checks: Int; let lastWrong: [String]
        let events: [String]; let status: String; let ended: Bool; let endTime: Double?; let guessCount: Int; let conflicts: [String]; let correct: Int; let hintTarget: String?
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable {
        let id: String; let text: String; let key: String; let cipher: String; let mapping: [String: String]; let given: [String]; let hinted: [String]
        let revealed: Bool; let checks: Int; let correct: Int; let total: Int; let solved: Bool
    }
    private struct Script: Decodable { let name: String; let id: String; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Fixtures: Decodable {
        let epoch: String; let dailyCount: Int; let extraCount: Int; let holidayKeys: [String]; let days: [DayCase]; let seeds: [SeedCase]
        let puzzle: CryptogramPuzzle; let cipher: String; let codes: [String]; let frequencies: [String: Int]; let initial: Initial
        let guessCounts: [GuessCount]; let reducer: [Script]; let malformed: [Recon?]
    }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else { throw XCTSkip("Missing fixture: \(name).json") }
        return try Data(contentsOf: url)
    }
    private func load() throws -> Fixtures { try JSONDecoder().decode(Fixtures.self, from: fixtureData("cryptogram-fixtures")) }
    private func bank() throws -> CryptogramBank { guard let b = CryptogramBank.load(from: try fixtureData("cryptogram-puzzles")) else { throw XCTSkip("bank unreadable") }; return b }
    private func holidays() throws -> HolidayTable { guard let t = HolidayTable.load(from: try fixtureData("holiday-days")) else { throw XCTSkip("holiday table unreadable") }; return t }
    private func action(_ a: Act) -> CryptogramAction {
        switch a.type {
        case "SET": return .set(code: a.code!, plain: a.plain)
        case "CHECK": return .check
        case "HINT": return .hint
        case "REVEAL": return .reveal
        case "FINISH": return .finish
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testBankAndCipherMatchSharedFixtures() throws {
        let f = try load(); let b = try bank(); let table = try holidays()
        XCTAssertEqual(b.epoch, f.epoch); XCTAssertEqual(b.daily.count, f.dailyCount); XCTAssertEqual(b.extra.count, f.extraCount)
        XCTAssertEqual(Set(b.holiday?.keys.map { $0 } ?? []), Set(f.holidayKeys)); XCTAssertEqual(b.holiday?.count, f.holidayKeys.count)
        for c in f.days {
            XCTAssertEqual(cryptogramPuzzleForDay(b, day: c.day, holidays: table)?.id, c.id, "day \(c.day)")
            XCTAssertEqual(cryptogramPuzzleForDay(b, day: c.day, holidays: nil)?.id, c.plainId, "plain day \(c.day)")
            XCTAssertEqual(cryptogramDailyNumber(c.day), c.number, "number \(c.day)")
        }
        for c in f.seeds { XCTAssertEqual(cryptogramPuzzleForSeed(b, seed: c.seed)?.id, c.id, "seed \(c.seed)") }
        XCTAssertEqual(b.daily[0], f.puzzle)
        let p = f.puzzle
        let cipher = cryptogramEncipher(p.text, key: p.key)
        XCTAssertEqual(cipher, f.cipher)
        XCTAssertEqual(cryptogramCodeLetters(cipher), f.codes)
        XCTAssertEqual(cryptogramFrequencies(cipher), f.frequencies)
        let s = createCryptogramState(p, seed: "fixture", startTime: 0)
        XCTAssertEqual(s.cipher, f.cipher)
        XCTAssertEqual(s.mapping, f.initial.mapping); XCTAssertEqual(s.locked, f.initial.locked); XCTAssertEqual(cryptogramHintTarget(s), f.initial.hintTarget)
        for g in f.guessCounts { XCTAssertEqual(cryptogramGuessCount(g.checks), g.guessCount, "guessCount(\(g.checks))") }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            XCTAssertEqual(sc.id, f.puzzle.id)
            var s = createCryptogramState(f.puzzle, seed: "fixture", startTime: 0)
            for a in sc.actions { s = cryptogramReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.mapping, sc.expect.mapping, "\(sc.name) mapping")
            XCTAssertEqual(s.locked, sc.expect.locked, "\(sc.name) locked")
            XCTAssertEqual(s.hinted, sc.expect.hinted, "\(sc.name) hinted")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.checks, sc.expect.checks, "\(sc.name) checks")
            XCTAssertEqual(s.lastWrong, sc.expect.lastWrong, "\(sc.name) lastWrong")
            XCTAssertEqual(s.events, sc.expect.events, "\(sc.name) events")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.ended, sc.expect.ended, "\(sc.name) ended")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            XCTAssertEqual(cryptogramGuessCount(s.checks), sc.expect.guessCount, "\(sc.name) guessCount")
            XCTAssertEqual(cryptogramConflicts(s.mapping), sc.expect.conflicts, "\(sc.name) conflicts")
            XCTAssertEqual(cryptogramCorrectCount(s), sc.expect.correct, "\(sc.name) correct")
            XCTAssertEqual(cryptogramHintTarget(s), sc.expect.hintTarget, "\(sc.name) hintTarget")
            let row = cryptogramMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions, "\(sc.name) solutions"); XCTAssertEqual(row.guesses, sc.row.guesses, "\(sc.name) guesses")
            let r = reconstructCryptogram(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.id, sc.reconstruct?.id); XCTAssertEqual(r?.text, sc.reconstruct?.text); XCTAssertEqual(r?.key, sc.reconstruct?.key)
            XCTAssertEqual(r?.cipher, sc.reconstruct?.cipher, "\(sc.name) recon cipher")
            XCTAssertEqual(r?.mapping, sc.reconstruct?.mapping, "\(sc.name) recon mapping")
            XCTAssertEqual(r?.given, sc.reconstruct?.given, "\(sc.name) recon given")
            XCTAssertEqual(r?.hinted, sc.reconstruct?.hinted, "\(sc.name) recon hinted")
            XCTAssertEqual(r?.revealed, sc.reconstruct?.revealed, "\(sc.name) recon revealed")
            XCTAssertEqual(r?.checks, sc.reconstruct?.checks, "\(sc.name) recon checks")
            XCTAssertEqual(r?.correct, sc.reconstruct?.correct, "\(sc.name) recon correct")
            XCTAssertEqual(r?.total, sc.reconstruct?.total, "\(sc.name) recon total")
            XCTAssertEqual(r?.solved, sc.reconstruct?.solved, "\(sc.name) recon solved")
        }
        XCTAssertEqual(f.malformed.count, 2)
        for m in f.malformed { XCTAssertNil(m) }
        XCTAssertNil(reconstructCryptogram(solutions: ["x", "ABC"], guesses: []))
        XCTAssertNil(reconstructCryptogram(solutions: ["Hi there.", "AABCDEFGHIJKLMNOPQRSTUVWXY", "id"], guesses: []))
    }
}
