import XCTest
@testable import WordociousCore

/// FINISH_SPEC §V3 level tiers and §X the Halloween season window.
final class LevelSeasonTests: XCTestCase {
    func testLevelTierThresholds() {
        let cases: [(Int, LevelTier)] = [(0, .bronze), (1, .bronze), (10, .bronze), (11, .silver), (25, .silver),
                                          (26, .gold), (50, .gold), (51, .platinum), (99, .platinum), (100, .diamond), (250, .diamond)]
        for (lvl, tier) in cases { XCTAssertEqual(LevelTier.forLevel(lvl), tier, "level \(lvl)") }
        XCTAssertEqual(LevelTier.gold.assetName, "art-badge-level-gold")
        XCTAssertEqual(LevelTier.platinum.label, "Platinum")
    }

    func testHalloweenWindowIsOct17ThroughNov1() {
        XCTAssertNil(Season.current(day: "2026-10-08"))
        XCTAssertEqual(Season.current(day: "2026-10-09"), .halloween)
        XCTAssertEqual(Season.current(day: "2026-10-24"), .halloween)
        XCTAssertEqual(Season.current(day: "2026-10-31"), .halloween)
        XCTAssertEqual(Season.current(day: "2026-10-31"), .halloween)
        XCTAssertNil(Season.current(day: "2026-11-01"))
        XCTAssertNil(Season.current(day: "2026-12-25"))
        XCTAssertNil(Season.current(day: "garbage"))
    }

    /// Parity: packages/core SEASON_WINDOWS + currentSeason (level-season-fixtures.json `days` + `windows`).
    func testMatchesSharedSeasonFixture() throws {
        struct Day: Decodable { let date: String; let season: String? }
        struct Row: Decodable { let id: String; let start: [Int]; let end: [Int] }
        struct F: Decodable { let days: [Day]; let windows: [Row] }
        let url = try XCTUnwrap(Bundle.module.url(forResource: "level-season-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "level-season-fixtures", withExtension: "json"))
        let f = try JSONDecoder().decode(F.self, from: Data(contentsOf: url))
        for d in f.days { XCTAssertEqual(Season.current(day: d.date)?.rawValue, d.season, d.date) }
        XCTAssertEqual(f.windows.map { "\($0.id) \($0.start) \($0.end)" },
                       Season.windows.map { "\($0.season.rawValue) [\($0.start.0), \($0.start.1)] [\($0.end.0), \($0.end.1)]" })
    }
}
