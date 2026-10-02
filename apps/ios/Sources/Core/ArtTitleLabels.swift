import Foundation

/// FINISH_SPEC §AB: the words every lettering image shows — its VoiceOver label
/// (with the header trait) and its text fallback. ONE registry the app's art
/// enums read (`ArtTitleName`, `MomentArt`, `DayTitleArt`), so a test can prove
/// every art title that ships has a real, non-empty label. Game title art
/// (`art-game-<mode id>`) is labeled with the catalog's `shareLabel`.
public enum ArtTitleLabels {
    /// `art-title-<key>`: page / section titles with the cast.
    public static let titles: [String: String] = [
        "friends": "Friends",
        "stats": "Stats",
        "records": "All-Time Records",
        "vs": "VS Battle",
        "puzzles": "Puzzles",
        "wotd": "Word of the Day",
        "settings": "Settings",
        "howto": "How to Play",
        "gopro": "Go Pro",
        "moregames": "More Games",
        "welcome": "Welcome",
        "leaderboard": "Leaderboard",
        "dailies": "Dailies",
        "guides": "Guides",
        "strategy": "Strategy",
        "words": "Words",
        "faq": "FAQ",
        "privacy": "Privacy",
        "terms": "Terms",
        "vsbattle": "VS Battle",
    ]

    /// `art-moment-<key>`: result / celebration lettering.
    public static let moments: [String: String] = [
        "victory": "Victory!",
        "soclose": "So close!",
        "sweep": "Sweep!",
        "flawless": "Flawless!",
        "youwin": "You win!",
        "youlose": "You lose",
        "draw": "Draw",
        "newrecord": "New record!",
        "streak": "Streak!",
    ]

    /// `art-day-<weekday>`, Sunday first (core `LeaderboardTitle.weekdayTitles` order).
    public static let dayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

    /// The day title art's words.
    public static let days: [String: String] = [
        "sunday": "Sunday Superstars",
        "monday": "Monday Masters",
        "tuesday": "Tuesday Titans",
        "wednesday": "Wednesday Wizards",
        "thursday": "Thursday Thunder",
        "friday": "Friday\u{2019}s Finest",
        "saturday": "Saturday Stars",
    ]

    /// The label for a lettering asset name (`art-title-*`, `art-moment-*`,
    /// `art-day-*`; `art-game-*` via `gameLabels`, mode id → catalog shareLabel).
    /// nil = not a lettering asset, or one with no registered words.
    public static func label(forAsset name: String, gameLabels: [String: String] = [:]) -> String? {
        let table: [(String, [String: String])] = [
            ("art-title-", titles), ("art-moment-", moments), ("art-day-", days), ("art-game-", gameLabels),
        ]
        for (prefix, map) in table where name.hasPrefix(prefix) {
            return map[String(name.dropFirst(prefix.count))]
        }
        return nil
    }
}
