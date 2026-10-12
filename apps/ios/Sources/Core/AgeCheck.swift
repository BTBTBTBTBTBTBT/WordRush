import Foundation

/// 13+ age check (FRIDAY-QUEUE item 29 — COPPA). Pure rules; mirrors core age-check.ts and
/// AgeCheck.kt (Android). One neutral question, "What year were you born?", no default, no hint
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

/// What the age gate shows (2026-10-10 fix: a returning signed-in player sat on a black screen). A returning player on a
/// fresh device may already be confirmed server-side, so the gate waits for that lookup, but NEVER longer than
/// `maxWaitMs` and never on a plain black screen. Mirrors core ageGateView (pinned by age-gate-fixtures.json).
public enum AgeGate {
    public enum View: String, Equatable, Sendable { case pass, under, placeholder, question }

    /// The longest the gate shows its placeholder before it just asks.
    public static let maxWaitMs = 2000

    public static func view(stored: AgeCheck.State?, live: Bool, hadSession: Bool, serverCheckDone: Bool, elapsedMs: Int) -> View {
        if stored == .under { return .under }
        if stored == .ok || !live { return .pass }
        if hadSession && !serverCheckDone && elapsedMs < maxWaitMs { return .placeholder }
        return .question
    }
}


/// Recovery from a mistaken "under" (2026-10-12: a real adult tapped a toddler year). The lockout screen offers a quiet
/// "A grown-up? Sign in"; after a sign-in that started there, the account's server flag decides. Confirmed -> the device's
/// "under" becomes a passing "ok" (the shape a confirmed account gets on a fresh device: this year - 18). Not confirmed, or
/// missing -> the account is signed out again, the lockout stays and NOTHING is posted for it (it must not be flagged or
/// purged just for trying). Mirrors core ageRecoveryDecision and Android AgeRecovery.
public enum AgeRecovery {
    public enum Decision: Equatable, Sendable {
        case unlock(AgeCheck.Stored)
        case stayLocked   // never posts the under-13 answer
    }

    public static let linkLabel = "A grown-up? Sign in"
    public static let unconfirmedLine = "This account isn't confirmed for 13+. A parent can email \(AgeCheck.supportEmail)."

    /// The year a confirmed account adopts (the server keeps only the yes/no flag).
    public static func confirmedYear(now: Date = Date(), calendar: Calendar = .current) -> Int {
        calendar.component(.year, from: now) - 18
    }

    public static func decide(serverConfirmed: Bool?, now: Date = Date(), calendar: Calendar = .current) -> Decision {
        guard serverConfirmed == true else { return .stayLocked }
        return .unlock(AgeCheck.Stored(state: .ok, year: confirmedYear(now: now, calendar: calendar)))
    }
}
