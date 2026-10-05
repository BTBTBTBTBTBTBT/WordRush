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

    /// Johnny (iOS 242): the same unlock queued twice (live result + sync, or a replay)
    /// must show ONCE, and "Awesome!" must close it for good.
    func testDuplicateUnlockShowsOnceAndAwesomeCloses() {
        let id = "a:cryptogram_swift"
        // Two announcements of the same achievement in one batch → one popup.
        var queue = UnlockQueue.admit([id, id], queued: [], shown: [])
        XCTAssertEqual(queue, [id])
        // A second announcement while it is on screen → still one.
        queue += UnlockQueue.admit([id], queued: queue, shown: [id])
        XCTAssertEqual(queue, [id])
        // Even a queue that somehow holds two copies empties on one "Awesome!".
        queue = UnlockQueue.dismiss([id, id, "a:best_buds"], id: id)
        XCTAssertEqual(queue, ["a:best_buds"])
        // After it was shown, a late re-announcement (sync, replay) is refused.
        XCTAssertEqual(UnlockQueue.admit([id, "a:night_owl"], queued: [], shown: [id]), ["a:night_owl"])
        // Different achievements still play one after another, in order.
        XCTAssertEqual(UnlockQueue.admit(["a:x", "l:11", "a:y", "a:x"], queued: [], shown: []), ["a:x", "l:11", "a:y"])
    }
}
