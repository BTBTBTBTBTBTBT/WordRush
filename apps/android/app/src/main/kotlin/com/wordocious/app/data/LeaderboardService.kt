package com.wordocious.app.data

import com.wordocious.app.todayUtcDate
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

object LeaderboardService {
    private val client get() = SupabaseConfig.client

    @Serializable
    data class LeaderboardEntry(
        @SerialName("user_id") val userId: String,
        val username: String? = null,
        @SerialName("composite_score") val compositeScore: Double,
        @SerialName("guess_count") val guessCount: Int = 0,
        @SerialName("time_seconds") val timeSeconds: Int = 0,
        @SerialName("boards_solved") val boardsSolved: Int = 1,
        @SerialName("total_boards") val totalBoards: Int = 1,
        @SerialName("hints_used") val hintsUsed: Int = 0,
        val completed: Boolean = false,
    )

    @Serializable
    data class AllTimeRecord(
        @SerialName("record_type") val recordType: String,
        @SerialName("holder_id") val holderId: String? = null,
        @SerialName("holder_username") val holderUsername: String? = null,
        @SerialName("record_value") val recordValue: Double = 0.0,
        @SerialName("game_mode") val gameMode: String? = null,
    )

    suspend fun fetchDailyLeaderboard(
        gameMode: String,
        playType: String = "solo",
        day: String = todayUtcDate(),
        limit: Int = 50,
    ): List<LeaderboardEntry> = runCatching {
        client.postgrest["daily_results"]
            .select(Columns.raw("user_id,profiles(username),composite_score,guess_count,time_seconds,boards_solved,total_boards,hints_used,completed")) {
                filter {
                    eq("game_mode", gameMode)
                    eq("play_type", playType)
                    eq("day", day)
                    eq("completed", true)
                }
                order("composite_score", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<LeaderboardEntry>()
    }.getOrElse { emptyList() }

    suspend fun getUserDailyRank(userId: String, gameMode: String, day: String = todayUtcDate()): Int? =
        runCatching {
            val all = fetchDailyLeaderboard(gameMode, day = day, limit = 1000)
            val idx = all.indexOfFirst { it.userId == userId }
            if (idx >= 0) idx + 1 else null
        }.getOrNull()

    suspend fun fetchAllTimeRecords(): List<AllTimeRecord> = runCatching {
        client.postgrest["all_time_records"]
            .select()
            .decodeList<AllTimeRecord>()
    }.getOrElse { emptyList() }
}
