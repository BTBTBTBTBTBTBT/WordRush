package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import com.wordocious.core.DayRunTotals
import com.wordocious.core.DayStreaks
import com.wordocious.core.DayTally
import com.wordocious.core.dayRunTotals
import com.wordocious.core.dayStreaks
import com.wordocious.core.isDailySeed
import com.wordocious.core.shiftDay
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
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
        if (dbKeys.isEmpty()) return DayStreaks(0, 0)
        val days = puzzleDays(dbKeys) ?: return DayStreaks(0, 0)
        return dayStreaks(days, dbKeys.size, todayLocalDate())
    }

    /** The All-time "Puzzles Sweeps" card: lifetime totals and best runs, plus the current runs. */
    data class PuzzleRecords(val totals: DayRunTotals, val streaks: DayStreaks) {
        val hasData: Boolean get() = totals.sweepDays > 0 || totals.flawlessDays > 0
    }

    /**
     * Founder, 2026-10-01 stats audit: sweep and flawless days for the Puzzles
     * (days every visible Puzzles daily was finished / won), their best runs and
     * the current runs, over the same ~400-day window the banner walks. Null on a
     * failed fetch (the card keeps what it had).
     */
    suspend fun puzzleRecords(dbKeys: List<String>): PuzzleRecords? {
        if (dbKeys.isEmpty()) return PuzzleRecords(DayRunTotals(0, 0, 0, 0), DayStreaks(0, 0))
        val days = puzzleDays(dbKeys) ?: return null
        return PuzzleRecords(dayRunTotals(days, dbKeys.size), dayStreaks(days, dbKeys.size, todayLocalDate()))
    }

    /** Each day's distinct Puzzles finished and won, from the player's solo daily_results. Null = signed out / failed. */
    private suspend fun puzzleDays(dbKeys: List<String>): Map<String, DayTally>? {
        val userId = AuthService.userId ?: return null
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
            played.mapValues { (day, set) -> DayTally(set.size, won[day]?.size ?: 0) }
        }.getOrNull()
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

    // FINISH_SPEC BI17 §3: every answer is ALSO kept on this device, per user ("guest"
    // signed out) per day, so a database outage never re-asks today's quiz or zeroes
    // the streak. Local is written first; the server row follows. Reads merge both
    // (server wins per day) and re-send local-only days in the background.
    private fun historyKey(owner: String) = "wordocious-wotd-quiz-hist-$owner"

    private fun readHistory(owner: String): Map<String, WotdQuizHistory.Entry> {
        val raw = SettingsPref.get(historyKey(owner), "")
        if (raw.isEmpty()) return emptyMap()
        return runCatching { json.decodeFromString(WotdQuizHistory.MAP_SERIALIZER, raw) }.getOrElse { emptyMap() }
    }

    private fun recordLocal(owner: String, day: String, word: String, answer: QuizAnswer) {
        val history = readHistory(owner)
        if (history.containsKey(day)) return // the first answer stands (server parity)
        val next = WotdQuizHistory.prune(history + (day to WotdQuizHistory.Entry(answer.picked, answer.correct, word)), sinceDay())
        SettingsPref.set(historyKey(owner), json.encodeToString(WotdQuizHistory.MAP_SERIALIZER, next))
    }

    /** Local-only days already re-sent this process (one background attempt each per launch). */
    private val resent = java.util.Collections.synchronizedSet(HashSet<String>())

    private suspend fun fetchQuizRows(userId: String): Map<String, QuizAnswer>? = runCatching {
        client.postgrest["word_quiz_answers"]
            .select(Columns.raw("day,picked,correct")) {
                filter { eq("user_id", userId); gte("day", sinceDay()) }
                order("day", Order.DESCENDING)
                limit(LOOKBACK_DAYS.toLong())
            }
            .decodeList<QuizRow>()
            .associate { it.day to QuizAnswer(it.picked, it.correct) }
    }.getOrNull()

    /** Insert-only re-send of answers made while the database was unreachable (duplicates ignored). */
    private fun resendLocalOnly(userId: String, localOnly: Map<String, WotdQuizHistory.Entry>) {
        val todo = localOnly.filterKeys { resent.add("$userId/$it") }
        if (todo.isEmpty()) return
        kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
            for ((day, e) in todo) insertQuizRow(userId, day, e.word, QuizAnswer(e.picked, e.correct))
        }
    }

    private suspend fun insertQuizRow(userId: String, day: String, word: String, answer: QuizAnswer) {
        runCatching {
            client.postgrest["word_quiz_answers"].insert(QuizInsert(userId, day, word, answer.picked, answer.correct))
        }.onFailure {
            // 23505 = already answered that day on another device: expected, not an error.
            if (it.message?.contains("23505") != true && it.message?.contains("duplicate key") != true) {
                DailyResultsService.reportSwallowedWrite("saveQuizAnswer", "WOTD", it)
            }
        }
    }

    /**
     * Today's saved answer plus the word streak. Signed in: the database merged with
     * this device's history (a failed read uses the device history alone). Guest: the
     * day's device key (unchanged), else the guest history.
     */
    suspend fun quizState(day: String): QuizState {
        val userId = AuthService.userId
        if (userId == null) {
            val raw = SettingsPref.get(guestKey(day), "")
            val v = if (raw.isEmpty()) null else runCatching { json.decodeFromString(QuizAnswer.serializer(), raw) }.getOrNull()
            val fromHistory = readHistory("guest")[day]?.let { QuizAnswer(it.picked, it.correct) }
            return QuizState(v ?: fromHistory, 0)
        }
        val merged = WotdQuizHistory.merge(fetchQuizRows(userId), readHistory(userId), day)
        if (merged.serverOk) resendLocalOnly(userId, merged.localOnly)
        return QuizState(merged.today, merged.streak)
    }

    /** The All-time Word of the Day record: current word streak, best run, right answers of all answered. */
    data class QuizRecord(val streak: Int, val best: Int, val right: Int, val answered: Int)

    /**
     * Founder, 2026-10-01 stats audit: the player's word_quiz_answers as a record —
     * the current streak (dayStreaks(days, 1).flawless), the best run
     * (dayRunTotals(days, 1).bestFlawless) and "Right N of M". Local-only days (answered
     * during an outage) fill gaps. Null signed out or on a failed fetch; `answered == 0`
     * hides the card.
     */
    suspend fun quizRecord(): QuizRecord? {
        val userId = AuthService.userId ?: return null
        val server = fetchQuizRows(userId) ?: return null
        val merged = WotdQuizHistory.merge(server, readHistory(userId), todayLocalDate())
        val totals = dayRunTotals(merged.days, 1)
        return QuizRecord(
            streak = merged.streak,
            best = totals.bestFlawless,
            right = totals.flawlessDays,
            answered = totals.sweepDays,
        )
    }

    /**
     * Saves the answer once: this device first (per user / guest, per day), then the
     * server row; a second save for the same day is refused by the primary key (first
     * answer stands). A failed insert is re-sent on a later read.
     */
    suspend fun saveQuizAnswer(day: String, word: String, answer: QuizAnswer) {
        val userId = AuthService.userId
        recordLocal(userId ?: "guest", day, word, answer)
        if (userId == null) {
            SettingsPref.set(guestKey(day), json.encodeToString(QuizAnswer.serializer(), answer))
            return
        }
        insertQuizRow(userId, day, word, answer)
    }
}

