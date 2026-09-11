import Foundation

/// §260: what a human can actually do. Same numbers as the web's
/// lib/plausibility.ts, Android's Plausibility.kt and the daily_results
/// trigger (supabase/manual-migrations/20260911000001_plausibility_guards.sql).
/// A completed puzzle needs at least one guess, and every guess after the
/// first costs at least a second.
public enum Plausibility {
    public static let minSecondsPerExtraGuess = 1
    public static let maxTimeSeconds = 172_800
    public static let maxGuesses = 200
    public static let maxBoards = 21 // Gauntlet: 1 + 4 + 8 + 4 + 4 across its five stages

    public static func isPlausibleDailyResult(completed: Bool, guessCount: Int, timeSeconds: Int, totalBoards: Int) -> Bool {
        if guessCount < 0 || timeSeconds < 0 { return false }
        if guessCount >= maxGuesses || timeSeconds >= maxTimeSeconds || totalBoards > maxBoards || totalBoards < 1 { return false }
        if !completed { return true }
        if guessCount < 1 { return false }
        return timeSeconds >= (guessCount - 1) * minSecondsPerExtraGuess
    }
}
