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

    /// Founder 10-16: Thanksgiving runs Nov 14 – Nov 29 by the calendar, but a NOT-READY season (art unshipped)
    /// never activates for the public; the admin preview still names it (every case is listed).
    func testThanksgivingWindowAndReadyGate() {
        XCTAssertEqual(Season.calendar(day: "2026-10-31"), .halloween)
        XCTAssertNil(Season.calendar(day: "2026-11-01"))
        XCTAssertNil(Season.calendar(day: "2026-11-13"))
        XCTAssertEqual(Season.calendar(day: "2026-11-14"), .thanksgiving)
        XCTAssertEqual(Season.calendar(day: "2026-11-26"), .thanksgiving)
        XCTAssertEqual(Season.calendar(day: "2026-11-29"), .thanksgiving)
        XCTAssertNil(Season.calendar(day: "2026-11-30"))
        XCTAssertFalse(Season.thanksgiving.ready)
        XCTAssertTrue(Season.halloween.ready)
        for day in ["2026-11-14", "2026-11-20", "2026-11-26", "2026-11-29"] {
            XCTAssertEqual(Season.calendar(day: day), .thanksgiving, day)
            XCTAssertNil(Season.current(day: day), "not-ready season must stay off: \(day)")
        }
        XCTAssertEqual(Season.current(day: "2026-10-31"), .halloween)
        // The admin picker (SettingsView, CastSkin.debugKey) accepts every case, ready or not.
        XCTAssertEqual(Season(rawValue: "thanksgiving"), .thanksgiving)
        XCTAssertEqual(Season.allCases.map(\.rawValue), ["halloween", "thanksgiving"])
    }

    /// Parity: packages/core SEASON_WINDOWS + currentSeason / calendarSeason (level-season-fixtures.json `days` + `windows`).
    func testMatchesSharedSeasonFixture() throws {
        struct Day: Decodable { let date: String; let season: String?; let calendar: String? }
        struct Row: Decodable { let id: String; let start: [Int]; let end: [Int]; let ready: Bool }
        struct F: Decodable { let days: [Day]; let windows: [Row] }
        let url = try XCTUnwrap(Bundle.module.url(forResource: "level-season-fixtures", withExtension: "json", subdirectory: "Fixtures")
            ?? Bundle.module.url(forResource: "level-season-fixtures", withExtension: "json"))
        let f = try JSONDecoder().decode(F.self, from: Data(contentsOf: url))
        for d in f.days {
            XCTAssertEqual(Season.current(day: d.date)?.rawValue, d.season, d.date)
            XCTAssertEqual(Season.calendar(day: d.date)?.rawValue, d.calendar, d.date)
        }
        XCTAssertEqual(f.windows.map { "\($0.id) \($0.start) \($0.end) \($0.ready)" },
                       Season.windows.map { "\($0.season.rawValue) [\($0.start.0), \($0.start.1)] [\($0.end.0), \($0.end.1)] \($0.ready)" })
    }
}
