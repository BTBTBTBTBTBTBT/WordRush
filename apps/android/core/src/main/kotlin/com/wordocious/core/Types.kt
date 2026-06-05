package com.wordocious.core

import kotlinx.serialization.Serializable

/**
 * Core engine value types — mirror `apps/ios/Sources/Core/Types.swift`.
 * Enum constant names match the wire/raw values (`CORRECT`, `HINT_USED`, …) so
 * JSON (de)serialization is identity across web/iOS/Android. More of the state
 * model (BoardState, GameState, GauntletProgress, GameMode) is added with the
 * reducer port.
 */
/** Enum constant names == wire/raw values (DUEL_6, MULTI_DUEL, …). */
@Serializable
enum class GameMode { DUEL, MULTI_DUEL, GAUNTLET, QUORDLE, OCTORDLE, SEQUENCE, RESCUE, TOURNAMENT, PROPERNOUNDLE, DUEL_6, DUEL_7 }

@Serializable
enum class TileState { CORRECT, PRESENT, ABSENT, EMPTY, HINT_USED }

@Serializable
data class TileResult(val letter: String, var state: TileState)

@Serializable
data class GuessResult(val tiles: List<TileResult>, val isCorrect: Boolean)

@Serializable
enum class GameStatus { PLAYING, WON, LOST, ABANDONED }

/** Inputs to the VS match-score (`calculateScore`). Times are milliseconds. */
@Serializable
data class MatchResult(
    val playerGuesses: Int,
    val opponentGuesses: Int,
    val playerTime: Double,
    val opponentTime: Double,
    val playerStatus: GameStatus,
    val opponentStatus: GameStatus,
)

/** A pre-revealed row (Deliverance/Rescue) — doesn't consume the guess budget. */
@Serializable
data class PrefilledGuess(val word: String, val evaluation: GuessResult)

/**
 * One board's state. Immutable data class (Kotlin idiom) — the reducer produces
 * new copies via `.copy()`, matching Swift's value-type structs. Each board
 * carries its OWN guess stream (critical for Sequence/Rescue). `hintEvaluations`
 * is keyed by row-index-as-string. Mirrors `Types.swift` `BoardState`.
 */
@Serializable
data class BoardState(
    val solution: String,
    val guesses: List<String> = emptyList(),
    val maxGuesses: Int,
    val status: GameStatus,
    val prefilledGuesses: List<PrefilledGuess>? = null,
    val hintEvaluations: Map<String, GuessResult>? = null,
)

@Serializable
data class GauntletStageConfig(
    val stageIndex: Int,
    val name: String,
    val baseMode: GameMode,
    val boardCount: Int,
    val maxGuesses: Int,
    val sequential: Boolean,
    val hasPrefill: Boolean,
)

@Serializable
data class GauntletStageResult(
    val stageIndex: Int,
    val status: GameStatus,
    val guesses: Int,
    val timeMs: Int,
    val boardsSnapshot: List<BoardState>? = null,
)

@Serializable
data class GauntletProgress(
    val currentStage: Int,
    val totalStages: Int,
    val stages: List<GauntletStageConfig>,
    val stageResults: List<GauntletStageResult> = emptyList(),
    val stageStartTime: Double,
    val stageStartElapsedMs: Double? = null,
    val allSolutions: List<String>,
    val blackoutCount: Int = 0,
)

@Serializable
data class GameState(
    val mode: GameMode,
    val seed: String,
    val startTime: Double,
    val boards: List<BoardState>,
    val currentBoardIndex: Int,
    val status: GameStatus,
    val gauntlet: GauntletProgress? = null,
)

/** Reducer actions — Swift enum-with-associated-values → Kotlin sealed interface. */
sealed interface GameAction {
    data class SubmitGuess(val guess: String, val boardIndex: Int? = null, val applyToAll: Boolean = false) : GameAction
    data class SubmitHint(val hintWord: String, val hintEvaluation: GuessResult, val boardIndex: Int? = null) : GameAction
    data object NextBoard : GameAction
    data class NextStage(val elapsedMs: Double? = null) : GameAction
    data object StealGuess : GameAction
    data class BlackoutRestart(val boardIndex: Int) : GameAction
    data object Abandon : GameAction
    data class Reset(val seed: String, val mode: GameMode) : GameAction
    data class RestoreState(val state: GameState) : GameAction
}

/** The 5 fixed Gauntlet stages — mirrors `Types.swift` `gauntletStages`. */
val gauntletStages: List<GauntletStageConfig> = listOf(
    GauntletStageConfig(0, "The Opening", GameMode.DUEL, 1, 6, sequential = false, hasPrefill = false),
    GauntletStageConfig(1, "QuadWord", GameMode.QUORDLE, 4, 9, sequential = false, hasPrefill = false),
    GauntletStageConfig(2, "Succession", GameMode.SEQUENCE, 4, 10, sequential = true, hasPrefill = false),
    GauntletStageConfig(3, "Deliverance", GameMode.RESCUE, 4, 6, sequential = false, hasPrefill = true),
    GauntletStageConfig(4, "OctoWord", GameMode.OCTORDLE, 8, 13, sequential = false, hasPrefill = false),
)

val gauntletTotalSolutions: Int = gauntletStages.sumOf { it.boardCount }

@Serializable
data class ScoreBreakdown(
    val winBonus: Int,
    val guessDiff: Int,
    val timeDiff: Int,
    val dnfPenalty: Int,
    val total: Int,
)
