package com.wordocious.app.data

import kotlin.math.max
import kotlin.math.round

/**
 * Composite-score formula ported 1:1 from apps/web/lib/daily-service.ts
 * (MODE_SCORE_CONFIG + computeScoreBreakdown) and apps/ios DailyScoring.swift.
 * MUST stay identical to web/iOS so Android results rank correctly on the
 * shared leaderboard. Drives BOTH the recorded leaderboard score and the
 * post-game ScoreBreakdown card, so they can never drift.
 */
object DailyScoring {
    data class Config(
        val maxGuesses: Int,
        val guessWeight: Int,
        val timeCap: Int,
        val totalBoards: Int,
        val hintCost: Int? = null,
    )

    val config: Map<String, Config> = mapOf(
        "DUEL" to Config(6, 100, 300, 1),
        "QUORDLE" to Config(9, 50, 600, 4),
        "OCTORDLE" to Config(13, 30, 900, 8),
        "SEQUENCE" to Config(10, 60, 480, 4),
        "RESCUE" to Config(6, 80, 480, 4),
        "GAUNTLET" to Config(44, 20, 1800, 21),
        "PROPERNOUNDLE" to Config(6, 100, 300, 1, hintCost = 120),
        "DUEL_6" to Config(7, 90, 360, 1, hintCost = 150),
        "DUEL_7" to Config(8, 80, 420, 1, hintCost = 150),
        // TOURNAMENT shares the DUEL config (single-word, 6 guesses).
        "TOURNAMENT" to Config(6, 100, 300, 1),
    )

    data class Breakdown(
        val basePoints: Double, val guessBonus: Double, val timeBonus: Double,
        val completionBonus: Double, val hintPenalty: Double, val total: Double,
        val hasHints: Boolean,
        val maxGuesses: Int, val timeCap: Int, val guessWeight: Int, val hintCost: Int,
    )

    fun breakdown(
        gameMode: String, completed: Boolean, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
    ): Breakdown {
        val c = config[gameMode] ?: return Breakdown(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, false, 0, 0, 0, 0)
        val hasHints = c.hintCost != null
        val basePoints = if (completed) 1000.0 else 0.0
        // Guess bonus applies ONLY to hint-bearing modes (Six/Seven/ProperNoundle).
        val guessBonus = if (completed && hasHints) (max(0, c.maxGuesses - guessCount) * c.guessWeight).toDouble() else 0.0
        // Time bonus = seconds under the cap (NOT divided — full credit per second).
        val timeBonus = if (completed) max(0, c.timeCap - timeSeconds).toDouble() else 0.0
        // Completion bonus ALWAYS applies (single board solved → bs/tb = 1 → +200).
        val completionBonus = (boardsSolved.toDouble() / max(1, totalBoards)) * 200.0
        val hintPenalty = if (hasHints) (hintsUsed * (c.hintCost ?: 0)).toDouble() else 0.0
        val total = round(max(0.0, basePoints + guessBonus + timeBonus + completionBonus - hintPenalty) * 100) / 100
        return Breakdown(
            basePoints, guessBonus, timeBonus, completionBonus, hintPenalty, total,
            hasHints, c.maxGuesses, c.timeCap, c.guessWeight, c.hintCost ?: 0,
        )
    }

    fun compositeScore(
        gameMode: String, completed: Boolean, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
    ): Double = breakdown(gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed).total
}
