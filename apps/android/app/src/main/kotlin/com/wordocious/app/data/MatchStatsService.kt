package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Profile-dashboard stats from the `matches` table — ports iOS MatchStatsService
 * (which itself ports apps/web/lib/stats-service.ts). NOTE: for SOLO games the web
 * writes the GUESS COUNT into `matches.player1_score` (recordSoloMatch
 * `score: guesses`), so guess-distribution bucketing on player1_score is correct.
 *
 * Native solo plays write `matches` rows with player1_id = user, player2_id = null,
 * so the solo charts all filter on player1_id; streak/head-to-head also consider
 * player2_id for VS games. Timestamps are parsed in the device LOCAL zone (matches
 * iOS Calendar.current) so the activity calendar and time-of-day buckets line up
 * with the user's wall clock.
 */
object MatchStatsService {
    private val client get() = SupabaseConfig.client
    private val localZone: ZoneId get() = ZoneId.systemDefault()

    // ── Result models ──────────────────────────────────────────────────────────
    data class GuessBucket(val guesses: Int, val count: Int)
    data class DayActivity(val day: String, val played: Int, val won: Int)
    data class SolvePoint(val index: Int, val seconds: Int, val mode: String)
    data class HourBucket(val hour: Int, val played: Int, val won: Int)
    data class TopWord(val word: String, val count: Int, val wins: Int)
    data class ProInsights(
        val fastestTime: Int? = null,
        val fewestGuesses: Int? = null,
        val perfectGames: Int = 0,
        val consistency: Int = 0,
        val consistencySample: Int = 0,
        val recentAvg: Int = 0,
        val overallAvg: Int = 0,
        val improving: Boolean = false,
        val percentChange: Int = 0,
        val currentStreak: Int = 0,
        val bestStreak: Int = 0,
        val avgGuesses: Double = 0.0,
        val firstTryRate: Int = 0,
        val luckyWord: String? = null,
        val nemesisWord: String? = null,
        val nemesisLosses: Int = 0,
        val peakHour: Int? = null,
        val vsWins: Int = 0,
        val vsLosses: Int = 0,
        val vsTotal: Int = 0,
        val vsWinRate: Int = 0,
    ) {
        val hasData: Boolean
            get() = fastestTime != null || fewestGuesses != null || perfectGames > 0 ||
                avgGuesses > 0 || currentStreak > 0 || vsTotal > 0
    }

    // ── Row decoders ───────────────────────────────────────────────────────────
    @Serializable
    private data class ScoreRow(
        @SerialName("player1_score") val player1Score: Int? = null,
        @SerialName("game_mode") val gameMode: String = "",
        @SerialName("winner_id") val winnerId: String? = null,
    )

    @Serializable
    private data class DateRow(
        @SerialName("created_at") val createdAt: String = "",
        @SerialName("winner_id") val winnerId: String? = null,
    )

    @Serializable
    private data class TimeRow(
        @SerialName("player1_time") val player1Time: Double? = null,
        @SerialName("game_mode") val gameMode: String = "",
        @SerialName("created_at") val createdAt: String = "",
    )

    @Serializable
    private data class GuessesRow(
        @SerialName("player1_guesses") val player1Guesses: List<String>? = null,
        @SerialName("winner_id") val winnerId: String? = null,
    )

    @Serializable
    private data class InsightRow(
        @SerialName("player1_time") val player1Time: Double? = null,
        @SerialName("player1_score") val player1Score: Int? = null,
        @SerialName("created_at") val createdAt: String = "",
    )

    @Serializable
    private data class WinnerRow(@SerialName("winner_id") val winnerId: String? = null)

    @Serializable
    private data class WordInsightRow(
        val solutions: List<String>? = null,
        @SerialName("winner_id") val winnerId: String? = null,
        @SerialName("player1_time") val player1Time: Double? = null,
        @SerialName("player1_score") val player1Score: Int? = null,
    )

