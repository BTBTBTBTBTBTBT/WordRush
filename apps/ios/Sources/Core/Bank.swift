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

// MARK: - Holidays (More Games §20)

/// The shared holiday calendar — DATA emitted by apps/web/scripts/holidays/
/// gen-holiday-days.mjs (holiday-days.json, bundled on every platform and
/// sha-guarded): `days` maps yyyy-MM-dd to a holiday key ("christmas",
/// "mlkday", …). No platform ports the date rules. Port of bank.ts.
public struct HolidayTable: Decodable {
    public let version: Int
    public let from: String
    public let to: String
    public let days: [String: String]
    public init(version: Int, from: String, to: String, days: [String: String]) { self.version = version; self.from = from; self.to = to; self.days = days }
    public static func load(from data: Data) -> HolidayTable? { try? JSONDecoder().decode(HolidayTable.self, from: data) }
    /// The app-bundled calendar (Resources/holiday-days.json); nil where the app bundle lacks it.
    public static let bundled: HolidayTable? = {
        guard let url = Bundle.main.url(forResource: "holiday-days", withExtension: "json"), let data = try? Data(contentsOf: url) else { return nil }
        return load(from: data)
    }()
}

/// The holiday key that owns `day`, or nil on an ordinary day (or outside the table).
public func holidayKeyForDay(_ day: String, table: HolidayTable?) -> String? { table?.days[day] }

/// How many days owned by `key` fall strictly BEFORE `day` in the table — the
/// k-th outing of a holiday (Christmas Eve 0, Christmas Day 1, Boxing Day 2 in
/// the first year; 3, 4, 5 the next). Plain string comparison, as in bank.ts.
public func holidayOccurrence(_ day: String, key: String, table: HolidayTable?) -> Int {
    guard let days = table?.days else { return 0 }
    var n = 0
    for (d, k) in days where d < day && k == key { n += 1 }
    return n
}

/// The holiday entry a bank should serve on `day`: `entries[k mod n]` where k is
/// the occurrence, or nil when the day is ordinary or the bank has nothing for
/// that holiday (then the ordinary epoch index applies).
public func bankHolidayPick<T>(day: String, table: HolidayTable?, holiday: [String: [T]]?) -> (key: String, index: Int, entry: T)? {
    guard let key = holidayKeyForDay(day, table: table), let entries = holiday?[key], !entries.isEmpty else { return nil }
    let index = holidayOccurrence(day, key: key, table: table) % entries.count
    return (key, index, entries[index])
}
