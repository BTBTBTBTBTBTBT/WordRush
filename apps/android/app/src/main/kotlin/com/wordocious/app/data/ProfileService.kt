package com.wordocious.app.data

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
        val wins: Int = 0,
        val losses: Int = 0,
        @SerialName("total_games") val totalGames: Int = 0,
        @SerialName("best_score") val bestScore: Double? = null,
        @SerialName("fastest_time") val fastestTime: Int? = null,
    )

    @Serializable
    data class RecentMatch(
        val id: String,
        @SerialName("game_mode") val gameMode: String,
        @SerialName("player1_id") val player1Id: String,
        @SerialName("player2_id") val player2Id: String? = null,
        @SerialName("winner_id") val winnerId: String? = null,
        @SerialName("player1_score") val player1Score: Double? = null,
        @SerialName("created_at") val createdAt: String,
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
            .select(Columns.raw("id,game_mode,player1_id,player2_id,winner_id,player1_score,created_at")) {
                filter { eq("player1_id", userId) }
                order("created_at", Order.DESCENDING)
                limit(limit.toLong())
            }
            .decodeList<RecentMatch>()
    }.getOrElse { emptyList() }

    suspend fun fetchUserMedals(userId: String, limit: Int = 10): List<UserMedal> = runCatching {
        client.postgrest["medals"]
            .select { filter { eq("user_id", userId) }; order("day", Order.DESCENDING); limit(limit.toLong()) }
            .decodeList<UserMedal>()
    }.getOrElse { emptyList() }
}
