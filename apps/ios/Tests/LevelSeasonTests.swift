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

    func testHalloweenWindowIsOct24ThroughNov1() {
        XCTAssertNil(Season.current(day: "2026-10-23"))
        XCTAssertEqual(Season.current(day: "2026-10-24"), .halloween)
        XCTAssertEqual(Season.current(day: "2026-10-31"), .halloween)
        XCTAssertEqual(Season.current(day: "2026-11-01"), .halloween)
        XCTAssertNil(Season.current(day: "2026-11-02"))
        XCTAssertNil(Season.current(day: "2026-12-25"))
        XCTAssertNil(Season.current(day: "garbage"))
    }
}
