package com.wordocious.app.data

/**
 * Realtime VS (socket.io) server configuration — mirrors iOS VSConfig and the
 * web `NEXT_PUBLIC_SERVER_URL`. The socket.io server (apps/server) is deployed
 * on Railway behind the stable custom domain below, so the underlying service
 * can change without touching clients.
 */
object VSConfig {
    /** Production socket server base URL — the Railway custom domain. */
    const val SERVER_URL = "https://server.wordocious.com"

    /** True once a real (non-placeholder) server URL is configured. */
    val isConfigured: Boolean get() = !SERVER_URL.contains("REPLACE-WITH")
}
