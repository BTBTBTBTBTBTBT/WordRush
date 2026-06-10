package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * All-time head-to-head record + minimal opponent profile for the VS
 * intro/header/result UI — Android port of web lib/head-to-head.ts.
 */
object HeadToHeadService {
    private val client get() = SupabaseConfig.client

    data class HeadToHeadRecord(val myWins: Int, val theirWins: Int, val draws: Int)

    /** Minimal public profile bits needed by the VS intro/header/result UI. */
    @Serializable
    data class VsProfile(
        val username: String? = null,
        @SerialName("avatar_url") val avatarUrl: String? = null,
        val level: Int? = null,
    ) {
        val displayName: String get() = username?.takeIf { it.isNotBlank() } ?: "Player"
    }

    @Serializable
    private data class MatchRow(
        @SerialName("player1_id") val player1Id: String? = null,
        @SerialName("player2_id") val player2Id: String? = null,
        @SerialName("winner_id") val winnerId: String? = null,
    )

    /** Web match-intro headToHeadLine — identical copy in all four states. */
    fun headToHeadLine(opponentName: String, h2h: HeadToHeadRecord): String = when {
        h2h.myWins == 0 && h2h.theirWins == 0 && h2h.draws == 0 -> "First meeting!"
        h2h.myWins > h2h.theirWins -> "You lead ${h2h.myWins}–${h2h.theirWins}"
        h2h.theirWins > h2h.myWins -> "$opponentName leads ${h2h.theirWins}–${h2h.myWins}"
        else -> "Tied ${h2h.myWins}–${h2h.theirWins}"
    }

    /**
     * All-time head-to-head between two players, counted from the `matches`
     * table (rows where the two ids occupy player1/player2 in either order).
     * A draw is a VS row (player2_id set) with no winner_id.
     */
    suspend fun fetchHeadToHead(myId: String, opponentId: String): HeadToHeadRecord = runCatching {
        val rows = client.postgrest["matches"]
            .select(Columns.raw("player1_id, player2_id, winner_id")) {
                filter {
                    or {
                        and { eq("player1_id", myId); eq("player2_id", opponentId) }
                        and { eq("player1_id", opponentId); eq("player2_id", myId) }
                    }
                }
                limit(1000)
            }
            .decodeList<MatchRow>()
        var myWins = 0; var theirWins = 0; var draws = 0
        for (row in rows) {
            when {
                row.winnerId == myId -> myWins++
                row.winnerId == opponentId -> theirWins++
                row.player2Id != null -> draws++
            }
        }
        HeadToHeadRecord(myWins, theirWins, draws)
    }.getOrDefault(HeadToHeadRecord(0, 0, 0))

    /** Opponent's public profile (username/avatar/level) — null if not found. */
    suspend fun fetchVsProfile(userId: String): VsProfile? = runCatching {
        client.postgrest["profiles"]
            .select(Columns.raw("username, avatar_url, level")) {
                filter { eq("id", userId) }
                limit(1)
            }
            .decodeSingleOrNull<VsProfile>()
    }.getOrNull()
}
