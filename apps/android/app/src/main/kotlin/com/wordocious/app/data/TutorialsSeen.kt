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
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import com.wordocious.core.PocketHelp

/**
 * First-play tutorials, "seen" per game per player (FRIDAY-QUEUE item 12). Signed in: profiles.tutorials_seen
 * (text[], supabase/manual-migrations/20261010000001_tutorials_seen.sql) merged with a local copy, so a new
 * device does not show a card the player already dismissed. Guests: the local copy only. Until the column
 * exists the read is simply empty and the write error is ignored (the local copy still holds).
 * The decision and the list math are core ([PocketHelp]) so web, iOS and Android agree.
 * Web: lib/tutorials-seen.ts.
 */
object TutorialsSeen {
    private const val LOCAL_KEY = "tutorials-seen"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _seen = MutableStateFlow<List<String>?>(null)
    /** Null until known (never show a tutorial on a guess). */
    val seen: StateFlow<List<String>?> = _seen.asStateFlow()

    private var loadedFor: String? = null

    @Serializable
    private data class SeenRow(@SerialName("tutorials_seen") val seen: List<String>? = null)

    private fun readLocal(): List<String> =
        SettingsPref.get(LOCAL_KEY, "").split(',').map { it.trim() }.filter { it.isNotEmpty() }

    private fun writeLocal(list: List<String>) = SettingsPref.set(LOCAL_KEY, list.joinToString(","))

    /** Load the seen list for the current account (idempotent per account); call from a LaunchedEffect keyed on the user id. */
    fun ensureLoaded() {
        val uid = AuthService.userId
        val tag = uid ?: ""
        if (loadedFor == tag) return
        loadedFor = tag
        val local = readLocal()
        if (uid == null) {
            _seen.value = local
            return
        }
        _seen.value = null
        scope.launch {
            val remote = runCatching {
                SupabaseConfig.client.postgrest["profiles"]
                    .select(Columns.raw("tutorials_seen")) { filter { eq("id", uid) } }
                    .decodeSingleOrNull<SeenRow>()?.seen
            }.getOrNull() ?: emptyList()
            val merged = PocketHelp.mergeTutorialsSeen(local, remote)
            writeLocal(merged)
            _seen.value = merged
            // A device that knows keys the server lacks pushes the sorted union back.
            if (merged.size != remote.size) push(uid, merged)
        }
    }

    /** Record that a tutorial card closed (idempotent). */
    fun mark(key: String) {
        val current = _seen.value ?: readLocal()
        if (key in current) return
        val next = PocketHelp.withTutorialSeen(PocketHelp.mergeTutorialsSeen(readLocal(), current), key)
        writeLocal(next)
        _seen.value = next
        val uid = AuthService.userId ?: return
        scope.launch { push(uid, next) }
    }

    private suspend fun push(uid: String, list: List<String>) {
        runCatching {
            SupabaseConfig.client.postgrest["profiles"].update({ set("tutorials_seen", list) }) { filter { eq("id", uid) } }
        }
    }
}
