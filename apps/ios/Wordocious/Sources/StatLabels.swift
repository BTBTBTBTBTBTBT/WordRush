import Foundation

/// The stats glossary (Stats + Friends redesign D2, founder 2026-09-26) — the
/// Swift twin of web `lib/stat-labels.ts`. One word per idea; every surface
/// that shows one of these routes its label through here so the three
/// platforms never drift.
///
///   Win Streak     consecutive WINS (any play type) — profiles.current_streak, user_stats.streak
///   Daily Streak   consecutive days with a daily played — profiles.daily_login_streak
///   Sweep Streak   consecutive days with every sweep daily played — daily_bonuses
///   Clean          a win with no hints
///   Perfect        a win at the mode's perfect count (guessBase)
///   Top X%         percentile of TODAY's field you beat — the leaderboard badge
///                  formula (Format.topPercentLabel); the Stats "Standing" pill
///                  averages it over the dailies you played
enum StatLabels {
    static let winStreak = "Win Streak"
    static let bestWinStreak = "Best Win Streak"
    /// The 8-cell game grid (≤ 12 chars) shows this beside "Win Streak", where "Win" is implied.
    static let bestStreakShort = "Best Streak"
    static let longestWinStreak = "Longest Win Streak"
    static let dailyStreak = "Daily Streak"
    static let bestDailyStreak = "Best Daily Streak"
    static let sweepStreak = "Sweep Streak"
    static let clean = "Clean"
    static let perfect = "Perfect"
    static let standing = "Standing"
}
