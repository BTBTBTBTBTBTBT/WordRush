package com.wordocious.app.data

import io.socket.client.IO
import io.socket.client.Socket

/**
 * Always-on lightweight presence socket — the Android counterpart to the web
 * SitePresenceProvider / iOS PresenceService. Holds one socket.io connection
 * while signed in so the user is counted in the server's /presence total (the
 * home LIVE banner). Tagged with the SAME `u:<userId>` presenceId the VS match
 * socket uses, so the server dedupes a person to 1 even while in a match.
 */
object PresenceService {
    private var socket: Socket? = null

    private val presenceId: String? get() = AuthService.userId?.let { "u:$it" }

    /** Idempotent: no-ops if already connected or the user isn't loaded yet. */
    fun start() {
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
        socket?.disconnect()
        socket = null
    }
}
