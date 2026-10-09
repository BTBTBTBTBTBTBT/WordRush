package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable

/**
 * The player's owned mascot items: the owned_items ledger through the my_owned_items view (RLS: your own active rows;
 * supabase/manual-migrations/20261009000005_owned_items.sql). Keys are access-table keys ("head:crown"). An owned part
 * saves without Pro (core AvatarAccess.keepOwned / partAccess). Empty when signed out, offline, or before the SQL is
 * applied. Written only by the server (admin grants, earns, purchases): the app only reads.
 */
object OwnedItems {
    @Serializable
    private data class Row(val item_key: String)

    private val _keys = MutableStateFlow<List<String>>(emptyList())
    val keys: StateFlow<List<String>> = _keys.asStateFlow()

    /** Reload the ledger (no-throw; keeps the last good list on failure). */
    suspend fun load() {
        if (AuthService.userId == null) { _keys.value = emptyList(); return }
        runCatching {
            SupabaseConfig.client.postgrest["my_owned_items"].select().decodeList<Row>().map { it.item_key }
        }.onSuccess { _keys.value = it }
    }
}