/**
 * The pure merge behind the outage-safe WOTD quiz (FINISH_SPEC BI17 §3; unit-tested:
 * WotdQuizHistoryTest). Server rows win per day; local-only days fill the gaps.
 */
object WotdQuizHistory {
    /** One answered day on this device. */
    @Serializable
    data class Entry(val picked: Int, val correct: Boolean, val word: String = "")

    val MAP_SERIALIZER = MapSerializer(String.serializer(), Entry.serializer())

    data class Merged(
        /** Today's answer (null = not answered yet). */
        val today: HomeStreaksService.QuizAnswer?,
        /** Every answered day (answered = 1; right = flawless). */
        val days: Map<String, DayTally>,
        /** Days only this device knows (to re-send); empty when the server read failed. */
        val localOnly: Map<String, Entry>,
        /** False when the server read failed (local history alone). */
        val serverOk: Boolean,
        /** The current word streak as of [todayDay]. */
        val streak: Int,
    )

    /** [server] null = the read failed. */
    fun merge(server: Map<String, HomeStreaksService.QuizAnswer>?, local: Map<String, Entry>, todayDay: String): Merged {
        val answers = HashMap<String, HomeStreaksService.QuizAnswer>()
        local.forEach { (d, e) -> answers[d] = HomeStreaksService.QuizAnswer(e.picked, e.correct) }
        server?.forEach { (d, a) -> answers[d] = a }
        val days = answers.mapValues { (_, a) -> DayTally(1, if (a.correct) 1 else 0) }
        val localOnly = if (server == null) emptyMap() else local.filterKeys { it !in server }
        return Merged(answers[todayDay], days, localOnly, server != null, dayStreaks(days, 1, todayDay).flawless)
    }

    /** Drops days before [sinceDay] (yyyy-MM-dd compares as text). */
    fun prune(history: Map<String, Entry>, sinceDay: String): Map<String, Entry> = history.filterKeys { it >= sinceDay }
}
