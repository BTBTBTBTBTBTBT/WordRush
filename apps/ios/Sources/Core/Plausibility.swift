import Foundation

/// §260: what a human can actually do. Same numbers as the web's
/// lib/plausibility.ts, Android's Plausibility.kt and the daily_results
/// trigger (supabase/manual-migrations/20260911000001_plausibility_guards.sql,
/// mode-aware version 20260922000001_plausibility_mode_floors.sql).
/// A completed puzzle needs at least one guess, and every guess after the
/// first costs at least a second. More Games (§11) adds per-mode floors for a
/// win: the perfect-run guess_count and a minimum solve time.
public enum Plausibility {
    public static let minSecondsPerExtraGuess = 1
    public static let maxTimeSeconds = 172_800
    public static let maxGuesses = 200
    public static let maxBoards = 21 // Gauntlet: 1 + 4 + 8 + 4 + 4 across its five stages

    /// Lowest guess_count a completed result can carry, per mode (the perfect run).
    public static let minWinGuesses: [String: Int] = [
        "DUEL": 1, "DUEL_6": 1, "DUEL_7": 1, "PROPERNOUNDLE": 1,
        "QUORDLE": 4, "OCTORDLE": 8, "SEQUENCE": 4, "RESCUE": 4, "GAUNTLET": 21,
        "SUDOKU": 1, "REGIONS": 1, "LADDER": 1, "CROSSWORD": 1, "CRYPTOGRAM": 1, "HUB": 1,
        "SCRAMBLE": 5, "GROUPS": 4, "WORDSEARCH": 10,
    ]
    /// Fewest seconds a human has ever needed to finish, per mode.
    public static let minWinSeconds: [String: Int] = [
        "SUDOKU": 60, "REGIONS": 15, "LADDER": 8, "SCRAMBLE": 12, "WORDSEARCH": 15,
        "CROSSWORD": 25, "CRYPTOGRAM": 15, "GROUPS": 5, "HUB": 8,
    ]

    public static func isPlausibleDailyResult(completed: Bool, guessCount: Int, timeSeconds: Int, totalBoards: Int, gameMode: String? = nil) -> Bool {
        if guessCount < 0 || timeSeconds < 0 { return false }
        if guessCount >= maxGuesses || timeSeconds >= maxTimeSeconds || totalBoards > maxBoards || totalBoards < 1 { return false }
        if !completed { return true }
        if guessCount < 1 { return false }
        if timeSeconds < (guessCount - 1) * minSecondsPerExtraGuess { return false }
        if let mode = gameMode {
            if let g = minWinGuesses[mode], guessCount < g { return false }
            if let s = minWinSeconds[mode], timeSeconds < s { return false }
        }
        return true
    }
}
