package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import com.wordocious.core.DayStreaks
import com.wordocious.core.DayTally
import com.wordocious.core.dayStreaks
import com.wordocious.core.isDailySeed
import com.wordocious.core.shiftDay
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL

/**
 * Data behind the home banner's row streaks and Unlimited counts, and the Word
 * of the Day quiz (founder-approved home redesign, 2026-10-01). Port of web
 * lib/home-streaks.ts. The rules themselves (what counts as a sweep, how a run
 * is counted) live in the shared core (HomeBanner.kt), so all three platforms
 * count exactly the same way.
 */
object HomeStreaksService {
    private val client get() = SupabaseConfig.client
    private val json = Json { ignoreUnknownKeys = true }
    private const val LOOKBACK_DAYS = 400

    private fun sinceDay(): String = shiftDay(todayLocalDate(), -LOOKBACK_DAYS)

    @Serializable
    private data class DayModeRow(
        val day: String,
        @SerialName("game_mode") val gameMode: String,
        val completed: Boolean = false,
    )

    /**
     * The Puzzles row's sweep and flawless runs: days in a row the player
     * finished (and won) every one of the More Games dailies. `dbKeys` are the
     * visible More Games daily modes; a day needs all of them.
     */
    suspend fun puzzleStreaks(dbKeys: List<String>): DayStreaks {
        val userId = AuthService.userId ?: return DayStreaks(0, 0)
        if (dbKeys.isEmpty()) return DayStreaks(0, 0)
        return runCatching {
            val rows = client.postgrest["daily_results"]
                .select(Columns.raw("day,game_mode,completed")) {
                    filter {
                        eq("user_id", userId); eq("play_type", "solo")
                        isIn("game_mode", dbKeys); gte("day", sinceDay())
                    }
                    limit(LOOKBACK_DAYS.toLong() * dbKeys.size)
                }
                .decodeList<DayModeRow>()
            val played = HashMap<String, MutableSet<String>>()
            val won = HashMap<String, MutableSet<String>>()
            for (r in rows) {
                played.getOrPut(r.day) { mutableSetOf() }.add(r.gameMode)
                if (r.completed) won.getOrPut(r.day) { mutableSetOf() }.add(r.gameMode)
            }
            val days = played.mapValues { (day, set) -> DayTally(set.size, won[day]?.size ?: 0) }
            dayStreaks(days, dbKeys.size, todayLocalDate())
        }.getOrElse { DayStreaks(0, 0) }
    }

    @Serializable
    private data class MatchSeedRow(
        @SerialName("game_mode") val gameMode: String,
        val seed: String? = null,
        @SerialName("player2_id") val player2Id: String? = null,
    )

    /**
     * Unlimited mode's "N PLAYED TODAY": the player's finished non-daily games
     * since local midnight, per game_mode. Daily seeds and VS matches don't
     * count. One small query over today's own matches rows (web parity).
     */
    suspend fun unlimitedCountsToday(): Map<String, Int> {
        val userId = AuthService.userId ?: return emptyMap()
        return runCatching {
            val midnight = java.time.LocalDate.now().atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toString()
            val rows = client.postgrest["matches"]
                .select(Columns.raw("game_mode,seed,player2_id")) {
                    filter { eq("player1_id", userId); gte("created_at", midnight) }
                    limit(500)
                }
                .decodeList<MatchSeedRow>()
            val counts = HashMap<String, Int>()
            for (m in rows) {
                if (m.player2Id != null || m.seed.isNullOrEmpty() || isDailySeed(m.seed)) continue
                counts[m.gameMode] = (counts[m.gameMode] ?: 0) + 1
            }
            counts
        }.getOrElse { emptyMap() }
    }

    // ── Row streak cache (the widget reads these synchronously) ─────────────

    private const val ROW_STREAKS_KEY = "home-row-streaks"

    /** Both rows' current runs, as last computed on Home. */
    @Serializable
    data class RowStreaks(
        val day: String,
        val wordSweep: Int = 0,
        val wordFlawless: Int = 0,
        val puzzlesSweep: Int = 0,
        val puzzlesFlawless: Int = 0,
    )

    /** Trusted only when stamped today or yesterday (a run can't survive a skipped day). */
    fun cachedRowStreaks(): RowStreaks? {
        val raw = SettingsPref.get(ROW_STREAKS_KEY, "")
        if (raw.isEmpty()) return null
        val s = runCatching { json.decodeFromString(RowStreaks.serializer(), raw) }.getOrNull() ?: return null
        val today = todayLocalDate()
        return if (s.day == today || s.day == shiftDay(today, -1)) s else null
    }

