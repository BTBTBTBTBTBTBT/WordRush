import XCTest
@testable import WordociousCore

/// Cross-platform parity guard for epoch-indexed banks (More Games §11):
/// Bank.indexForDay / indexForSeed must match packages/core/src/bank.ts
/// exactly, or two platforms would serve different puzzles on the same date.
final class BankFixtureTests: XCTestCase {
    private struct DayCase: Decodable { let day: String; let n: Int; let dayIndex: Int?; let index: Int }
    private struct SeedCase: Decodable { let seed: String; let n: Int; let avoid: Int?; let index: Int }
    private struct Fixtures: Decodable { let epoch: String; let days: [DayCase]; let seeds: [SeedCase] }

    func testBankIndexesMatchSharedFixtures() throws {
        guard let url = Bundle.module.url(forResource: "bank-fixtures", withExtension: "json", subdirectory: "Fixtures") else {
            return XCTFail("Missing fixture: bank-fixtures.json")
        }
        let f = try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
        XCTAssertFalse(f.days.isEmpty); XCTAssertFalse(f.seeds.isEmpty)
        for c in f.days {
            XCTAssertEqual(Bank.dayIndex(c.day, epoch: f.epoch), c.dayIndex, "dayIndex(\(c.day))")
            XCTAssertEqual(Bank.indexForDay(c.day, n: c.n, epoch: f.epoch), c.index, "indexForDay(\(c.day), n: \(c.n))")
        }
        for c in f.seeds {
            XCTAssertEqual(Bank.indexForSeed(c.seed, n: c.n, avoid: c.avoid), c.index, "indexForSeed(\(c.seed), n: \(c.n), avoid: \(String(describing: c.avoid)))")
        }
    }
}
