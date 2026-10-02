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

/// FINISH_SPEC §X: seasonal cast skins. Halloween runs Oct 24 – Nov 1 (local date,
/// inclusive). Mirrors core `currentSeason(date)`.
public enum Season: String, Codable {
    case halloween

    /// The season for a local calendar day (month 1–12, day 1–31), or nil.
    public static func current(month: Int, day: Int) -> Season? {
        if (month == 10 && day >= 24) || (month == 11 && day <= 1) { return .halloween }
        return nil
    }

    /// The season for a "yyyy-MM-dd" local day, or nil (also nil when malformed).
    public static func current(day: String) -> Season? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return current(month: p[1], day: p[2])
    }
}
