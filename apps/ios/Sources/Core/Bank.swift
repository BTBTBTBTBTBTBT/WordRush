import Foundation

/// Epoch-indexed puzzle banks — port of packages/core/src/bank.ts (More Games
/// §11). Day k after a mode's epoch is always bank entry k, whatever the
/// bank's length, so appending entries never changes an already-dated puzzle.
/// Dailies draw from `daily`, Unlimited from `extra`. Parity is pinned by
/// bank-fixtures.json alongside the Kotlin and TS ports.
public enum Bank {
    /// Whole UTC days from `epoch` to `day` (both yyyy-MM-dd); nil if unparseable.
    public static func dayIndex(_ day: String, epoch: String) -> Int? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        f.locale = Locale(identifier: "en_US_POSIX")
        guard let to = f.date(from: day), let from = f.date(from: epoch) else { return nil }
        return Int(((to.timeIntervalSince1970 - from.timeIntervalSince1970) / 86400).rounded())
    }

    /// Index for the daily on `day` into a bank of `n` entries. Pre-epoch and
    /// past-the-end days fall back to a stable modulo (a runway check keeps
    /// that from ever happening in production). 0 for an empty bank.
    public static func indexForDay(_ day: String, n: Int, epoch: String) -> Int {
        guard n > 0, let idx = dayIndex(day, epoch: epoch) else { return 0 }
        if idx >= 0 && idx < n { return idx }
        return ((idx % n) + n) % n
    }

    /// Index for an Unlimited seed; steps past `avoid` if the hash lands on it.
    public static func indexForSeed(_ seed: String, n: Int, avoid: Int? = nil) -> Int {
        guard n > 0 else { return 0 }
        let idx = simpleHash(seed) % n
        if let a = avoid, n > 1, idx == a { return (idx + 1) % n }
        return idx
    }
}
