package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import com.wordocious.app.yesterdayLocalDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Count
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Daily leaderboard + all-time records, mirroring iOS LeaderboardService.swift
 * and web lib/daily-service.ts getDailyLeaderboard() exactly:
 *   - day = device-LOCAL date (NOT UTC) so it matches the puzzle + web/iOS
 *   - NO `completed` filter — losers (DNF) appear too, ranked below winners
 *   - order by composite_score DESC, then created_at ASC (stable tiebreak)
 *   - embeds profiles!inner(username, avatar_url)
 */
object LeaderboardService {
    private val client get() = SupabaseConfig.client

    /** Like [runCatching].getOrElse, but lets cancellation propagate so a
     *  cancelled LaunchedEffect (mode switch) can't resume with a bogus
     *  fallback value and overwrite the new mode's state. */
    private inline fun <T> Result<T>.getOrElseNotCancelled(fallback: (Throwable) -> T): T =
        getOrElse { if (it is CancellationException) throw it else fallback(it) }

    /** User's rank + total for the rank banner (web getUserDailyRank parity). */
    data class RankInfo(val rank: Int, val totalPlayers: Int)

    /** Session-lived stale-while-revalidate cache, keyed "mode:day:userId".
     *  A mode-chip tap or a screen re-entry paints the last-known rows
     *  instantly (no skeleton) while a fresh fetch swaps in silently. */
    data class CachedBoard(
        val entries: List<LeaderboardEntry>,
        val playerCount: Int,
        val rank: RankInfo?,
        /** "Your neighborhood" rows when the user ranks past the top-50 list
         *  (web lbCache.win parity). Defaulted so existing call sites compile. */
        val rankWindow: RankWindow? = null,
    )

    data class RankWindow(val startRank: Int, val entries: List<LeaderboardEntry>)
    private val boardCache = mutableMapOf<String, CachedBoard>()
    fun cacheKey(gameMode: String, day: String, userId: String?, playType: String = "solo") =
        "$gameMode:$day:$playType:${userId ?: "anon"}"
    fun cachedBoard(key: String): CachedBoard? = boardCache[key]
    fun cacheBoard(key: String, board: CachedBoard) { boardCache[key] = board }

    @Serializable
    data class ProfileRef(
        val username: String? = null,
        @SerialName("avatar_url") val avatarUrl: String? = null,
    )

    @Serializable
    data class LeaderboardEntry(
        @SerialName("user_id") val userId: String,
        // PostgREST embeds the joined profile as a nested object.
        val profiles: ProfileRef? = null,
        @SerialName("composite_score") val compositeScore: Double,
        @SerialName("guess_count") val guessCount: Int = 0,
        @SerialName("time_seconds") val timeSeconds: Int = 0,
        @SerialName("boards_solved") val boardsSolved: Int = 1,
        @SerialName("total_boards") val totalBoards: Int = 1,
        @SerialName("hints_used") val hintsUsed: Int = 0,
        @SerialName("vs_wins") val vsWins: Int = 0,
        @SerialName("vs_games") val vsGames: Int = 0,
        val completed: Boolean = false,
    ) {
        /** Flattened username from the embedded profile, for the UI. */
        val username: String? get() = profiles?.username
        val avatarUrl: String? get() = profiles?.avatarUrl
    }

    @Serializable
    data class AllTimeRecord(
        @SerialName("record_type") val recordType: String,
        @SerialName("holder_id") val holderId: String? = null,
        // PostgREST embeds the holder's profile: profiles!inner(username)
        val profiles: ProfileRef? = null,
        @SerialName("record_value") val recordValue: Double = 0.0,
        @SerialName("game_mode") val gameMode: String? = null,
        @SerialName("play_type") val playType: String? = null,
    ) {
        val holderUsername: String? get() = profiles?.username
    }

    private const val COLS =
        "user_id,profiles!inner(username,avatar_url),composite_score,guess_count," +
        "time_seconds,boards_solved,total_boards,hints_used,vs_wins,vs_games,completed"

    /** Today's daily leaderboard for a mode (mirrors getDailyLeaderboard). */
    suspend fun fetchDailyLeaderboard(
        gameMode: String,
        playType: String = "solo",
        day: String = todayLocalDate(),
        limit: Int = 50,
    ): List<LeaderboardEntry> = fetchDailyLeaderboardOrNull(gameMode, playType, day, limit) ?: emptyList()

    /** Same, but null on a network/decode error (vs. a genuinely empty day) so
     *  the SWR path can keep cached rows instead of clobbering them with []. */
    suspend fun fetchDailyLeaderboardOrNull(
        gameMode: String,
        playType: String = "solo",
        day: String = todayLocalDate(),
        limit: Int = 50,
        /** Row offset into the ranked ordering (0-based) — used by the
         *  rank-window fetch to read the rows AROUND a deep rank. */
        offset: Int = 0,
    ): List<LeaderboardEntry>? = runCatching {
        client.postgrest["daily_results"]
            .select(Columns.raw(COLS)) {
                filter {
                    eq("game_mode", gameMode)
                    eq("play_type", playType)
                    eq("day", day)
                }
                order("composite_score", Order.DESCENDING)
                order("created_at", Order.ASCENDING)   // stable tiebreak (earlier finisher first)
                range(offset.toLong()..(offset + limit - 1).toLong())
            }
            .decodeList<LeaderboardEntry>()
    }.getOrElseNotCancelled { null }

