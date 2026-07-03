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
    private data class NameIdRow(val id: String, val username: String? = null)

    /**
     * Batched inviter-username lookup: ONE profiles query for all inviter ids
     * (match_invites.inviter_id references auth.users, not profiles, so a
     * PostgREST embed isn't possible — this mirrors web/iOS). Returns id → username.
     */
    suspend fun lookupInviterUsernames(inviterIds: List<String>): Map<String, String> {
        val ids = inviterIds.distinct()
        if (ids.isEmpty()) return emptyMap()
        return runCatching {
            client.postgrest["profiles"]
                .select(Columns.raw("id,username")) { filter { isIn("id", ids) } }
                .decodeList<NameIdRow>()
                .mapNotNull { row -> row.username?.let { row.id to it } }
                .toMap()
        }.getOrElse { emptyMap() }
    }

    suspend fun markInviteDeclined(inviteId: String) {
        runCatching {
            client.postgrest["match_invites"].update({ set("status", "declined") }) {
                filter { eq("id", inviteId) }
            }
        }
    }

    @Serializable
    private data class GameModeRow(@SerialName("game_mode") val gameMode: String)

    /**
     * Which mode a shared invite code is for (joiner side) — web/iOS lookupMode.
     * Returns the game_mode string, or null if the code is unknown/expired.
     */
    suspend fun lookupMode(code: String): String? = runCatching {
        client.postgrest["match_invites"]
            .select(Columns.raw("game_mode")) {
                filter { eq("invite_code", code); eq("status", "pending") }
                limit(1)
            }
            .decodeSingleOrNull<GameModeRow>()?.gameMode
    }.getOrNull()

    /** Flip an invite to accepted once the server has paired both players. */
    suspend fun markInviteAccepted(code: String, matchId: String?) {
        runCatching {
            client.postgrest["match_invites"].update({
                set("status", "accepted")
                if (matchId != null) set("match_id", matchId)
            }) {
                filter { eq("invite_code", code); eq("status", "pending") }
            }
        }
    }

    // MARK: Outgoing invites (home Invite modal — web lib/invite-service.ts createInvite)

    /** Result of the home Invite modal — a shareable code or a user-facing error. */
    data class InviteResult(val code: String?, val error: String?)

    // No 0/O/1/I/l — easier to type (matches web CODE_ALPHABET + iOS).
    private const val CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    private fun generateCode(length: Int = 8): String =
        (0 until length).map { CODE_ALPHABET.random() }.joinToString("")

    @Serializable
    private data class IdRow(val id: String)

    @Serializable
    private data class InviteInsert(
        @SerialName("inviter_id") val inviterId: String,
        @SerialName("invitee_id") val inviteeId: String? = null,
        @SerialName("invite_code") val inviteCode: String,
        @SerialName("game_mode") val gameMode: String,
    )

    /**
     * Create a VS invite for a mode. If [inviteeUsername] is non-empty the invite
     * is targeted at that user (pending-invites badge); otherwise it's a public
     * link anyone can redeem. Returns the shareable code, or a user-facing error.
     * Retries a few times on the vanishingly unlikely unique-code collision.
     */
    suspend fun createInvite(gameMode: String, inviteeUsername: String?): InviteResult {
        val uid = AuthService.userId?.lowercase()
            ?: return InviteResult(null, "You're not signed in")

        var inviteeId: String? = null
        val uname = inviteeUsername?.trim()
        if (!uname.isNullOrEmpty()) {
            val row = runCatching {
                client.postgrest["profiles"]
                    .select(Columns.raw("id")) { filter { ilike("username", uname) }; limit(1) }
                    .decodeSingleOrNull<IdRow>()
            }.getOrNull() ?: return InviteResult(null, "User not found")
            if (row.id.lowercase() == uid) return InviteResult(null, "You can't invite yourself")
            inviteeId = row.id
        }

        repeat(3) {
            val code = generateCode()
            val ok = runCatching {
                client.postgrest["match_invites"]
                    .insert(InviteInsert(inviterId = uid, inviteeId = inviteeId, inviteCode = code, gameMode = gameMode))
            }.isSuccess
            if (ok) return InviteResult(code, null)
        }
        return InviteResult(null, "Could not generate a unique code")
    }
}
