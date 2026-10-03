import Foundation

/// FINISH_SPEC BI14: the Strategy page's pure rules, shared word-for-word with
/// apps/web/lib/strategy-games.ts and Android StrategyKit — which game an article
/// belongs to (its color, host, title art and PLAY button), the deterministic
/// "Tip of the day", and the takeaway line pulled from each section.
public enum StrategyPlan {
    /// Article slug → catalog id (packages/core/modes.json). Absent = an "Every game" article.
    public static let gameIds: [String: String] = [
        "best-starting-words": "practice",
        "solve-faster": "practice",
        "multi-board-mastery": "quordle",
        "gauntlet-survival": "gauntlet",
        "propernoundle-playbook": "propernoundle",
        "sudocious-playbook": "sudoku",
        "starsweep-playbook": "regions",
        "letter-ladder-playbook": "ladder",
        "spyglass-playbook": "wordsearch",
        "hubbub-playbook": "hub",
        "codebreaker-playbook": "cryptogram",
        "kindred-playbook": "groups",
        "crosswordocious-playbook": "crossword",
        "muddle-playbook": "scramble",
        "vs-battle-tactics": "vs",
    ]

    /// The general articles (no game) — listed so a new general article is a
    /// deliberate choice; unknown slugs still fall back by title below.
    public static let general: Set<String> = [
        "modes-explained", "daily-sweep-guide", "letter-frequency-atlas",
        "repeated-letter-traps", "beginner-to-sweeper",
    ]

    /// The catalog id for a slug. `titles` maps catalog id → title, for an unlisted
    /// "<game>-playbook" slug (title lowercased, spaces → "-").
    public static func gameId(for slug: String, titles: [String: String] = [:]) -> String? {
        if let id = gameIds[slug] { return id }
        if general.contains(slug) { return nil }
        let stem = slug.hasSuffix("-playbook") ? String(slug.dropLast("-playbook".count)) : slug
        return titles.first { $0.value.lowercased().replacingOccurrences(of: " ", with: "-") == stem }?.key
    }

    /// The cast order general articles cycle through (by their index among the general articles).
    public static let cast = ["w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s"]

    /// Whole days from 1970-01-01 to the given LOCAL calendar date.
    public static func dayNumber(year: Int, month: Int, day: Int) -> Int {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let d = utc.date(from: DateComponents(year: year, month: month, day: day)) ?? Date(timeIntervalSince1970: 0)
        return Int((d.timeIntervalSince1970 / 86_400).rounded(.down))
    }

    /// Today's featured index into `count` articles (deterministic by the local date).
    public static func tipIndex(count: Int, now: Date = Date(), calendar: Calendar = .current) -> Int {
        guard count > 0 else { return 0 }
        let c = calendar.dateComponents([.year, .month, .day], from: now)
        let n = dayNumber(year: c.year ?? 1970, month: c.month ?? 1, day: c.day ?? 1)
        return ((n % count) + count) % count
    }

    /// Splits a paragraph into its first sentence (the takeaway) and the rest. The
    /// split is the first ". ", "! " or "? " at character index ≥ 20; nil when none.
    public static func takeaway(_ paragraph: String) -> (takeaway: String, rest: String)? {
        let chars = Array(paragraph)
        guard chars.count > 21 else { return nil }
        for i in 20..<(chars.count - 1) where ".!?".contains(chars[i]) && chars[i + 1] == " " {
            let head = String(chars[0...i]).trimmingCharacters(in: .whitespaces)
            let rest = String(chars[(i + 1)...]).trimmingCharacters(in: .whitespaces)
            return (head, rest)
        }
        return nil
    }
}
