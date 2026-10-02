import XCTest
@testable import WordociousCore

/// FINISH_SPEC §AI: the review prompt's happy-moment rules.
final class ReviewPromptPolicyTests: XCTestCase {
    func testDayMath() {
        XCTAssertEqual(ReviewPromptPolicy.days(from: "2026-10-01", to: "2026-10-04"), 3)
        XCTAssertEqual(ReviewPromptPolicy.days(from: "2026-02-28", to: "2026-03-01"), 1)
        XCTAssertEqual(ReviewPromptPolicy.days(from: "2024-02-28", to: "2024-03-01"), 2)
        XCTAssertEqual(ReviewPromptPolicy.days(from: "2025-12-31", to: "2026-01-01"), 1)
        XCTAssertNil(ReviewPromptPolicy.days(from: "x", to: "2026-01-01"))
    }

    func testRules() {
        let t = "2026-10-10"
        XCTAssertFalse(ReviewPromptPolicy.shouldAsk(today: t, firstPlayDay: nil, lastAskDay: nil, afterLoss: false))
        XCTAssertFalse(ReviewPromptPolicy.shouldAsk(today: t, firstPlayDay: "2026-10-08", lastAskDay: nil, afterLoss: false))
        XCTAssertTrue(ReviewPromptPolicy.shouldAsk(today: t, firstPlayDay: "2026-10-07", lastAskDay: nil, afterLoss: false))
        XCTAssertFalse(ReviewPromptPolicy.shouldAsk(today: t, firstPlayDay: "2026-01-01", lastAskDay: nil, afterLoss: true))
        XCTAssertFalse(ReviewPromptPolicy.shouldAsk(today: t, firstPlayDay: "2026-01-01", lastAskDay: "2026-06-20", afterLoss: false))
        XCTAssertTrue(ReviewPromptPolicy.shouldAsk(today: t, firstPlayDay: "2026-01-01", lastAskDay: "2026-06-12", afterLoss: false))
    }
}
