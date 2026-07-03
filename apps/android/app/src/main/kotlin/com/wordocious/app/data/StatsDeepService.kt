package com.wordocious.app.data

import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.ZoneId
import kotlin.math.ln
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Kotlin ports of the restat R1/R4 fetchers in apps/web/lib/stats-service.ts
 * (and iOS StatsDeepService.swift): Opener Lab, Weekday Form, today's daily
 * standing, and the Pro Insights deep layer (opener yield, position accuracy,
 * word almanac, gauntlet stages, hint honesty, skill radar, rivalries). All
 * data derives from stored guess logs (matches.player1/2_guesses + solutions),
 * hints_used and gauntlet_stages — evaluated client-side with the :core
 * engine's evaluateGuess, exactly like the web.
 */
object StatsDeepService {
    private val client get() = SupabaseConfig.client

    /** Length-guarded evaluation — :core evaluateGuess throws on length
     *  mismatch (web safeEval wraps in try/catch for the same reason). */
    fun safeEval(solution: String, guess: String): List<TileState>? {
        val s = solution.uppercase(); val g = guess.uppercase()
        if (s.isEmpty() || s.length != g.length) return null
        return runCatching { evaluateGuess(s, g).tiles.map { it.state } }.getOrNull()
    }

    // ── Shared guess-row loader (web fetchMyGuessRows) ─────────────────────────

    data class GuessRow(
        val guesses: List<String>,
        val solutions: List<String>,
        val won: Boolean,
        val time: Int,
        val createdAt: String,
        val gameMode: String,
        val hintsUsed: Int,
    )

    @Serializable
    private data class MatchRow(
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player1_guesses") val player1Guesses: List<String>? = null,
        @SerialName("player2_guesses") val player2Guesses: List<String>? = null,
        val solutions: List<String>? = null,
        @SerialName("winner_id") val winnerId: String? = null,
        @SerialName("player1_time") val player1Time: Double? = null,
        @SerialName("player2_time") val player2Time: Double? = null,
        @SerialName("created_at") val createdAt: String = "",
        @SerialName("game_mode") val gameMode: String = "",
        @SerialName("hints_used") val hintsUsed: Int? = null,
    )

    /** Rows of (my guesses, solutions, won, time) for a mode — shared loader.
     *  Play-type-scoped (restat B1): solo = player2_id null, vs = not null;
     *  vs_cpu callers early-return (CPU games never write match rows). */
    suspend fun myGuessRows(userId: String, gameMode: String? = null, limit: Int = 400, playType: String = "solo"): List<GuessRow> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_id,player1_guesses,player2_guesses,solutions,winner_id,player1_time,player2_time,created_at,game_mode,hints_used")) {
                filter {
                    or { eq("player1_id", userId); eq("player2_id", userId) }
                    scopeToPlayType(playType)
                    filterNot("solutions", FilterOperator.IS, null)
                    gameMode?.let { eq("game_mode", it) }
                }
                order("created_at", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<MatchRow>()
        rows.mapNotNull { r ->
            val mine = (if (r.player1Id == userId) r.player1Guesses else r.player2Guesses) ?: emptyList()
            val sols = r.solutions ?: emptyList()
            if (mine.isEmpty() || sols.isEmpty()) return@mapNotNull null
            val t = (if (r.player1Id == userId) r.player1Time else r.player2Time) ?: 0.0
            GuessRow(
                guesses = mine, solutions = sols, won = r.winnerId == userId,
                time = t.roundToInt(), createdAt = r.createdAt,
                gameMode = r.gameMode, hintsUsed = r.hintsUsed ?: 0,
            )
        }
    }.getOrElse { emptyList() }

    // ── Opener Lab (basic — web fetchOpenerStats) ──────────────────────────────

    data class OpenerStat(val word: String, val count: Int, val wins: Int, val winRate: Int)

    @Serializable
    private data class OpenerRow(
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player1_guesses") val player1Guesses: List<String>? = null,
        @SerialName("player2_guesses") val player2Guesses: List<String>? = null,
        @SerialName("winner_id") val winnerId: String? = null,
    )

