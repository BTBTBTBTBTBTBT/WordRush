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

    // Loss-credit tuning — identical to lib/daily-service.ts + DailyScoring.swift.
    // GAUNTLET losses use a stage-depth ladder + per-board tiebreak; single-board
    // losses use a near-miss credit per green letter. Other multi-board losses
    // keep the proportional boards bonus.
    private val GAUNTLET_STAGE_LADDER = intArrayOf(0, 25, 55, 95, 150) // index = stages fully cleared (0–4)
    private val GAUNTLET_STAGE_BOARDS = intArrayOf(1, 4, 4, 4, 8)
    private const val SINGLE_BOARD_GREEN_VALUE = 12

    data class Breakdown(
        val basePoints: Double, val guessBonus: Double, val timeBonus: Double,
        val completionBonus: Double, val hintPenalty: Double, val total: Double,
        val hasHints: Boolean,
        val maxGuesses: Int, val timeCap: Int, val guessWeight: Int, val hintCost: Int,
    )

    fun breakdown(
        gameMode: String, completed: Boolean, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
        // Loss-only progress inputs (optional — fall back to the legacy
        // proportional boards bonus when omitted).
        stagesCompleted: Int? = null,    // GAUNTLET: fully-cleared stage count
        bestCorrectLetters: Int? = null, // single-board: best green-letter count
    ): Breakdown {
        val c = config[gameMode] ?: return Breakdown(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, false, 0, 0, 0, 0)
        val hasHints = c.hintCost != null
        val basePoints = if (completed) 1000.0 else 0.0
        // Guess bonus applies ONLY to hint-bearing modes (Six/Seven/ProperNoundle).
        val guessBonus = if (completed && hasHints) (max(0, c.maxGuesses - guessCount) * c.guessWeight).toDouble() else 0.0
        // Time bonus = seconds under the cap (NOT divided — full credit per second).
        val timeBonus = if (completed) max(0, c.timeCap - timeSeconds).toDouble() else 0.0
        // Completion / progress bonus. Wins (and non-Gauntlet multi-board losses)
        // use the proportional boards bonus; Gauntlet + single-board losses use
        // the progress-aware credit.
        val completionBonus: Double = when {
            completed -> (boardsSolved.toDouble() / max(1, totalBoards)) * 200.0
            gameMode == "GAUNTLET" -> {
                val sc = (stagesCompleted ?: 0).coerceIn(0, GAUNTLET_STAGE_LADDER.size - 1)
                val clearedBoards = GAUNTLET_STAGE_BOARDS.take(sc).sum()
                val failedStageBoards = max(0, boardsSolved - clearedBoards)
                (GAUNTLET_STAGE_LADDER[sc] + 6 * failedStageBoards).toDouble()
            }
            totalBoards == 1 -> (SINGLE_BOARD_GREEN_VALUE * max(0, bestCorrectLetters ?: 0)).toDouble()
            else -> (boardsSolved.toDouble() / max(1, totalBoards)) * 200.0
        }
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
        stagesCompleted: Int? = null, bestCorrectLetters: Int? = null,
    ): Double = breakdown(gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards,
        hintsUsed, stagesCompleted, bestCorrectLetters).total
}
