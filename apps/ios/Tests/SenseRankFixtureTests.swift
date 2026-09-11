import XCTest
@testable import WordociousCore

/// Sense-ranker parity guard (iOS side). Asserts the same JSON that web
/// (lib/sense-rank.test.ts) and Android (SenseRankFixtureTest.kt) assert, so a
/// rule change that isn't regenerated + ported fails on every platform.
/// Regenerate: node apps/web/scripts/gen-sense-rank-fixtures.mjs
final class SenseRankFixtureTests: XCTestCase {
    struct Sense: Decodable { let pos: String; let def: String }
    struct Case: Decodable { let word: String; let senses: [Sense]; let expectedFirst: String; let scores: [Int] }
    struct Fixtures: Decodable { let cases: [Case] }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "sense-rank-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testFirstSenseAndScoresMatchFixtures() throws {
        let f = try load()
        XCTAssertGreaterThan(f.cases.count, 100)
        for c in f.cases {
            XCTAssertEqual(SenseRank.rank(c.word, c.senses, def: { $0.def }).first?.def, c.expectedFirst, c.word)
            XCTAssertEqual(c.senses.map { SenseRank.score(c.word, $0.def) }, c.scores, "\(c.word) scores")
        }
    }

    func testDecidedSemantics() {
        XCTAssertTrue(SenseRank.isCircular("nasty", "Something nasty."))
        XCTAssertFalse(SenseRank.isCircular("blade", "The sharp cutting edge of a knife, chisel, or other tool, a razor blade/sword blade."))
        XCTAssertFalse(SenseRank.isCircular("bible", "An exemplar of the Bible."))
        XCTAssertTrue(SenseRank.isStub("Alternative spelling of braze."))
        XCTAssertFalse(SenseRank.isStub("plural of calf"))
        XCTAssertTrue(SenseRank.isDerived("dizzy", "To make dizzy, to bewilder."))
        XCTAssertTrue(Plausibility.isPlausibleDailyResult(completed: true, guessCount: 1, timeSeconds: 3, totalBoards: 1))
        XCTAssertFalse(Plausibility.isPlausibleDailyResult(completed: true, guessCount: 6, timeSeconds: 3, totalBoards: 1))
        XCTAssertFalse(Plausibility.isPlausibleDailyResult(completed: true, guessCount: 0, timeSeconds: 30, totalBoards: 1))
    }
}
