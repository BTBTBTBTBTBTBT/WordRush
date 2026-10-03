import XCTest
@testable import WordociousCore

/// FINISH_SPEC BF3: unlock detection — the unseen diff, first-launch seeding, queue order.
final class AchievementSeenTests: XCTestCase {
    private func e(_ k: String, _ at: String?) -> AchievementSeen.Earned { .init(key: k, at: at) }

    func testFirstLaunchSeedsWithoutCelebrating() {
        let r = AchievementSeen.diff(earned: [e("first_win", "2026-09-01"), e("streak_7", "2026-09-08")], seen: nil)
        XCTAssertEqual(r.celebrate, [])
        XCTAssertEqual(r.seen, ["first_win", "streak_7"])
    }

    func testNewKeyQueuedOnceAlreadySeenNever() {
        let seen: Set<String> = ["first_win"]
        let r = AchievementSeen.diff(earned: [e("first_win", "2026-09-01"), e("puzzle_sweep", "2026-10-02T09:00")], seen: seen)
        XCTAssertEqual(r.celebrate, ["puzzle_sweep"])
        // The next sync with the stored set celebrates nothing.
        let again = AchievementSeen.diff(earned: [e("first_win", "2026-09-01"), e("puzzle_sweep", "2026-10-02T09:00")], seen: r.seen)
        XCTAssertEqual(again.celebrate, [])
    }

    func testQueueOrderOldestFirst() {
        let r = AchievementSeen.diff(earned: [e("night_owl", "2026-10-02T03:00"), e("early_bird", "2026-10-01T06:00"),
                                              e("best_buds", "2026-10-02T03:00"), e("best_buds", "2026-10-02T03:00")],
                                     seen: [])
        XCTAssertEqual(r.celebrate, ["early_bird", "best_buds", "night_owl"])
    }

    func testAwardUnseen() {
        XCTAssertEqual(AchievementSeen.unseen(["a", "b", "a", "c"], seen: ["b"]), ["a", "c"])
        XCTAssertEqual(AchievementSeen.unseen([], seen: []), [])
    }
}
