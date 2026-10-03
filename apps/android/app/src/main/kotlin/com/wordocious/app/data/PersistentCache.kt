package com.wordocious.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json

/**
 * BI19 (founder, 2026-10-03: "make sure the information on all pages is quick to load and stays
 * every time"): the one persisted, cache-first store behind every data screen. A screen paints its
 * last cached copy on the first frame — also on a cold launch — then revalidates in the
 * background and swaps in only what changed. A failed or slow fetch never blanks it.
 *
 * - Versioned: entries live under "v<version>:"; anything written by another version is purged.
 * - Size-bounded: at most [maxEntries] entries (oldest write evicted first), and a value larger
 *   than [maxValueChars] is simply not cached.
 * - Per user: callers put the user id in the key; [clear] runs when the save owner changes.
 *
 * Pure over [KeyValueStore] so the relaunch behavior is JVM-tested (PersistentCacheTest): a new
 * instance over the same store reads what the old one wrote.
 */
class PersistentCache(
    private val store: KeyValueStore,
    private val version: Int = VERSION,
    private val maxEntries: Int = 96,
    private val maxValueChars: Int = 400_000,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val prefix = "v$version:"
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    init {
        // A cache from another schema version is dropped, never decoded.
        runCatching { store.keys().filterNot { it.startsWith(prefix) }.forEach { store.remove(it) } }
    }

    /** The raw cached string for [key], or null. */
    fun getRaw(key: String): String? {
        val stored = runCatching { store.get(prefix + key) }.getOrNull() ?: return null
        val bar = stored.indexOf('|')
        if (bar < 0) return null
        return stored.substring(bar + 1)
    }

    /** Cache [value] for [key]; evicts the oldest entries past [maxEntries]. */
    fun putRaw(key: String, value: String) {
        if (value.length > maxValueChars) return
        runCatching {
            store.put(prefix + key, "${clock()}|$value")
            val all = store.keys().filter { it.startsWith(prefix) }
            if (all.size > maxEntries) {
                all.sortedBy { k -> store.get(k)?.substringBefore('|')?.toLongOrNull() ?: 0L }
                    .take(all.size - maxEntries)
                    .forEach { store.remove(it) }
            }
        }
    }

    fun <T> get(key: String, serializer: KSerializer<T>): T? {
        val raw = getRaw(key) ?: return null
        return runCatching { json.decodeFromString(serializer, raw) }
            .onFailure { remove(key) }
            .getOrNull()
    }

    fun <T> put(key: String, value: T, serializer: KSerializer<T>) {
        runCatching { putRaw(key, json.encodeToString(serializer, value)) }
    }

    fun remove(key: String) {
        runCatching { store.remove(prefix + key) }
    }

    /** Drop every entry (sign-out / a different account on this device). */
    fun clear() {
        runCatching { store.keys().forEach { store.remove(it) } }
    }

    companion object {
        /** Bump when a cached shape changes incompatibly. */
        const val VERSION = 1
    }
}

/** Minimal string store behind [PersistentCache] and [OptimisticResults.Store]. */
interface KeyValueStore {
    fun get(key: String): String?
    fun put(key: String, value: String)
    fun remove(key: String)
    fun keys(): Set<String>
}

/** In-memory store (tests, and a fallback before the app context exists). */
class MemoryKeyValueStore : KeyValueStore {
    private val map = java.util.concurrent.ConcurrentHashMap<String, String>()
    override fun get(key: String) = map[key]
    override fun put(key: String, value: String) { map[key] = value }
    override fun remove(key: String) { map.remove(key) }
    override fun keys(): Set<String> = map.keys.toSet()
}

/** SharedPreferences-backed store (survives relaunch). */
class PrefsKeyValueStore(private val prefs: android.content.SharedPreferences) : KeyValueStore {
    override fun get(key: String): String? = prefs.getString(key, null)
    override fun put(key: String, value: String) { prefs.edit().putString(key, value).apply() }
    override fun remove(key: String) { prefs.edit().remove(key).apply() }
    override fun keys(): Set<String> = prefs.all.keys.toSet()
}

/** The app's instances. Separate preference files so a cache wipe never touches settings. */
object AppCache {
    private fun prefsStore(name: String): KeyValueStore = runCatching {
        PrefsKeyValueStore(
            com.wordocious.app.App.instance.getSharedPreferences(name, android.content.Context.MODE_PRIVATE),
        ) as KeyValueStore
    }.getOrElse { MemoryKeyValueStore() }

    /** Screen data (Stats, Friends, Records…), keyed by the callers per user. */
    val screens: PersistentCache by lazy { PersistentCache(prefsStore("wordocious_screen_cache")) }

    /** Optimistic daily results awaiting server confirmation. */
    val optimistic: OptimisticResults.Store by lazy { OptimisticResults.Store(prefsStore("wordocious_optimistic_results")) }

    /** A different account (or guest) took over the device's saves: nothing cached carries over. */
    fun clearForOwnerChange() {
        runCatching { screens.clear() }
        runCatching { optimistic.clear() }
    }
}
