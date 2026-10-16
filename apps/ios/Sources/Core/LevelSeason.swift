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
/// "How to add a season"). Halloween runs Oct 9 – Oct 31, Thanksgiving Nov 14 – Nov 29 (local date,
/// inclusive). Mirrors core `SEASON_WINDOWS` / `currentSeason(date)` / `calendarSeason(date)`;
/// level-season-fixtures.json pins the rows. The art slots + palette per season live in
/// season-registry.json (app target, SeasonKit).
///
/// `ready` (10-16): false while the season's art is unapproved / unshipped. `current` skips a
/// not-ready season (nothing public switches on: cast, walls, titles, surfaces, widgets, sounds);
/// `calendar` answers for every window; the admin Season preview (`CastSkin.debugKey`) lists
/// every case and bypasses the calendar. Flip `ready` in the build that ships the art.
public enum Season: String, Codable, CaseIterable {
    case halloween
    case thanksgiving

    /// (start month, start day, end month, end day), inclusive; a window may wrap the new year.
    public static let windows: [(season: Season, start: (Int, Int), end: (Int, Int), ready: Bool)] = [
        (.halloween, (10, 9), (10, 31), true),
        (.thanksgiving, (11, 14), (11, 29), false),
    ]

    /// Is the season's art shipped (its window may switch it on for the public)?
    public var ready: Bool { Season.windows.first { $0.season == self }?.ready ?? false }

    /// The PUBLIC season for a local calendar day (month 1–12, day 1–31): the window's season when
    /// it is ready, else nil.
    public static func current(month: Int, day: Int) -> Season? {
        guard let s = calendar(month: month, day: day), s.ready else { return nil }
        return s
    }

    /// The window a local calendar day falls in, ready or not; nil = no season.
    public static func calendar(month: Int, day: Int) -> Season? {
        let k = month * 100 + day
        for w in windows {
            let a = w.start.0 * 100 + w.start.1, b = w.end.0 * 100 + w.end.1
            if a <= b ? (k >= a && k <= b) : (k >= a || k <= b) { return w.season }
        }
        return nil
    }

    /// The public season for a "yyyy-MM-dd" local day, or nil (also nil when malformed).
    public static func current(day: String) -> Season? {
        guard let (m, d) = monthDay(day) else { return nil }
        return current(month: m, day: d)
    }

    /// `calendar(month:day:)` for a "yyyy-MM-dd" local day.
    public static func calendar(day: String) -> Season? {
        guard let (m, d) = monthDay(day) else { return nil }
        return calendar(month: m, day: d)
    }

    private static func monthDay(_ day: String) -> (Int, Int)? {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return (p[1], p[2])
    }
}
