import XCTest
@testable import WordociousCore

/// Display-format parity guard (iOS side). Asserts the same JSON that web
/// (display-format.test.ts) and Android (DisplayFormatFixtureTest.kt) assert,
/// so a formatter change that isn't regenerated + ported fails on every
/// platform. Regenerate: node apps/web/scripts/gen-display-format-fixtures.mjs
final class DisplayFormatFixtureTests: XCTestCase {
    struct Fixtures: Decodable {
        struct Score: Decodable { let score: Double; let expected: String }
        struct Time: Decodable { let seconds: Int; let expected: String }
        struct Percentile: Decodable {
            let rank: Int; let totalPlayers: Int
            let expectedLabel: String; let expectedGold: Bool
        }
        let formatScore: [Score]
        let formatShortTime: [Time]
        let topPercentLabel: [Percentile]
    }

    private func loadFixtures() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "display-format-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testFormatScoreMatchesFixtures() throws {
        for c in try loadFixtures().formatScore {
            XCTAssertEqual(formatScore(c.score), c.expected, "formatScore(\(c.score))")
        }
    }

    func testFormatShortTimeMatchesFixtures() throws {
        for c in try loadFixtures().formatShortTime {
            XCTAssertEqual(formatShortTime(c.seconds), c.expected, "formatShortTime(\(c.seconds))")
        }
    }

    func testTopPercentLabelMatchesFixtures() throws {
        for c in try loadFixtures().topPercentLabel {
            let r = topPercentLabel(rank: c.rank, totalPlayers: c.totalPlayers)
            XCTAssertEqual(r.label, c.expectedLabel, "topPercentLabel(\(c.rank), \(c.totalPlayers))")
            XCTAssertEqual(r.gold, c.expectedGold, "gold(\(c.rank), \(c.totalPlayers))")
        }
    }
}