    /**
     * The rows AROUND the user's rank — the "your neighborhood" section shown
     * below the top-50 list when the user placed past it (web fetchRankWindow
     * parity). `startRank` is entries[0]'s 1-based rank; the window clamps to
     * start after [topLimit] so it never overlaps the list.
     */
    suspend fun fetchRankWindow(
        gameMode: String,
        playType: String = "solo",
        userRank: Int,
        day: String = todayLocalDate(),
        radius: Int = 4,
        topLimit: Int = 50,
    ): RankWindow? {
        val startRank = maxOf(topLimit + 1, userRank - radius)
        val endRank = userRank + radius
        if (endRank < startRank) return null
        val entries = fetchDailyLeaderboardOrNull(
            gameMode, playType, day,
            limit = endRank - startRank + 1, offset = startRank - 1,
        ) ?: return null
        if (entries.isEmpty()) return null
        return RankWindow(startRank, entries)
    }

    /** Yesterday's top finishers (for the "Yesterday's Winners" card). */
    suspend fun fetchYesterdayWinners(gameMode: String, playType: String = "solo", limit: Int = 3): List<LeaderboardEntry> =
        fetchDailyLeaderboard(gameMode, playType, day = yesterdayLocalDate(), limit = limit)

    @Serializable
    private data class ScoreRow(@SerialName("composite_score") val compositeScore: Double)

    /** Exact server-side count of today's SOLO players for [gameMode] — the true
     *  "of M" once the leaderboard page is full (web totalQuery parity). */
    suspend fun soloPlayerCount(gameMode: String, day: String = todayLocalDate(), playType: String = "solo"): Int =
        runCatching {
            client.postgrest["daily_results"]
                .select(Columns.raw("id")) {
                    count(Count.EXACT)
                    limit(1)
                    filter {
                        eq("day", day)
                        eq("game_mode", gameMode)
                        eq("play_type", playType)
                    }
                }
                .countOrNull()?.toInt() ?: 0
        }.getOrElseNotCancelled { 0 }

    /**
     * User's rank + true total (web getUserDailyRank parity). When the user is on
     * the already-fetched [topEntries] page, rank comes from their index — zero
     * (under-full page) or one (full page → true total) extra queries. Outside a
     * full page: score + total in parallel, then a players-ahead count. Returns
     * null when the user has no result today.
     */
    suspend fun getUserDailyRank(
        userId: String,
        gameMode: String,
        playType: String = "solo",
        day: String = todayLocalDate(),
        topEntries: List<LeaderboardEntry>? = null,
        topLimit: Int = 50,
    ): RankInfo? = runCatching {
        if (topEntries != null) {
            val idx = topEntries.indexOfFirst { it.userId == userId }
            if (idx >= 0) {
                // Under-full page → the list IS everyone; full page needs a true total.
                if (topEntries.size < topLimit) return@runCatching RankInfo(idx + 1, topEntries.size)
                val count = soloPlayerCount(gameMode, day, playType)
                return@runCatching RankInfo(idx + 1, if (count > 0) count else topEntries.size)
            }
            // Full board visible and the user isn't on it → they haven't played today.
            if (topEntries.size < topLimit) return@runCatching null
        }

        // Outside the fetched page: user's score + total in parallel, then players ahead.
        val (userScore, totalPlayers) = coroutineScope {
            val score = async {
                client.postgrest["daily_results"]
                    .select(Columns.raw("composite_score")) {
                        filter {
                            eq("user_id", userId)
                            eq("day", day)
                            eq("game_mode", gameMode)
                            eq("play_type", playType)
                        }
                        limit(1)
                    }
                    .decodeList<ScoreRow>().firstOrNull()?.compositeScore
            }
            val total = async { soloPlayerCount(gameMode, day, playType) }
            score.await() to total.await()
        }
        if (userScore == null) return@runCatching null

        val higherCount = client.postgrest["daily_results"]
            .select(Columns.raw("id")) {
                count(Count.EXACT)
                limit(1)
                filter {
                    eq("day", day)
                    eq("game_mode", gameMode)
                    eq("play_type", playType)
                    gt("composite_score", userScore)
                }
            }
            .countOrNull()?.toInt() ?: 0

        RankInfo(higherCount + 1, totalPlayers)
    }.getOrElseNotCancelled { null }

    /** Total players who logged a result for today's [gameMode] (for "{n} players today").
     *  Web parity: getDailyPlayerCount counts ALL play types (solo + VS) with an
     *  exact server-side count — no solo filter, no row cap. */
    suspend fun playerCount(gameMode: String): Int = runCatching {
        client.postgrest["daily_results"]
            .select(Columns.raw("user_id")) {
                count(Count.EXACT)
                limit(1)
                filter {
                    eq("game_mode", gameMode)
                    eq("day", todayLocalDate())
                }
            }
            .countOrNull()?.toInt() ?: 0
    }.getOrElseNotCancelled { 0 }

    suspend fun fetchAllTimeRecords(): List<AllTimeRecord> = runCatching {
        client.postgrest["all_time_records"]
            .select(Columns.raw("record_type,record_value,game_mode,play_type,holder_id,profiles!inner(username)"))
            .decodeList<AllTimeRecord>()
    }.getOrElse { emptyList() }
}
