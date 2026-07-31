package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.collectAsState
import androidx.compose.material.icons.filled.Delete
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.selection.toggleable
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.data.ThemePref
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Settings — 1:1 port of iOS SettingsView / web settings-dialog.tsx.
 * THEME radio cards (live recolor) · Sound · Notifications · Accessibility ·
 * About links · Sign out · Delete account · version. Full-screen with Done.
 */
private val THEMES = listOf(
    Triple("light", "Default", "Classic Wordle colors"),
    Triple("dark", "Dark", "Easy on the eyes"),
    Triple("ocean", "Ocean", "Blue and teal tones"),
    Triple("forest", "Forest", "Green and earth tones"),
)

@Composable
fun SettingsScreen(onDone: () -> Unit, onOpenInfo: (String) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var theme by remember { mutableStateOf(ThemePref.current()) }
    var sound by remember { mutableStateOf(SettingsPref.get(SettingsPref.SOUND, true)) }
    var dailyReminder by remember { mutableStateOf(SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) }
    var colorblind by remember { mutableStateOf(SettingsPref.get(SettingsPref.COLORBLIND, false)) }
    var reducedMotion by remember { mutableStateOf(SettingsPref.get(SettingsPref.REDUCED_MOTION, false)) }
    val context = androidx.compose.ui.platform.LocalContext.current
    // Resolved once: outside a consent region Google's form has nothing to
    // show, so the row would be a dead end rather than a choice.
    val privacyOptionsRequired = remember {
        (context as? android.app.Activity)
            ?.let { com.wordocious.app.data.AdsManager.privacyOptionsRequired(it) } ?: false
    }
    var consentError by remember { mutableStateOf<String?>(null) }
    val isAuthenticated by AuthService.isAuthenticated.collectAsState()
    var reminderDenied by remember { mutableStateOf(false) }
    // Permission launcher for the daily-reminder toggle (API 33+ runtime perm).
    val notifPermLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            com.wordocious.app.data.NotificationService.schedule(context)
        } else {
            // iOS snaps the toggle back off and explains (SettingsView.swift:142).
            dailyReminder = false
            SettingsPref.set(SettingsPref.DAILY_REMINDER, false)
            reminderDenied = true
        }
    }
    // Account deletion flow (Play compliance — web/iOS parity).
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var deleteError by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().background(WTheme.bg)) {
        // Title bar with Done
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("SETTINGS", fontSize = 17.sp, fontWeight = FontWeight.Black, style = androidx.compose.ui.text.TextStyle(brush = WTheme.wordmarkGradient, fontFamily = Nunito))
            Spacer(Modifier.weight(1f))
            Text(
                // Deliberately brand purple, NOT iOS's #007AFF: that blue is a
                // SwiftUI toolbar default rather than a design choice, and system
                // blue reads as foreign chrome on Android.
                "Done", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clickableNoRipple(onDone),
            )
        }

        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            // THEME
            Section("THEME") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    THEMES.forEach { (key, label, desc) ->
                        val active = theme == key
                        Row(
                            modifier = Modifier.fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) WTheme.surfaceHover else WTheme.bg)
                                .border(1.5.dp, if (active) Color(0xFFC4B5FD) else WTheme.border, RoundedCornerShape(12.dp))
                                .clickableNoRipple { ThemePref.set(key); theme = key }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text)
                                Text(desc, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
                            }
                            if (active) Icon(Icons.Filled.CheckCircle, null, tint = WTheme.primary, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }

            // SOUND & FEEDBACK
            Section("SOUND & FEEDBACK") {
                Card {
                    ToggleRow("Sound Effects", "Key taps, win/loss jingles", sound) {
                        sound = it; SettingsPref.set(SettingsPref.SOUND, it)
                    }
                }
            }

            // NOTIFICATIONS
            Section("NOTIFICATIONS") {
                Card {
                    ToggleRow("Daily Reminders", "A nudge to play today's puzzles", dailyReminder) {
                        dailyReminder = it; SettingsPref.set(SettingsPref.DAILY_REMINDER, it)
                        if (it) {
                            // API 33+: ask for POST_NOTIFICATIONS before scheduling.
                            if (android.os.Build.VERSION.SDK_INT >= 33 &&
                                androidx.core.content.ContextCompat.checkSelfPermission(
                                    context, android.Manifest.permission.POST_NOTIFICATIONS,
                                ) != android.content.pm.PackageManager.PERMISSION_GRANTED
                            ) {
                                notifPermLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                            } else if (androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                                com.wordocious.app.data.NotificationService.schedule(context)
                            } else {
                                // Notifications switched off in system settings (or a
                                // previously-denied 33+ perm) — same revert-and-explain as iOS.
                                dailyReminder = false
                                SettingsPref.set(SettingsPref.DAILY_REMINDER, false)
                                reminderDenied = true
                            }
                        } else {
                            com.wordocious.app.data.NotificationService.cancel(context)
                        }
                    }
                }
            }

            // ACCESSIBILITY
            Section("ACCESSIBILITY") {
                Card {
                    ToggleRow("Colorblind Mode", "High contrast colors", colorblind) {
                        colorblind = it; SettingsPref.set(SettingsPref.COLORBLIND, it); WTheme.colorblind = it
                    }
                    Divider()
                    ToggleRow("Reduced Motion", "Minimize animations", reducedMotion) {
                        reducedMotion = it; SettingsPref.set(SettingsPref.REDUCED_MOTION, it); WTheme.reducedMotionPref = it
                    }
                }
            }

            // SUBSCRIPTION — Play's manage-subscriptions page for this app
            // (cancel, change plan, resubscribe). iOS opens Apple's native
            // sheet; this is the Play analogue.
            Section("SUBSCRIPTION") {
                Card {
                    LinkRow("Manage Subscription") {
                        runCatching {
                            context.startActivity(
                                android.content.Intent(
                                    android.content.Intent.ACTION_VIEW,
                                    android.net.Uri.parse(
                                        "https://play.google.com/store/account/subscriptions?package=com.wordocious.app"
                                    ),
                                )
                            )
                        }
                    }
                }
            }

            // ABOUT
            Section("ABOUT") {
                Card {
                    // "About Wordocious" led this card until 2026-08-01 — dropped for
                    // the same reason it left the "?" menu (restated How to Play in
                    // older copy). Section opens with Help & Support, like iOS.
                    LinkRow("Help & Support") { onOpenInfo("support") }; Divider()
                    LinkRow("Privacy Policy") { onOpenInfo("privacy") }; Divider()
                    // Ad-consent withdrawal. UMP requires a PERSISTENT entry
                    // point — a form shown once at first launch is not a
                    // choice the user can revisit, and our own privacy policy
                    // promised one. Hidden outside consent regions, where
                    // Google's form would have nothing to show.
                    if (privacyOptionsRequired) {
                        LinkRow("Ad Privacy Settings") {
                            val activity = context as? android.app.Activity ?: return@LinkRow
                            com.wordocious.app.data.AdsManager.showPrivacyOptions(activity) { err ->
                                if (err != null) consentError = err
                            }
                        }; Divider()
                    }
                    LinkRow("Terms of Service") { onOpenInfo("terms") }
                }
            }

            // Account — hidden for guests, matching SettingsView.swift:104
            // (`if auth.isAuthenticated`); a guest has no session to sign out of
            // and no account to delete.
            if (isAuthenticated) {
                // iOS uses .buttonStyle(.bordered).tint(red) — a soft tinted fill
                // at a fixed 46pt height, not a hard outline.
                Box(
                    modifier = Modifier.fillMaxWidth()
                        .height(46.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFDC2626).copy(alpha = 0.12f))
                        .clickableNoRipple { scope.launch { AuthService.signOut(); onDone() } },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Sign Out", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFDC2626))
                }

                // Quiet outlined card matching the Section cards above (iOS
                // SettingsView.swift:111-122), not a solid-red slab.
                Row(
                    modifier = Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(WTheme.surface)
                        .border(1.5.dp, Color(0xFFFECACA), RoundedCornerShape(14.dp))
                        .clickableNoRipple { if (!deleting) showDeleteConfirm = true }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Delete, null, tint = Color(0xFFDC2626), modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(10.dp))
                    Text("Delete Account", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFDC2626))
                }
            }

            Text(
                "Wordocious · v1.0.0",
                fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
        }
    }

    // Google's privacy form failed to present (offline, or UMP unreachable).
    // Silently swallowing it would leave the user tapping a row that appears
    // to do nothing — the same dead-end the row exists to remove.
    consentError?.let { msg ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { consentError = null },
            title = { Text("Couldn't open ad privacy settings", fontWeight = FontWeight.Black) },
            text = { Text("$msg\n\nCheck your connection and try again.") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { consentError = null }) { Text("OK") }
            },
        )
    }
    if (reminderDenied) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { reminderDenied = false },
            title = { Text("Notifications are off", fontWeight = FontWeight.Black) },
            text = { Text("Enable notifications for Wordocious in Android Settings to get a daily reminder.") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { reminderDenied = false }) { Text("OK") }
            },
        )
    }
    if (showDeleteConfirm) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { if (!deleting) showDeleteConfirm = false },
            title = { Text("Delete your account?", fontWeight = FontWeight.Black) },
            text = {
                Text(
                    "This will permanently delete your profile, stats, streak, medals, " +
                        "achievements, and all game data. This action cannot be undone.",
                )
            },
            confirmButton = {
                androidx.compose.material3.TextButton(
                    enabled = !deleting,
                    onClick = {
                        deleting = true
                        scope.launch {
                            val ok = AuthService.deleteAccount()
                            deleting = false
                            showDeleteConfirm = false
                            if (ok) onDone() else deleteError = true
                        }
                    },
                ) { Text(if (deleting) "Deleting…" else "Delete Forever", color = Color(0xFFDC2626), fontWeight = FontWeight.Black) }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(enabled = !deleting, onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            },
        )
    }
    if (deleteError) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { deleteError = false },
            title = { Text("Couldn't delete account", fontWeight = FontWeight.Black) },
            text = { Text("Please try again or contact support@wordocious.com.") },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { deleteError = false }) { Text("OK") }
            },
        )
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted, letterSpacing = 1.1.sp)
        content()
    }
}

@Composable
private fun Card(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp)),
    ) { content() }
}

@Composable
private fun ToggleRow(title: String, sub: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    // SwiftUI's Toggle makes label + switch one tap target; mirror that here so
    // tapping the title flips the switch (the Switch itself no longer handles it).
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier = Modifier.fillMaxWidth()
            .toggleable(
                value = checked,
                interactionSource = interaction,
                indication = null,
                role = Role.Switch,
                onValueChange = onChange,
            )
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            Text(sub, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted)
        }
        Switch(
            checked = checked, onCheckedChange = null,
            colors = SwitchDefaults.colors(checkedTrackColor = WTheme.primary),
        )
    }
}

@Composable
private fun LinkRow(title: String, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().clickableNoRipple(onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = WTheme.textMuted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
}
