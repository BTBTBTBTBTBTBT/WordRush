package com.wordocious.app.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

object ProfileService {
    private val client get() = SupabaseConfig.client

    @Serializable
    data class UserStat(
        @SerialName("game_mode") val gameMode: String,
        @SerialName("play_type") val playType: String = "solo",
        val wins: Int = 0,
        val losses: Int = 0,
        @SerialName("total_games") val totalGames: Int = 0,
        @SerialName("best_score") val bestScore: Double? = null,
        @SerialName("fastest_time") val fastestTime: Int? = null,
        @SerialName("average_time") val averageTime: Int = 0,
    )

    @Serializable
    data class RecentMatch(
        val id: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player2_id") val player2Id: String? = null,
        @SerialName("winner_id") val winnerId: String? = null,
        @SerialName("player1_score") val player1Score: Double? = null,
        @SerialName("player2_score") val player2Score: Double? = null,
        @SerialName("player1_time") val player1Time: Double? = null,
        @SerialName("player2_time") val player2Time: Double? = null,
        @SerialName("created_at") val createdAt: String,
        val forfeit: Boolean? = null,
    )

    @Serializable
    data class UserMedal(
        val id: String? = null,
        @SerialName("medal_type") val medalType: String,
        val day: String,
        @SerialName("game_mode") val gameMode: String? = null,
    )

    suspend fun fetchUserStats(userId: String): List<UserStat> = runCatching {
        client.postgrest["user_stats"]
            .select { filter { eq("user_id", userId) } }
            .decodeList<UserStat>()
    }.getOrElse { emptyList() }

    suspend fun fetchRecentMatches(userId: String, limit: Int = 5): List<RecentMatch> = runCatching {
        client.postgrest["matches"]
            .select(Columns.raw("id,game_mode,player1_id,player2_id,winner_id,player1_score,player2_score,player1_time,player2_time,created_at,forfeit")) {
                // Web parity: include matches where the user is player1 OR player2 (VS).
                filter { or { eq("player1_id", userId); eq("player2_id", userId) } }
                order("created_at", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<RecentMatch>()
    }.getOrElse { emptyList() }

    @Serializable
    private data class MatchesEnvelope(val matches: List<RecentMatch> = emptyList())

    // ── PRIVATE PROFILES gate plumbing ───────────────────────────────────────

    /** The gate's typed 403 body: {"error":"This profile is private","private":true}. */
    @Serializable
    private data class PrivateGateBody(@SerialName("private") val isPrivateGate: Boolean? = null)

    /** A deep-endpoint fetch that can be refused by the privacy gate. */
    sealed interface Gated<out T> {
        data class Ok<T>(val value: T) : Gated<T>
        /** Typed 403 {private:true} — the caller must show the teaser card. */
        data object PrivateProfile : Gated<Nothing>
        data object Failed : Gated<Nothing>
    }

    private data class ApiResponse(val code: Int, val body: String?)

    // GET one of the four /api/profile/[id] endpoints with the caller's
    // Supabase access token when a session exists. The header is optional
    // (anonymous viewers of public profiles still get data) but MUST be sent
    // whenever signed in — without it the OWNER of a private profile is gated
    // out of their own deep stats. Mirrors web profileApiHeaders() in
    // lib/profile-social.ts.
    private fun profileApiGet(url: String): ApiResponse {
        val conn = (java.net.URL(url).openConnection() as java.net.HttpURLConnection).apply {
            SupabaseConfig.client.auth.currentSessionOrNull()?.accessToken?.let {
                setRequestProperty("Authorization", "Bearer $it")
            }
            connectTimeout = 10_000
            readTimeout = 10_000
        }
        val code = conn.responseCode
        val body = runCatching {
            (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() }
        }.getOrNull()
        return ApiResponse(code, body)
    }

    /** True iff a response is the private-profile 403 (branch on `private`,
     *  never string-match the error; the board route's 403 is {locked:true}). */
    private fun isPrivateGate(resp: ApiResponse): Boolean =
        resp.code == 403 && resp.body?.let {
            runCatching { jsonLoose.decodeFromString<PrivateGateBody>(it).isPrivateGate == true }.getOrDefault(false)
        } == true

    /**
     * Recent matches for ANOTHER player's public profile — fetched from the
     * web API, not a direct `matches` query: that table's SELECT policy is
     * participants-only (guess rows are private by design), so the client
     * read in [fetchRecentMatches] returns zero rows for anyone but the
     * session user and "Recent Matches" was permanently empty on other
     * players' profiles. The endpoint reads server-side and returns only the
     * sanitized columns this screen renders (no guess arrays).
     * Returns [Gated.PrivateProfile] on the privacy gate's typed 403.
     */
    suspend fun fetchPublicRecentMatches(userId: String): Gated<List<RecentMatch>> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val resp = profileApiGet("https://wordocious.com/api/profile/$userId/matches")
                when {
                    isPrivateGate(resp) -> Gated.PrivateProfile
                    resp.code in 200..299 && resp.body != null ->
                        Gated.Ok(jsonLoose.decodeFromString<MatchesEnvelope>(resp.body).matches)
                    else -> Gated.Failed
                }
            }.getOrDefault(Gated.Failed)
        }

