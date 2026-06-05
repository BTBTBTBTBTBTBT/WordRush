package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import com.wordocious.core.GameMode
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.round

/**
 * Records and fetches daily results in the Supabase `daily_results` table.
 * Mirrors apps/ios/Sources/DailyResultsService.swift and
 * apps/web/lib/daily-service.ts (recordDailyResult, computeScoreBreakdown).
 *
 * Composite-score formula — identical to the web:
 *   base = 1000 (win) | 0 (DNF)
 *   + time bonus: floor(max(0, timeCap - elapsedSecs) / 5) (win only)
 *   + completion bonus: (boardsSolved/totalBoards) * 200 (multi-board)
 *   − hint penalty: hintsUsed * hintCost
 */
object DailyResultsService {

    private val client get() = SupabaseConfig.client

    @Serializable
    data class DailyResult(
        val id: String? = null,
        @SerialName("user_id") val userId: String,
        val day: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("play_type") val playType: String = "solo",
        val completed: Boolean,
        @SerialName("guess_count") val guessCount: Int,
        @SerialName("time_seconds") val timeSeconds: Int,
        @SerialName("boards_solved") val boardsSolved: Int,
        @SerialName("total_boards") val totalBoards: Int,
        @SerialName("composite_score") val compositeScore: Double,
        @SerialName("hints_used") val hintsUsed: Int = 0,
    )

    @Serializable
    private data class ExistingRow(
        val id: String,
        @SerialName("composite_score") val compositeScore: Double,
    )

    /** Record a completed solo daily result. Skips if not authenticated. */
    suspend fun recordDailyResult(
        mode: GameMode,
        completed: Boolean,
        guessCount: Int,
        elapsedSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        hintsUsed: Int = 0,
    ) {
        val userId = AuthService.userId ?: return
        val day = todayLocalDate()
        val gameModeStr = mode.name
        val score = computeCompositeScore(gameModeStr, completed, guessCount, elapsedSeconds, boardsSolved, totalBoards, hintsUsed)

        try {
            // Check if a row already exists for today
            val existing = client.postgrest["daily_results"]
                .select { filter { eq("user_id", userId); eq("day", day); eq("game_mode", gameModeStr); eq("play_type", "solo") }; limit(1) }
                .decodeSingleOrNull<ExistingRow>()

            if (existing != null) {
                // Only update if new score is better (web behavior: best score wins)
                if (score <= existing.compositeScore) return
                client.postgrest["daily_results"].update({
                    set("completed", completed)
                    set("guess_count", guessCount)
                    set("time_seconds", elapsedSeconds)
                    set("boards_solved", boardsSolved)
                    set("total_boards", totalBoards)
                    set("composite_score", score)
                    set("hints_used", hintsUsed)
                }) { filter { eq("id", existing.id) } }
            } else {
                client.postgrest["daily_results"].insert(
                    DailyResult(
                        userId = userId, day = day, gameMode = gameModeStr,
                        completed = completed, guessCount = guessCount,
                        timeSeconds = elapsedSeconds, boardsSolved = boardsSolved,
                        totalBoards = totalBoards, compositeScore = score, hintsUsed = hintsUsed,
                    )
                )
            }
            AuthService.refreshProfile()
        } catch (_: Exception) {
            // Network/auth failure — silent (game result still local)
        }
    }

    /**
     * Composite score — delegates to [DailyScoring], the single source of truth
     * shared with the post-game ScoreBreakdown card (1:1 with web/iOS).
     */
    fun computeCompositeScore(
        gameMode: String,
        completed: Boolean,
        guessCount: Int,
        elapsedSeconds: Int,
        boardsSolved: Int,
        totalBoards: Int,
        hintsUsed: Int,
    ): Double = DailyScoring.compositeScore(gameMode, completed, guessCount, elapsedSeconds, boardsSolved, totalBoards, hintsUsed)
}
