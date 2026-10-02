package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Always-on lightweight presence socket — the Android counterpart to the web
 * SitePresenceProvider / iOS PresenceService. Holds one socket.io connection
 * while signed in so the user is counted in the server's /presence total (the
 * home LIVE banner). Tagged with the SAME `u:<userId>` presenceId the VS match
 * socket uses, so the server dedupes a person to 1 even while in a match.
 *
 * Friends overhaul §1 ("On now", 2026-10-01): while the app is in the
 * foreground it also heartbeats the player's own profile every 60 s —
 * `last_seen_at = now` and `last_activity` = the db key of the game on screen
 * (DUEL, SCRAMBLE …) or null — and immediately whenever that game changes. The
 * column only accepts `^[A-Za-z0-9_]{1,24}$`, so anything else is sent as null.
 */
object PresenceService {
    private var socket: Socket? = null

    private val presenceId: String? get() = AuthService.userId?.let { "u:$it" }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var heartbeat: Job? = null
    @Volatile private var activity: String? = null
    private val KEY_RE = Regex("^[A-Za-z0-9_]{1,24}$")

    /** Idempotent: no-ops if already connected or the user isn't loaded yet. */
    fun start() {
        startHeartbeat()
        if (socket != null || !VSConfig.isConfigured) return
        val pid = presenceId ?: return
        val opts = IO.Options().apply {
            reconnection = true
            transports = arrayOf("websocket")
            auth = mapOf("presenceId" to pid)
        }
        val s = runCatching { IO.socket(VSConfig.SERVER_URL, opts) }.getOrNull() ?: return
        socket = s
        s.connect()   // no handlers needed — the server counts the connection itself
    }

    fun stop() {
        heartbeat?.cancel()
        heartbeat = null
        socket?.disconnect()
        socket = null
    }

    /**
     * The game on screen changed (null = none). Writes at once when it differs,
     * so a friend's "On now · in Muddle" follows you in and out of games.
     */
    fun setActivity(dbKey: String?) {
        val key = dbKey?.takeIf { KEY_RE.matches(it) }
        if (key == activity) return
        activity = key
        if (heartbeat != null) scope.launch { beat() }
    }

    /** The 60 s foreground heartbeat (no-op without a signed-in user; idempotent). */
    private fun startHeartbeat() {
        if (heartbeat?.isActive == true || AuthService.userId == null) return
        heartbeat = scope.launch {
            while (isActive) {
                beat()
                delay(60_000)
            }
        }
    }

    private suspend fun beat() {
        val uid = AuthService.userId ?: return
        val key = activity
        runCatching {
            SupabaseConfig.client.postgrest["profiles"].update({
                set("last_seen_at", java.time.Instant.now().toString())
                set("last_activity", key)
            }) { filter { eq("id", uid) } }
        }
    }
}
