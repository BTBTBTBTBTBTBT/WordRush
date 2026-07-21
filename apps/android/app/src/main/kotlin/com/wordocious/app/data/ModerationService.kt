package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * User-generated-content moderation (App Review 1.2): report + block — the
 * Android port of iOS ModerationService.swift. Backed by the `reports`
 * (insert-only) and `blocks` (own-rows) tables from manual-migration
 * 20260721000001_prelaunch_hardening.sql.
 *
 * Blocked ids are cached in-memory per launch (lowercased) and applied as a
 * client-side filter wherever strangers' usernames render (leaderboards,
 * records).
 */
object ModerationService {
    private val client get() = SupabaseConfig.client

    @Serializable
    private data class ReportInsert(
        @SerialName("reporter_id") val reporterId: String,
        @SerialName("reported_user_id") val reportedUserId: String,
        val reason: String,
        val context: String,
    )

    @Serializable
    private data class BlockInsert(
        @SerialName("blocker_id") val blockerId: String,
        @SerialName("blocked_id") val blockedId: String,
    )

    @Serializable
    private data class BlockRow(@SerialName("blocked_id") val blockedId: String)

    /** In-memory cache of who the signed-in user has blocked (lowercased ids).
     *  Loaded once per launch, updated optimistically on block/unblock. */
    private val blockedIds: MutableSet<String> =
        java.util.Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap())

    @Volatile private var loaded = false

    /** File a report against [userId]. Returns false when signed out / on failure. */
    suspend fun report(userId: String, reason: String, context: String): Boolean {
        val uid = AuthService.userId ?: return false
        return runCatching {
            client.postgrest["reports"].insert(
                ReportInsert(
                    reporterId = uid,
                    reportedUserId = userId,
                    reason = reason.take(500),
                    context = context.take(200),
                ),
            )
        }.isSuccess
    }

    /** Block [userId] (optimistic: cache updates immediately; a duplicate-PK
     *  insert failure means "already blocked", which still counts as success). */
    suspend fun block(userId: String): Boolean {
        val uid = AuthService.userId ?: return false
        blockedIds.add(userId.lowercase())
        runCatching {
            client.postgrest["blocks"].insert(BlockInsert(blockerId = uid, blockedId = userId))
        }
        return true
    }

    suspend fun unblock(userId: String) {
        val uid = AuthService.userId ?: return
        blockedIds.remove(userId.lowercase())
        runCatching {
            client.postgrest["blocks"].delete {
                filter { eq("blocker_id", uid); eq("blocked_id", userId) }
            }
        }
    }

    /** Load (once per launch) the signed-in user's block list. Best-effort:
     *  a failed/signed-out attempt leaves `loaded` false so a later call retries. */
    suspend fun loadBlockedIds() {
        if (loaded) return
        val uid = AuthService.userId ?: return
        runCatching {
            val rows = client.postgrest["blocks"]
                .select(Columns.raw("blocked_id")) { filter { eq("blocker_id", uid) } }
                .decodeList<BlockRow>()
            blockedIds.clear()
            blockedIds.addAll(rows.map { it.blockedId.lowercase() })
            loaded = true
        }
    }

    fun isBlocked(userId: String): Boolean = blockedIds.contains(userId.lowercase())
}
