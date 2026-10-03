import XCTest
@testable import WordociousCore

/// FINISH_SPEC BJ11: the subscription hand-off copy + the lapsed-Pro line (web parity
/// lib/payment/subscription-copy.test.ts).
final class SubscriptionCopyTests: XCTestCase {
    func testEveryHandoffSaysWhatOpens() {
        XCTAssertEqual(SubscriptionCopy.handoff(.apple).line, "Opens your Apple subscription settings")
        XCTAssertEqual(SubscriptionCopy.handoff(.google).line, "Opens your Google Play subscriptions")
        XCTAssertEqual(SubscriptionCopy.handoff(.stripe).line, "Opens Stripe's secure billing page")
        XCTAssertEqual(SubscriptionCopy.handoff(.apple).cta, "Open Apple subscriptions")
    }

    func testCopyHasNoEmojiOrBritishSpelling() {
        let all = SubscriptionCopy.Store.allCases.map { s -> String in
            let h = SubscriptionCopy.handoff(s); return [h.title, h.line, h.body, h.cta].joined(separator: " ")
        }.joined(separator: " ") + SubscriptionCopy.lapsedBody + SubscriptionCopy.appleDisclosure(monthly: "$6.99", yearly: "$59.99")
        XCTAssertFalse(all.unicodeScalars.contains { $0.properties.isEmojiPresentation })
        XCTAssertNil(all.range(of: "cancell", options: .caseInsensitive))
    }

    func testDisclosureCarriesTheLivePrices() {
        let d = SubscriptionCopy.appleDisclosure(monthly: "€7,99", yearly: "€64,99")
        XCTAssertTrue(d.hasPrefix("Monthly (€7,99) and Yearly (€64,99) are auto-renewing subscriptions."))
        XCTAssertTrue(d.contains("24 hours before the period ends"))
    }

    func testLapsedLine() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Chicago")!
        let now = cal.date(from: DateComponents(year: 2026, month: 10, day: 3, hour: 12))!
        let ended = cal.date(from: DateComponents(year: 2026, month: 9, day: 30, hour: 12))!
        let future = cal.date(from: DateComponents(year: 2026, month: 10, day: 30, hour: 12))!
        XCTAssertEqual(SubscriptionCopy.lapsedLine(expiresAt: ended, proActive: false, now: now, calendar: cal),
                       "Your Pro ended Sep 30, 2026")
        XCTAssertNil(SubscriptionCopy.lapsedLine(expiresAt: ended, proActive: true, now: now, calendar: cal))
        XCTAssertNil(SubscriptionCopy.lapsedLine(expiresAt: future, proActive: false, now: now, calendar: cal))
        XCTAssertNil(SubscriptionCopy.lapsedLine(expiresAt: nil, proActive: false, now: now, calendar: cal))
    }
}
