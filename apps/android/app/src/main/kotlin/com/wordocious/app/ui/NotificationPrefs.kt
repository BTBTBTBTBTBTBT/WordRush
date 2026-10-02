package com.wordocious.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.Profile
import com.wordocious.app.data.SupabaseConfig
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

// Per-event notification preferences for the Friends pushes (§294, Friends
// D3.5) — Android twin of web components/friends/notification-prefs.tsx. Shown
// in Settings › Notifications (FINISH_SPEC C4b; the Friends header bell is gone).
// Stored in profiles.notification_prefs (jsonb; a missing key means ON) and
// honored server-side by lib/push/broadcast.ts for every friends push that
// names a category. Friend requests always arrive — not a category here.

/** The four push categories — keys, labels and hints MUST mirror the web PUSH_CATEGORIES. */
data class PushCategory(val key: String, val label: String, val hint: String)

val PUSH_CATEGORIES = listOf(
    PushCategory("race", "Race finish & overtakes", "Monday's recap and when a friend passes you"),
    PushCategory("challenge", "Challenges & games", "VS challenges, and your turn in a quick game"),
    PushCategory("nudge", "Nudges & taunts", "The canned one-liners"),
    PushCategory("feed", "Moments", "Reactions, shield gifts and other circle moments"),
)

/**
 * The Friends push toggles' state (FINISH_SPEC C4b: they live in Settings ›
 * Notifications now; the Friends header bell is gone). An optimistic local copy:
 * a switch flips at once and the profile refresh confirms it (and reseeds this state
 * when a new profile lands). One write at a time ([saving] = the key in flight).
 */
class FriendsPushPrefs internal constructor(
    private val profileId: String,
    initial: Map<String, Boolean>,
    private val scope: kotlinx.coroutines.CoroutineScope,
) {
    var prefs by mutableStateOf(initial)
        private set
    var saving by mutableStateOf<String?>(null)
        private set

    /** A missing key means ON. */
    fun isOn(key: String): Boolean = prefs[key] != false

    fun toggle(key: String) {
        if (saving != null) return
        saving = key
        val next = prefs + (key to (prefs[key] == false))
        prefs = next
        scope.launch {
            try {
                runCatching {
                    SupabaseConfig.client.postgrest["profiles"].update({
                        set("notification_prefs", buildJsonObject { next.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
                    }) { filter { eq("id", profileId) } }
                }
                AuthService.refreshProfile()
            } finally { saving = null }
        }
    }
}

/** [FriendsPushPrefs] for [profile], reseeded whenever its stored prefs change. */
@Composable
fun rememberFriendsPushPrefs(profile: Profile): FriendsPushPrefs {
    val scope = rememberCoroutineScope()
    return remember(profile.id, profile.notificationPrefs) {
        FriendsPushPrefs(profile.id, profile.notificationPrefs ?: emptyMap(), scope)
    }
}

/**
 * Write one opt-in into profiles.notification_prefs, merged into the existing
 * object exactly like the dialog's toggles do, then refresh the profile. Used
 * by the live search's "Ping me when someone's looking" switch (VS overhaul
 * §13; `vsLooking` — a missing key there means OFF).
 */
suspend fun saveNotificationPref(profile: Profile, key: String, value: Boolean) {
    val next = (profile.notificationPrefs ?: emptyMap()) + (key to value)
    runCatching {
        SupabaseConfig.client.postgrest["profiles"].update({
            set("notification_prefs", buildJsonObject { next.forEach { (k, v) -> put(k, JsonPrimitive(v)) } })
        }) { filter { eq("id", profile.id) } }
    }
    AuthService.refreshProfile()
}
