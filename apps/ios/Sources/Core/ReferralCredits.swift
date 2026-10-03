import Foundation

/// Referral CREDIT notices on the "Gift a week of Pro" card (founder 10-03: "I need to be able to
/// X that so it goes away"): the inviter's settled rows ("<name> joined! +3 days", "<name>
/// subscribed! …") each get a dismiss X, plus a quiet "Clear all" at 2+. A dismissal sticks across
/// relaunches (a per-user local list keyed by the referral id) and devices (the server flag via
/// /api/referrals/dismiss). Mirrors web lib/referral-credits.ts + Android ReferralCredits.kt.
public enum ReferralCredits {
    public static func isCredit(_ status: String) -> Bool { status == "redeemed" || status == "converted" }

    public static func showClearAll(_ statuses: [String]) -> Bool { statuses.filter(isCredit).count >= 2 }

    public static func key(_ userId: String) -> String { "referral-credits-dismissed:\(userId)" }

    public static func read(_ userId: String, defaults: UserDefaults = .standard) -> Set<String> {
        Set(defaults.stringArray(forKey: key(userId)) ?? [])
    }

    /// Adds ids to the user's local list (keeps the newest 200) and returns the new set.
    @discardableResult
    public static func write(_ userId: String, _ ids: [String], defaults: UserDefaults = .standard) -> Set<String> {
        var list = defaults.stringArray(forKey: key(userId)) ?? []
        for id in ids where !list.contains(id) { list.append(id) }
        if list.count > 200 { list = Array(list.suffix(200)) }
        defaults.set(list, forKey: key(userId))
        return Set(list)
    }
}
