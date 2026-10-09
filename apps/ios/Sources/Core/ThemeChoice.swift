import Foundation

/// Theme choice + the "Seasonal" row (FRIDAY-QUEUE items 24 + 25). Port of core theme-choice.ts, pinned by
/// theme-choice-fixtures.json (web + Swift + Kotlin read the same file).
///
///   - the player's BASE theme is never overwritten by a season: it is what comes back when the season ends
///   - inside the window Seasonal is preset ON; picking another theme opts out for THIS season + year
///   - picking Seasonal clears the opt-out; outside a season the row is hidden
///   - the `season_halloween` off-switch turns every season look off
public enum ThemeChoiceRules {
    public static let baseThemes = ["default", "ocean", "forest", "dark"]

    public struct Choice: Equatable, Sendable {
        public var theme: String
        /// "<season>:<year>" the player opted out of, or nil.
        public var seasonOptOut: String?
        public init(theme: String = "default", seasonOptOut: String? = nil) {
            self.theme = theme; self.seasonOptOut = seasonOptOut
        }
    }

    /// "<season>:<year>" for a season and a local "YYYY-MM-DD" date.
    public static func optOutKey(season: String, date: String) -> String {
        "\(season):\(date.prefix(4))"
    }

    public static func seasonalActive(_ c: Choice, season: String?, switchOn: Bool, date: String) -> Bool {
        guard let season, switchOn else { return false }
        return c.seasonOptOut != optOutKey(season: season, date: date)
    }

    public static func showSeasonalRow(season: String?, switchOn: Bool) -> Bool { season != nil && switchOn }

    /// What to draw: the base theme, and whether the season layers on top.
    public static func effective(_ c: Choice, season: String?, switchOn: Bool, date: String) -> (base: String, seasonal: Bool) {
        (c.theme, seasonalActive(c, season: season, switchOn: switchOn, date: date))
    }

    /// The choice after a tap on a Settings theme row ("seasonal" or a base theme).
    public static func pick(_ c: Choice, picked: String, season: String?, date: String) -> Choice {
        if picked == "seasonal" { return Choice(theme: c.theme, seasonOptOut: nil) }
        return Choice(theme: picked, seasonOptOut: season.map { optOutKey(season: $0, date: date) } ?? c.seasonOptOut)
    }

    /// "Oct 31": the window's last day, for the row subtitle.
    public static func endLabel(season: String) -> String? {
        guard let w = Season.windows.first(where: { $0.season.rawValue == season }) else { return nil }
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return "\(months[w.end.0 - 1]) \(w.end.1)"
    }

    public static func parseBase(_ v: String?) -> String {
        guard let v, baseThemes.contains(v) else { return "default" }
        return v
    }
}
