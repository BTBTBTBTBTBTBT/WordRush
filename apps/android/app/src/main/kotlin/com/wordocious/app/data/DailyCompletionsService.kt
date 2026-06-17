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
        /** Per-mode daily composite score (daily_results.composite_score). */
        @SerialName("composite_score") val score: Double = 0.0,
    )

    /**
     * Summed totals across today's completions — one helper shared by the
     * banner, celebration modal, and share card so all three always agree.
     */
    data class Totals(
        val completed: Int,
        val won: Int,
        val total: Int,
        val totalGuesses: Int,
        val totalTimeSeconds: Int,
        val totalScore: Int,
    ) {
        val flawless: Boolean get() = completed >= total && won >= total
    }

    /** The 9 daily modes (VS excluded — no daily row). */
    const val TOTAL_DAILY_MODES = 9

    fun totals(byMode: Map<String, Completion>): Totals {
        var won = 0; var guesses = 0; var time = 0; var score = 0.0
        for (c in byMode.values) {
            if (c.completed) won++
            guesses += c.guessCount; time += c.timeSeconds; score += c.score
        }
        return Totals(byMode.size, won, TOTAL_DAILY_MODES, guesses, time, Math.round(score).toInt())
    }

    /** Map of game_mode → completion for today's daily (solo). Empty if not signed in. */
    suspend fun fetchTodayCompletions(): Map<String, Completion> {
        val userId = AuthService.userId ?: return emptyMap()
        return runCatching {
            val map = client.postgrest["daily_results"]
                .select(Columns.raw("game_mode,completed,guess_count,time_seconds,composite_score")) {
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

    /**
     * Optimistic local update the moment a daily finishes (web 'daily-completion'
     * event parity): writes the completion into the day-keyed cache so the home
     * grid shows "completed" instantly when the player returns — HomeScreen
     * seeds from this cache on every (re)composition. Never downgrades a win.
     */
    fun noteCompletion(gameMode: String, completed: Boolean, guessCount: Int, timeSeconds: Int, score: Double = 0.0) {
        val current = readCache().toMutableMap()
        val existing = current[gameMode]
        if (existing != null && existing.completed && !completed) return
        current[gameMode] = Completion(gameMode = gameMode, completed = completed, guessCount = guessCount, timeSeconds = timeSeconds, score = score)
        writeCache(current)
    }

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
