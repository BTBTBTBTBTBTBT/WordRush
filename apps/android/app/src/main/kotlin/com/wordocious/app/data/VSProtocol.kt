package com.wordocious.app.data

import com.wordocious.core.TileState
import kotlinx.serialization.Serializable

/**
 * Wire models + event names for the VS socket.io protocol — 1:1 with
 * apps/server/src/types.ts (and iOS VSProtocol.swift). socket.io delivers each
 * event payload as a JSON object; these are decoded from it via kotlinx.
 */
object VSEvent {
    // Client → server
    const val JOIN_QUEUE = "join_queue"
    const val LEAVE_QUEUE = "leave_queue"
    const val SUBMIT_GUESS = "submit_guess"
    const val BOARD_SOLVED = "board_solved"
    const val PLAYER_COMPLETED = "player_completed"
    const val STAGE_COMPLETED = "stage_completed"
    const val ABANDON_MATCH = "abandon_match"
    // Rematch: the server starts a rematch once BOTH players emit `offer_rematch`
    // (there is no accept_rematch handler) — so "accept" re-emits offer_rematch.
    const val OFFER_REMATCH = "offer_rematch"
    const val DECLINE_REMATCH = "decline_rematch"
    /** Throttled "I have letters in my row" activity ping — relayed to the opponent. */
    const val TYPING = "typing"

    // Server → client
    const val QUEUE_STATUS = "queue_status"
    const val MATCH_FOUND = "match_found"
    const val MATCH_START = "match_start"
    const val GUESS_RESULT = "guess_result"
    const val OPPONENT_PROGRESS = "opponent_progress"
    const val MATCH_ENDED = "match_ended"
    const val OPPONENT_STAGE_COMPLETED = "opponent_stage_completed"
    const val REMATCH_OFFERED = "rematch_offered"
    const val REMATCH_DECLINED = "rematch_declined"
    const val REMATCH_START = "rematch_start"
    const val OPPONENT_LEFT = "opponent_left"
    const val ERROR = "error"
    /** Opponent activity ping (no letters) — drives the "typing…" indicator. */
    const val OPPONENT_TYPING = "opponent_typing"
}

// ── Server → client payloads ───────────────────────────────────────────────────
@Serializable
data class VSQueueStatus(
    val position: Int = 0,
    val mode: String = "",
    /** Total players currently waiting in this mode's queue (optional on the wire). */
    val queueSize: Int? = null,
)

@Serializable
data class VSMatchFound(
    val matchId: String = "",
    val mode: String = "",
    val serverStartAt: Double = 0.0,    // unix ms
    val countdownSeconds: Double = 3.0,
    /** Opponent's Supabase user id (from presenceId `u:<id>`), or null if anonymous. */
    val opponentUserId: String? = null,
)

@Serializable
data class VSPuzzleMetadata(
    val display: String? = null,
    val category: String? = null,
    val answerLength: Int? = null,
    val themeCategory: String? = null,
)

@Serializable
data class VSMatchStart(
    val seed: String = "",
    val startTime: Double = 0.0,        // unix ms
    val puzzleMetadata: VSPuzzleMetadata? = null,
)

@Serializable
data class VSGuessResult(
    val boardIndex: Int = 0,
    val isValid: Boolean = false,
    val isCorrect: Boolean = false,
    val reason: String? = null,
)

@Serializable
data class VSOpponentLatestGuess(
    val boardIndex: Int = 0,
    val tiles: List<String> = emptyList(),  // "CORRECT" | "PRESENT" | "ABSENT"
)

@Serializable
data class VSOpponentProgress(
    val attempts: Int = 0,
    val solved: Boolean = false,
    val boardsSolved: Int = 0,
    val totalBoards: Int = 0,
    val latestGuess: VSOpponentLatestGuess? = null,
)

/** One opponent guess word (letters only revealed at match end). */
@Serializable
data class VSGuessLogEntry(val boardIndex: Int = 0, val guess: String = "")

@Serializable
data class VSMatchEnded(
    val winner: String? = null,         // "player" | "opponent" | "draw" | null
    val playerGuesses: Int = 0,
    val opponentGuesses: Int = 0,
    val playerTime: Double = 0.0,       // ms
    val opponentTime: Double = 0.0,
    val playerScore: Double = 0.0,
    val opponentScore: Double = 0.0,
    val opponentId: String? = null,     // opponent's Supabase user id (null if anon)
    val recordMatch: Boolean? = null,   // true only for the single designated writer (player1)
    /** Opponent's full ordered guess words (+ board index) — revealed at match end. */
    val opponentGuessLog: List<VSGuessLogEntry>? = null,
    /** The match solutions, so the result screen can render both final boards. */
    val solutions: List<String>? = null,
    /** True when the match ended by the opponent disconnecting/abandoning (forfeit win). */
    val forfeit: Boolean? = null,
)

@Serializable
data class VSRematchStart(
    val matchId: String = "",
    val seed: String = "",
    val puzzleMetadata: VSPuzzleMetadata? = null,
)

@Serializable
data class VSStageEvent(val stageIndex: Int = 0)

@Serializable
data class VSServerError(val message: String = "")

/** Map wire tile strings ("CORRECT"/"PRESENT"/"ABSENT") to engine TileState. */
fun VSOpponentLatestGuess.tileStates(): List<TileState> =
    tiles.map { runCatching { TileState.valueOf(it) }.getOrDefault(TileState.EMPTY) }
