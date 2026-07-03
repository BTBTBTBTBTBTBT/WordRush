package com.wordocious.app.data

/**
 * Tiny session-lived stale-while-revalidate memo for the profile dashboards
 * (P-cache). Screen re-entry / mode re-tap seeds state from the last-known
 * value for an INSTANT repaint while the normal fetch runs and stores back.
 * Keys are caller-composed, e.g. "guessDist:$uid:$mode:$playType".
 * In-memory only — cleared on process death; never a source of truth.
 */
object StatsMemo {
    private val store = mutableMapOf<String, Any>()

    @Suppress("UNCHECKED_CAST")
    fun <T> get(key: String): T? = store[key] as? T

    fun set(key: String, value: Any) { store[key] = value }
}
