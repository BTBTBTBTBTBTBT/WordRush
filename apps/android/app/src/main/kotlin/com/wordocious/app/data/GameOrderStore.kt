package com.wordocious.app.data

import com.wordocious.core.GameOrder
import com.wordocious.core.GameOrderPrefs
import com.wordocious.core.GameOrderSection
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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive

/**
 * FRIDAY-QUEUE item 35 (Android): the player's saved game order. Signed in: profiles.game_order (jsonb,
 * synced across devices) mirrored per user in SharedPreferences so the order paints instantly; guest:
 * local only. Gate: the `custom_game_order` off-switch (off = everyone sees the default order, no
 * editing). Pure rules: core [GameOrder] (parity with core game-order.ts); iOS: GameOrderStore.swift;
 * web: lib/game-order-store.ts. The column is read best-effort (it may not exist before the migration).
 */
object GameOrderStore {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    private val _prefs = MutableStateFlow<GameOrderPrefs?>(null)
    /** The saved order (null = default). Collect it so every list re-sorts. */
    val prefs: StateFlow<GameOrderPrefs?> = _prefs.asStateFlow()

    private var userId: String? = null
    private var fetchedFor: String? = null

    @Serializable
    private data class Stored(val dailies: List<String> = emptyList(), val puzzles: List<String> = emptyList())

    @Serializable
    private data class Row(val game_order: Stored? = null)

    private fun key(uid: String?) = "game-order:${uid?.lowercase() ?: "guest"}"

    /** Editing is available (the off-switch is live). */
    val canEdit: Boolean get() = FlagsService.isLive("custom_game_order")

    /** Call when the signed-in account changes: load the local mirror, then the profile row once. */
    fun bind(uid: String?) {
        if (uid == userId && fetchedFor != null) return
        userId = uid
        _prefs.value = readLocal(uid)
        if (uid == null || fetchedFor == uid) { fetchedFor = uid ?: ""; return }
        fetchedFor = uid
        scope.launch {
            val row = runCatching {
                SupabaseConfig.client.postgrest["profiles"]
                    .select(Columns.raw("game_order")) { filter { eq("id", uid) }; limit(1) }
                    .decodeSingle<Row>()
            }.getOrNull() ?: return@launch
            if (userId != uid) return@launch
            val remote = GameOrder.parse(row.game_order?.dailies, row.game_order?.puzzles)
            _prefs.value = remote
            writeLocal(uid, remote)
        }
    }

    private fun readLocal(uid: String?): GameOrderPrefs? {
        val raw = SettingsPref.get(key(uid), "")
        if (raw.isEmpty()) return null
        val s = runCatching { json.decodeFromString<Stored>(raw) }.getOrNull() ?: return null
        return GameOrder.parse(s.dailies, s.puzzles)
    }

    private fun writeLocal(uid: String?, p: GameOrderPrefs?) {
        if (p == null) SettingsPref.remove(key(uid))
        else SettingsPref.set(key(uid), json.encodeToString(Stored(p.dailies, p.puzzles)))
    }

    /** [items] (already flag-filtered, catalog order) sorted by the player's order for [section]. */
    fun <T> ordered(items: List<T>, section: GameOrderSection, idOf: (T) -> String): List<T> {
        val saved = if (canEdit) _prefs.value?.let { if (section == GameOrderSection.DAILIES) it.dailies else it.puzzles } else null
        val ids = GameOrder.apply(items.map(idOf), saved, GameOrder.pinned(section))
        return GameOrder.sortBy(items, ids, idOf)
    }

    /** The id order as the player sees it, for id-only walkers (NEXT, widget). */
    fun orderedIds(defaultIds: List<String>, section: GameOrderSection): List<String> {
        val saved = if (canEdit) _prefs.value?.let { if (section == GameOrderSection.DAILIES) it.dailies else it.puzzles } else null
        return GameOrder.apply(defaultIds, saved, GameOrder.pinned(section))
    }

    /** Live reorder while dragging (persist = false updates the in-memory order only); persist on drop. */
    fun set(section: GameOrderSection, ids: List<String>, persist: Boolean) {
        val cur = _prefs.value ?: GameOrderPrefs()
        val p = if (section == GameOrderSection.DAILIES) cur.copy(dailies = ids) else cur.copy(puzzles = ids)
        val allDefault = GameOrder.isDefault(GameOrder.DEFAULT_DAILIES, p.dailies, GameOrder.PINNED_FIRST_DAILY) &&
            GameOrder.isDefault(GameOrder.DEFAULT_PUZZLES, p.puzzles, null)
        _prefs.value = if (allDefault) null else p
        if (persist) save()
    }

    fun reset(section: GameOrderSection) {
        val cur = _prefs.value ?: GameOrderPrefs()
        val p = if (section == GameOrderSection.DAILIES) cur.copy(dailies = emptyList()) else cur.copy(puzzles = emptyList())
        _prefs.value = if (p.dailies.isEmpty() && p.puzzles.isEmpty()) null else p
        save()
    }

    fun commit() = save()

    private fun save() {
        val snapshot = _prefs.value
        writeLocal(userId, snapshot)
        runCatching { com.wordocious.app.widget.WidgetBridge.update(DailyCompletionsService.readCache()) }   // the widget lists games in the same order
        val uid = userId ?: return
        scope.launch {
            runCatching {
                SupabaseConfig.client.postgrest["profiles"].update({
                    set("game_order", if (snapshot == null) JsonNull else JsonObject(mapOf(
                        "dailies" to JsonArray(snapshot.dailies.map { JsonPrimitive(it) }),
                        "puzzles" to JsonArray(snapshot.puzzles.map { JsonPrimitive(it) }),
                    )))
                }) { filter { eq("id", uid) } }
            }
        }
    }
}
