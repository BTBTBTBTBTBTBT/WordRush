import XCTest
@testable import WordociousCore

/// VS Gauntlet matches solo: the race clock pauses during the player's own stage card
/// (5 s, tap to skip), and recorded times exclude the card time.
final class RaceClockTests: XCTestCase {
    func testStageCardTimeIsExcluded() {
        var c = RaceClock(startMs: 1_000)
        XCTAssertEqual(c.elapsedMs(at: 11_000), 10_000)
        // Stage 1 cleared at 10 s of race time: the 5 s card pauses the clock.
        c.pause(at: 11_000)
        XCTAssertEqual(c.elapsedMs(at: 14_000), 10_000)   // frozen during the card
        c.pause(at: 13_000)                                 // idempotent
        c.resume(at: 16_000)
        XCTAssertEqual(c.elapsedMs(at: 16_000), 10_000)
        XCTAssertEqual(c.elapsedMs(at: 26_000), 20_000)
        // A skipped card (tapped after 0.8 s) excludes only that 0.8 s.
        c.pause(at: 26_000)
        c.resume(at: 26_800)
        XCTAssertEqual(c.elapsedMs(at: 36_800), 30_000)
        XCTAssertEqual(c.pausedMs, 5_800)
        c.resume(at: 40_000)                                // no-op while running
        XCTAssertEqual(c.pausedMs, 5_800)
    }

    func testFinishTakenDuringTheFinalCardStopsAtTheCard() {
        var c = RaceClock(startMs: 1_000)
        c.pause(at: 61_000)   // the last stage's card goes up at 60 s of race time
        XCTAssertEqual(c.elapsedMs(at: 64_000), 60_000)
        XCTAssertTrue(c.isPaused)
    }

    func testNotStarted() {
        XCTAssertEqual(RaceClock(startMs: 0).elapsedMs(at: 5_000), 0)
    }
}
