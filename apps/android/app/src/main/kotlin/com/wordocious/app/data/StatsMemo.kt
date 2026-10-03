package com.wordocious.app.data

import kotlinx.coroutines.launch
import kotlinx.serialization.KSerializer

/**
 * Stale-while-revalidate memo for the profile / Stats dashboards (P-cache). Screen re-entry /
 * mode re-tap seeds state from the last-known value for an INSTANT repaint while the normal
 * fetch runs and stores back. Keys are caller-composed and carry the user id, e.g.
 * "guessDist:$uid:$mode:$playType". Never a source of truth.
 *
 * BI19: the [getPersisted] / [setPersisted] pair also mirrors the value to [AppCache.screens],
 * so a COLD launch paints the last copy too (versioned, size-bounded, cleared on an account
 * change). The plain [get] / [set] stay in-memory only.
 */
object StatsMemo {
    private val store = java.util.concurrent.ConcurrentHashMap<String, Any>()
    private val persistScope = kotlinx.coroutines.CoroutineScope(
        kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO,
    )

    @Suppress("UNCHECKED_CAST")
    fun <T> get(key: String): T? = store[key] as? T

    fun set(key: String, value: Any) { store[key] = value }

    /** The session copy, else the persisted one from an earlier launch. */
    fun <T : Any> getPersisted(key: String, serializer: KSerializer<T>): T? =
        get<T>(key) ?: AppCache.screens.get(key, serializer)?.also { store[key] = it }

    /** Session copy now; the disk copy is encoded + written off the main thread. */
    fun <T : Any> setPersisted(key: String, value: T, serializer: KSerializer<T>) {
        store[key] = value
        persistScope.launch { AppCache.screens.put(key, value, serializer) }
    }

    fun clear() = store.clear()
}