    /** Most-used STARTING words and how often games opened with them were won. */
    suspend fun openerStats(userId: String, limit: Int = 5, playType: String = "solo"): List<OpenerStat> = runCatching {
        if (playType == "vs_cpu") return emptyList()
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_id,player1_guesses,player2_guesses,winner_id")) {
                filter {
                    or { eq("player1_id", userId); eq("player2_id", userId) }
                    scopeToPlayType(playType)
                    filterNot("player1_guesses", FilterOperator.IS, null)
                }
                order("created_at", Order.DESCENDING)
                limit(1000)
            }
            .decodeList<OpenerRow>()
        val map = HashMap<String, IntArray>()  // word -> [count, wins]
        rows.forEach { r ->
            val guesses = (if (r.player1Id == userId) r.player1Guesses else r.player2Guesses) ?: return@forEach
            val opener = guesses.firstOrNull()?.uppercase() ?: return@forEach
            val e = map.getOrPut(opener) { intArrayOf(0, 0) }
            e[0]++; if (r.winnerId == userId) e[1]++
        }
        map.map { (word, s) ->
            OpenerStat(word, s[0], s[1], (s[1].toDouble() / s[0] * 100).roundToInt())
        }.sortedByDescending { it.count }.take(limit)
    }.getOrElse { emptyList() }

    // ── Weekday form (web fetchWeekdayForm) ────────────────────────────────────

    /** dow: 0 = Sunday … 6 = Saturday, LOCAL time. */
    data class WeekdayFormDay(val dow: Int, val played: Int, val won: Int)

    @Serializable
    private data class WeekdayRow(
        @SerialName("winner_id") val winnerId: String? = null,
        @SerialName("created_at") val createdAt: String = "",
    )

    /** Win rate by LOCAL day of week (last 500 games) — "your best day" card. */
    suspend fun weekdayForm(userId: String, playType: String = "solo"): List<WeekdayFormDay> = runCatching {
        if (playType == "vs_cpu") return (0..6).map { WeekdayFormDay(it, 0, 0) }
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_id,winner_id,created_at")) {
                filter { or { eq("player1_id", userId); eq("player2_id", userId) }; scopeToPlayType(playType) }
                order("created_at", Order.DESCENDING)
                limit(500)
            }
            .decodeList<WeekdayRow>()
        val played = IntArray(7); val won = IntArray(7)
        val zone = ZoneId.systemDefault()
        rows.forEach { r ->
            val d = runCatching {
                Instant.parse(if (r.createdAt.endsWith("Z") || r.createdAt.contains('+')) r.createdAt else r.createdAt + "Z")
                    .atZone(zone).dayOfWeek.value % 7   // ISO Mon=1..Sun=7 → Sun=0..Sat=6
            }.getOrNull() ?: return@forEach
            played[d]++; if (r.winnerId == userId) won[d]++
        }
        (0..6).map { WeekdayFormDay(it, played[it], won[it]) }
    }.getOrElse { emptyList() }

    // ── Today's daily standing (web fetchTodayDailyStanding) ───────────────────

    /** topPercent: average top-percentile across today's played dailies (1 = top 1%). */
    data class DailyStanding(val topPercent: Int, val modesCounted: Int)

    @Serializable
    private data class MineRow(
        @SerialName("game_mode") val gameMode: String,
        @SerialName("composite_score") val compositeScore: Double? = null,
    )

    @Serializable
    private data class FieldRow(@SerialName("composite_score") val compositeScore: Double? = null)

    /** Where the user's daily composite scores sit in today's field, averaged
     *  across the modes they've played today. */
    suspend fun todayDailyStanding(userId: String): DailyStanding? = runCatching {
        val day = com.wordocious.app.todayLocalDate()
        val mine = client.postgrest["daily_results"]
            .select(Columns.raw("game_mode,composite_score")) {
                filter { eq("user_id", userId); eq("day", day); eq("play_type", "solo") }
            }
            .decodeList<MineRow>()
        if (mine.isEmpty()) return@runCatching null
        val percentiles = ArrayList<Int>()
        for (row in mine) {
            val myScore = row.compositeScore ?: continue
            val field = client.postgrest["daily_results"]
                .select(Columns.raw("composite_score")) {
                    filter { eq("day", day); eq("game_mode", row.gameMode); eq("play_type", "solo") }
                    limit(2000)
                }
                .decodeList<FieldRow>()
            if (field.size < 2) continue
            val better = field.count { (it.compositeScore ?: 0.0) > myScore }
            percentiles.add(maxOf(1, ((better + 1).toDouble() / field.size * 100).roundToInt()))
        }
        if (percentiles.isEmpty()) return@runCatching null
        DailyStanding(
            topPercent = (percentiles.sum().toDouble() / percentiles.size).roundToInt(),
            modesCounted = percentiles.size,
        )
    }.getOrNull()

    // ── Opener yield (web fetchOpenerDeep) ─────────────────────────────────────

    data class OpenerDeepStat(
        val word: String, val count: Int,
        val avgGreens: Double, val avgYellows: Double, val winRate: Int,
    )

    /** Info yield of each starting word — avg greens/yellows on guess 1.
     *  [preloaded] skips the fetch when the caller already holds the same
     *  myGuessRows(userId, gameMode, 400, playType) slice (ProDeepModeCard). */
    suspend fun openerDeep(userId: String, gameMode: String, limit: Int = 5, playType: String = "solo", preloaded: List<GuessRow>? = null): List<OpenerDeepStat> {
        if (playType == "vs_cpu") return emptyList()
        val rows = preloaded ?: myGuessRows(userId, gameMode, playType = playType)
        val map = HashMap<String, IntArray>()  // word -> [count, greens, yellows, wins]
        for (r in rows) {
            val first = r.guesses.firstOrNull() ?: continue
            val sol = r.solutions.firstOrNull() ?: continue
            val states = safeEval(sol, first) ?: continue
            val opener = first.uppercase()
            val e = map.getOrPut(opener) { intArrayOf(0, 0, 0, 0) }
            e[0]++
            e[1] += states.count { it == TileState.CORRECT }
            e[2] += states.count { it == TileState.PRESENT }
            if (r.won) e[3]++
        }
        return map.map { (word, s) ->
            OpenerDeepStat(
                word = word, count = s[0],
                avgGreens = (s[1].toDouble() / s[0] * 10).roundToInt() / 10.0,
                avgYellows = (s[2].toDouble() / s[0] * 10).roundToInt() / 10.0,
                winRate = (s[3].toDouble() / s[0] * 100).roundToInt(),
            )
        }.sortedByDescending { it.count }.take(limit)
    }

    // ── Position accuracy (web fetchPositionAccuracy) ──────────────────────────

    /** pct: per position, share of ALL guesses that had that slot correct (0–100). */
    data class PositionAccuracy(val wordLength: Int, val pct: List<Int>, val sampleGuesses: Int)

    /** How often each letter slot comes up green across all guesses.
     *  [preloaded] as in [openerDeep] — same myGuessRows slice, no re-fetch. */
    suspend fun positionAccuracy(userId: String, gameMode: String, playType: String = "solo", preloaded: List<GuessRow>? = null): PositionAccuracy? {
        if (playType == "vs_cpu") return null
        val rows = preloaded ?: myGuessRows(userId, gameMode, playType = playType)
        val wordLength = rows.firstOrNull()?.solutions?.firstOrNull()?.length ?: return null
        val correct = IntArray(wordLength)
        var total = 0
        for (r in rows) {
            val sol = r.solutions.firstOrNull() ?: continue
            for (g in r.guesses) {
                val states = safeEval(sol, g) ?: continue
                if (states.size != wordLength) continue
                total++
                states.forEachIndexed { i, s -> if (s == TileState.CORRECT) correct[i]++ }
            }
        }
        if (total < 10) return null
        return PositionAccuracy(
            wordLength = wordLength,
            pct = correct.map { (it.toDouble() / total * 100).roundToInt() },
            sampleGuesses = total,
        )
    }

    // ── Word Almanac (web fetchWordAlmanac) ────────────────────────────────────

    data class AlmanacEntry(val word: String, val won: Boolean, val guesses: Int, val time: Int, val date: String)

    /** Recent solutions faced (first board), with result + pace. */
    suspend fun wordAlmanac(userId: String, gameMode: String, limit: Int = 24, playType: String = "solo"): List<AlmanacEntry> =
        if (playType == "vs_cpu") emptyList()
        else myGuessRows(userId, gameMode, limit, playType).mapNotNull { r ->
            val sol = r.solutions.firstOrNull() ?: return@mapNotNull null
            AlmanacEntry(sol.uppercase(), r.won, r.guesses.size, r.time, r.createdAt)
        }

    // ── Gauntlet stage breakdown (web fetchGauntletStageStats) ─────────────────

    data class GauntletStageStat(
        val stage: Int,          // 0-based
        val name: String?,
        val runs: Int,
        val clears: Int,
        val avgTimeSecs: Int,
    )

    @Serializable
    private data class StageResultRow(
        val name: String? = null,
        val status: String? = null,
        val timeMs: Double? = null,
    )

    @Serializable
    private data class StageCfgRow(val name: String? = null)

    @Serializable
    private data class StagesObj(
        val stageResults: List<StageResultRow>? = null,
        val stages: List<StageCfgRow>? = null,
    )

    @Serializable
    private data class GauntletRow(@SerialName("gauntlet_stages") val gauntletStages: StagesObj? = null)

    /** Gauntlet stage analytics from stored gauntlet_stages.stageResults. */
    suspend fun gauntletStageStats(userId: String, playType: String = "solo"): List<GauntletStageStat> = runCatching {
        if (playType == "vs_cpu") return emptyList()
        val rows = client.postgrest["matches"]
            .select(Columns.raw("gauntlet_stages")) {
                filter {
                    eq("player1_id", userId); eq("game_mode", "GAUNTLET")
                    scopeToPlayType(playType)
                    filterNot("gauntlet_stages", FilterOperator.IS, null)
                }
                order("created_at", Order.DESCENDING)
                limit(200)
            }
            .decodeList<GauntletRow>()

        // stage -> (name, runs, clears, timeMs, timed)
        data class Agg(var name: String?, var runs: Int, var clears: Int, var timeMs: Double, var timed: Int)
        val agg = ArrayList<Agg>()
        for (row in rows) {
            val results = row.gauntletStages?.stageResults ?: continue
            val cfgNames = row.gauntletStages.stages
            results.forEachIndexed { i, sr ->
                while (agg.size <= i) agg.add(Agg(null, 0, 0, 0.0, 0))
                val a = agg[i]
                a.runs++
                if (sr.status?.uppercase() == "WON") a.clears++
                sr.timeMs?.takeIf { it > 0 }?.let { a.timeMs += it; a.timed++ }
                // Android stage results carry no name — fall back to the stage config.
                if (a.name == null) a.name = sr.name ?: cfgNames?.getOrNull(i)?.name
            }
        }
        agg.mapIndexedNotNull { i, a ->
            if (a.runs == 0) return@mapIndexedNotNull null
            GauntletStageStat(
                stage = i, name = a.name, runs = a.runs, clears = a.clears,
                avgTimeSecs = if (a.timed > 0) (a.timeMs / a.timed / 1000).roundToInt() else 0,
            )
        }
    }.getOrElse { emptyList() }

    // ── Hint honesty (web fetchHintHonesty) ────────────────────────────────────

    data class HintHonesty(val hintlessWinRate: Int, val avgHintsPerGame: Double, val gamesCounted: Int)

    /** Hint usage honesty card (Six/Seven/ProperNoundle — hints_used is stored).
     *  [preloaded] as in [openerDeep] — same myGuessRows slice, no re-fetch. */
    suspend fun hintHonesty(userId: String, gameMode: String, playType: String = "solo", preloaded: List<GuessRow>? = null): HintHonesty? {
        if (playType == "vs_cpu") return null
        val rows = preloaded ?: myGuessRows(userId, gameMode, playType = playType)
        if (rows.isEmpty()) return null
        val wins = rows.filter { it.won }
        if (wins.isEmpty()) return null
        val hintlessWins = wins.count { it.hintsUsed == 0 }
        val totalHints = rows.sumOf { it.hintsUsed }
        return HintHonesty(
            hintlessWinRate = (hintlessWins.toDouble() / wins.size * 100).roundToInt(),
            avgHintsPerGame = (totalHints.toDouble() / rows.size * 10).roundToInt() / 10.0,
            gamesCounted = rows.size,
        )
    }

    // ── Skill radar (web fetchSkillRadar) ──────────────────────────────────────

    /** All axes 0–100. */
    data class SkillRadarData(
        val speed: Int, val accuracy: Int, val consistency: Int,
        val endurance: Int, val versatility: Int,
    )

    /** Five 0–100 axes from user_stats (solo) + recent solve times. */
    suspend fun skillRadar(userId: String): SkillRadarData? = runCatching {
        val rows = ProfileService.fetchUserStats(userId).filter { it.playType == "solo" }
        val times = MatchStatsService.solveTimes(userId, mode = null, limit = 20)
        if (rows.isEmpty()) return@runCatching null
        val totalGames = rows.sumOf { it.totalGames }
        if (totalGames < 5) return@runCatching null

        // Accuracy: overall win rate.
        val wins = rows.sumOf { it.wins }
        val accuracy = (wins.toDouble() / maxOf(1, totalGames) * 100).roundToInt()

        // Speed: recent solve times vs a 5-minute yardstick (faster → higher).
        val avgTime = if (times.isEmpty()) 300.0 else times.sumOf { it.seconds }.toDouble() / times.size
        val speed = (100 - avgTime / 300 * 100).coerceIn(0.0, 100.0).roundToInt()

        // Consistency: coefficient of variation of recent times (steadier → higher).
        var consistency = 50
        if (times.size >= 5) {
            val variance = times.sumOf { (it.seconds - avgTime) * (it.seconds - avgTime) } / times.size
            val cv = sqrt(variance) / maxOf(1.0, avgTime)
            consistency = (100 - cv * 100).coerceIn(0.0, 100.0).roundToInt()
        }

        // Endurance: Gauntlet clear rate (the marathon mode).
        val g = rows.firstOrNull { it.gameMode == "GAUNTLET" }
        val endurance = if (g != null && g.totalGames > 0)
            (g.wins.toDouble() / g.totalGames * 100).roundToInt() else 0

        // Versatility: how evenly play spreads across modes (normalized entropy).
        val played = rows.filter { it.totalGames > 0 }
        var versatility = 0
        if (played.size > 1) {
            val h = played.sumOf { r ->
                val p = r.totalGames.toDouble() / totalGames
                -p * ln(p)
            }
            versatility = (h / ln(9.0) * 100).roundToInt()
        }
        SkillRadarData(speed, accuracy, consistency, endurance, versatility)
    }.getOrNull()

    // ── Rivalries (web fetchRivalries) ─────────────────────────────────────────

    data class Rivalry(
        val opponentId: String, val username: String,
        val wins: Int, val losses: Int, val draws: Int, val total: Int,
    )

    @Serializable
    private data class RivalryRow(
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player2_id") val player2Id: String? = null,
        @SerialName("winner_id") val winnerId: String? = null,
    )

    /** Most-faced human opponents with the head-to-head record. */
    suspend fun rivalries(userId: String, limit: Int = 5): List<Rivalry> = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_id,player2_id,winner_id")) {
                filter {
                    or { eq("player1_id", userId); eq("player2_id", userId) }
                    filterNot("player2_id", FilterOperator.IS, null)
                }
                order("created_at", Order.DESCENDING)
                limit(1000)
            }
            .decodeList<RivalryRow>()
        val map = HashMap<String, IntArray>()  // opp -> [wins, losses, draws]
        rows.forEach { m ->
            val opp = if (m.player1Id == userId) (m.player2Id ?: "") else m.player1Id
            if (opp.isEmpty() || opp == userId) return@forEach
            val e = map.getOrPut(opp) { intArrayOf(0, 0, 0) }
            when {
                m.winnerId == userId -> e[0]++
                m.winnerId != null -> e[1]++
                else -> e[2]++
            }
        }
        val top = map.map { (id, r) -> Triple(id, r, r[0] + r[1] + r[2]) }
            .sortedByDescending { it.third }
            .take(limit)
        if (top.isEmpty()) return@runCatching emptyList()
        val names = ProfileService.fetchUsernames(top.map { it.first })
        top.map { (id, r, total) ->
            Rivalry(id, names[id] ?: "Unknown", r[0], r[1], r[2], total)
        }
    }.getOrElse { emptyList() }
}
