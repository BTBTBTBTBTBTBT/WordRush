package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Remote feature flags — the More Games kill switch + tester gate (plan §7).
 * Port of apps/web/lib/flags.ts `isFlagOn`; the rule is identical on the web
 * and iOS:
 *
 *   no flagKey on the mode        → on   (nothing to gate)
 *   flags unknown / unreachable   → on   (the catalog's `enabled` alone decides)
 *   no row for the key            → OFF  (a gated mode needs its row — fail closed)
 *   row.enabled = false           → OFF  (the kill switch)
 *   row.audience = "all"          → on
 *   row.audience = "testers"      → on for admins and testers only
 *
 * Loaded on every onResume (MainActivity), which covers launch and foreground
 * returns; the last good table is cached in SettingsPref so a cold start
 * offline shows the same set the player saw last time. While the very first
 * fetch is in flight with nothing cached, flagged modes are HIDDEN.
 */
object FlagsService {
    @Serializable
    data class AppFlag(val key: String, val enabled: Boolean, val audience: String)

    private const val CACHE_KEY = "app-flags-cache"
    private val json = Json { ignoreUnknownKeys = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** null = unknown (first load in flight, nothing cached); empty = table empty. */
    private val _flags = MutableStateFlow<Map<String, AppFlag>?>(readCache())
    val flags: StateFlow<Map<String, AppFlag>?> = _flags.asStateFlow()
    private val _loaded = MutableStateFlow(false)
    val loaded: StateFlow<Boolean> = _loaded.asStateFlow()

    private fun readCache(): Map<String, AppFlag>? {
        val raw = SettingsPref.get(CACHE_KEY, "")
        if (raw.isEmpty()) return null
        return runCatching { json.decodeFromString<List<AppFlag>>(raw).associateBy { it.key } }.getOrNull()
    }

    /** Fetch the table; a failure keeps the cached (or null) set. */
    fun load() {
        scope.launch {
            val rows = runCatching {
                SupabaseConfig.client.postgrest["app_flags"]
                    .select(Columns.raw("key, enabled, audience"))
                    .decodeList<AppFlag>()
            }.getOrNull()
            if (rows != null) {
                _flags.value = rows.associateBy { it.key }
                runCatching { SettingsPref.set(CACHE_KEY, json.encodeToString(rows)) }
            }
            _loaded.value = true
        }
    }

    /** The shared resolver, pure form: same rule, explicit inputs. */
    fun resolve(flagKey: String?, flags: Map<String, AppFlag>?, isTester: Boolean): Boolean {
        if (flagKey == null) return true
        if (flags == null) return true
        val row = flags[flagKey] ?: return false
        if (!row.enabled) return false
        if (row.audience == "all") return true
        return isTester
    }

    /** Live resolver against the current table and the signed-in profile. */
    fun isOn(flagKey: String?, flags: Map<String, AppFlag>? = _flags.value, loaded: Boolean = _loaded.value): Boolean {
        if (flagKey == null) return true
        if (flags == null) return loaded    // in flight → hidden; unreachable → catalog decides
        return resolve(flagKey, flags, AuthService.isAdsExempt)
    }
}
