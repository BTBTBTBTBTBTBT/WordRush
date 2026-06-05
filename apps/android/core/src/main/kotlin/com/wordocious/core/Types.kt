package com.wordocious.core

import kotlinx.serialization.Serializable

/**
 * Core engine value types — mirror `apps/ios/Sources/Core/Types.swift`.
 * Enum constant names match the wire/raw values (`CORRECT`, `HINT_USED`, …) so
 * JSON (de)serialization is identity across web/iOS/Android. More of the state
 * model (BoardState, GameState, GauntletProgress, GameMode) is added with the
 * reducer port.
 */
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

@Serializable
data class ScoreBreakdown(
    val winBonus: Int,
    val guessDiff: Int,
    val timeDiff: Int,
    val dnfPenalty: Int,
    val total: Int,
)
