package com.wordocious.app.data

import com.wordocious.app.todayUtcDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Fetches the signed-in user's daily completions for today — mirrors the web
 * DailyCompletionsProvider (apps/web/lib/daily-completions-context.tsx). Drives
 * the Home mode-card W/L badges + completed-tint and the daily-sweep banner.
 */
object DailyCompletionsService {
    private val client get() = SupabaseConfig.client

    @Serializable
    data class Completion(
        @SerialName("game_mode") val gameMode: String,
        val completed: Boolean,
        @SerialName("guess_count") val guessCount: Int = 0,
        @SerialName("time_seconds") val timeSeconds: Int = 0,
    )

    /** Map of game_mode → completion for today's daily (solo). Empty if not signed in. */
    suspend fun fetchTodayCompletions(): Map<String, Completion> {
        val userId = AuthService.userId ?: return emptyMap()
        return runCatching {
            client.postgrest["daily_results"]
                .select(Columns.raw("game_mode,completed,guess_count,time_seconds")) {
                    filter {
                        eq("user_id", userId)
                        eq("day", todayUtcDate())
                        eq("play_type", "solo")
                    }
                }
                .decodeList<Completion>()
                .associateBy { it.gameMode }
        }.getOrElse { emptyMap() }
    }
}
