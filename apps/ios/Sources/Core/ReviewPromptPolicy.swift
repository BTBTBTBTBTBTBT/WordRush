import Foundation

/// FINISH_SPEC §AI: the store review prompt rides a happy moment only — right after
/// a Flawless, a Daily Sweep, or a 7-day streak milestone — never in the first 3
/// days of play, at most once per 120 days, never after a loss. No custom pre-prompt
/// (Apple 5.6.1): the caller lets the celebration finish, then asks the system.
public enum ReviewPromptPolicy {
    public static let minDaysPlaying = 3
    public static let minDaysBetweenAsks = 120

    /// Days from `from` to `to` ("yyyy-MM-dd", UTC-free calendar math); nil when malformed.
    public static func days(from: String, to: String) -> Int? {
        func ordinal(_ s: String) -> Int? {
            let p = s.split(separator: "-").compactMap { Int($0) }
            guard p.count == 3 else { return nil }
            var y = p[0], m = p[1]
            let d = p[2]
            // Days since a fixed epoch (proleptic Gregorian, civil-from-days inverse).
            if m <= 2 { y -= 1; m += 12 }
            return 365 * y + y / 4 - y / 100 + y / 400 + (153 * (m - 3) + 2) / 5 + d
        }
        guard let a = ordinal(from), let b = ordinal(to) else { return nil }
        return b - a
    }

    /// Whether to ask now. `firstPlayDay` = the first day this device saw the player
    /// play (nil = unknown → don't ask); `lastAskDay` = the last ask (nil = never).
    public static func shouldAsk(today: String, firstPlayDay: String?, lastAskDay: String?, afterLoss: Bool) -> Bool {
        guard !afterLoss, let first = firstPlayDay, let playing = days(from: first, to: today),
              playing >= minDaysPlaying else { return false }
        if let last = lastAskDay {
            guard let since = days(from: last, to: today), since >= minDaysBetweenAsks else { return false }
        }
        return true
    }
}
