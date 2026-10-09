import Foundation

/// Home banner rules (founder-approved home redesign, 2026-10-01) — 1:1 port of
/// packages/core/src/home-banner.ts. One banner tops Home: a frosted headline
/// strip over two rows, Wordocious (the eight sweep dailies) and Puzzles (the
/// ten More Games dailies). Each row glows on its own: purple when every game
/// in it is finished (a sweep), gold when every game in it is won (a flawless);
/// both gold is a Double Flawless.
///
/// Pure so web, iOS and Android read the SAME words; pinned by
/// home-banner-fixtures.json (packages/core/scripts/gen-parity-fixtures.ts).
/// Compiled into the app (WordociousCore) AND the widget extension (project.yml)
/// so the widget headline can never drift from the home banner.
public enum BannerTier: String, Codable, Equatable {
    case none, sweep, flawless
}

/// One row's progress today: how many of its `total` dailies are finished, and how many won.
public struct GroupProgress: Codable, Equatable {
    public var played: Int
    public var won: Int
    public var total: Int
    public init(played: Int, won: Int, total: Int) {
        self.played = played; self.won = won; self.total = total
    }
}

/// One local day's finished / won counts (dayStreaks input).
public struct DayCount: Codable, Equatable {
    public var played: Int
    public var won: Int
    public init(played: Int, won: Int) { self.played = played; self.won = won }
}

/// A row's two runs: consecutive sweep days and consecutive flawless days.
public struct GroupStreaks: Codable, Equatable {
    public var sweep: Int
    public var flawless: Int
    /// 2.8 items 7 + 48: the best runs ever (0 = unknown → no "NEW BEST!").
    public var bestSweep: Int
    public var bestFlawless: Int
    public init(sweep: Int, flawless: Int, bestSweep: Int = 0, bestFlawless: Int = 0) {
        self.sweep = sweep; self.flawless = flawless; self.bestSweep = bestSweep; self.bestFlawless = bestFlawless
    }
    private enum CodingKeys: String, CodingKey { case sweep, flawless, bestSweep, bestFlawless }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sweep = try c.decode(Int.self, forKey: .sweep)
        flawless = try c.decode(Int.self, forKey: .flawless)
        bestSweep = try c.decodeIfPresent(Int.self, forKey: .bestSweep) ?? 0
        bestFlawless = try c.decodeIfPresent(Int.self, forKey: .bestFlawless) ?? 0
    }
}

/// Lifetime totals for a set of days: how many were sweeps / flawless and the longest run of each.
public struct DayRunTotals: Codable, Equatable {
    public var sweepDays: Int
    public var flawlessDays: Int
    public var bestSweep: Int
    public var bestFlawless: Int
    public init(sweepDays: Int, flawlessDays: Int, bestSweep: Int, bestFlawless: Int) {
        self.sweepDays = sweepDays; self.flawlessDays = flawlessDays; self.bestSweep = bestSweep; self.bestFlawless = bestFlawless
    }
}

public enum HomeBanner {
    /// A row glows once every game in it is finished; gold only when every one is won.
    public static func groupTier(_ g: GroupProgress) -> BannerTier {
        if g.total <= 0 || g.played < g.total { return .none }
        return g.won >= g.total ? .flawless : .sweep
    }

    /// The row's status text: "3/8", "SWEEP · 7/8 WON", "FLAWLESS · 8/8 WON".
    public static func groupStatus(_ g: GroupProgress) -> String {
        let tier = groupTier(g)
        if tier == .none { return "\(g.played)/\(g.total)" }
        return "\(tier == .flawless ? "FLAWLESS" : "SWEEP") · \(g.won)/\(g.total) WON"
    }

    /// Unlimited mode's row status: "5 PLAYED TODAY".
    public static func unlimitedGroupStatus(_ playedToday: Int) -> String {
        "\(playedToday) PLAYED TODAY"
    }

    /// Morning before noon, afternoon until 5 pm, evening after (local hour 0-23).
    public static func greetingWord(_ hour: Int) -> String {
        if hour < 12 { return "MORNING" }
        if hour < 17 { return "AFTERNOON" }
        return "EVENING"
    }

    private static func puzzlesLeft(_ n: Int) -> String {
        "\(n) \(n == 1 ? "PUZZLE" : "PUZZLES") LEFT"
    }

    private static func playedCount(_ word: GroupProgress, _ puzzles: GroupProgress) -> Int {
        min(word.played, word.total) + min(puzzles.played, puzzles.total)
    }

