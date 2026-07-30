package com.wordocious.app.data

import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * FCM token capture — the Android half of iOS `PushRegistration`
 * (PushRegistration.swift). Tokens land in the same `device_tokens` table,
 * keyed to the signed-in user, and the server send path already exists.
 *
 * Platform note: iOS registers with APNs and gets its token via an
 * AppDelegate callback; Android gets one from FCM either at first launch
 * (fetched here) or whenever Firebase rotates it (onNewToken below). Both
 * paths funnel into [upload], which upserts on `token` so a device that
 * re-registers updates its row instead of accumulating duplicates.
 */
object PushRegistration {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Serializable
    private data class TokenRow(
        @SerialName("user_id") val userId: String,
        val platform: String,
        val token: String,
    )

    /**
     * Fetch the current token and upload it. Call once auth has bootstrapped —
     * before that there is no user id to key the row on, and the write would be
     * dropped by the row-level security policy.
     */
    fun register() {
        if (AuthService.userId == null) return
        scope.launch {
            val token = runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()
            if (token != null) upload(token)
        }
    }

    /**
     * Store the token for the signed-in user. No-ops when signed out.
     *
     * Update-then-insert rather than a true upsert: `device_tokens` has RLS
     * policies per operation and no client-visible unique constraint helper, so
     * this matches the insert/update idiom the other services use. Re-running it
     * for the same token is a no-op update, so the same device never
     * accumulates duplicate rows.
     */
    suspend fun upload(token: String) {
        val uid = AuthService.userId ?: return
        runCatching {
            val client = SupabaseConfig.client
            val existing = client.postgrest["device_tokens"]
                .select { filter { eq("token", token) } }
                .decodeList<TokenRow>()
            if (existing.isEmpty()) {
                client.postgrest["device_tokens"]
                    .insert(TokenRow(userId = uid, platform = "android", token = token))
            } else if (existing.first().userId != uid) {
                // Device changed hands (sign out -> different account): repoint
                // the row so pushes follow the account actually on the device.
                client.postgrest["device_tokens"]
                    .update({ set("user_id", uid) }) { filter { eq("token", token) } }
            }
        }
    }
}

/**
 * Receives FCM lifecycle callbacks. Registered in AndroidManifest.
 *
 * Display is deliberately left to the system: the server sends `notification`
 * payloads, which Android renders itself while the app is backgrounded — the
 * same division of labour iOS has with APNs. [onMessageReceived] therefore only
 * matters for data-only messages, which nothing sends today.
 */
class WordociousMessagingService : FirebaseMessagingService() {
    /**
     * Fired when Firebase issues or rotates a token — including the very first
     * one on a fresh install, which can arrive before the user signs in. In that
     * case [PushRegistration.upload] no-ops and PushRegistration.register()
     * picks the token up once auth bootstraps.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            PushRegistration.upload(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // Notification-payload messages are drawn by the system; nothing to do.
    }
}
