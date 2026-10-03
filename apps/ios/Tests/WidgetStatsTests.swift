import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AL: the widget snapshot math (points sum, played/total, midnight rollover).
final class WidgetStatsTests: XCTestCase {
    func testPointsSumRoundsOnce() {
        XCTAssertEqual(WidgetStats.points(wordScore: 2005.4, puzzleScore: 1414.4), 3420)
        XCTAssertEqual(WidgetStats.points(wordScore: 0, puzzleScore: 0), 0)
        XCTAssertEqual(WidgetStats.points(wordScore: -5, puzzleScore: 10), 10)
    }

    func testSameDayKeepsTheNumbers() {
        let s = WidgetStats.forDay(snapshotDay: "2026-10-02", today: "2026-10-02", played: 5, total: 8, points: 3420)
        XCTAssertEqual(s, WidgetDayStats(played: 5, total: 8, points: 3420))
        XCTAssertEqual(WidgetStats.solvedText(s), "5/8")
        XCTAssertEqual(WidgetStats.pointsText(s.points), "3,420")
        XCTAssertEqual(WidgetStats.solvedPhrase(s), "5 of 8 puzzles solved today")
        XCTAssertEqual(WidgetStats.pointsPhrase(s), "3,420 points today")
    }

    func testMidnightRollsOverToZero() {
        let s = WidgetStats.forDay(snapshotDay: "2026-10-01", today: "2026-10-02", played: 8, total: 8, points: 9000)
        XCTAssertEqual(s, WidgetDayStats(played: 0, total: 8, points: 0))
    }

    func testMissingPointsShowZeroNeverHidden() {
        XCTAssertEqual(WidgetStats.forDay(snapshotDay: "d", today: "d", played: 0, total: 18, points: nil).points, 0)
        XCTAssertEqual(WidgetStats.forDay(snapshotDay: "d", today: "d", played: 20, total: 18, points: 5).played, 18)
    }

    func testCountdownPhrase() {
        XCTAssertEqual(WidgetStats.countdownPhrase(seconds: 7 * 3600 + 42 * 60 + 10), "new puzzles in 7 hours 42 minutes")
        XCTAssertEqual(WidgetStats.countdownPhrase(seconds: 3600), "new puzzles in 1 hour")
        XCTAssertEqual(WidgetStats.countdownPhrase(seconds: 59), "new puzzles in 0 minutes")
    }

    /// FINISH_SPEC §AV: the peeking trio — never the day host, distinct, rotating daily.
    func testWidgetPeekers() {
        XCTAssertEqual(WidgetCast.dayNumber("1970-01-01"), 0)
        XCTAssertEqual(WidgetCast.dayNumber("2026-10-03") - WidgetCast.dayNumber("2026-10-02"), 1)
        var seen = Set<[String]>()
        for host in WidgetCast.cast {
            for d in 0..<14 {
                let p = WidgetCast.peekers(dayNumber: 20_000 + d, host: host)
                XCTAssertEqual(p.count, 3)
                XCTAssertEqual(Set(p).count, 3)
                XCTAssertFalse(p.contains(host))
                seen.insert(p)
            }
        }
        // Consecutive days differ.
        XCTAssertNotEqual(WidgetCast.peekers(dayNumber: 20_001, host: "d"), WidgetCast.peekers(dayNumber: 20_002, host: "d"))
        XCTAssertGreaterThan(seen.count, 5)
        XCTAssertEqual(WidgetCast.asset("w", day: "2026-10-30"), "art-halloween-w")
        XCTAssertEqual(WidgetCast.asset("w", day: "2026-10-02"), "mascot-w")
        XCTAssertEqual(WidgetCast.asset("w", day: "2026-11-01"), "art-halloween-w")
    }

    /// FINISH_SPEC BC: the short points form is a last resort only.
    func testPointsCompact() {
        XCTAssertEqual(WidgetStats.pointsCompact(10_779), "10.8K")
        XCTAssertEqual(WidgetStats.pointsCompact(9_999), "9,999")
        XCTAssertEqual(WidgetStats.pointsCompact(20_000), "20K")
        XCTAssertEqual(WidgetStats.pointsCompact(1_250_000), "1.3M")
        XCTAssertEqual(WidgetStats.pointsCompact(0), "0")
    }
}
