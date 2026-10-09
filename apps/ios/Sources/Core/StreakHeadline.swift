import Foundation

// 2.8 items 7 + 48: the Home banner's streak lines — a 1:1 port of packages/core/src/streak-headline.ts, pinned by
// Fixtures/home-banner-fixtures.json ("streakLines" / "withStreaks"). Milestone lines at 2 / 3 / 4 / 5 / 6 / 7 / 10 /
// 14 / 30, "NEW BEST!" on a record run, a kind restart line after a break; the variant is picked by a stable hash of
// the date key so everyone sees the same line that day and it never repeats flatly.

public enum StreakHeadline {
    public enum Kind: String, Sendable { case flawless, sweep }

    /// A stable non-negative hash (FNV-1a over the UTF-16 code units, 31 bits) — identical in every port.
    public static func dayHash(_ s: String) -> Int {
        var h: UInt32 = 2166136261
        for u in s.utf16 {
            h ^= UInt32(u)
            h = h &* 16777619
        }
        return Int(h & 0x7fffffff)
    }

    private static let n = "{n}"

    private static let flawlessMilestones: [Int: [String]] = [
        2: ["FLAWLESS · 2 IN A ROW!", "BACK-TO-BACK FLAWLESS!", "FLAWLESS TWICE IN A ROW!"],
        3: ["FLAWLESS 3-PEAT!", "THREE FLAWLESS DAYS!", "FLAWLESS · 3 IN A ROW!"],
        4: ["FOUR-MIDABLE! 4 FLAWLESS DAYS", "A PERFECT FOUR-SOME!", "FLAWLESS · 4 IN A ROW!"],
        5: ["HIGH FIVE! 5 FLAWLESS DAYS", "FIVE PERFECT DAYS!", "FLAWLESS · 5 IN A ROW!"],
        6: ["SO CLOSE TO A WEEK! 6 FLAWLESS", "SIX FLAWLESS DAYS!", "FLAWLESS · 6 IN A ROW!"],
        7: ["A WHOLE WEEK FLAWLESS!", "FLAWLESS WEEK!", "7 DAYS, ZERO MISSES!"],
        10: ["TEN FLAWLESS DAYS!", "DOUBLE DIGITS FLAWLESS!", "10 IN A ROW, ZERO MISSES!"],
        14: ["TWO FLAWLESS WEEKS!", "14 DAYS, ZERO MISSES!", "A FORTNIGHT OF FLAWLESS!"],
        30: ["A FLAWLESS MONTH!", "30 PERFECT DAYS!", "LEGENDARY · 30 FLAWLESS DAYS!"],
    ]
    private static let sweepMilestones: [Int: [String]] = [
        2: ["SWEPT · 2 DAYS IN A ROW!", "BACK-TO-BACK SWEEPS!", "CLEAN SWEEP, TWICE IN A ROW!"],
        3: ["SWEEP 3-PEAT!", "THREE SWEEPS IN A ROW!", "SWEPT · 3 DAYS RUNNING!"],
        4: ["FOUR SWEEPS RUNNING!", "A SWEEPING FOUR-SOME!", "SWEPT · 4 DAYS IN A ROW!"],
        5: ["HIGH FIVE! 5 SWEEPS IN A ROW", "FIVE CLEAN SWEEPS!", "SWEPT · 5 DAYS IN A ROW!"],
        6: ["SO CLOSE TO A WEEK! 6 SWEEPS", "SIX SWEEPS IN A ROW!", "SWEPT · 6 DAYS IN A ROW!"],
        7: ["A WHOLE WEEK OF SWEEPS!", "SWEEP WEEK!", "7 DAYS, 7 SWEEPS!"],
        10: ["TEN SWEEPS IN A ROW!", "DOUBLE DIGITS OF SWEEPS!", "10 DAYS, 10 SWEEPS!"],
        14: ["TWO WEEKS OF SWEEPS!", "14 SWEEPS IN A ROW!", "A FORTNIGHT OF SWEEPS!"],
        30: ["A SWEEPING MONTH!", "30 SWEEPS IN A ROW!", "LEGENDARY · 30 DAYS OF SWEEPS!"],
    ]
    private static let flawlessGeneric = ["FLAWLESS · {n} IN A ROW!", "{n} FLAWLESS DAYS!", "{n} PERFECT DAYS IN A ROW!"]
    private static let sweepGeneric = ["SWEPT · {n} DAYS IN A ROW!", "{n} SWEEPS IN A ROW!", "{n} CLEAN SWEEPS RUNNING!"]
    private static let flawlessNewBest = ["NEW BEST! {n} FLAWLESS DAYS", "NEW BEST · {n} FLAWLESS IN A ROW!", "A NEW RECORD! {n} FLAWLESS DAYS"]
    private static let sweepNewBest = ["NEW BEST! {n} SWEEPS IN A ROW", "NEW BEST · {n} DAYS OF SWEEPS!", "A NEW RECORD! {n} SWEEPS"]
    private static let flawlessRestart = ["FLAWLESS AGAIN! A FRESH START", "BACK ON TRACK! FLAWLESS TODAY", "A NEW STREAK STARTS NOW!"]
    private static let sweepRestart = ["SWEPT AGAIN! A FRESH START", "BACK ON TRACK! SWEPT TODAY", "A NEW SWEEP STREAK STARTS NOW!"]

    public static let milestones: [Int] = [2, 3, 4, 5, 6, 7, 10, 14, 30]

    private static func pick(_ pool: [String], _ seed: String, _ days: Int) -> String {
        pool[dayHash("\(seed)|\(days)") % pool.count].replacingOccurrences(of: n, with: String(days))
    }

    /// The streak headline for a group that just earned today's flawless / sweep, or nil with no streak news.
    public static func line(kind: Kind, days rawDays: Int, best rawBest: Int = 0, dateKey: String) -> String? {
        let days = max(0, rawDays)
        let flawless = kind == .flawless
        let best = max(0, rawBest)
        if days <= 1 {
            if days == 1 && best >= 3 { return pick(flawless ? flawlessRestart : sweepRestart, dateKey, days) }
            return nil
        }
        if let m = (flawless ? flawlessMilestones : sweepMilestones)[days] { return pick(m, dateKey, days) }
        if best > 0 && days >= best && days >= 3 { return pick(flawless ? flawlessNewBest : sweepNewBest, dateKey, days) }
        return pick(flawless ? flawlessGeneric : sweepGeneric, dateKey, days)
    }
}
