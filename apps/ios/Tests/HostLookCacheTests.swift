import XCTest
@testable import WordociousCore

/// Founder 10-05: the Home host draws the player's cached look from the first frame (web
/// home-host-cache.test.ts / Android HostLookCacheTest parity).
final class HostLookCacheTests: XCTestCase {
    private let mine = HostLookEntry(userId: "AAA-111", kind: .mascot, config: AvatarCatalog.defaultAvatar(userId: "wordwiz"),
                                     username: "WordWiz")

    func testEntryKeyIsLowercasedUserId() {
        XCTAssertEqual(mine.userId, "aaa-111")
    }

    func testLaunchWindowBeforeProfileShowsTheCachedLook() {
        XCTAssertEqual(HostLookRules.source(entry: mine, sessionExpected: true, isGuest: false, profileUserId: nil, liveSettled: false),
                       .cached(mine))
    }

    func testCachedLookShowsWhileTheOwnColumnsLoad() {
        XCTAssertEqual(HostLookRules.source(entry: mine, sessionExpected: true, isGuest: false, profileUserId: "aaa-111", liveSettled: false),
                       .cached(mine))
    }

    func testKeyedByUserAnotherAccountsLookIsNeverShown() {
        XCTAssertEqual(HostLookRules.source(entry: mine, sessionExpected: true, isGuest: false, profileUserId: "bbb-222", liveSettled: false),
                       .unknown)
    }

    func testSettledLiveLookWins() {
        XCTAssertEqual(HostLookRules.source(entry: mine, sessionExpected: true, isGuest: false, profileUserId: "AAA-111", liveSettled: true),
                       .live)
    }

    func testNoCacheWhileLoadingIsUnknownSoNoInviteBubble() {
        XCTAssertEqual(HostLookRules.source(entry: nil, sessionExpected: true, isGuest: false, profileUserId: nil, liveSettled: false),
                       .unknown)
        XCTAssertEqual(HostLookRules.source(entry: nil, sessionExpected: true, isGuest: false, profileUserId: "aaa-111", liveSettled: false),
                       .unknown)
    }

    func testSignedOutAndGuestsKeepTodaysBehavior() {
        // Signed out (sign-out clears the session hint and the entry): the live host (W).
        XCTAssertEqual(HostLookRules.source(entry: nil, sessionExpected: false, isGuest: false, profileUserId: nil, liveSettled: false),
                       .live)
        // A stale entry with no session expected is never drawn.
        XCTAssertEqual(HostLookRules.source(entry: mine, sessionExpected: false, isGuest: false, profileUserId: nil, liveSettled: false),
                       .live)
        XCTAssertEqual(HostLookRules.source(entry: mine, sessionExpected: true, isGuest: true, profileUserId: nil, liveSettled: false),
                       .live)
    }

    func testWritesOnlyOnChangeAndCrossfadesOnlyOnChange() {
        XCTAssertFalse(HostLookRules.shouldWrite(stored: mine, live: mine))
        var changed = mine
        changed.config?.color = "pink"
        XCTAssertTrue(HostLookRules.shouldWrite(stored: mine, live: changed))
        XCTAssertTrue(HostLookRules.shouldWrite(stored: nil, live: mine))
        XCTAssertFalse(HostLookRules.crossfades(from: mine, to: mine))
        XCTAssertTrue(HostLookRules.crossfades(from: mine, to: changed))
        XCTAssertEqual(HostLookRules.crossfadeSeconds, 0.2, accuracy: 0.0001)
    }

    func testEntryRoundTripsThroughJSON() throws {
        let photo = HostLookEntry(userId: "aaa-111", kind: .photo, photoUrl: "https://x/p.jpg", username: "WordWiz", frame: "gold", pro: true)
        for e in [mine, photo] {
            let back = try JSONDecoder().decode(HostLookEntry.self, from: JSONEncoder().encode(e))
            XCTAssertEqual(back, e)
        }
    }
}
