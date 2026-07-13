package com.wordocious.app.data

import kotlin.math.max
import kotlin.math.round

/**
 * Composite-score formula ported 1:1 from apps/web/lib/composite-scoring.ts
 * (MODE_SCORE_CONFIG + computeScoreBreakdown) and apps/ios DailyScoring.swift.
 * MUST stay identical to web/iOS so Android results rank correctly on the
 * shared leaderboard. Drives BOTH the recorded leaderboard score and the
 * post-game ScoreBreakdown card, so they can never drift.
 *
 * FORMULA V2 (guess-first) — days >= [SCORING_CUTOVER_DATE].
 * Rule: "Fewer guesses always wins. Speed breaks ties."
 *   • Guess bonus applies to EVERY mode: (maxGuesses - guessCount) × guessWeight.
 *   • Speed bonus caps at 80% of ONE guessWeight, so no time gap can ever
 *     overcome a single saved guess.
 *   • Hint penalties softened (a hint consumes a row, which now costs a full
 *     guess-step of bonus).
 * V1 is kept verbatim and selected by `dateKey` (the PUZZLE's day, from its
 * daily seed — never wall clock) so pre-cutover leaderboards + breakdown
 * cards recompute exactly what was recorded.
 */
object DailyScoring {
    /** Days (YYYY-MM-DD, local) before this date score with the V1 formula. */
    const val SCORING_CUTOVER_DATE = "2026-07-14"

    data class Config(
        val maxGuesses: Int,
        val guessWeight: Int,
        val timeCap: Int,
        val totalBoards: Int,
        val hintCost: Int? = null,
    )

    /** V2 config (current). guessWeight = V1 × 3; speed max = 0.8 × guessWeight. */
    val config: Map<String, Config> = mapOf(
        "DUEL" to Config(6, 300, 300, 1),
        "QUORDLE" to Config(9, 150, 600, 4),
        "OCTORDLE" to Config(13, 90, 900, 8),
        "SEQUENCE" to Config(10, 180, 480, 4),
        "RESCUE" to Config(6, 240, 480, 4),
        "GAUNTLET" to Config(44, 60, 1800, 21),
        "PROPERNOUNDLE" to Config(6, 300, 300, 1, hintCost = 60),
        "DUEL_6" to Config(7, 270, 360, 1, hintCost = 75),
        "DUEL_7" to Config(8, 240, 420, 1, hintCost = 75),
        // TOURNAMENT shares the DUEL config (single-word, 6 guesses).
        "TOURNAMENT" to Config(6, 300, 300, 1),
    )

    /** V1 config (frozen forever — pre-cutover replays/breakdowns only). */
    val configV1: Map<String, Config> = mapOf(
        "DUEL" to Config(6, 100, 300, 1),
        "QUORDLE" to Config(9, 50, 600, 4),
        "OCTORDLE" to Config(13, 30, 900, 8),
        "SEQUENCE" to Config(10, 60, 480, 4),
        "RESCUE" to Config(6, 80, 480, 4),
        "GAUNTLET" to Config(44, 20, 1800, 21),
        "PROPERNOUNDLE" to Config(6, 100, 300, 1, hintCost = 120),
        "DUEL_6" to Config(7, 90, 360, 1, hintCost = 150),
        "DUEL_7" to Config(8, 80, 420, 1, hintCost = 150),
        "TOURNAMENT" to Config(6, 100, 300, 1),
    )

    /** Fraction of one guess-step the speed bonus can reach (V2). Strictly < 1. */
    private const val SPEED_FRACTION = 0.8

    // Loss-credit tuning — identical to lib/composite-scoring.ts + DailyScoring.swift
    // (and identical in V1/V2 — losses have no guess/time bonus in either).
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
        /** Whether the guess-bonus row applies (V2: all modes; V1: hint modes only). */
        val guessBonusApplies: Boolean,
        /** Max speed bonus (V2: 0.8 × guessWeight; V1: timeCap) — for the UI detail. */
        val speedMax: Double,
        val maxGuesses: Int, val timeCap: Int, val guessWeight: Int, val hintCost: Int,
    )

    fun breakdown(
        gameMode: String, completed: Boolean, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
        // Loss-only progress inputs (optional — fall back to the legacy
        // proportional boards bonus when omitted).
        stagesCompleted: Int? = null,    // GAUNTLET: fully-cleared stage count
        bestCorrectLetters: Int? = null, // single-board: best green-letter count
        dateKey: String? = null,         // puzzle day — pre-cutover days score with V1
    ): Breakdown {
        val v2 = dateKey == null || dateKey >= SCORING_CUTOVER_DATE
        val c = (if (v2) config else configV1)[gameMode]
            ?: return Breakdown(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, false, false, 0.0, 0, 0, 0, 0)
        val hasHints = c.hintCost != null
        val basePoints = if (completed) 1000.0 else 0.0
        // V2: guess bonus applies to EVERY mode. V1: hint modes only.
        val guessBonusApplies = v2 || hasHints
        val guessBonus = if (completed && guessBonusApplies) (max(0, c.maxGuesses - guessCount) * c.guessWeight).toDouble() else 0.0
        // V2: speed bonus = fraction of remaining time × 80% of one guess-step
        // (2-decimal precision). V1: one point per second under the cap.
        val speedMax = if (v2) SPEED_FRACTION * c.guessWeight else c.timeCap.toDouble()
        val timeBonus = when {
            !completed -> 0.0
            v2 -> round((max(0, c.timeCap - timeSeconds).toDouble() / c.timeCap) * speedMax * 100) / 100
            else -> max(0, c.timeCap - timeSeconds).toDouble()
        }
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
            hasHints, guessBonusApplies, speedMax, c.maxGuesses, c.timeCap, c.guessWeight, c.hintCost ?: 0,
        )
    }

    fun compositeScore(
        gameMode: String, completed: Boolean, guessCount: Int, timeSeconds: Int,
        boardsSolved: Int, totalBoards: Int, hintsUsed: Int = 0,
        stagesCompleted: Int? = null, bestCorrectLetters: Int? = null,
        dateKey: String? = null,
    ): Double = breakdown(gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards,
        hintsUsed, stagesCompleted, bestCorrectLetters, dateKey).total
}
