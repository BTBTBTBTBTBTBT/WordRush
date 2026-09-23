import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for epoch-indexed banks (More Games §11):
/// Bank.indexForDay / indexForSeed must match packages/core/src/bank.ts
/// exactly, or two platforms would serve different puzzles on the same date.
final class BankFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let n: Int; let dayIndex: Int?; let index: Int }
    private struct SeedCase: Decodable { let seed: String; let n: Int; let avoid: Int?; let index: Int }
    private struct TableCase: Decodable { let version: Int; let from: String; let to: String; let dayCount: Int }
    private struct Pick: Decodable { let key: String; let index: Int; let entry: String }
    private struct HolidayCase: Decodable { let day: String; let key: String?; let occurrence: Int; let pick: Pick? }
    private struct Fixtures: Decodable { let epoch: String; let days: [DayCase]; let seeds: [SeedCase]; let holidayTable: TableCase; let holidayDays: [HolidayCase] }

    private func fixtureData(_ name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures") else { throw XCTSkip("Missing fixture: \(name).json") }
        return try Data(contentsOf: url)
    }

    func testBankIndexesMatchSharedFixtures() throws {
        let f = try JSONDecoder().decode(Fixtures.self, from: fixtureData("bank-fixtures"))
        XCTAssertFalse(f.days.isEmpty); XCTAssertFalse(f.seeds.isEmpty)
        for c in f.days {
            XCTAssertEqual(Bank.dayIndex(c.day, epoch: f.epoch), c.dayIndex, "dayIndex(\(c.day))")
            XCTAssertEqual(Bank.indexForDay(c.day, n: c.n, epoch: f.epoch), c.index, "indexForDay(\(c.day), n: \(c.n))")
        }
        for c in f.seeds {
            XCTAssertEqual(Bank.indexForSeed(c.seed, n: c.n, avoid: c.avoid), c.index, "indexForSeed(\(c.seed), n: \(c.n), avoid: \(String(describing: c.avoid)))")
        }
    }

    /// Holidays (More Games §20): key lookup, the k-th-outing count and the pick
    /// into a 3-entry holiday list must match bank.ts on the shared calendar.
    func testHolidayHelpersMatchSharedFixtures() throws {
        let f = try JSONDecoder().decode(Fixtures.self, from: fixtureData("bank-fixtures"))
        guard let table = HolidayTable.load(from: try fixtureData("holiday-days")) else { return XCTFail("holiday-days.json unreadable") }
        XCTAssertEqual(table.version, f.holidayTable.version); XCTAssertEqual(table.from, f.holidayTable.from); XCTAssertEqual(table.to, f.holidayTable.to)
        XCTAssertEqual(table.days.count, f.holidayTable.dayCount)
        let three = ["christmas": ["c0", "c1", "c2"], "halloween": ["h0", "h1", "h2"], "mlkday": ["m0", "m1", "m2"]]
        XCTAssertFalse(f.holidayDays.isEmpty)
        for c in f.holidayDays {
            let key = holidayKeyForDay(c.day, table: table)
            XCTAssertEqual(key, c.key, "key(\(c.day))")
            XCTAssertEqual(key.map { holidayOccurrence(c.day, key: $0, table: table) } ?? 0, c.occurrence, "occurrence(\(c.day))")
            let pick = bankHolidayPick(day: c.day, table: table, holiday: three)
            XCTAssertEqual(pick?.key, c.pick?.key, "pick key(\(c.day))")
            XCTAssertEqual(pick?.index, c.pick?.index, "pick index(\(c.day))")
            XCTAssertEqual(pick?.entry, c.pick?.entry, "pick entry(\(c.day))")
        }
        XCTAssertNil(bankHolidayPick(day: "2026-12-25", table: nil, holiday: three))
        XCTAssertNil(bankHolidayPick(day: "2026-12-25", table: table, holiday: [String: [String]]()))
    }
}
