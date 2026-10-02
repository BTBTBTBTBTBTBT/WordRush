import Foundation

/// The Leaderboard page title (founder, 2026-10-01): "a fun word play like
/// Friday's Finest … switching those up by the days". One alliterative title per
/// weekday; a holiday day swaps in "<HOLIDAY> HEROES". 1:1 port of
/// packages/core/src/leaderboard-title.ts, pinned by leaderboard-title-fixtures.json
/// so web, iOS and Android read the same words on the same local day.
public enum LeaderboardTitle {
    /// Sunday first (JS getUTCDay order). FRIDAY’S uses the curly apostrophe (U+2019).
    public static let weekdayTitles: [String] = [
        "SUNDAY SUPERSTARS",
        "MONDAY MASTERS",
        "TUESDAY TITANS",
        "WEDNESDAY WIZARDS",
        "THURSDAY THUNDER",
        "FRIDAY\u{2019}S FINEST",
        "SATURDAY STARS",
    ]

    /// `day` is the player's local yyyy-MM-dd; `holiday` the day's holiday name, if any.
    public static func title(day: String, holiday: String? = nil) -> String {
        let h = (holiday ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !h.isEmpty { return "\(h.uppercased()) HEROES" }
        return weekdayTitles[weekday(day)]
    }

    /// 0 = Sunday … 6 = Saturday for a proleptic-Gregorian yyyy-MM-dd (Sakamoto's method).
    static func weekday(_ day: String) -> Int {
        let parts = day.split(separator: "-").map { Int($0) ?? 0 }
        guard parts.count == 3 else { return 0 }
        let t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
        let m = parts[1], d = parts[2]
        guard (1...12).contains(m) else { return 0 }
        let y = m < 3 ? parts[0] - 1 : parts[0]
        let w = (y + y / 4 - y / 100 + y / 400 + t[m - 1] + d) % 7
        return (w + 7) % 7
    }
}

/// Free-function spelling of the core export (`leaderboardTitle(day, holiday)`).
public func leaderboardTitle(_ day: String, _ holiday: String? = nil) -> String {
    LeaderboardTitle.title(day: day, holiday: holiday)
}
