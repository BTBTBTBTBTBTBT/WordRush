package com.wordocious.app.data

import com.wordocious.app.todayLocalDate
import com.wordocious.app.yesterdayLocalDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
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
    ): List<LeaderboardEntry> = runCatching {
        client.postgrest["daily_results"]
            .select(Columns.raw(COLS)) {
                filter {
                    eq("game_mode", gameMode)
                    eq("play_type", playType)
                    eq("day", day)
                }
                order("composite_score", Order.DESCENDING)
                order("created_at", Order.ASCENDING)   // stable tiebreak (earlier finisher first)
                limit(limit.toLong())
            }
            .decodeList<LeaderboardEntry>()
    }.getOrElse { emptyList() }

    /** Yesterday's top finishers (for the "Yesterday's Winners" card). */
    suspend fun fetchYesterdayWinners(gameMode: String, playType: String = "solo", limit: Int = 3): List<LeaderboardEntry> =
        fetchDailyLeaderboard(gameMode, playType, day = yesterdayLocalDate(), limit = limit)

    /**
     * Current user's rank + total player count for today (mirrors getUserDailyRank).
     * Computed over the full unfiltered list (same numbers as the server count).
     */
    suspend fun userRankAndTotal(userId: String, gameMode: String, playType: String = "solo"): Pair<Int, Int>? =
        runCatching {
            val all = fetchDailyLeaderboard(gameMode, playType, limit = 1000)
            if (all.isEmpty()) return@runCatching null
            val idx = all.indexOfFirst { it.userId == userId }
            (if (idx >= 0) idx + 1 else all.size + 1) to all.size
        }.getOrNull()

    suspend fun getUserDailyRank(userId: String, gameMode: String, day: String = todayLocalDate()): Int? =
        userRankAndTotal(userId, gameMode)?.first

    /** Total players who logged a result for today's [gameMode] (for "{n} players today").
     *  Web parity: getDailyPlayerCount counts ALL play types (solo + VS) with an
     *  exact server-side count — no solo filter, no row cap. */
    suspend fun playerCount(gameMode: String): Int = runCatching {
        client.postgrest["daily_results"]
            .select(Columns.raw("user_id")) {
                count(io.github.jan.supabase.postgrest.query.Count.EXACT)
                limit(1)
                filter {
                    eq("game_mode", gameMode)
                    eq("day", todayLocalDate())
                }
            }
            .countOrNull()?.toInt() ?: 0
    }.getOrElse { 0 }

    suspend fun fetchAllTimeRecords(): List<AllTimeRecord> = runCatching {
        client.postgrest["all_time_records"]
            .select(Columns.raw("record_type,record_value,game_mode,play_type,holder_id,profiles!inner(username)"))
            .decodeList<AllTimeRecord>()
    }.getOrElse { emptyList() }
}
