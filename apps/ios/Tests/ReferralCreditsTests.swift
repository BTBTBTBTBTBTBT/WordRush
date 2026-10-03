import XCTest
@testable import WordociousCore

final class ReferralCreditsTests: XCTestCase {
    func testDismissPersistsPerUser() {
        let suite = "ReferralCreditsTests-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        defer { d.removePersistentDomain(forName: suite) }
        ReferralCredits.write("u1", ["a"], defaults: d)
        // A fresh read = the next launch.
        XCTAssertEqual(ReferralCredits.read("u1", defaults: d), ["a"])
        XCTAssertEqual(ReferralCredits.read("u2", defaults: d), [])
        // Server ids + Clear all merge without duplicates.
        XCTAssertEqual(ReferralCredits.write("u1", ["a", "b"], defaults: d), ["a", "b"])
    }

    func testOnlySettledRowsAreCredits() {
        XCTAssertTrue(ReferralCredits.isCredit("redeemed"))
        XCTAssertTrue(ReferralCredits.isCredit("converted"))
        XCTAssertFalse(ReferralCredits.isCredit("pending"))
        XCTAssertTrue(ReferralCredits.showClearAll(["redeemed", "converted", "pending"]))
        XCTAssertFalse(ReferralCredits.showClearAll(["redeemed", "pending"]))
    }
}
