import Foundation

/// FINISH_SPEC §AL: the numbers every widget size always shows — puzzles solved
/// today, today's points, and the time until new puzzles — plus their spoken phrases.
/// Pure Foundation: compiled into the app (WordociousCore) AND straight into the
/// widget extension (project.yml), so both sides do the same math.
public struct WidgetDayStats: Equatable {
    public let played: Int
    public let total: Int
    public let points: Int

    public init(played: Int, total: Int, points: Int) {
        self.played = played; self.total = total; self.points = points
    }
}

public enum WidgetStats {
    /// Today's points: the word dailies' plus the Puzzles' summed scores, rounded once
    /// (the same number the app shows for today).
    public static func points(wordScore: Double, puzzleScore: Double) -> Int {
        Int((max(0, wordScore) + max(0, puzzleScore)).rounded())
    }

    /// The stats to draw for `today` from a snapshot written for `snapshotDay`: a
    /// snapshot from another day rolls over to 0/N and 0 points (never yesterday's numbers).
    public static func forDay(snapshotDay: String, today: String, played: Int, total: Int, points: Int?) -> WidgetDayStats {
        guard snapshotDay == today else { return WidgetDayStats(played: 0, total: max(0, total), points: 0) }
        return WidgetDayStats(played: min(max(0, played), max(0, total)), total: max(0, total), points: max(0, points ?? 0))
    }

    /// "3,420".
    public static func pointsText(_ n: Int) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_US")
        f.numberStyle = .decimal
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    /// "5/8".
    public static func solvedText(_ s: WidgetDayStats) -> String { "\(s.played)/\(s.total)" }

    /// VoiceOver: "5 of 8 puzzles solved today".
    public static func solvedPhrase(_ s: WidgetDayStats) -> String { "\(s.played) of \(s.total) puzzles solved today" }

    /// VoiceOver: "3,420 points today".
    public static func pointsPhrase(_ s: WidgetDayStats) -> String {
        "\(pointsText(s.points)) \(s.points == 1 ? "point" : "points") today"
    }

    /// VoiceOver: "new puzzles in 7 hours 42 minutes".
    public static func countdownPhrase(seconds: Int) -> String {
        let s = max(0, seconds)
        let h = s / 3600, m = (s % 3600) / 60
        var parts: [String] = []
        if h > 0 { parts.append("\(h) \(h == 1 ? "hour" : "hours")") }
        if m > 0 || h == 0 { parts.append("\(m) \(m == 1 ? "minute" : "minutes")") }
        return "new puzzles in " + parts.joined(separator: " ")
    }
}
