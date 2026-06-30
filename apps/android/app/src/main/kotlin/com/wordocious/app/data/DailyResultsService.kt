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

    /**
     * Record a daily VS result — ports web daily-service recordDailyVsResult:
     * one play_type='vs' row per (user, day, mode) accumulating vs_wins/losses/
     * games, scored by calculateVsCompositeScore (0 until 3 games).
     */
    /** Server-side daily-VS check (iOS hasPlayedDailyVS parity): has this
     *  user already recorded a daily VS today? Backs the freemium lobby lock
     *  so clearing app data / a second device can't mint extra matches. */
    suspend fun hasPlayedDailyVsToday(): Boolean {
        val userId = AuthService.userId ?: return false
        return runCatching {
            client.postgrest["daily_results"]
                .select(io.github.jan.supabase.postgrest.query.Columns.raw("id")) {
                    filter { eq("user_id", userId); eq("day", todayLocalDate()); eq("game_mode", GameMode.DUEL.name); eq("play_type", "vs") }
                    limit(1)
                }
                .decodeList<IdOnlyRow>().isNotEmpty()
        }.getOrDefault(false)
    }

    @Serializable
    private data class IdOnlyRow(val id: String? = null)

    /** Today's daily Classic VS outcome for the home card badge: true=won,
     *  false=lost, null if not played yet. (One shared daily VS per day.) */
    suspend fun dailyVsResult(): Boolean? {
        val userId = AuthService.userId ?: return null
        return runCatching {
            client.postgrest["daily_results"]
                .select(io.github.jan.supabase.postgrest.query.Columns.raw("id, vs_wins, vs_losses, vs_games")) {
                    filter { eq("user_id", userId); eq("day", todayLocalDate()); eq("game_mode", GameMode.DUEL.name); eq("play_type", "vs") }
                    limit(1)
                }
                .decodeSingleOrNull<VsRow>()?.let { it.vsWins > 0 }
        }.getOrNull()
    }

    suspend fun recordDailyVsResult(mode: GameMode, won: Boolean) {
        val userId = AuthService.userId ?: return
        val day = todayLocalDate()
        runCatching {
            val existing = client.postgrest["daily_results"]
                .select(io.github.jan.supabase.postgrest.query.Columns.raw("id, vs_wins, vs_losses, vs_games")) {
                    filter { eq("user_id", userId); eq("day", day); eq("game_mode", mode.name); eq("play_type", "vs") }
                    limit(1)
                }
                .decodeSingleOrNull<VsRow>()
            if (existing != null) {
                val wins = existing.vsWins + if (won) 1 else 0
                val losses = existing.vsLosses + if (won) 0 else 1
                val games = existing.vsGames + 1
                client.postgrest["daily_results"].update({
                    set("vs_wins", wins); set("vs_losses", losses); set("vs_games", games)
                    set("composite_score", vsCompositeScore(wins, losses, games))
                    set("completed", true)
                }) { filter { eq("id", existing.id) } }
            } else {
                val wins = if (won) 1 else 0
                val losses = if (won) 0 else 1
                client.postgrest["daily_results"].insert(
                    VsInsert(
                        userId = userId, day = day, gameMode = mode.name,
                        vsWins = wins, vsLosses = losses, vsGames = 1,
                        compositeScore = vsCompositeScore(wins, losses, 1),
                    )
                )
            }
        }
    }

    /** Web calculateVsCompositeScore — no minimum-games floor (freemium = 1 VS/day). */
    private fun vsCompositeScore(wins: Int, losses: Int, games: Int): Double {
        val winRate = wins.toDouble() / max(1, games)
        return round((wins * 100 + winRate * 50 + games * 5) * 100) / 100
    }

    @Serializable
    private data class VsRow(
        val id: String,
        @SerialName("vs_wins") val vsWins: Int = 0,
        @SerialName("vs_losses") val vsLosses: Int = 0,
        @SerialName("vs_games") val vsGames: Int = 0,
    )

    @Serializable
    private data class VsInsert(
        @SerialName("user_id") val userId: String,
        val day: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("play_type") val playType: String = "vs",
        val completed: Boolean = true,
        @SerialName("vs_wins") val vsWins: Int,
        @SerialName("vs_losses") val vsLosses: Int,
        @SerialName("vs_games") val vsGames: Int,
        @SerialName("composite_score") val compositeScore: Double,
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
        /** The game seed (`daily-YYYY-MM-DD-MODE`). When present, the result is
         *  keyed to the seed's date — a game finished after midnight records on
         *  the day it was DEALT, not on tomorrow. Falls back to today's date. */
        seed: String? = null,
        stagesCompleted: Int? = null,
        bestCorrectLetters: Int? = null,
    ) {
        val userId = AuthService.userId ?: return
        val day = seed?.let { com.wordocious.core.getDailySeedDate(it) } ?: todayLocalDate()
        val gameModeStr = mode.name
        val score = computeCompositeScore(gameModeStr, completed, guessCount, elapsedSeconds, boardsSolved, totalBoards, hintsUsed, stagesCompleted, bestCorrectLetters)
        // Optimistic local update FIRST so the home card flips to completed the
        // instant the game ends (web 'daily-completion' event parity).
        DailyCompletionsService.noteCompletion(gameModeStr, completed, guessCount, elapsedSeconds, score)

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
        stagesCompleted: Int? = null,
        bestCorrectLetters: Int? = null,
    ): Double = DailyScoring.compositeScore(gameMode, completed, guessCount, elapsedSeconds, boardsSolved, totalBoards, hintsUsed, stagesCompleted, bestCorrectLetters)
}
