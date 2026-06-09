package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
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
    private val prefs by lazy {
        com.wordocious.app.App.instance.getSharedPreferences("wordocious_prefs", android.content.Context.MODE_PRIVATE)
    }
    private const val CACHE_KEY = "daily-completions-cache"
    private const val CACHE_DAY_KEY = "daily-completions-cache-day"

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
            val map = client.postgrest["daily_results"]
                .select(Columns.raw("game_mode,completed,guess_count,time_seconds")) {
                    filter {
                        eq("user_id", userId)
                        eq("day", todayLocalDate())
                        eq("play_type", "solo")
                    }
                }
                .decodeList<Completion>()
                .associateBy { it.gameMode }
            writeCache(map)
            map
        }.getOrElse { readCache() }   // transient failure → keep cached state
    }

    // ── Day-keyed cache (web sessionStorage parity) — seeds the home grid's
    // first render so cold launches don't flash unbadged cards while the
    // network fetch runs.

    fun readCache(): Map<String, Completion> {
        if (prefs.getString(CACHE_DAY_KEY, null) != todayLocalDate()) return emptyMap()
        val json = prefs.getString(CACHE_KEY, null) ?: return emptyMap()
        return runCatching {
            kotlinx.serialization.json.Json.decodeFromString<List<Completion>>(json).associateBy { it.gameMode }
        }.getOrElse { emptyMap() }
    }

    private fun writeCache(map: Map<String, Completion>) {
        runCatching {
            prefs.edit()
                .putString(CACHE_KEY, kotlinx.serialization.json.Json.encodeToString(
                    kotlinx.serialization.builtins.ListSerializer(Completion.serializer()), map.values.toList()))
                .putString(CACHE_DAY_KEY, todayLocalDate())
                .apply()
        }
    }
}
