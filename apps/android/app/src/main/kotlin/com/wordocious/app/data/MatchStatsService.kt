package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Profile-dashboard stats from the `matches` table — ports the core of iOS
 * MatchStatsService. NOTE: for SOLO games the web writes the GUESS COUNT into
 * `matches.player1_score` (stats-service recordSoloMatch `score: guesses`), so
 * the guess-distribution bucketing on player1_score is correct (verified vs web).
 */
object MatchStatsService {
    private val client get() = SupabaseConfig.client

    data class GuessBucket(val guesses: Int, val count: Int)
    data class DayActivity(val day: String, val played: Int, val won: Int)

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

    /** Guess-distribution buckets 1..6 over the user's solo wins. */
    suspend fun guessDistribution(userId: String): List<GuessBucket> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_score,game_mode,winner_id")) {
                filter { eq("player1_id", userId); eq("winner_id", userId) }
                limit(2000)
            }
            .decodeList<ScoreRow>()
        val counts = HashMap<Int, Int>()
        rows.forEach { r -> r.player1Score?.takeIf { it > 0 }?.let { counts[minOf(it, 6)] = (counts[minOf(it, 6)] ?: 0) + 1 } }
        (1..6).map { GuessBucket(it, counts[it] ?: 0) }
    }.getOrElse { emptyList() }

    /** Per-day played/won over the last [days] (most recent first → chronological). */
    suspend fun activity(userId: String, days: Int = 7): List<DayActivity> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("created_at,winner_id")) {
                filter { eq("player1_id", userId) }
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
}
