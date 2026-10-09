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
}