    fun cacheRowStreaks(word: DayStreaks, puzzles: DayStreaks) {
        val s = RowStreaks(todayLocalDate(), word.sweep, word.flawless, puzzles.sweep, puzzles.flawless)
        if (s == cachedRowStreaks()) return
        SettingsPref.set(ROW_STREAKS_KEY, json.encodeToString(RowStreaks.serializer(), s))
        runCatching { com.wordocious.app.widget.WidgetBridge.update(DailyCompletionsService.readCache()) }
    }

    // ── Word of the Day quiz ────────────────────────────────────────────────

    /** GET /api/wotd?date=… — the card's word plus the day's three choices (null = no quiz today). */
    @Serializable
    data class WotdInfo(
        val word: String = "",
        val phonetic: String = "",
        val partOfSpeech: String = "",
        val definition: String = "",
        val choices: List<String>? = null,
        val answer: Int? = null,
        val quizPartOfSpeech: String? = null,
    ) {
        /** The quiz, when the server sent a usable one. */
        val hasQuiz: Boolean get() = choices?.size == 3 && answer != null && answer in 0..2
    }

    private fun wotdCacheKey(day: String) = "wotd-api-v2-$day"

    /** Today's entry from the day-keyed cache (no network). */
    fun cachedWotd(day: String): WotdInfo? {
        val raw = SettingsPref.get(wotdCacheKey(day), "")
        if (raw.isEmpty()) return null
        return runCatching { json.decodeFromString(WotdInfo.serializer(), raw) }.getOrNull()?.takeIf { it.word.isNotEmpty() }
    }

    /** Fetch the day's entry from the web API; null on any failure. Cached per day on success. */
    suspend fun fetchWotd(day: String): WotdInfo? = withContext(Dispatchers.IO) {
        runCatching {
            val conn = (URL("https://wordocious.com/api/wotd?date=$day").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"; connectTimeout = 8000; readTimeout = 8000
            }
            val out = if (conn.responseCode in 200..299) {
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                json.decodeFromString(WotdInfo.serializer(), body).takeIf { it.word.isNotEmpty() }
            } else null
            conn.disconnect()
            out?.also { if (it.definition.isNotEmpty()) SettingsPref.set(wotdCacheKey(day), json.encodeToString(WotdInfo.serializer(), it)) }
        }.getOrNull()
    }

    @Serializable
    data class QuizAnswer(val picked: Int, val correct: Boolean)

    data class QuizState(val today: QuizAnswer?, val streak: Int)

    @Serializable
    private data class QuizRow(val day: String, val picked: Int = 0, val correct: Boolean = false)

    @Serializable
    private data class QuizInsert(
        @SerialName("user_id") val userId: String,
        val day: String,
        val word: String,
        val picked: Int,
        val correct: Boolean,
    )

    private fun guestKey(day: String) = "wordocious-wotd-quiz-$day"

    /** Today's saved answer (signed in: the database; guest: this device), plus the word streak. */
    suspend fun quizState(day: String): QuizState {
        val userId = AuthService.userId
        if (userId == null) {
            val raw = SettingsPref.get(guestKey(day), "")
            val v = if (raw.isEmpty()) null else runCatching { json.decodeFromString(QuizAnswer.serializer(), raw) }.getOrNull()
            return QuizState(v, 0)
        }
        val rows = client.postgrest["word_quiz_answers"]
            .select(Columns.raw("day,picked,correct")) {
                filter { eq("user_id", userId); gte("day", sinceDay()) }
                order("day", Order.DESCENDING)
                limit(LOOKBACK_DAYS.toLong())
            }
            .decodeList<QuizRow>()
        var today: QuizAnswer? = null
        val days = HashMap<String, DayTally>()
        for (r in rows) {
            days[r.day] = DayTally(1, if (r.correct) 1 else 0)
            if (r.day == day) today = QuizAnswer(r.picked, r.correct)
        }
        return QuizState(today, dayStreaks(days, 1, day).flawless)
    }

    /** Saves the answer once; a second save for the same day is refused by the primary key (first answer stands). */
    suspend fun saveQuizAnswer(day: String, word: String, answer: QuizAnswer) {
        val userId = AuthService.userId
        if (userId == null) {
            SettingsPref.set(guestKey(day), json.encodeToString(QuizAnswer.serializer(), answer))
            return
        }
        runCatching {
            client.postgrest["word_quiz_answers"].insert(QuizInsert(userId, day, word, answer.picked, answer.correct))
        }.onFailure {
            // 23505 = already answered today on another device: expected, not an error.
            if (it.message?.contains("23505") != true && it.message?.contains("duplicate key") != true) {
                DailyResultsService.reportSwallowedWrite("saveQuizAnswer", "WOTD", it)
            }
        }
    }
}
