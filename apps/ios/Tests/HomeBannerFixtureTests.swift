import XCTest
@testable import WordociousCore

/// Home banner parity guard (iOS side): HomeBanner must produce the same words
/// and streaks as packages/core/src/home-banner.ts for every fixture case, so
/// the banner reads identically on web, iOS and Android.
/// Regenerate: packages/core/scripts/gen-parity-fixtures.ts
final class HomeBannerFixtureTests: XCTestCase {
    private struct Headline: Decodable {
        let word: GroupProgress
        let puzzles: GroupProgress
        let hour: Int
        let name: String
        let unlimited: Bool
        let headline: String
    }
    private struct Clock: Decodable {
        let word: GroupProgress
        let puzzles: GroupProgress
        let clock: String
        let unlimited: Bool
        let line: String
    }
    private struct Group: Decodable {
        let group: GroupProgress
        let tier: BannerTier
        let status: String
    }
    private struct Streak: Decodable {
        let days: [String: DayCount]
        let total: Int
        let today: String
        let sweep: Int
        let flawless: Int
    }
    private struct Totals: Decodable {
        let days: [String: DayCount]
        let total: Int
        let sweepDays: Int
        let flawlessDays: Int
        let bestSweep: Int
        let bestFlawless: Int
    }
    private struct StreakLine: Decodable {
        let kind: String
        let days: Int
        let best: Int
        let dateKey: String
        let line: String?
    }
    private struct StreaksIn: Decodable { let word: GroupStreaks; let puzzles: GroupStreaks }
    private struct WithStreaks: Decodable {
        let word: GroupProgress
        let puzzles: GroupProgress
        let hour: Int
        let name: String
        let streaks: StreaksIn
        let dateKey: String
        let headline: String
    }
    private struct Fixtures: Decodable {
        let streakLines: [StreakLine]
        let withStreaks: [WithStreaks]
        let headlines: [Headline]
        let clocks: [Clock]
        let groups: [Group]
        let streaks: [Streak]
        let totals: [Totals]
    }

    private func load() throws -> Fixtures {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "home-banner-fixtures", withExtension: "json", subdirectory: "Fixtures"))
        return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }

    func testHeadlinesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.headlines.isEmpty)
        for (i, c) in f.headlines.enumerated() {
            XCTAssertEqual(HomeBanner.bannerHeadline(c.word, c.puzzles, hour: c.hour, name: c.name, unlimited: c.unlimited),
                           c.headline, "headline #\(i)")
        }
    }

    /// 2.8 items 7 + 48: the streak lines (milestones, NEW BEST!, restarts) and the banner with streaks.
    func testStreakHeadlinesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.streakLines.isEmpty)
        for c in f.streakLines {
            let kind: StreakHeadline.Kind = c.kind == "flawless" ? .flawless : .sweep
            XCTAssertEqual(StreakHeadline.line(kind: kind, days: c.days, best: c.best, dateKey: c.dateKey), c.line, "\(c)")
        }
        for c in f.withStreaks {
            XCTAssertEqual(HomeBanner.bannerHeadline(c.word, c.puzzles, hour: c.hour, name: c.name,
                                                     wordStreaks: c.streaks.word, puzzleStreaks: c.streaks.puzzles, dateKey: c.dateKey),
                           c.headline)
        }
    }

    func testClockLinesMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.clocks.isEmpty)
        for (i, c) in f.clocks.enumerated() {
            XCTAssertEqual(HomeBanner.bannerClockLine(c.word, c.puzzles, clock: c.clock, unlimited: c.unlimited),
                           c.line, "clock #\(i)")
        }
    }

    func testGroupsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.groups.isEmpty)
        for (i, c) in f.groups.enumerated() {
            XCTAssertEqual(HomeBanner.groupTier(c.group), c.tier, "tier #\(i)")
            XCTAssertEqual(HomeBanner.groupStatus(c.group), c.status, "status #\(i)")
        }
    }

    func testStreaksMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.streaks.isEmpty)
        for (i, c) in f.streaks.enumerated() {
            let got = HomeBanner.dayStreaks(c.days, total: c.total, today: c.today)
            XCTAssertEqual(got.sweep, c.sweep, "sweep #\(i)")
            XCTAssertEqual(got.flawless, c.flawless, "flawless #\(i)")
        }
    }

    func testDayRunTotalsMatchSharedFixtures() throws {
        let f = try load()
        XCTAssertFalse(f.totals.isEmpty)
        for (i, c) in f.totals.enumerated() {
            XCTAssertEqual(HomeBanner.dayRunTotals(c.days, total: c.total),
                           DayRunTotals(sweepDays: c.sweepDays, flawlessDays: c.flawlessDays, bestSweep: c.bestSweep, bestFlawless: c.bestFlawless),
                           "totals #\(i)")
        }
        XCTAssertEqual(HomeBanner.dayRunTotals(["2026-10-01": DayCount(played: 1, won: 1)], total: 0),
                       DayRunTotals(sweepDays: 0, flawlessDays: 0, bestSweep: 0, bestFlawless: 0))
    }

    func testShiftDayCrossesMonthsAndYears() {
        XCTAssertEqual(HomeBanner.shiftDay("2026-03-01", -1), "2026-02-28")
        XCTAssertEqual(HomeBanner.shiftDay("2024-03-01", -1), "2024-02-29")
        XCTAssertEqual(HomeBanner.shiftDay("2026-01-01", -1), "2025-12-31")
        XCTAssertEqual(HomeBanner.shiftDay("2025-12-31", 1), "2026-01-01")
        XCTAssertEqual(HomeBanner.unlimitedGroupStatus(5), "5 PLAYED TODAY")
        XCTAssertEqual(HomeBanner.groupStreak(.flawless, GroupStreaks(sweep: 4, flawless: 2)), 2)
        XCTAssertEqual(HomeBanner.groupStreak(.sweep, GroupStreaks(sweep: 4, flawless: 2)), 4)
        XCTAssertEqual(HomeBanner.groupStreak(.none, GroupStreaks(sweep: 4, flawless: 2)), 4)
    }
}
