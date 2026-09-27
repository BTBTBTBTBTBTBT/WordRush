package com.wordocious.app.data

import com.wordocious.app.ModeGen
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import kotlin.math.roundToInt

/**
 * New stats from the audit (Stats + Friends redesign D2, founder 2026-09-26) —
 * the Android twin of web lib/signature-stats.ts, all derived from data the
 * profile already reads; no schema change.
 *
 *   Free:  Best day (most wins in one local day), Best week (most wins Mon–Sun),
 *          Comebacks (wins on the very last row), Perfect games.
 *   Pro:   Standing trend — your average "Top X%" per day over the last 30
 *          days, the same badge formula everywhere.
 *
 * `computeSignature` and `computeStandingTrend` are pure (unit-tested against
 * the web fixture, SignatureStatsTest); the two `fetch*` functions read Supabase.
 */
object SignatureStats {
    private val client get() = SupabaseConfig.client

    /** Last-row wins: the mode's maximum guess count for word engines (a "comeback"). */
    val MODE_MAX_GUESSES: Map<String, Int> = mapOf(
        "DUEL" to 6, "QUORDLE" to 9, "OCTORDLE" to 13, "SEQUENCE" to 10,
        "RESCUE" to 6, "PROPERNOUNDLE" to 6, "DUEL_6" to 7, "DUEL_7" to 8,
    )

    data class DayWins(val day: String, val wins: Int)
    data class WeekWins(val weekStart: String, val wins: Int)

    data class Signature(
        val bestDay: DayWins?,
        val bestWeek: WeekWins?,
        val comebacks: Int,
        val perfectGames: Int,
    )

    /** One solo match, folded to what the signature needs. [day] is the LOCAL "YYYY-MM-DD". */
    data class MatchFact(val day: String, val gameMode: String, val won: Boolean, val guessCount: Int)

    /** The Monday ("YYYY-MM-DD") of the week holding [day]. */
    fun localWeekStartOf(day: String): String {
        val d = LocalDate.parse(day)
        return d.minusDays((d.dayOfWeek.value - 1).toLong()).toString()
    }

    /** Pure: fold match rows into the four signature facts (web computeSignature). */
    fun computeSignature(rows: List<MatchFact>): Signature {
        val byDay = HashMap<String, Int>()
        val byWeek = HashMap<String, Int>()
        var comebacks = 0
        var perfect = 0
        for (r in rows) {
            if (!r.won) continue
            byDay[r.day] = (byDay[r.day] ?: 0) + 1
            val w = localWeekStartOf(r.day)
            byWeek[w] = (byWeek[w] ?: 0) + 1
            val max = MODE_MAX_GUESSES[r.gameMode]
            if (max != null && r.guessCount == max) comebacks++
            val meta = ModeGen.byDbKey(r.gameMode)
            if (meta != null && r.guessCount <= meta.guessBase) perfect++
        }
        // Ties go to the later day/week (web: v === best && k > best[0]).
        fun top(m: Map<String, Int>): Pair<String, Int>? {
            var best: Pair<String, Int>? = null
            for ((k, v) in m) {
                val b = best
                if (b == null || v > b.second || (v == b.second && k > b.first)) best = k to v
            }
            return best
        }
        val bd = top(byDay)
        val bw = top(byWeek)
        return Signature(
            bestDay = bd?.let { DayWins(it.first, it.second) },
            bestWeek = bw?.let { WeekWins(it.first, it.second) },
            comebacks = comebacks,
            perfectGames = perfect,
        )
    }

    @Serializable
    private data class SigRow(
        @SerialName("created_at") val createdAt: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("winner_id") val winnerId: String? = null,
        @SerialName("player1_score") val player1Score: Double? = null,
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player2_id") val player2Id: String? = null,
    )

    /** The local "YYYY-MM-DD" of an ISO timestamp (web: new Date(created_at) → local Y-M-D). */
    fun localDayOf(iso: String): String {
        val instant = runCatching { OffsetDateTime.parse(iso).toInstant() }
            .recoverCatching { Instant.parse(if (iso.endsWith("Z")) iso else "${iso}Z") }
            .getOrNull() ?: return iso.take(10)
        return instant.atZone(ZoneId.systemDefault()).toLocalDate().toString()
    }

    /** My solo matches (up to 1000, newest first) → the signature. Null on a failed read. */
    suspend fun fetchSignature(userId: String): Signature? = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("created_at,game_mode,winner_id,player1_score,player1_id,player2_id")) {
                filter {
                    or { eq("player1_id", userId); eq("player2_id", userId) }
                    exact("player2_id", null)
                }
                order("created_at", Order.DESCENDING)
                limit(1000)
            }
            .decodeList<SigRow>()
        computeSignature(rows.map {
            MatchFact(
                day = localDayOf(it.createdAt), gameMode = it.gameMode,
                won = it.winnerId == userId, guessCount = (it.player1Score ?: 0.0).toInt(),
            )
        })
    }.getOrNull()

    // ── Standing trend (Pro) ───────────────────────────────────────────────────

    /** One daily_results row, as both my rows and the field's rows read. */
    @Serializable
    data class DailyRow(
        val day: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("composite_score") val compositeScore: Double? = null,
    )

    data class StandingPoint(val day: String, val topPercent: Int, val modes: Int)

    /** Pure: per-day average of the badge percentile over the dailies I played
     *  (web computeStandingTrend). (day, mode) fields with fewer than two
     *  players are skipped, exactly like the Stats Standing pill. */
    fun computeStandingTrend(mine: List<DailyRow>, field: List<DailyRow>): List<StandingPoint> {
        val scores = HashMap<String, MutableList<Double>>()
        for (f in field) {
            scores.getOrPut("${f.day}|${f.gameMode}") { ArrayList() }.add(f.compositeScore ?: 0.0)
        }
        val perDay = HashMap<String, MutableList<Int>>()
        for (m in mine) {
            val arr = scores["${m.day}|${m.gameMode}"] ?: continue
            if (arr.size < 2) continue
            val my = m.compositeScore ?: 0.0
            val better = arr.count { it > my }
            // Badge formula (Format.topPercentLabel with rank = better + 1): one "Top X%" everywhere.
            val percentile = ((1 - better.toDouble() / arr.size) * 100).roundToInt()
            perDay.getOrPut(m.day) { ArrayList() }.add(maxOf(1, 100 - percentile))
        }
        return perDay.entries
            .map { (day, pcts) -> StandingPoint(day, (pcts.sum().toDouble() / pcts.size).roundToInt(), pcts.size) }
            .sortedBy { it.day }
    }

    /** My solo dailies over the last [days] days + the field for those modes → the trend. */
    suspend fun fetchStandingTrend(userId: String, days: Int = 30): List<StandingPoint> = runCatching {
        val to = LocalDate.now()
        val from = to.minusDays((days - 1).toLong())
        val mine = client.postgrest["daily_results"]
            .select(Columns.raw("day,game_mode,composite_score")) {
                filter { eq("user_id", userId); eq("play_type", "solo"); gte("day", from.toString()); lte("day", to.toString()) }
            }
            .decodeList<DailyRow>()
        if (mine.isEmpty()) return@runCatching emptyList()
        val modes = mine.map { it.gameMode }.distinct()
        val field = client.postgrest["daily_results"]
            .select(Columns.raw("day,game_mode,composite_score")) {
                filter { eq("play_type", "solo"); gte("day", from.toString()); lte("day", to.toString()); isIn("game_mode", modes) }
                limit(20000)
            }
            .decodeList<DailyRow>()
        computeStandingTrend(mine, field)
    }.getOrElse { emptyList() }
}
