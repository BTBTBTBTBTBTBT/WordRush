import XCTest
@testable import WordociousCore

/// Items 11 + 11b: parity with packages/core/src/leaderboard-stage.test.ts.
final class LeaderboardStageTests: XCTestCase {
    func testHostsOnePerWeekdayWNeverHostsWednesdayIsTheWizard() {
        XCTAssertEqual(LeaderboardStage.dayHosts.count, 7)
        XCTAssertTrue(LeaderboardStage.dayHosts.allSatisfy { $0.castId != "w" })
        XCTAssertEqual(leaderboardTitle("2026-10-07", nil), "WEDNESDAY WIZARDS")   // a Wednesday
        XCTAssertEqual(LeaderboardStage.host(day: "2026-10-07"), LeaderboardStage.Host(castId: "u", pose: "spin"))
        XCTAssertEqual(LeaderboardStage.weekday("2026-10-04"), 0)
        XCTAssertEqual(LeaderboardStage.weekday("2026-10-10"), 6)
    }

    func testLedgeStepsAreTwoOneThreeCentered() {
        XCTAssertEqual(LeaderboardStage.ledgeSteps.map(\.place), [2, 1, 3])
        XCTAssertEqual(LeaderboardStage.ledgeSteps[1].x, 0.5, accuracy: 0.0001)
        XCTAssertLessThan(LeaderboardStage.ledgeSteps[1].top, LeaderboardStage.ledgeSteps[0].top)
        XCTAssertLessThan(LeaderboardStage.ledgeSteps[0].top, LeaderboardStage.ledgeSteps[2].top)
    }

    func testStageTopLeavesRoomForThePodium() {
        XCTAssertTrue(LeaderboardStage.podiumFits(stageTopHeight: LeaderboardStage.topMaxHeight))
        XCTAssertFalse(LeaderboardStage.podiumFits(stageTopHeight: LeaderboardStage.topMaxHeight + 200))
    }

    func testDayPropsAndWizardHat() {
        XCTAssertEqual(LeaderboardStage.dayProps.count, 7)
        XCTAssertEqual(LeaderboardStage.dayProp(day: "2026-10-07"), LeaderboardStage.DayProp(art: "art-lb-day-wand-swish", motion: "swish"))
        XCTAssertEqual(LeaderboardStage.dayProp(day: "2026-10-08"), LeaderboardStage.DayProp(art: "art-lb-day-lightning", motion: "flash"))
        XCTAssertGreaterThanOrEqual(Set(LeaderboardStage.dayProps.map(\.motion)).count, 5)
        XCTAssertTrue(LeaderboardStage.wearsWizardHat(day: "2026-10-07"))
        for d in ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09", "2026-10-10"] { XCTAssertFalse(LeaderboardStage.wearsWizardHat(day: d)) }
    }
}
