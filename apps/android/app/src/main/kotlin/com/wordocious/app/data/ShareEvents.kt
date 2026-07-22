package com.wordocious.app.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Share-event instrumentation (distribution memo: "measure share rate per
 * completed game from day one"). Fire-and-forget insert into `share_events`
 * (manual-migration 20260722000001) — guests log with user_id null (anon
 * policy allows it), signed-in users as themselves. Never throws, never
 * blocks the share UX. Mirrors apps/web/lib/share-events.ts.
 *
 * Log when the user TAPS share, not on render.
 */
object ShareEvents {
    private val scope = CoroutineScope(Dispatchers.IO)

    @Serializable
    private data class Insert(
        @SerialName("user_id") val userId: String?,
        val platform: String,
        @SerialName("game_mode") val gameMode: String,
        val kind: String,
        val surface: String,
    )

    /**
     * @param kind one of 'text' | 'image' | 'link_invite' | 'other' (DB check)
     * @param gameMode lowercased engine-mode name, or "" when not applicable
     * @param surface where the tap happened, e.g. "post_game", "daily_sweep"
     */
    fun log(kind: String, gameMode: String, surface: String) {
        val uid = AuthService.userId // capture on the caller's thread
        scope.launch {
            runCatching {
                SupabaseConfig.client.postgrest["share_events"].insert(
                    Insert(
                        userId = uid,
                        platform = "android",
                        gameMode = gameMode.take(32),
                        kind = kind,
                        surface = surface.take(32),
                    ),
                )
            } // analytics must never break sharing
        }
    }
}
