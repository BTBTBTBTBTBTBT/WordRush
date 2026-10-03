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

    /// FINISH_SPEC BC: the last-resort short form — "10.8K" (≥ 10,000), "1.2M";
    /// below 10,000 the full number.
    public static func pointsCompact(_ n: Int) -> String {
        func one(_ v: Double, _ unit: String) -> String {
            let r = (v * 10).rounded() / 10
            return (r == r.rounded() ? String(Int(r)) : String(format: "%.1f", r)) + unit
        }
        if n >= 1_000_000 { return one(Double(n) / 1_000_000, "M") }
        if n >= 10_000 { return one(Double(n) / 1_000, "K") }
        return pointsText(n)
    }

    /// "5/8".
    public static func solvedText(_ s: WidgetDayStats) -> String { "\(s.played)/\(s.total)" }

    /// VoiceOver: "5 of 8 puzzles solved today".
    public static func solvedPhrase(_ s: WidgetDayStats) -> String { "\(s.played) of \(s.total) puzzles solved today" }

    /// VoiceOver: "3,420 points today".
    public static func pointsPhrase(_ s: WidgetDayStats) -> String {
        "\(pointsText(s.points)) \(s.points == 1 ? "point" : "points") today"
    }

    /// BI13: the widget's short reset label — "4h" (whole hours, rounded up) while an hour
    /// or more is left, then "45m" (minutes, rounded up). The widget timeline refreshes on
    /// the hour and every 15 minutes in the last hour, so it never runs stale-low.
    public static func resetText(seconds: Int) -> String {
        let s = max(0, seconds)
        if s >= 3600 { return "\((s + 3599) / 3600)h" }
        return "\(max(1, (s + 59) / 60))m"
    }

    /// BI13: the name the widget's "NEXT …" line shows — the snapshot's short title, except
    /// the two clipped ones ("Succ.", "Deliv."), which read better in full.
    public static func nextName(key: String, title: String) -> String {
        switch key {
        case "SEQUENCE": return "Succession"
        case "RESCUE": return "Deliverance"
        default: return title.hasSuffix(".") ? String(title.dropLast()) : title
        }
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

/// FINISH_SPEC §AV: the widget's cast — the day host leaning in from the top-right,
/// plus a different trio of cast heads peeking up from the bottom edge each day
/// (never the day host), in Halloween skins in season. Pure Foundation (compiled into
/// the widget extension too).
public enum WidgetCast {
    /// The ten heroes in WORDOCIOUS order.
    public static let cast = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]

    /// The day's peekers: `count` distinct cast ids (never `host`), rotating by day.
    public static func peekers(dayNumber: Int, host: String, count: Int = 3) -> [String] {
        let pool = cast.filter { $0 != host }
        guard !pool.isEmpty else { return [] }
        let n = min(count, pool.count)
        let start = ((dayNumber % pool.count) * 3 + pool.count * 1000) % pool.count
        return (0..<n).map { pool[(start + $0) % pool.count] }
    }

    /// Days since 1970 for a local "yyyy-MM-dd" (the rotation key; 0 when malformed).
    public static func dayNumber(_ day: String) -> Int {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return 0 }
        // Days from civil (Howard Hinnant) — no Calendar, stable everywhere.
        let y = p[1] <= 2 ? p[0] - 1 : p[0]
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let m = p[1], d = p[2]
        let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    /// The image set for a cast id on `day`: the Halloween skin Oct 24 – Nov 1.
    public static func asset(_ id: String, day: String) -> String {
        let p = day.split(separator: "-").compactMap { Int($0) }
        let halloween = p.count == 3 && ((p[1] == 10 && p[2] >= 24) || (p[1] == 11 && p[2] <= 1))
        return halloween ? "art-halloween-\(id)" : "mascot-\(id)"
    }

    /// BI13b (founder 10-03: "sprinkle a mascot or two … just a little personality"): the
    /// mood of the one cast member peeking into the widget.
    public enum PeekMood: String, CaseIterable { case fresh, playing, milestone, swept }

    /// Friendly poses only, never W (W hosts the large header; never w-cheer / w-lean).
    /// Pose ids are `art-pose-<id>` image sets (bundled via scripts/sync-widget-assets.sh).
    public static let peekPoses: [PeekMood: [String]] = [
        .fresh: ["r-wake", "r-cocoa"],                                   // sleepy R, the morning
        .playing: ["o1-ready", "c-telescope", "d-eureka", "i-reach", "o2-ready", "o3-ready"],
        .milestone: ["s-trophy", "s-victory"],                           // S on a streak milestone
        .swept: ["d-cheer", "o1-cheer", "o2-cheer", "i-cheer"],          // the cheer squad
    ]

    /// A streak worth a trophy: every 7th day and every 50th.
    public static func isMilestone(_ streak: Int) -> Bool {
        streak >= 7 && (streak % 7 == 0 || streak % 50 == 0)
    }

    /// Swept beats everything, then nothing-played-yet, then a milestone streak.
    public static func peekMood(played: Int, total: Int, streak: Int) -> PeekMood {
        if total > 0 && played >= total { return .swept }
        if played == 0 { return .fresh }
        if isMilestone(streak) { return .milestone }
        return .playing
    }

    /// The pose id for this moment, picked deterministically by the local day.
    public static func peekPose(played: Int, total: Int, streak: Int, day: String) -> String {
        let pool = peekPoses[peekMood(played: played, total: total, streak: streak)] ?? ["r-wake"]
        let i = ((dayNumber(day) % pool.count) + pool.count) % pool.count
        return pool[i]
    }

    /// The image set: the pose, or in Halloween season that character's costume.
    public static func peekAsset(_ pose: String, day: String) -> String {
        let id = String(pose.split(separator: "-").first ?? "r")
        let costume = asset(id, day: day)
        return costume.hasPrefix("art-halloween-") ? costume : "art-pose-\(pose)"
    }

    /// BI13c (founder 10-03): on a big day (all eight swept, or a streak milestone) the
    /// player's OWN mascot peeks in instead of the day's cast member.
    public static func ownPeekDay(played: Int, total: Int, streak: Int) -> Bool {
        let mood = peekMood(played: played, total: total, streak: streak)
        return mood == .swept || mood == .milestone
    }
}

/// BI13c: the player's own look, pre-rendered by the app (WidgetAvatarSnapshot) into the
/// app-group container — a full-body mascot cutout OR a framed photo portrait (never both),
/// ~256 px PNG. Missing file → W. The widget composes nothing.
public enum WidgetAvatar {
    public static let mascotFile = "widget-avatar-mascot.png"
    public static let photoFile = "widget-avatar-photo.png"
    public static let side: Int = 256
}
