package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.Profile
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

// Per-event notification preferences for the Friends pushes (§294, Friends
// D3.5) — Android twin of web components/friends/notification-prefs.tsx.
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

private val PREFS_PURPLE = Color(0xFF7C3AED)

/**
 * The bell in the FRIENDS card header: NotificationsOff when any category is
 * turned off, Notifications otherwise. Tap → the prefs dialog. Nothing when
 * there is no profile (signed out).
 */
@Composable
fun NotificationPrefsButton(profile: Profile?) {
    if (profile == null) return
    var open by remember { mutableStateOf(false) }
    val prefs = profile.notificationPrefs ?: emptyMap()
    val anyOff = PUSH_CATEGORIES.any { prefs[it.key] == false }
    // A header action: the shared white circle (HEADER_SPEC §4).
    HeaderCircle(onClick = { open = true }, contentDescription = "Friends notification settings") {
        Icon(
            if (anyOff) Icons.Filled.NotificationsOff else Icons.Filled.Notifications,
            null,
            tint = if (anyOff) WTheme.textMuted else PREFS_PURPLE,
            modifier = Modifier.size(19.dp),
        )
    }
    if (open) NotificationPrefsDialog(profile = profile, onDismiss = { open = false })
}

@Composable
private fun NotificationPrefsDialog(profile: Profile, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    // Optimistic local copy: the switch flips at once; the profile refresh
    // confirms it (and reseeds this state when a new profile lands).
    var prefs by remember(profile.notificationPrefs) { mutableStateOf(profile.notificationPrefs ?: emptyMap()) }
    var saving by remember { mutableStateOf<String?>(null) }

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
                    }) { filter { eq("id", profile.id) } }
                }
                AuthService.refreshProfile()
            } finally { saving = null }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = WTheme.surface,
        title = {
            Text(
                "FRIENDS NOTIFICATIONS", fontSize = 11.sp, fontWeight = FontWeight.Black,
                letterSpacing = 0.8.sp, color = WTheme.textMuted, fontFamily = Nunito,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PUSH_CATEGORIES.forEach { c ->
                    val on = prefs[c.key] != false
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                            .alpha(if (saving == c.key) 0.5f else 1f)
                            .clickableNoRipple { toggle(c.key) },
                    ) {
                        Switch(
                            checked = on, onCheckedChange = { toggle(c.key) },
                            colors = SwitchDefaults.colors(checkedTrackColor = PREFS_PURPLE),
                        )
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            Text(
                                c.label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold,
                                color = WTheme.text, fontFamily = Nunito,
                            )
                            Text(
                                c.hint, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                                color = WTheme.textMuted, fontFamily = Nunito,
                                maxLines = 1, overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
                Text(
                    "Friend requests always come through.", fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    color = WTheme.textMuted, fontFamily = Nunito, modifier = Modifier.padding(top = 2.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Done", fontWeight = FontWeight.Black, color = PREFS_PURPLE, fontFamily = Nunito)
            }
        },
    )
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