    @Serializable
    private data class TopWordsEnvelope(val topWords: List<MatchStatsService.TopWord> = emptyList())

    /** Top words for another player — same web-endpoint story as above.
     *  (The screen never calls this for a gated profile; a privacy 403 here
     *  just renders as no top-words card.) */
    suspend fun fetchPublicTopWords(userId: String, mode: String, playType: String): List<MatchStatsService.TopWord> =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val play = if (playType == "vs") "vs" else "solo"
                val resp = profileApiGet("https://wordocious.com/api/profile/$userId/top-words?mode=$mode&play=$play")
                if (resp.code in 200..299 && resp.body != null) {
                    jsonLoose.decodeFromString<TopWordsEnvelope>(resp.body).topWords
                } else {
                    emptyList()
                }
            }.getOrDefault(emptyList())
        }

    @Serializable
    private data class NameRow(val id: String, val username: String? = null)

    /** Batch-resolve usernames (e.g. VS opponents in Recent Matches). */
    suspend fun fetchUsernames(ids: List<String>): Map<String, String> = runCatching {
        if (ids.isEmpty()) return emptyMap()
        client.postgrest["profiles"]
            .select(Columns.raw("id, username")) { filter { isIn("id", ids) } }
            .decodeList<NameRow>()
            .mapNotNull { row -> row.username?.let { row.id to it } }
            .toMap()
    }.getOrElse { emptyMap() }

    /** §226 trophy epoch: trophies count from the App Store launch (iOS 1.1,
     *  2026-07-29). Pre-epoch medal rows are retained but never shown.
     *  Mirrors web TROPHY_EPOCH_DATE + the all-time sweep RPCs — lockstep. */
    private const val TROPHY_EPOCH_DATE = "2026-07-29"

    suspend fun fetchUserMedals(userId: String, limit: Int = 10): List<UserMedal> = runCatching {
        client.postgrest["medals"]
            .select {
                filter { eq("user_id", userId); gte("day", TROPHY_EPOCH_DATE) }
                order("day", Order.DESCENDING); limit(limit.toLong())
            }
            .decodeList<UserMedal>()
    }.getOrElse { emptyList() }

    // ═════════════════════════════════════════════════════════════════════════
    // Profile-social layer — persona endpoint, guarded board viewer, H2H from
    // daily_results, podium + calendar. Every fetcher swallows failures into an
    // empty/null fallback: the profile screen must render its existing content
    // even if every one of these calls dies.
    // ═════════════════════════════════════════════════════════════════════════

    private val jsonLoose = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    // ── Persona (server aggregate; contract fixed by web /api/profile/[id]/persona)
    @Serializable
    data class PersonaOpener(val word: String = "", val count: Int = 0, val winRate: Int = 0)

    @Serializable
    data class PersonaPercentile(val mode: String = "", val topPct: Int = 0)

    @Serializable
    data class PersonaNemesis(val userId: String = "", val username: String = "", val sharedBoards: Int = 0)

    @Serializable
    data class PersonaFlawless(val count: Int = 0, val pctOfPlayers: Int = 0)

    @Serializable
    data class Persona(
        val archetype: String = "CHALLENGER",
        val opener: PersonaOpener? = null,
        val longestWinStreak: Int = 0,
        val bestPercentile: PersonaPercentile? = null,
        val nemesis: PersonaNemesis? = null,
        val flawless: PersonaFlawless? = null,
    )

    /** Server-side persona aggregates (archetype/opener/streak/percentile/nemesis/flawless).
     *  Bearer header per the private-profiles contract: the endpoint 403s for
     *  a private target unless the caller proves they're the owner/an admin. */
    suspend fun fetchPersona(userId: String): Persona? =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val resp = profileApiGet("https://wordocious.com/api/profile/$userId/persona")
                if (resp.code in 200..299 && resp.body != null) {
                    jsonLoose.decodeFromString<Persona>(resp.body)
                } else {
                    null
                }
            }.getOrNull()
        }

    // ── Spoiler-guarded board viewer ─────────────────────────────────────────
    @Serializable
    data class BoardDetail(
        val seed: String = "",
        val gameMode: String = "",
        val guesses: List<String> = emptyList(),
        val solutions: List<String> = emptyList(),
        val timeSeconds: Int = 0,
        val won: Boolean = false,
        val hintsUsed: Int = 0,
    )

    sealed interface BoardFetch {
        data class Ready(val board: BoardDetail) : BoardFetch
        data object Locked : BoardFetch
        data object Unavailable : BoardFetch
    }

    /**
     * Another player's solved daily board — 403 (Locked) until the REQUESTER has
     * finished that same daily; the guard is server-side (guess arrays are what
     * the matches participants-only policy protects).
     */
    suspend fun fetchGuardedBoard(targetId: String, seed: String): BoardFetch =
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                // Token exactly as MedalService.awardDailyBonusesIfComplete passes it.
                val access = SupabaseConfig.client.auth.currentSessionOrNull()?.accessToken
                    ?: return@withContext BoardFetch.Locked
                val conn = (
                    java.net.URL("https://wordocious.com/api/profile/$targetId/board?seed=$seed")
                        .openConnection() as java.net.HttpURLConnection
                    ).apply {
                    setRequestProperty("Authorization", "Bearer $access")
                    connectTimeout = 10_000
                    readTimeout = 10_000
                }
                when (conn.responseCode) {
                    in 200..299 -> {
                        val body = conn.inputStream.bufferedReader().use { it.readText() }
                        BoardFetch.Ready(jsonLoose.decodeFromString<BoardDetail>(body))
                    }
                    401, 403 -> BoardFetch.Locked
                    else -> BoardFetch.Unavailable
                }
            }.getOrDefault(BoardFetch.Unavailable)
        }

    // ── daily_results reads (readable for any user — leaderboards already do) ─
    @Serializable
    data class DailyRowLite(
        val day: String,
        @SerialName("game_mode") val gameMode: String,
        val completed: Boolean = false,
        @SerialName("guess_count") val guessCount: Int? = null,
        @SerialName("time_seconds") val timeSeconds: Int? = null,
        @SerialName("boards_solved") val boardsSolved: Int? = null,
        @SerialName("total_boards") val totalBoards: Int? = null,
        @SerialName("composite_score") val compositeScore: Double? = null,
    )

    /** A player's solo daily rows, newest day first (H2H / ring / calendar / highlights). */
    suspend fun fetchSoloDailyRows(userId: String, limit: Long = 800): List<DailyRowLite> = runCatching {
        client.postgrest["daily_results"]
            .select(Columns.raw("day,game_mode,completed,guess_count,time_seconds,boards_solved,total_boards,composite_score")) {
                filter { eq("user_id", userId); eq("play_type", "solo") }
                order("day", Order.DESCENDING)
                limit(limit)
            }
            .decodeList<DailyRowLite>()
    }.getOrElse { emptyList() }

    // ── Head-to-head over shared dailies (join on day + game_mode) ───────────
    data class SharedDaily(
        val day: String,
        val gameMode: String,
        val viewerScore: Double,
        val targetScore: Double,
    ) {
        /** 1 = viewer took it, 2 = target, 0 = tie. Winner = higher composite. */
        val winner: Int get() = when {
            viewerScore > targetScore -> 1
            targetScore > viewerScore -> 2
            else -> 0
        }
    }

    data class H2HSummary(
        val viewerWins: Int,
        val targetWins: Int,
        val ties: Int,
        val shared: List<SharedDaily>,
        val viewerAvgGuess: Double?,
        val targetAvgGuess: Double?,
        val viewerAvgTime: Int?,
        val targetAvgTime: Int?,
        val viewerSweeps: Int,
        val targetSweeps: Int,
    )

    private fun sweepDays(rows: List<DailyRowLite>): Int =
        rows.filter { it.completed }.groupBy { it.day }
            .count { (_, dayRows) -> dayRows.map { it.gameMode }.distinct().size >= 9 }

    /** Pure join of two players' daily rows — no I/O, safe with empty inputs. */
    fun computeH2H(viewerRows: List<DailyRowLite>, targetRows: List<DailyRowLite>): H2HSummary {
        val targetByKey = targetRows.filter { it.completed }.associateBy { "${it.day}|${it.gameMode}" }
        val viewerDone = viewerRows.filter { it.completed }
        val shared = viewerDone.mapNotNull { v ->
            targetByKey["${v.day}|${v.gameMode}"]?.let { t ->
                SharedDaily(v.day, v.gameMode, v.compositeScore ?: 0.0, t.compositeScore ?: 0.0)
            }
        }.sortedByDescending { it.day }

        val sharedKeys = shared.map { "${it.day}|${it.gameMode}" }.toSet()
        fun side(rows: List<DailyRowLite>): Pair<Double?, Int?> {
            val mine = rows.filter { it.completed && "${it.day}|${it.gameMode}" in sharedKeys }
            val guesses = mine.mapNotNull { it.guessCount }.filter { it > 0 }
            val times = mine.mapNotNull { it.timeSeconds }.filter { it > 0 }
            return (guesses.takeIf { it.isNotEmpty() }?.average()) to
                (times.takeIf { it.isNotEmpty() }?.average()?.toInt())
        }
        val (vAvgG, vAvgT) = side(viewerRows)
        val (tAvgG, tAvgT) = side(targetRows)
        return H2HSummary(
            viewerWins = shared.count { it.winner == 1 },
            targetWins = shared.count { it.winner == 2 },
            ties = shared.count { it.winner == 0 },
            shared = shared,
            viewerAvgGuess = vAvgG, targetAvgGuess = tAvgG,
            viewerAvgTime = vAvgT, targetAvgTime = tAvgT,
            viewerSweeps = sweepDays(viewerRows), targetSweeps = sweepDays(targetRows),
        )
    }

    // ── Podium for one day + mode (medal-history drill-down) ─────────────────
    @Serializable
    private data class PodiumRow(
        @SerialName("user_id") val userId: String,
        @SerialName("composite_score") val compositeScore: Double? = null,
    )

    data class PodiumEntry(val userId: String, val username: String, val score: Double)

    /** Top-3 completed solo scores for (day, mode), usernames resolved. */
    suspend fun fetchPodium(day: String, gameMode: String): List<PodiumEntry> = runCatching {
        val rows = client.postgrest["daily_results"]
            .select(Columns.raw("user_id,composite_score")) {
                filter {
                    eq("day", day); eq("game_mode", gameMode)
                    eq("play_type", "solo"); eq("completed", true)
                }
                order("composite_score", Order.DESCENDING)
                limit(3)
            }
            .decodeList<PodiumRow>()
        val names = fetchUsernames(rows.map { it.userId })
        rows.map { PodiumEntry(it.userId, names[it.userId] ?: "Player", it.compositeScore ?: 0.0) }
    }.getOrElse { emptyList() }
}
