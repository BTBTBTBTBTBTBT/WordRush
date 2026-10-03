import Foundation

/// FINISH_SPEC BJ11 (founder 10-03: "When I clicked check subscription somewhere the
/// Apple menu popped up"): every hand-off to a billing page we don't draw — Apple's or
/// Google Play's subscription settings, Stripe's billing page — is announced first, in
/// our look, saying what opens. Plus the lapsed-Pro line a former member sees ("Your Pro
/// ended Sep 30, 2026"). Pure copy; web parity lib/payment/subscription-copy.ts,
/// Android data/SubscriptionCopy.kt.
public enum SubscriptionCopy {
    public enum Store: String, CaseIterable { case apple, google, stripe }

    public struct Handoff: Equatable {
        /// The sheet / row title.
        public let title: String
        /// The one line under a row: what opens.
        public let line: String
        /// The interstitial's sentence (why it opens a page that isn't ours).
        public let body: String
        /// The button that continues to the store's page.
        public let cta: String
    }

    public static func handoff(_ store: Store) -> Handoff {
        switch store {
        case .apple:
            return Handoff(
                title: "Manage on the App Store",
                line: "Opens your Apple subscription settings",
                body: "Apple handles Pro billing for iPhone and iPad, so changing plans or canceling happens in your Apple subscription settings. Your Pro stays tied to your Wordocious account.",
                cta: "Open Apple subscriptions")
        case .google:
            return Handoff(
                title: "Manage on Google Play",
                line: "Opens your Google Play subscriptions",
                body: "Google Play handles Pro billing on Android, so changing plans or canceling happens in your Play subscriptions. Your Pro stays tied to your Wordocious account.",
                cta: "Open Play subscriptions")
        case .stripe:
            return Handoff(
                title: "Manage web billing",
                line: "Opens Stripe's secure billing page",
                body: "Pro bought on wordocious.com is billed by Stripe. Update your card, switch plans or cancel on Stripe's secure page, then come right back.",
                cta: "Open billing")
        }
    }

    /// The line under a Subscribe button in the iOS app: where the purchase happens.
    public static let appleCheckoutLine = "Confirms with your Apple Account"

    /// The App Store auto-renew disclosure (Guideline 3.1.2) with the live prices.
    public static func appleDisclosure(monthly: String, yearly: String) -> String {
        "Monthly (\(monthly)) and Yearly (\(yearly)) are auto-renewing subscriptions. Payment is charged to your Apple Account at confirmation. Subscriptions renew automatically unless canceled at least 24 hours before the period ends; manage or cancel in Settings › Apple Account › Subscriptions. The Day Pass is a one-time 24-hour purchase and does not renew."
    }

    private static let shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    /// "Your Pro ended Sep 30, 2026" for a former member: the Pro window is in the past and
    /// Pro isn't active. Nil for players who never had Pro, active members, or no expiry.
    public static func lapsedLine(expiresAt: Date?, proActive: Bool, now: Date = Date(),
                                  calendar: Calendar = .current) -> String? {
        guard !proActive, let end = expiresAt, end < now else { return nil }
        let c = calendar.dateComponents([.year, .month, .day], from: end)
        guard let y = c.year, let m = c.month, let d = c.day, (1...12).contains(m) else { return nil }
        return "Your Pro ended \(shortMonths[m - 1]) \(d), \(y)"
    }

    /// The lapsed card's second line.
    public static let lapsedBody = "Everything you earned is still here. Pick a plan to switch Pro back on."
}