    /// The banner headline, always upper case. It moves with the day: a
    /// greeting before the first puzzle, then WARMING UP → ON A ROLL → HOME
    /// STRETCH, then a row's own news once one finishes, and finally the two
    /// results in banner order (Wordocious first, then Puzzles).
    /// `name` = the player's username (no nickname setting, founder 2026-10-01); empty for a guest.
    public static func bannerHeadline(_ word: GroupProgress, _ puzzles: GroupProgress,
                                      hour: Int, name: String, unlimited: Bool = false,
                                      wordStreaks: GroupStreaks? = nil, puzzleStreaks: GroupStreaks? = nil,
                                      dateKey: String? = nil) -> String {
        if unlimited { return "UNLIMITED PLAY" }
        let a = groupTier(word)
        let b = groupTier(puzzles)
        let total = word.total + puzzles.total
        let played = playedCount(word, puzzles)
        let left = max(0, total - played)
        // 2.8 items 7 + 48: a row that just earned its tier speaks to the streak when there is streak news.
        func streakLine(_ s: GroupStreaks?, _ t: BannerTier) -> String? {
            guard let s, let dateKey, t != .none else { return nil }
            return t == .flawless
                ? StreakHeadline.line(kind: .flawless, days: s.flawless, best: s.bestFlawless, dateKey: dateKey)
                : StreakHeadline.line(kind: .sweep, days: s.sweep, best: s.bestSweep, dateKey: dateKey)
        }
        if a != .none && b != .none {
            // Both rows done: the Wordocious row's streak (the header trophy counts it) leads.
            if let lead = streakLine(wordStreaks, a) { return lead }
            if a == .flawless && b == .flawless { return "DOUBLE FLAWLESS!" }
            if a == .sweep && b == .sweep { return "DOUBLE SWEEP!" }
            return a == .flawless ? "FLAWLESS + SWEEP!" : "SWEEP + FLAWLESS!"
        }
        func news(_ label: String, _ t: BannerTier) -> String {
            "\(label) \(t == .flawless ? "FLAWLESS!" : "SWEPT!") \(puzzlesLeft(left))"
        }
        if a != .none { return streakLine(wordStreaks, a) ?? news("WORDOCIOUS", a) }
        if b != .none { return streakLine(puzzleStreaks, b) ?? news("PUZZLES", b) }
        if played == 0 {
            let n = name.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            // BJ6 (founder 10-03): personal for signed-in players; 0–4 h is "UP LATE?".
            if hour >= 0 && hour < 5 { return n.isEmpty ? "UP LATE?" : "UP LATE, \(n)?" }
            return n.isEmpty ? "GOOD \(greetingWord(hour))!" : "GOOD \(greetingWord(hour)), \(n)!"
        }
        if played <= 5 { return "WARMING UP · \(played) DOWN" }
        if played <= 11 { return "ON A ROLL · \(played) OF \(total)" }
        return "HOME STRETCH · \(left) LEFT"
    }

    /// The line under the headline. `clock` is the live HH:MM:SS countdown to local midnight.
    public static func bannerClockLine(_ word: GroupProgress, _ puzzles: GroupProgress,
                                       clock: String, unlimited: Bool = false) -> String {
        if unlimited { return "FRESH PUZZLE EVERY TAP · ALL STATS COUNT" }
        let total = word.total + puzzles.total
        let played = playedCount(word, puzzles)
        if played >= total { return "NEW PUZZLES IN \(clock)" }
        if played == 0 { return "\(total) FRESH PUZZLES · RESETS IN \(clock)" }
        return "RESETS IN \(clock)"
    }

    /// The streak a row shows: its flawless run on a gold day, otherwise its sweep run.
    public static func groupStreak(_ tier: BannerTier, _ streaks: GroupStreaks) -> Int {
        tier == .flawless ? streaks.flawless : streaks.sweep
    }

    /// `YYYY-MM-DD` shifted by whole days (calendar math in UTC, no local time zones involved).
    public static func shiftDay(_ day: String, _ delta: Int) -> String {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return day }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        // Like JS Date.UTC, an out-of-range day rolls into the neighboring month/year.
        guard let base = utc.date(from: DateComponents(year: parts[0], month: parts[1], day: 1)),
              let t = utc.date(byAdding: .day, value: parts[2] - 1 + delta, to: base) else { return day }
        let c = utc.dateComponents([.year, .month, .day], from: t)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Consecutive-day runs ending today, or yesterday when today isn't done yet.
    /// `days` maps a local day to that day's finished and won counts; a day is a
    /// sweep when `played >= total` and a flawless when `won >= total`. Used for
    /// the Puzzles row (total = 10) and the Word of the Day (total = 1: a right
    /// answer counts as a "won" day).
    public static func dayStreaks(_ days: [String: DayCount], total: Int, today: String) -> GroupStreaks {
        if total <= 0 { return GroupStreaks(sweep: 0, flawless: 0) }
        func run(_ ok: (DayCount) -> Bool) -> Int {
            func hit(_ day: String) -> Bool { days[day].map(ok) ?? false }
            let yesterday = shiftDay(today, -1)
            var cursor: String? = hit(today) ? today : hit(yesterday) ? yesterday : nil
            var n = 0
            while let c = cursor, hit(c) { n += 1; cursor = shiftDay(c, -1) }
            return n
        }
        return GroupStreaks(sweep: run { $0.played >= total }, flawless: run { $0.won >= total })
    }

    /// Lifetime totals for a set of days (founder, 2026-10-01 stats audit): how many
    /// days were sweeps / flawless and the longest run of each. Feeds the All-time
    /// "Puzzles Sweeps" card (total = 10) and the Word of the Day record (total = 1).
    public static func dayRunTotals(_ days: [String: DayCount], total: Int) -> DayRunTotals {
        if total <= 0 { return DayRunTotals(sweepDays: 0, flawlessDays: 0, bestSweep: 0, bestFlawless: 0) }
        func tally(_ ok: (DayCount) -> Bool) -> (count: Int, best: Int) {
            let hits = days.filter { ok($0.value) }.keys.sorted()
            var best = 0, run = 0
            var prev: String?
            for d in hits {
                run = prev.map { shiftDay($0, 1) == d } == true ? run + 1 : 1
                if run > best { best = run }
                prev = d
            }
            return (hits.count, best)
        }
        let sweep = tally { $0.played >= total }
        let flawless = tally { $0.won >= total }
        return DayRunTotals(sweepDays: sweep.count, flawlessDays: flawless.count, bestSweep: sweep.best, bestFlawless: flawless.best)
    }
}
