import Foundation

/// Per-mode stats registry — port of apps/web/lib/mode-stats.ts (More Games
/// §18). The default profile reproduces the profile tab's eight cells exactly;
/// each custom game adds one profile row when it lands. Pinned by
/// mode-stats-fixtures.json alongside the Kotlin and TS copies.
/// Regenerate: apps/server/node_modules/.bin/tsx apps/web/scripts/gen-mode-stats-fixtures.ts
public struct StatTotals {
    public var wins: Int
    public var losses: Int
    public var totalGames: Int
    /// Best (lowest) guess_count; 0 = none yet.
    public var bestScore: Int
    /// Fastest win in seconds; 0 = none yet.
    public var fastestTime: Int
    public var streak: Int
    public var bestStreak: Int
    public init(wins: Int, losses: Int, totalGames: Int, bestScore: Int, fastestTime: Int, streak: Int, bestStreak: Int) {
        self.wins = wins; self.losses = losses; self.totalGames = totalGames
        self.bestScore = bestScore; self.fastestTime = fastestTime; self.streak = streak; self.bestStreak = bestStreak
    }
}

public struct StatLine: Equatable { public let label: String; public let value: String }

public struct StatPanels: Equatable {
    public let guessDistribution: Bool
    public let solveTime: Bool
    public let topWords: Bool
    public let openerYield: Bool
    public let positionAccuracy: Bool
    public let stageBreakdown: Bool
}

public enum ModeStats {
    /// "-" for none, "45s", "2m", "2m 5s" — the grid's compact time (never "0s").
    public static func statTime(_ seconds: Int) -> String {
        if seconds <= 0 { return "-" }
        if seconds < 60 { return "\(seconds)s" }
        let m = seconds / 60, s = seconds % 60
        return s > 0 ? "\(m)m \(s)s" : "\(m)m"
    }

    public static func winRatePct(wins: Int, totalGames: Int) -> Int {
        totalGames > 0 ? Int((Double(wins) / Double(totalGames) * 100).rounded()) : 0
    }

    private static func defaultLines(_ t: StatTotals, semantics: String, guessBase: Int) -> [StatLine] {
        let best: String = t.bestScore > 0
            ? (semantics == "guesses" ? String(t.bestScore) : formatGuessStat(semantics: semantics, guessBase: guessBase, guessCount: t.bestScore))
            : "-"
        return [
            StatLine(label: "Wins", value: String(t.wins)),
            StatLine(label: "Losses", value: String(t.losses)),
            StatLine(label: "Games", value: String(t.totalGames)),
            StatLine(label: "Win Rate", value: "\(winRatePct(wins: t.wins, totalGames: t.totalGames))%"),
            StatLine(label: "Best", value: best),
            StatLine(label: "Fastest", value: statTime(t.fastestTime)),
            StatLine(label: "Streak", value: String(t.streak)),
            StatLine(label: "Best Streak", value: String(t.bestStreak)),
        ]
    }

    private static let wordPanels = StatPanels(guessDistribution: true, solveTime: true, topWords: true, openerYield: true, positionAccuracy: true, stageBreakdown: false)
    private static let customPanels = StatPanels(guessDistribution: false, solveTime: true, topWords: false, openerYield: false, positionAccuracy: false, stageBreakdown: false)
    private static let gauntletPanels = StatPanels(guessDistribution: false, solveTime: true, topWords: true, openerYield: true, positionAccuracy: true, stageBreakdown: true)

    public static func lines(dbKey: String, totals: StatTotals, semantics: String = "guesses", guessBase: Int = 1) -> [StatLine] {
        defaultLines(totals, semantics: semantics, guessBase: guessBase)
    }

    public static func panels(dbKey: String, semantics: String = "guesses") -> StatPanels {
        if dbKey == "GAUNTLET" { return gauntletPanels }
        return semantics == "guesses" ? wordPanels : customPanels
    }
}
