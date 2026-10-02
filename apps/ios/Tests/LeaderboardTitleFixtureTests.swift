import XCTest
@testable import WordociousCore

/// Leaderboard title parity guard (iOS side): leaderboardTitle must produce the
/// same words as packages/core/src/leaderboard-title.ts for every fixture case,
/// byte for byte (FRIDAY’S carries the curly U+2019 apostrophe).
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class LeaderboardTitleFixtureTests: XCTestCase {
    private struct Case: Decodable {
        let day: String
        let holiday: String?
        let title: String
    }
    private struct Fixtures: Decodable { let titles: [Case] }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "leaderboard-title-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testTitlesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.titles.isEmpty)
        for (i, c) in f.titles.enumerated() {
            let got = leaderboardTitle(c.day, c.holiday)
            XCTAssertEqual(got, c.title, "title #\(i) (\(c.day))")
            XCTAssertEqual(Array(got.utf8), Array(c.title.utf8), "bytes #\(i) (\(c.day))")
        }
    }

    func testFridayUsesCurlyApostrophe() {
        let friday = leaderboardTitle("2026-10-02")
        XCTAssertTrue(friday.unicodeScalars.contains("\u{2019}"))
        XCTAssertFalse(friday.contains("'"))
    }

    func testWhitespaceHolidayFallsBackToWeekday() {
        XCTAssertEqual(leaderboardTitle("2026-10-31", "   "), "SATURDAY STARS")
        XCTAssertEqual(leaderboardTitle("2026-10-31", " Halloween "), "HALLOWEEN HEROES")
    }
}
