package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * VS match invites — Android port of web lib/invite-service.ts (the parts the
 * pending-invites banner needs): list my pending un-expired invites, resolve
 * the inviter's username, decline.
 */
object InviteService {
    private val client get() = SupabaseConfig.client

    @Serializable
    data class MatchInvite(
        val id: String,
        @SerialName("inviter_id") val inviterId: String,
        @SerialName("invitee_id") val inviteeId: String? = null,
        @SerialName("invite_code") val inviteCode: String,
        @SerialName("game_mode") val gameMode: String,
        val status: String,
        @SerialName("expires_at") val expiresAt: String,
        @SerialName("created_at") val createdAt: String,
    )

    suspend fun fetchPendingInvitesForUser(userId: String): List<MatchInvite> = runCatching {
        client.postgrest["match_invites"]
            .select {
                filter {
                    eq("invitee_id", userId)
                    eq("status", "pending")
                    gt("expires_at", java.time.Instant.now().toString())
                }
                order("created_at", Order.DESCENDING)
            }
            .decodeList<MatchInvite>()
    }.getOrElse { emptyList() }

    @Serializable
    private data class NameRow(val username: String? = null)

    suspend fun lookupInviterUsername(inviterId: String): String? = runCatching {
        client.postgrest["profiles"]
            .select(Columns.raw("username")) { filter { eq("id", inviterId) }; limit(1) }
            .decodeSingleOrNull<NameRow>()?.username
    }.getOrNull()

    suspend fun markInviteDeclined(inviteId: String) {
        runCatching {
            client.postgrest["match_invites"].update({ set("status", "declined") }) {
                filter { eq("id", inviteId) }
            }
        }
    }
}
