package com.wordocious.app.data

/**
 * §260: what a human can actually do. Same numbers as the web's
 * lib/plausibility.ts, iOS Plausibility.swift and the daily_results trigger
 * (supabase/manual-migrations/20260911000001_plausibility_guards.sql). A
 * completed puzzle needs at least one guess, and every guess after the first
 * costs at least a second.
 */
object Plausibility {
    const val MIN_SECONDS_PER_EXTRA_GUESS = 1
    const val MAX_TIME_SECONDS = 172_800
    const val MAX_GUESSES = 200
    const val MAX_BOARDS = 21 // Gauntlet: 1 + 4 + 8 + 4 + 4 across its five stages

    fun isPlausibleDailyResult(completed: Boolean, guessCount: Int, timeSeconds: Int, totalBoards: Int): Boolean {
        if (guessCount < 0 || timeSeconds < 0) return false
        if (guessCount >= MAX_GUESSES || timeSeconds >= MAX_TIME_SECONDS || totalBoards > MAX_BOARDS || totalBoards < 1) return false
        if (!completed) return true
        if (guessCount < 1) return false
        return timeSeconds >= (guessCount - 1) * MIN_SECONDS_PER_EXTRA_GUESS
    }
}
