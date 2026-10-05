import Foundation

/// FINISH_SPEC §V3: the level tier badges (`art-badge-level-<tier>`), on the
/// thresholds the web Stats page already uses: Bronze 1–10, Silver 11–25,
/// Gold 26–50, Platinum 51–99, Diamond 100+. Mirrors core `levelTier(level)`.
public enum LevelTier: String, CaseIterable, Codable {
    case bronze, silver, gold, platinum, diamond

    public static func forLevel(_ level: Int) -> LevelTier {
        if level >= 100 { return .diamond }
        if level >= 51 { return .platinum }
        if level >= 26 { return .gold }
        if level >= 11 { return .silver }
        return .bronze
    }

    /// "Bronze" … "Diamond".
    public var label: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
    /// The badge image set.
    public var assetName: String { "art-badge-level-\(rawValue)" }
}

/// FINISH_SPEC §X: the season registry's date windows (docs/design/brand/seasons/README.md
/// "How to add a season"). Halloween runs Oct 17 – Nov 1 (local date, inclusive). Mirrors core
/// `SEASON_WINDOWS` / `currentSeason(date)`; level-season-fixtures.json pins the rows. The art
/// slots + palette per season live in season-registry.json (app target, SeasonKit).
public enum Season: String, Codable, CaseIterable {
    case halloween

    /// (start month, start day, end month, end day), inclusive; a window may wrap the new year.
    public static let windows: [(season: Season, start: (Int, Int), end: (Int, Int))] = [
        (.halloween, (10, 17), (11, 1)),
    ]

    /// The season for a local calendar day (month 1–12, day 1–31), or nil.
    public static func current(month: Int, day: Int) -> Season? {
        let k = month * 100 + day
        for w in windows {
            let a = w.start.0 * 100 + w.start.1, b = w.end.0 * 100 + w.end.1
            if a <= b ? (k >= a && k <= b) : (k >= a || k <= b) { return w.season }
        }
        return nil
    }

    /// The season for a "yyyy-MM-dd" local day, or nil (also nil when malformed).
    public static func current(day: String) -> Season? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return current(month: p[1], day: p[2])
    }
}