    /** Local hour-of-day (0–23) for an ISO8601 timestamp, or null if unparseable. */
    private fun localHour(iso: String): Int? = runCatching {
        Instant.parse(if (iso.endsWith("Z") || iso.contains('+')) iso else iso + "Z")
            .atZone(localZone).hour
    }.getOrNull()

    // ── Guess distribution ───────────────────────────────────────────────────────
    /** Guess-distribution buckets 1..6 over the user's solo wins. */
    suspend fun guessDistribution(userId: String, mode: String? = null): List<GuessBucket> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_score,game_mode,winner_id")) {
                filter { eq("player1_id", userId); eq("winner_id", userId); mode?.let { eq("game_mode", it) } }
                limit(2000)
            }
            .decodeList<ScoreRow>()
        val counts = HashMap<Int, Int>()
        rows.forEach { r -> r.player1Score?.takeIf { it > 0 }?.let { val b = minOf(it, 6); counts[b] = (counts[b] ?: 0) + 1 } }
        (1..6).map { GuessBucket(it, counts[it] ?: 0) }
    }.getOrElse { emptyList() }

    // ── Activity ─────────────────────────────────────────────────────────────────
    /** Per-day played/won over the last [days] (most recent first → chronological). */
    suspend fun activity(userId: String, days: Int = 7, mode: String? = null): List<DayActivity> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("created_at,winner_id")) {
                filter { eq("player1_id", userId); mode?.let { eq("game_mode", it) } }
                order("created_at", Order.DESCENDING)
                limit(2000)
            }
            .decodeList<DateRow>()
        val byDay = LinkedHashMap<String, IntArray>()  // day -> [played, won]
        rows.forEach { r ->
            val day = r.createdAt.take(10)
            if (day.length == 10) {
                val e = byDay.getOrPut(day) { intArrayOf(0, 0) }
                e[0]++; if (r.winnerId == userId) e[1]++
            }
        }
        byDay.entries.take(days).map { DayActivity(it.key, it.value[0], it.value[1]) }.sortedBy { it.day }
    }.getOrElse { emptyList() }

    // ── Solve times ──────────────────────────────────────────────────────────────
    /** Recent solo wins' solve times, oldest→newest (solve-time line chart). */
    suspend fun solveTimes(userId: String, mode: String? = null, limit: Int = 30): List<SolvePoint> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_time,game_mode,created_at")) {
                filter { eq("player1_id", userId); eq("winner_id", userId); gt("player1_time", 0); mode?.let { eq("game_mode", it) } }
                order("created_at", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<TimeRow>()
        // Reverse to chronological, then index for the X axis.
        rows.reversed().mapIndexedNotNull { i, r ->
            r.player1Time?.let { SolvePoint(i, it.roundToInt(), r.gameMode) }
        }
    }.getOrElse { emptyList() }

    // ── Time of day ──────────────────────────────────────────────────────────────
    /** Games played + won per local hour (0–23) — time-of-day heatmap. */
    suspend fun timeOfDay(userId: String, mode: String? = null): List<HourBucket> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("created_at,winner_id")) {
                filter { eq("player1_id", userId); mode?.let { eq("game_mode", it) } }
                limit(2000)
            }
            .decodeList<DateRow>()
        val played = HashMap<Int, Int>(); val won = HashMap<Int, Int>()
        rows.forEach { r ->
            val h = localHour(r.createdAt) ?: return@forEach
            played[h] = (played[h] ?: 0) + 1
            if (r.winnerId == userId) won[h] = (won[h] ?: 0) + 1
        }
        (0..23).map { HourBucket(it, played[it] ?: 0, won[it] ?: 0) }
    }.getOrElse { (0..23).map { HourBucket(it, 0, 0) } }

    // ── Top words ────────────────────────────────────────────────────────────────
    /** Top-[limit] most-guessed words (+ win counts). */
    suspend fun topWords(userId: String, mode: String? = null, limit: Int = 5): List<TopWord> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_guesses,winner_id,game_mode")) {
                filter { eq("player1_id", userId); mode?.let { eq("game_mode", it) } }
                order("created_at", Order.DESCENDING)
                limit(1000)
            }
            .decodeList<GuessesRow>()
        val counts = HashMap<String, IntArray>()  // word -> [count, wins]
        rows.forEach { r ->
            val won = r.winnerId == userId
            r.player1Guesses?.forEach { w ->
                val e = counts.getOrPut(w.uppercase()) { intArrayOf(0, 0) }
                e[0]++; if (won) e[1]++
            }
        }
        counts.map { TopWord(it.key, it.value[0], it.value[1]) }.sortedByDescending { it.count }.take(limit)
    }.getOrElse { emptyList() }

    // ── Pro insights (per-mode) ────────────────────────────────────────────────────
    suspend fun proInsights(userId: String, mode: String): ProInsights = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_time,player1_score,created_at")) {
                filter {
                    eq("player1_id", userId); eq("winner_id", userId); eq("game_mode", mode)
                    exact("player2_id", null); gt("player1_time", 0)
                }
                order("created_at", Order.DESCENDING)
                limit(200)
            }
            .decodeList<InsightRow>()
        if (rows.isEmpty()) return@runCatching ProInsights()

        val fastest = rows.mapNotNull { it.player1Time }.minOrNull()?.roundToInt()
        val scored = rows.filter { (it.player1Score ?: 0) > 0 }
        val fewest = scored.minByOrNull { it.player1Score ?: Int.MAX_VALUE }?.player1Score
        val perfect = rows.count { it.player1Score == 1 }

        val times = rows.mapNotNull { it.player1Time }
        val last20 = times.take(20)
        var consistency = 0; var consistencySample = 0
        if (last20.size >= 3) {
            val avg = last20.sum() / last20.size
            val variance = last20.sumOf { (it - avg) * (it - avg) } / last20.size
            val cv = if (avg > 0) sqrt(variance) / avg else 0.0
            consistency = maxOf(0, (100 - cv * 100).roundToInt())
            consistencySample = last20.size
        }
        val last10 = times.take(10)
        var recentAvg = 0; var overallAvg = 0; var improving = false; var percentChange = 0
        if (last10.isNotEmpty()) {
            recentAvg = (last10.sum() / last10.size).roundToInt()
            overallAvg = (times.sum() / times.size).roundToInt()
            improving = recentAvg < overallAvg
            percentChange = if (overallAvg > 0) ((overallAvg - recentAvg).toDouble() / overallAvg * 100).roundToInt() else 0
        }

        val w = wordInsights(userId, mode)
        val st = modeWinStreak(userId, mode)
        val ph = peakHour(userId, mode)
        val vs = headToHead(userId, mode)

        ProInsights(
            fastestTime = fastest, fewestGuesses = fewest, perfectGames = perfect,
            consistency = consistency, consistencySample = consistencySample,
            recentAvg = recentAvg, overallAvg = overallAvg, improving = improving, percentChange = percentChange,
            currentStreak = st.first, bestStreak = st.second,
            avgGuesses = w.avgGuesses, firstTryRate = w.firstTryRate,
            luckyWord = w.luckyWord, nemesisWord = w.nemesisWord, nemesisLosses = w.nemesisLosses,
            peakHour = ph,
            vsWins = vs.wins, vsLosses = vs.losses, vsTotal = vs.total, vsWinRate = vs.winRate,
        )
    }.getOrElse { ProInsights() }

    private data class WordResult(
        val nemesisWord: String?, val nemesisLosses: Int, val luckyWord: String?,
        val avgGuesses: Double, val firstTryRate: Int,
    )

    /** Nemesis (most-lost solution), lucky word (fastest solve), avg guesses, first-try rate. */
    private suspend fun wordInsights(userId: String, mode: String): WordResult = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("solutions,winner_id,player1_time,player1_score")) {
                filter { eq("player1_id", userId); eq("game_mode", mode); filterNot("solutions", FilterOperator.IS, null) }
                order("created_at", Order.DESCENDING)
                limit(500)
            }
            .decodeList<WordInsightRow>()
        val lossMap = HashMap<String, Int>()
        val speedMap = HashMap<String, Double>()  // word -> best (lowest) time
        var totalGuesses = 0; var totalWins = 0; var firstTryWins = 0
        rows.forEach { r ->
            val sols = r.solutions ?: return@forEach
            if (r.winnerId == userId) {
                totalWins++
                if (r.player1Score == 1) firstTryWins++
                totalGuesses += r.player1Score ?: 0
                val t = r.player1Time ?: 0.0
                sols.forEach { word ->
                    val w = word.uppercase()
                    val cur = speedMap[w]
                    if (cur != null) { if (t in 0.001..cur) speedMap[w] = t } else speedMap[w] = t
                }
            } else {
                sols.forEach { lossMap[it.uppercase()] = (lossMap[it.uppercase()] ?: 0) + 1 }
            }
        }
        val nemesis = lossMap.maxByOrNull { it.value }
        val lucky = speedMap.filter { it.value > 0 }.minByOrNull { it.value }
        val avg = if (totalWins > 0) ((totalGuesses.toDouble() / totalWins) * 10).roundToInt() / 10.0 else 0.0
        val ftr = if (totalWins > 0) ((firstTryWins.toDouble() / totalWins) * 100).roundToInt() else 0
        WordResult(nemesis?.key, nemesis?.value ?: 0, lucky?.key, avg, ftr)
    }.getOrElse { WordResult(null, 0, null, 0.0, 0) }

    /** Current + best win streak over the most-recent 200 games. */
    private suspend fun modeWinStreak(userId: String, mode: String): Pair<Int, Int> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("winner_id")) {
                filter { or { eq("player1_id", userId); eq("player2_id", userId) }; eq("game_mode", mode) }
                order("created_at", Order.DESCENDING)
                limit(200)
            }
            .decodeList<WinnerRow>()
        var current = 0; var best = 0; var streak = 0; var foundFirstLoss = false
        rows.forEach { r ->
            if (r.winnerId == userId) {
                streak++; best = maxOf(best, streak)
                if (!foundFirstLoss) current = streak
            } else { foundFirstLoss = true; streak = 0 }
        }
        current to best
    }.getOrElse { 0 to 0 }

    /** Hour (0–23) with the best win-rate among hours with ≥3 games. */
    private suspend fun peakHour(userId: String, mode: String): Int? {
        val buckets = timeOfDay(userId, mode)
        var bestHour: Int? = null; var bestRate = -1.0; var bestCount = 0
        buckets.filter { it.played >= 3 }.forEach { b ->
            val rate = b.won.toDouble() / b.played
            if (rate > bestRate || (rate == bestRate && b.played > bestCount)) {
                bestRate = rate; bestHour = b.hour; bestCount = b.played
            }
        }
        return bestHour
    }

    private data class H2H(val wins: Int, val losses: Int, val total: Int, val winRate: Int)

    /** VS head-to-head record (player2 not null). */
    private suspend fun headToHead(userId: String, mode: String): H2H = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("winner_id")) {
                filter { or { eq("player1_id", userId); eq("player2_id", userId) }; eq("game_mode", mode); filterNot("player2_id", FilterOperator.IS, null) }
                limit(1000)
            }
            .decodeList<WinnerRow>()
        var wins = 0; var losses = 0
        rows.forEach { r -> if (r.winnerId == userId) wins++ else if (r.winnerId != null) losses++ }
        val total = wins + losses
        H2H(wins, losses, total, if (total > 0) ((wins.toDouble() / total) * 100).roundToInt() else 0)
    }.getOrElse { H2H(0, 0, 0, 0) }
}
