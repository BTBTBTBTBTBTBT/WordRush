import Foundation

/// 13+ age check (FRIDAY-QUEUE item 29 — COPPA). Pure rules; mirrors core age-check.ts and
/// AgeCheck.kt (Android). One neutral question, "When's your birthday year?", no default, no hint
/// that 13 matters; only the year is ever stored.
///
/// A year alone cannot tell a passed 13th birthday from an upcoming one, so the rule is STRICT
/// (founder: "I don't mind losing the under-13 players if it's safer"): a player passes only when
/// `currentYear - birthYear >= passOffset`, i.e. they are guaranteed to be at least 13. Flip
/// `passOffset` to 13 for the permissive reading (and the same constant in the other two ports).
public enum AgeCheck {
    public static let minAge = 13
    public static let passOffset = minAge + 1
    public static let maxYearsBack = 100
    public static let supportEmail = "privacy@wordocious.com"

    public enum Verdict: Equatable, Sendable { case pass, under, invalid }
    public enum State: String, Codable, Equatable, Sendable { case ok, under }

    public struct Stored: Codable, Equatable, Sendable {
        public let state: State
        public let year: Int
        public init(state: State, year: Int) { self.state = state; self.year = year }
    }

    /// Years for the wheel, newest first (no default selection).
    public static func years(now: Date = Date(), calendar: Calendar = .current) -> [Int] {
        let y = calendar.component(.year, from: now)
        return (0...maxYearsBack).map { y - $0 }
    }

    public static func verdict(year: Int, now: Date = Date(), calendar: Calendar = .current) -> Verdict {
        let y = calendar.component(.year, from: now)
        if year > y || year < y - maxYearsBack { return .invalid }
        return y - year >= passOffset ? .pass : .under
    }

    /// Re-validates a stored value: a hand-edited "ok" next to a young year reads as "under".
    public static func parse(_ data: Data?, now: Date = Date(), calendar: Calendar = .current) -> Stored? {
        guard let data, let v = try? JSONDecoder().decode(Stored.self, from: data) else { return nil }
        switch verdict(year: v.year, now: now, calendar: calendar) {
        case .invalid: return nil
        case .pass: return v
        case .under: return Stored(state: .under, year: v.year)
        }
    }
}
