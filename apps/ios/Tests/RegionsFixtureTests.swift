import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for the Starsweep engine (More Games §18b): the
/// generator, reducer and matches-row round trip must match
/// packages/core/src/games/regions.ts byte for byte, or two platforms would
/// serve different boards on the same date.
final class RegionsFixtureTests: XCTestCase {
    private struct Gen: Decodable { let seed: String; let n: Int; let regions: String; let solution: String; let sizes: [Int]; let rerolls: Int; let unique: Bool }
    private struct Act: Decodable { let type: String; let cell: Int?; let value: Bool?; let now: Double? }
    private struct Expect: Decodable {
        let board: String; let hintMask: String; let wrongMask: String; let mistakes: Int; let hintsUsed: Int
        let status: String; let autoCross: Bool; let historyLength: Int; let endTime: Double?
    }
    private struct Row: Decodable { let solutions: [String]; let guesses: [String] }
    private struct Recon: Decodable { let n: Int; let regions: String; let solution: String; let board: String; let hintMask: String; let solved: Bool }
    private struct Script: Decodable { let name: String; let seed: String; let n: Int; let actions: [Act]; let expect: Expect; let row: Row; let reconstruct: Recon? }
    private struct Ruled: Decodable { let cell: Int; let cells: [Int] }
    private struct Size: Decodable { let day: String; let n: Int }
    private struct Fixtures: Decodable { let generation: [Gen]; let reducer: [Script]; let ruledOut: [Ruled]; let sizes: [Size]; let malformed: Recon? }

    private func load() throws -> Fixtures {
        guard let url = Bundle.module.url(forResource: "regions-fixtures", withExtension: "json", subdirectory: "Fixtures") else {
            throw XCTSkip("Missing fixture: regions-fixtures.json")
        }
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    private func action(_ a: Act) -> RegionsAction {
        switch a.type {
        case "TAP": return .tap(cell: a.cell!)
        case "ERASE": return .erase(cell: a.cell!)
        case "UNDO": return .undo
        case "HINT": return .hint(cell: a.cell)
        case "SET_AUTO_CROSS": return .setAutoCross(a.value!)
        case "FINISH": return .finish(now: a.now ?? 0)
        default: fatalError("unknown action \(a.type)")
        }
    }

    func testGenerationMatchesSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.generation.isEmpty)
        for c in f.generation {
            guard let p = generateRegions(c.seed, n: c.n) else { XCTFail("nil board \(c.seed) \(c.n)"); continue }
            XCTAssertEqual(p.regions, c.regions, "regions(\(c.seed), \(c.n))")
            XCTAssertEqual(p.solution, c.solution, "solution(\(c.seed))")
            XCTAssertEqual(p.sizes, c.sizes, "sizes(\(c.seed))")
            XCTAssertEqual(p.rerolls, c.rerolls, "rerolls(\(c.seed))")
            let reg = p.regions.map { Int($0.asciiValue!) - 48 }
            XCTAssertEqual(countRegionsSolutions(c.n, reg) == 1, c.unique)
        }
    }

    func testReducerScriptsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.reducer.isEmpty)
        for sc in f.reducer {
            let p = generateRegions(sc.seed, n: sc.n)!
            var s = RegionsState(puzzle: p, startTime: 0)
            for a in sc.actions { s = regionsReduce(s, action(a), now: 1000) }
            XCTAssertEqual(s.board, sc.expect.board, "\(sc.name) board")
            XCTAssertEqual(s.hintMask, sc.expect.hintMask, "\(sc.name) hintMask")
            XCTAssertEqual(s.wrongMask, sc.expect.wrongMask, "\(sc.name) wrongMask")
            XCTAssertEqual(s.mistakes, sc.expect.mistakes, "\(sc.name) mistakes")
            XCTAssertEqual(s.hintsUsed, sc.expect.hintsUsed, "\(sc.name) hintsUsed")
            XCTAssertEqual(s.status.rawValue, sc.expect.status, "\(sc.name) status")
            XCTAssertEqual(s.autoCross, sc.expect.autoCross, "\(sc.name) autoCross")
            XCTAssertEqual(s.history.count, sc.expect.historyLength, "\(sc.name) history")
            XCTAssertEqual(s.endTime, sc.expect.endTime, "\(sc.name) endTime")
            let row = regionsMatchRow(s)
            XCTAssertEqual(row.solutions, sc.row.solutions); XCTAssertEqual(row.guesses, sc.row.guesses)
            let r = reconstructRegions(solutions: row.solutions, guesses: row.guesses)
            XCTAssertEqual(r?.board, sc.reconstruct?.board); XCTAssertEqual(r?.solved, sc.reconstruct?.solved); XCTAssertEqual(r?.n, sc.reconstruct?.n)
        }
        XCTAssertNil(f.malformed); XCTAssertNil(reconstructRegions(solutions: ["nope"], guesses: []))
    }

    func testRuledOutAndSizesMatchSharedFixtures() throws {
        let f = try load()
        let p = generateRegions("daily-2026-10-03-REGIONS", n: 8)!
        for r in f.ruledOut { XCTAssertEqual(regionsRuledOut(8, p.regions, r.cell), r.cells, "ruledOut(\(r.cell))") }
        for s in f.sizes { XCTAssertEqual(regionsSizeForDay(s.day), s.n, "size(\(s.day))") }
        XCTAssertEqual(regionsSizeForSeed("unlimited-REGIONS-1-9"), 9)
        XCTAssertEqual(regionsDailyNumber(REGIONS_DAILY_EPOCH), 1)
    }
}
