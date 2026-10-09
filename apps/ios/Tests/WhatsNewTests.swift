import XCTest
@testable import WordociousCore

/// Item 41: parity with packages/core/src/whats-new.test.ts.
final class WhatsNewTests: XCTestCase {
    private func decide(live: Bool = true, seen: [String]? = [], signedIn: Bool = true, onboarded: Bool? = true,
                        created: String? = "2026-08-01T10:00:00Z") -> WhatsNew.Decision {
        WhatsNew.decision(live: live, seen: seen, signedIn: signedIn, hasOnboarded: onboarded, createdAt: created)
    }

    func testSixPagesInOrder() {
        XCTAssertEqual(WhatsNew.pages.map(\.id), ["season", "alive", "order", "invites", "widgets", "packs"])
        for p in WhatsNew.pages { XCTAssertEqual(p.title, p.title.uppercased()) }
    }

    func testWidgetsAreAnAppFeature() {
        XCTAssertFalse(WhatsNew.pages(for: "web").map(\.id).contains("widgets"))
        XCTAssertTrue(WhatsNew.pages(for: "ios").map(\.id).contains("widgets"))
        XCTAssertEqual(WhatsNew.pages(for: "android").count, 6)
    }

    func testExistingPlayerGetsTheTour() { XCTAssertEqual(decide(), .show) }

    func testBrandNewPlayerNeverSeesItAndTheKeyIsRecorded() {
        XCTAssertEqual(decide(created: "\(WhatsNew.cutoff)T00:00:00Z"), .record)
        XCTAssertEqual(decide(created: "2026-11-02T00:00:00Z"), .record)
        XCTAssertEqual(decide(onboarded: false), .record)
    }

    func testSeenOffGuestNothing() {
        XCTAssertEqual(decide(seen: [WhatsNew.key]), .none)
        XCTAssertEqual(decide(live: false), .none)
        XCTAssertEqual(decide(signedIn: false), .none)
    }

    func testWaitsWhileLoading() {
        XCTAssertEqual(decide(seen: nil), .wait)
        XCTAssertEqual(decide(onboarded: nil), .wait)
    }
}
