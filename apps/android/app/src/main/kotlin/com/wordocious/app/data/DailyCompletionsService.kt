package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.launch
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

    /** Bumped the instant a daily is recorded (noteCompletion) — the Android
     *  analogue of the iOS completionPosted notification. Completed-state screens
     *  (home, leaderboard, profile, records) key their fetches on this so a
     *  finished puzzle shows immediately, without a tab round-trip. */
    private val _completionTick = kotlinx.coroutines.flow.MutableStateFlow(0)
    val completionTick: kotlinx.coroutines.flow.StateFlow<Int> = _completionTick

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

    /** The local day the last fetch served — lets [refreshIfDayChanged] detect a
     *  midnight rollover on a home screen left composed overnight. */
    private var lastServedDay: String? = null

    /** Bump the tick if the local day rolled over since the last fetch, so a home
     *  screen kept composed across midnight refetches the new day's (empty)
     *  completions instead of showing yesterday's. Call from an ON_RESUME hook. */
    fun refreshIfDayChanged() {
        val today = todayLocalDate()
        if (lastServedDay != null && lastServedDay != today) _completionTick.value++
        lastServedDay = today
    }

    /** Map of game_mode → completion for today's daily (solo). Empty if not signed in. */
    suspend fun fetchTodayCompletions(): Map<String, Completion> {
        lastServedDay = todayLocalDate()
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
            // Read-after-write race: a fetch fired the instant a daily finishes
            // (completionTick) may not see the row we just INSERTed — a blind
            // replace would drop the just-finished mode, making a real Flawless
            // show as an N-1/9 Sweep. Keep any optimistic noteCompletion entry
            // (in the day-keyed cache) the server response is still missing.
            val merged = map.toMutableMap()
            for ((k, v) in readCache()) if (k !in merged) merged[k] = v
            writeCache(merged)
            // G6: fire-and-forget AFTER the completions map is ready (never
            // delays the return/publication) — warm the recorded-match row for
            // every daily already played today, so opening one on this device
            // replays instantly instead of flashing an empty board while
            // GameScreen's network fetch runs. Idempotent per seed per session.
            prefetchScope.launch {
                for (modeName in merged.keys) {
                    GameResultsService.prefetchRecordedDailyMatch(com.wordocious.app.todayLocalSeed(modeName))
                }
            }
            merged
        }.getOrElse { readCache() }   // transient failure → keep cached state
    }

    private val prefetchScope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO
    )

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
        _completionTick.value++
    }

    fun readCache(): Map<String, Completion> {
        if (prefs.getString(CACHE_DAY_KEY, null) != todayLocalDate()) return emptyMap()
        val json = prefs.getString(CACHE_KEY, null) ?: return emptyMap()
        return runCatching {
            kotlinx.serialization.json.Json.decodeFromString<List<Completion>>(json).associateBy { it.gameMode }
        }.getOrElse { emptyMap() }
    }

    /** Drop the cached completions — called on sign-out so a guest (or a
     *  different account) never seeds the home grid from the prior user's data. */
    fun clearCache() {
        runCatching { prefs.edit().remove(CACHE_KEY).remove(CACHE_DAY_KEY).apply() }
        // Prefetched replay rows are per-user too — never leak across accounts.
        GameResultsService.clearPrefetchedDailyMatches()
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
