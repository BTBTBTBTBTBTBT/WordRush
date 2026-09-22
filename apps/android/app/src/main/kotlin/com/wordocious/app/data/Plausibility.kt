package com.wordocious.app.data

/**
 * §260: what a human can actually do. Same numbers as the web's
 * lib/plausibility.ts, iOS Plausibility.swift and the daily_results trigger
 * (supabase/manual-migrations/20260911000001_plausibility_guards.sql, mode-aware
 * version 20260922000001_plausibility_mode_floors.sql). A completed puzzle needs
 * at least one guess, and every guess after the first costs at least a second.
 * More Games (§11) adds per-mode floors for a win: the perfect-run guess_count
 * and a minimum solve time.
 */
object Plausibility {
    const val MIN_SECONDS_PER_EXTRA_GUESS = 1
    const val MAX_TIME_SECONDS = 172_800
    const val MAX_GUESSES = 200
    const val MAX_BOARDS = 21 // Gauntlet: 1 + 4 + 8 + 4 + 4 across its five stages

    /** Lowest guess_count a completed result can carry, per mode (the perfect run). */
    val MIN_WIN_GUESSES: Map<String, Int> = mapOf(
        "DUEL" to 1, "DUEL_6" to 1, "DUEL_7" to 1, "PROPERNOUNDLE" to 1,
        "QUORDLE" to 4, "OCTORDLE" to 8, "SEQUENCE" to 4, "RESCUE" to 4, "GAUNTLET" to 21,
        "SUDOKU" to 1, "REGIONS" to 1, "LADDER" to 1, "CROSSWORD" to 1, "CRYPTOGRAM" to 1, "HUB" to 1,
        "SCRAMBLE" to 5, "GROUPS" to 4, "WORDSEARCH" to 10,
    )
    /** Fewest seconds a human has ever needed to finish, per mode. */
    val MIN_WIN_SECONDS: Map<String, Int> = mapOf(
        "SUDOKU" to 60, "REGIONS" to 15, "LADDER" to 8, "SCRAMBLE" to 12, "WORDSEARCH" to 15,
        "CROSSWORD" to 25, "CRYPTOGRAM" to 15, "GROUPS" to 5, "HUB" to 8,
    )

    fun isPlausibleDailyResult(completed: Boolean, guessCount: Int, timeSeconds: Int, totalBoards: Int, gameMode: String? = null): Boolean {
        if (guessCount < 0 || timeSeconds < 0) return false
        if (guessCount >= MAX_GUESSES || timeSeconds >= MAX_TIME_SECONDS || totalBoards > MAX_BOARDS || totalBoards < 1) return false
        if (!completed) return true
        if (guessCount < 1) return false
        if (timeSeconds < (guessCount - 1) * MIN_SECONDS_PER_EXTRA_GUESS) return false
        if (gameMode != null) {
            MIN_WIN_GUESSES[gameMode]?.let { if (guessCount < it) return false }
            MIN_WIN_SECONDS[gameMode]?.let { if (timeSeconds < it) return false }
        }
        return true
    }
}
