package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.SettingsPref
import com.wordocious.app.R
import com.wordocious.app.data.ThemePref
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Settings — 1:1 port of iOS SettingsView / web settings-dialog.tsx, in the finishing
 * look (FINISH_SPEC G5): the SETTINGS headline (A6), every section a tinted card with
 * its top bar (A1), switches tinted purple, the theme / keyboard choices as tinted
 * tiles with the selected ring, every action a candy button (A8; destructive = pink,
 * quiet = peach) and everything tappable squishing (A9). THEME radio cards (live
 * recolor) · Keyboard · Sound · Notifications (the daily reminder + the Friends push
 * categories, C4b) · Accessibility · Subscription · About · Linked sign-ins · Sign out
 * · Delete account · version. Full-screen with Done.
 */
/** Item 25: themes are data (assets/theme-registry.json), in picker order; keys are the stored Android keys. */
private val THEMES: List<Triple<String, String, String>>
    get() = ThemeKit.entries.map { Triple(com.wordocious.app.data.ThemeChoiceRules.toStored(it.id), it.title, it.subtitle) }

/** Each theme's swatch color for its tile. */
private fun themeAccent(key: String): Color = when (key) {
    "dark" -> Color(0xFF4C1D95)
    "ocean" -> Color(0xFF0EA5E9)
    "forest" -> Color(0xFF16A34A)
    else -> Color(0xFF7C3AED)
}

// Keyboard layouts (§213) — three arrangements of the same keys.
private val KEYBOARD_LAYOUTS = listOf(
    Triple("standard", "Standard", "Enter left, delete right"),
    Triple("flipped", "Flipped", "Delete left, enter right"),
    Triple("michael", "Michael Keyboard", "4 rows, delete + enter on both sides"),
)

/** The Settings sections' accents (A1: each card its own color; the page accent is purple). */
private object SettingsAccent {
    val theme = Color(0xFF7C3AED)
    val keyboard = Color(0xFF2563EB)
    val sound = Color(0xFFF59E0B)
    val notifications = Color(0xFFEC4899)
    val access = Color(0xFF0D9488)
    val subscription = Color(0xFFF59E0B)
    val about = Color(0xFF7C3AED)
    val linked = Color(0xFF2563EB)
    val account = Color(0xFFEC4899)
}

@Composable
fun SettingsScreen(onDone: () -> Unit, onOpenInfo: (String) -> Unit = {}) {
    val scope = rememberCoroutineScope()
    var theme by remember { mutableStateOf(ThemePref.current()) }
    var sound by remember { mutableStateOf(SettingsPref.get(SettingsPref.SOUND, true)) }
    var haptics by remember { mutableStateOf(SettingsPref.get(com.wordocious.app.data.Haptics.PREF, true)) }
    val hapticsView = androidx.compose.ui.platform.LocalView.current
    var dailyReminder by remember { mutableStateOf(SettingsPref.get(SettingsPref.DAILY_REMINDER, false)) }
    var colorblind by remember { mutableStateOf(SettingsPref.get(SettingsPref.COLORBLIND, false)) }
    var reducedMotion by remember { mutableStateOf(SettingsPref.get(SettingsPref.REDUCED_MOTION, false)) }
    val context = androidx.compose.ui.platform.LocalContext.current
    // Resolved once. Always false today: LevelPlay has no consent UI of its
    // own and consent regions never initialize ads (ConsentGate), so the row
    // would be a dead end. Returns true again once the phase-2 CMP lands.
    val privacyOptionsRequired = remember {
        (context as? android.app.Activity)
            ?.let { com.wordocious.app.data.AdsManager.privacyOptionsRequired(it) } ?: false
    }
    var consentError by remember { mutableStateOf<String?>(null) }
    val isAuthenticated by AuthService.isAuthenticated.collectAsState()
    val profile by AuthService.profile.collectAsState()
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
    // BI25: the screen has landed — heavier, below-the-fold pieces compose now.
    var settled by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(Unit) { kotlinx.coroutines.delay(350); settled = true }

    Column(modifier = Modifier.fillMaxSize().pageBackground(PageTint.HOME)) {
        // A3: the controls row — Done is the bare close control (no bubble).
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Spacer(Modifier.weight(1f))
            HeaderBackButton(onDone, close = true, contentDescription = "Done")
        }

        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            // BJ7: 12 between sections (was 18).
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // A6 / N1: the SETTINGS lettering as a calm centered headline (PageHeadline sizes it).
            PageHeadline(TitleArt.SETTINGS, Modifier.fillMaxWidth())

            // AA3: the gold WORDOCIOUS PRO member card (free players: the Go Pro upsell) leads Settings.
            ProSettingsCard()

            // THEME
            Section("THEME", SettingsAccent.theme, icon = R.drawable.set_theme) {
                // Reading the epoch makes a pick (or the season_halloween switch flipping) recompose these rows.
                val epoch = SeasonSkins.epoch
                val calendar = remember(epoch) { SeasonSkins.calendarSeason() }
                val seasonalOn = remember(epoch) { calendar != null && SeasonSkins.current() != null }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Item 24: the Seasonal row leads the list inside a season window.
                    val seasonal = ThemeKit.seasonal(calendar)
                    if (seasonal != null && calendar != null) {
                        val end = com.wordocious.app.data.ThemeChoiceRules.endLabel(calendar)?.let { " \u00B7 until $it" }.orEmpty()
                        ChoiceTile(seasonal.title, seasonal.subtitle + end, Color(0xFFF97316), active = seasonalOn,
                            preview = { SeasonalPreview(seasonal) }) { ThemePref.pick("seasonal"); theme = ThemePref.current() }
                    }
                    THEMES.forEach { (key, label, desc) ->
                        ChoiceTile(label, desc, SettingsAccent.theme, active = !seasonalOn && theme == key,
                            preview = { ThemeWallPreview(com.wordocious.app.data.ThemeChoiceRules.fromStored(key)) }) {
                            ThemePref.pick(com.wordocious.app.data.ThemeChoiceRules.fromStored(key)); theme = key
                        }
                    }
                }
            }

            // KEYBOARD (§213) — layout radio cards, THEME-card twins.
            Section("KEYBOARD", SettingsAccent.keyboard, icon = R.drawable.set_keyboard) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    KEYBOARD_LAYOUTS.forEach { (key, label, desc) ->
                        val active = com.wordocious.app.ui.game.KeyboardLayoutPref.value == key
                        ChoiceTile(label, desc, SettingsAccent.keyboard, active = active, preview = { KeyRowPreview(key) }) { com.wordocious.app.ui.game.KeyboardLayoutPref.value = key }
                    }
                }
            }

            // SOUND & FEEDBACK
            Section("SOUND & FEEDBACK", SettingsAccent.sound, icon = R.drawable.set_sound) {
                ToggleRow("Sound Effects", "Key taps, win/loss jingles", sound) {
                    sound = it; SettingsPref.set(SettingsPref.SOUND, it)
                }
                Divider(SettingsAccent.sound)
                // FINISH_SPEC U: a separate Haptics switch (default on).
                ToggleRow("Haptics", "Taps and buzzes as you play", haptics) {
                    haptics = it; SettingsPref.set(com.wordocious.app.data.Haptics.PREF, it)
                    if (it) com.wordocious.app.data.Haptics.light(hapticsView)
                }
            }

            // NOTIFICATIONS — the daily reminder, then (signed in) the Friends push
            // categories that used to sit behind the Friends header bell (C4b).
            Section("NOTIFICATIONS", SettingsAccent.notifications, icon = R.drawable.set_notifications) {
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
                profile?.let { p ->
                    val push = rememberFriendsPushPrefs(p)
                    Divider(SettingsAccent.notifications)
                    FinishLabel("FRIENDS", Modifier.padding(start = 12.dp, top = 10.dp, bottom = 2.dp), color = darkenInk(SettingsAccent.notifications))
                    PUSH_CATEGORIES.forEachIndexed { i, c ->
                        if (i > 0) Divider(SettingsAccent.notifications)
                        ToggleRow(
                            c.label, c.hint, push.isOn(c.key),
                            dimmed = push.saving == c.key,
                        ) { push.toggle(c.key) }
                    }
                    Text(
                        "Friend requests always come through.", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        color = WTheme.textMuted, fontFamily = Nunito, modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
                    )
                }
            }

            // ACCESSIBILITY
            Section("ACCESSIBILITY", SettingsAccent.access) {
                ToggleRow("Colorblind Mode", "High contrast colors", colorblind) {
                    colorblind = it; SettingsPref.set(SettingsPref.COLORBLIND, it); WTheme.colorblind = it
                }
                Divider(SettingsAccent.access)
                ToggleRow("Reduced Motion", "Minimize animations", reducedMotion) {
                    reducedMotion = it; SettingsPref.set(SettingsPref.REDUCED_MOTION, it); WTheme.reducedMotionPref = it
                }
            }

            // ADMIN (profiles.is_admin only; iOS parity): Season preview — Off (by date) or any registry season
            // (SeasonKit); every screen flips live (SeasonSkins.preview is observable).
            if (profile?.isAdmin == true) {
                Section("ADMIN", SettingsAccent.theme) {
                    val ctx = androidx.compose.ui.platform.LocalContext.current
                    val seasons = remember { SeasonKit.registry(ctx) }
                    // Inset like the tiles' own text (it sat flush on the card's left edge).
                    Text("Season preview", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text,
                        modifier = Modifier.padding(start = 12.dp, top = 8.dp, bottom = 4.dp))
                    ChoiceTile("Off (by date)", "Seasons switch on by the calendar", SettingsAccent.theme, active = SeasonSkins.preview == null,
                        preview = { SeasonPreviewW(null) }) { SeasonSkins.pick(null) }
                    seasons.forEach { s ->
                        ChoiceTile(s.title, "Show the ${s.title} art today (admin preview)", SettingsAccent.theme, active = SeasonSkins.preview == s.id,
                            preview = { SeasonPreviewW(s.id) }) { SeasonSkins.pick(s.id) }
                    }
                }
            }

            // SUBSCRIPTION — Play's manage-subscriptions page for this app
            // (cancel, change plan, resubscribe). iOS opens Apple's native
            // sheet; this is the Play analogue. BJ11: the branded hand-off
            // (what opens + Restore Purchases) comes first, never a cold jump.
            Section("SUBSCRIPTION", SettingsAccent.subscription, padded = true) {
                var manage by remember { mutableStateOf(false) }
                if (manage) ManageSubscriptionHandoff(onDismiss = { manage = false })
                // Item 25: the Pro card: the 3D crown, what opens, and a COMPACT family button (the full-width pill is gone).
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Icon3D(Icon3DName.CROWN, 40.dp)
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text("Wordocious Pro", fontSize = 14.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                        Text(
                            com.wordocious.app.data.SubscriptionCopy.handoff(com.wordocious.app.data.SubscriptionCopy.Store.GOOGLE).line,
                            fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                        )
                    }
                    QuietButton("Manage", onClick = { manage = true }, size = CandySize.SMALL, contentDescription = "Manage Subscription")
                }
            }

            // ABOUT
            Section("ABOUT", SettingsAccent.about) {
                // "About Wordocious" led this card until 2026-08-01 — dropped for
                // the same reason it left the "?" menu (restated How to Play in
                // older copy). Section opens with Help & Support, like iOS.
                LinkRow("Help & Support") { onOpenInfo("support") }; Divider(SettingsAccent.about)
                // Founder 10-07: the app tour is replayed only from here (not from per-game help / How to Play).
                // 2.8 item 23: the family QUIET button (iOS / web parity).
                QuietButton("Replay the app tour", onClick = { Onboarding.replay(); onDone() }, modifier = Modifier.padding(vertical = 6.dp), fill = true); Divider(SettingsAccent.about)
                LinkRow("Privacy Policy") { onOpenInfo("privacy") }; Divider(SettingsAccent.about)
                // Ad-consent withdrawal. GDPR requires a PERSISTENT entry
                // point — a form shown once at first launch is not a
                // choice the user can revisit, and our own privacy policy
                // promised one. Hidden while there is nothing to show
                // (no CMP yet — see AdsManager.privacyOptionsRequired).
                if (privacyOptionsRequired) {
                    LinkRow("Ad Privacy Settings") {
                        val activity = context as? android.app.Activity ?: return@LinkRow
                        com.wordocious.app.data.AdsManager.showPrivacyOptions(activity) { err ->
                            if (err != null) consentError = err
                        }
                    }; Divider(SettingsAccent.about)
                }
                LinkRow("Terms of Service") { onOpenInfo("terms") }
            }

            // Account — hidden for guests, matching SettingsView.swift:104
            // (`if auth.isAuthenticated`); a guest has no session to sign out of
            // and no account to delete.
            if (isAuthenticated) {
                // BI25: composed after the screen lands (its identity load stays off the tap frame); below the fold.
                if (settled) LinkedSignIns()

                Section("ACCOUNT", SettingsAccent.account, padded = true, icon = R.drawable.set_account) {
                    // Item 25: Sign out is the family quiet button; Delete account is a small calm link at the very bottom.
                    QuietButton("Sign Out", onClick = { scope.launch { AuthService.signOut(); onDone() } }, fill = true)
                }
            }

            // The footer: U with a cup of tea (A7: the page host is R), then the version.
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                CastPose(MascotId.U, "tea", 68.dp)
                Text(
                    "Wordocious · v${com.wordocious.app.BuildConfig.VERSION_NAME} (${com.wordocious.app.BuildConfig.VERSION_CODE})",
                    fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (isAuthenticated) {
                // Delete Account (Play compliance): a small, calm link at the very bottom; the designed confirm sheet below is unchanged.
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    TextLink(if (deleting) "Deleting\u2026" else "Delete account", onClick = { if (!deleting) showDeleteConfirm = true }, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    // Google's privacy form failed to present (offline, or UMP unreachable).
    // Silently swallowing it would leave the user tapping a row that appears
    // to do nothing — the same dead-end the row exists to remove.
    consentError?.let { msg ->
        SettingsDialog(
            title = "Couldn't open ad privacy settings",
            text = "$msg\n\nCheck your connection and try again.",
            onDismiss = { consentError = null },
            confirm = { CandyButton("OK", onClick = { consentError = null }, size = CandySize.MEDIUM) },
        )
    }
    if (reminderDenied) {
        SettingsDialog(
            title = "Notifications are off",
            text = "Enable notifications for Wordocious in Android Settings to get a daily reminder.",
            onDismiss = { reminderDenied = false },
            confirm = { CandyButton("OK", onClick = { reminderDenied = false }, size = CandySize.MEDIUM) },
        )
    }
    if (showDeleteConfirm) {
        SettingsDialog(
            title = "Delete your account?",
            text = "This will permanently delete your profile, stats, streak, medals, " +
                "achievements, and all game data. This action cannot be undone.",
            accent = SettingsAccent.account,
            onDismiss = { if (!deleting) showDeleteConfirm = false },
            confirm = {
                CandyButton(
                    if (deleting) "Deleting…" else "Delete Forever",
                    onClick = {
                        deleting = true
                        scope.launch {
                            val ok = AuthService.deleteAccount()
                            deleting = false
                            showDeleteConfirm = false
                            if (ok) onDone() else deleteError = true
                        }
                    },
                    color = CandyColor.PINK, size = CandySize.MEDIUM, enabled = !deleting,
                )
            },
            dismiss = {
                CandyButton("Cancel", onClick = { showDeleteConfirm = false }, color = CandyColor.PEACH, size = CandySize.MEDIUM, enabled = !deleting)
            },
        )
    }
    if (deleteError) {
        SettingsDialog(
            title = "Couldn't delete account",
            text = "Please try again or contact support@wordocious.com.",
            onDismiss = { deleteError = false },
            confirm = { CandyButton("OK", onClick = { deleteError = false }, size = CandySize.MEDIUM) },
        )
    }
}

/**
 * Settings › Linked sign-ins (founder, 2026-09-30; web linked-sign-ins.tsx parity). Lists the
 * sign-ins on this account and links Google onto it (supabase-kt manual linking, browser round
 * trip), so a later sign-in with it opens this same account. Apple can only be linked from the
 * iOS app (the Supabase Apple provider is native-iOS only). Unlink only while >1 sign-in remains.
 */
@Composable
private fun LinkedSignIns() {
    val scope = rememberCoroutineScope()
    val identities by AuthService.identities.collectAsState()
    val notice by AuthService.linkNotice.collectAsState()
    var loadError by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf<String?>(null) }
    var localNotice by remember { mutableStateOf<AuthService.LinkNotice?>(null) }
    var confirmUnlink by remember { mutableStateOf<AuthService.LinkedIdentity?>(null) }
    androidx.compose.runtime.LaunchedEffect(Unit) { loadError = !AuthService.loadIdentities() }
    androidx.compose.runtime.DisposableEffect(Unit) { onDispose { AuthService.clearLinkNotice() } }

    val list = identities
    val linked = list.orEmpty().map { it.provider }.toSet()
    val unlinkable = list != null && com.wordocious.app.data.IdentityLinking.canUnlink(list.size)
    val shown = localNotice ?: notice
    val accent = SettingsAccent.linked
    Section("LINKED SIGN-INS", accent) {
        Text(
            "Link Google so it opens this same account on any device.",
            fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted,
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 10.dp),
        )
        when {
            loadError && list == null -> Text(
                "Couldn’t load your sign-ins. Close Settings and try again.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626), modifier = Modifier.padding(12.dp),
            )
            list == null -> Text("Loading…", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.padding(12.dp))
            else -> {
                list.forEachIndexed { i, identity ->
                    if (i > 0) Divider(accent)
                    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(com.wordocious.app.data.IdentityLinking.providerLabel(identity.provider), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
                                Spacer(Modifier.width(6.dp))
                                Icon(Icons.Filled.CheckCircle, contentDescription = "Linked", tint = Color(0xFF16A34A), modifier = Modifier.size(14.dp))
                            }
                            identity.email?.let { email ->
                                Text(
                                    if (com.wordocious.app.data.IdentityLinking.isHideMyEmail(email)) "Hide My Email" else email,
                                    fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted, maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                        if (unlinkable) {
                            CandyButton(
                                if (busy == identity.identityId) "Unlinking…" else "Unlink",
                                onClick = { if (busy == null) confirmUnlink = identity },
                                color = CandyColor.PEACH, size = CandySize.SMALL,
                                contentDescription = "Unlink ${com.wordocious.app.data.IdentityLinking.providerLabel(identity.provider)}",
                            )
                        }
                    }
                }
                com.wordocious.app.data.IdentityLinking.LINKABLE.filter { it !in linked }.forEach { provider ->
                    if (list.isNotEmpty()) Divider(accent)
                    val label = com.wordocious.app.data.IdentityLinking.providerLabel(provider)
                    CandyButton(
                        if (busy == provider) "Opening…" else "Link $label",
                        onClick = {
                            if (busy != null) return@CandyButton
                            busy = provider
                            localNotice = null
                            scope.launch {
                                AuthService.linkGoogle()?.let { localNotice = AuthService.LinkNotice(false, it) }
                                busy = null
                            }
                        },
                        color = CandyColor.PURPLE, size = CandySize.MEDIUM,
                        modifier = Modifier.fillMaxWidth().padding(12.dp), fill = true,
                    )
                }
            }
        }
        if (list != null && "apple" !in linked) {
            Text(
                "To add Apple, use Settings → Linked sign-ins in the Wordocious iOS app.",
                fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted,
                modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
            )
        }
        shown?.let {
            Text(
                it.text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (it.ok) Color(0xFF16A34A) else Color(0xFFDC2626),
                modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
            )
        }
    }

    confirmUnlink?.let { identity ->
        val label = com.wordocious.app.data.IdentityLinking.providerLabel(identity.provider)
        SettingsDialog(
            title = "Unlink $label?",
            text = "You won’t be able to sign in to this account with $label anymore. Your stats and Pro stay put.",
            accent = SettingsAccent.linked,
            onDismiss = { confirmUnlink = null },
            confirm = {
                CandyButton("Unlink", onClick = {
                    confirmUnlink = null
                    busy = identity.identityId
                    localNotice = null
                    AuthService.clearLinkNotice()
                    scope.launch {
                        val err = AuthService.unlinkIdentity(identity)
                        localNotice = AuthService.LinkNotice(err == null, err ?: "$label unlinked.")
                        busy = null
                    }
                }, color = CandyColor.PINK, size = CandySize.MEDIUM)
            },
            dismiss = { CandyButton("Keep it", onClick = { confirmUnlink = null }, color = CandyColor.PEACH, size = CandySize.MEDIUM) },
        )
    }
}

/**
 * A1 a Settings section: the caps label (FinishLabel in the section's ink) over a
 * tinted card in [accent] with its top bar. [padded] = the card pads its content
 * (buttons); otherwise rows run to the card's edges.
 */
@Composable
private fun Section(title: String, accent: Color, padded: Boolean = false, @androidx.annotation.DrawableRes icon: Int? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        // Item 25: the section title is bubble lettering in the section's cast color with its soft 3D row icon.
        Row(Modifier.padding(start = 4.dp).heightIn(min = 30.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (icon != null) androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(icon), null, Modifier.size(28.dp))
            BubbleText(title.lowercase().replaceFirstChar { it.uppercase() }, accentPalette(accent), Modifier.weight(1f), maxSize = 18, minSize = 13,
                align = androidx.compose.ui.text.style.TextAlign.Start)
        }
        TintedCard(
            accent, Modifier.fillMaxWidth(), corner = 18.dp, barHeight = 6.dp,
            contentPadding = if (padded) PaddingValues(12.dp) else PaddingValues(0.dp),
            verticalArrangement = Arrangement.spacedBy(if (padded) 8.dp else 0.dp),
            content = content,
        )
    }
}

/**
 * BI25: a THEME / KEYBOARD choice as a soft filled tile — unselected a pale wash of the
 * section's color (no stroke); selected a glossy filled tile in that color with white
 * text and a small white check badge; a live [preview] on the right. The selected face
 * cross-fades (alpha only); the press squishes (A9).
 */
/** The Season preview tile's preview: the season's W skin (or the hero W). */
@Composable
private fun SeasonPreviewW(season: String?) {
    androidx.compose.foundation.Image(
        androidx.compose.ui.res.painterResource(SeasonSkins.fullRes(MascotId.W, season)), null,
        Modifier.size(34.dp),
    )
}

@Composable
private fun ChoiceTile(
    label: String, desc: String, accent: Color, active: Boolean,
    preview: @Composable () -> Unit = {}, onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    val face by androidx.compose.animation.core.animateFloatAsState(if (active) 1f else 0f, androidx.compose.animation.core.tween(180), label = "choice")
    val glossy = androidx.compose.ui.graphics.Brush.verticalGradient(
        listOf(androidx.compose.ui.graphics.lerp(accent, Color.White, 0.22f), accent, androidx.compose.ui.graphics.lerp(accent, Color.Black, 0.12f)),
    )
    val sheen = androidx.compose.ui.graphics.Brush.verticalGradient(0f to Color.White.copy(alpha = 0.32f), 0.5f to Color.Transparent)
    Box(
        Modifier.fillMaxWidth()
            .squishClickable(label = "$label, $desc" + if (active) ", selected" else "", role = Role.RadioButton, onClick = onClick),
    ) {
        Box(Modifier.matchParentSize().clip(shape).background(if (WTheme.isDark) accent.copy(alpha = 0.16f) else Wash.mix(accent, 0.11f)))
        Box(Modifier.matchParentSize().alpha(face).clip(shape).background(glossy).background(sheen))
        Row(
            Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(label, fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = if (active) Color.White else WTheme.text)
                Text(desc, fontSize = 11.sp, fontWeight = FontWeight.Bold, fontFamily = Nunito, color = if (active) Color.White.copy(alpha = 0.88f) else WTheme.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            preview()
            Box(Modifier.size(20.dp).alpha(face).clip(CircleShape).background(Color.White), contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.Check, null, tint = accent, modifier = Modifier.size(13.dp))
            }
        }
    }
}

/** BI25: four mini glossy letter tiles in the theme's colors on its page wash (SettingsPreviews). */
@Composable
private fun ThemeTilesPreview(theme: String) {
    val spec = com.wordocious.app.data.SettingsPreviews.theme(theme)
    Row(
        Modifier.clip(RoundedCornerShape(7.dp)).background(Color(0xFF000000 or spec.page.toLong())).padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        spec.tiles.forEach { t ->
            val c = Color(0xFF000000 or t.hex.toLong())
            Box(
                Modifier.size(15.dp).clip(RoundedCornerShape(3.5.dp))
                    .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(androidx.compose.ui.graphics.lerp(c, Color.White, 0.25f), c)))
                    .background(androidx.compose.ui.graphics.Brush.verticalGradient(0f to Color.White.copy(alpha = 0.35f), 0.5f to Color.Transparent)),
                contentAlignment = Alignment.Center,
            ) {
                Text(t.letter, fontSize = 9.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = Color.White)
            }
        }
    }
}

/** BI25: a mini key row showing where Enter and Delete sit for a keyboard layout. */
@Composable
private fun KeyRowPreview(layout: String) {
    val sp = com.wordocious.app.data.SettingsPreviews
    Column(
        Modifier.clip(RoundedCornerShape(7.dp)).background(Color.White.copy(alpha = if (WTheme.isDark) 0.12f else 0.55f)).padding(4.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        sp.keyRows(layout).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                row.forEach { key ->
                    val special = key == sp.ENTER || key == sp.DELETE
                    val w = if (special) 15.dp else if (key == sp.SPACE) 26.dp else 8.dp
                    Box(
                        Modifier.width(w).height(11.dp).clip(RoundedCornerShape(2.5.dp))
                            .background(if (special) Color(0xFFF59E0B) else Color.White),
                        contentAlignment = Alignment.Center,
                    ) {
                        when (key) {
                            sp.ENTER -> Icon(Icons.AutoMirrored.Filled.KeyboardReturn, null, tint = Color.White, modifier = Modifier.size(8.dp))
                            // The real keyboard's chunky backspace glyph (KeyboardView).
                            sp.DELETE -> com.wordocious.app.ui.game.ChunkyBackspace(10.dp)
                            sp.SPACE -> {}
                            else -> Text(key, fontSize = 6.sp, fontWeight = FontWeight.Black, fontFamily = Nunito, color = Color(0xFF3B1A78))
                        }
                    }
                }
            }
        }
    }
}

/** The purple-tinted switch (G5). */
@Composable
private fun settingsSwitchColors() = SwitchDefaults.colors(
    checkedTrackColor = Color(0xFF7C3AED),
    checkedThumbColor = Color.White,
    checkedBorderColor = Color(0xFF6D28D9),
    uncheckedTrackColor = accentWash(Color(0xFF7C3AED), 0.16f),
    uncheckedBorderColor = accentLine(Color(0xFF7C3AED), 0.45f),
    uncheckedThumbColor = Color(0xFFA78BFA),
)

@Composable
private fun ToggleRow(title: String, sub: String, checked: Boolean, dimmed: Boolean = false, onChange: (Boolean) -> Unit) {
    // SwiftUI's Toggle makes label + switch one tap target; mirror that here so
    // tapping the title flips the switch (the Switch itself no longer handles it).
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier = Modifier.fillMaxWidth()
            .pressSquish(interaction)
            .toggleable(
                value = checked,
                interactionSource = interaction,
                indication = null,
                role = Role.Switch,
                onValueChange = onChange,
            )
            .alpha(if (dimmed) 0.5f else 1f)
            .heightIn(min = 44.dp)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text)
            Text(sub, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = WTheme.textMuted)
        }
        // The candy on/off switch (night art 10-03 sprites); the row owns the Switch role + tap.
        CandySwitch(checked)
    }
}

@Composable
private fun LinkRow(title: String, onClick: () -> Unit = {}) {
    Row(
        modifier = Modifier.fillMaxWidth().squishClickable(label = title, role = Role.Button, onClick = onClick).heightIn(min = 44.dp).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = WTheme.text, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun Divider(accent: Color) {
    Box(Modifier.fillMaxWidth().height(1.dp).background(accentLine(accent, 0.24f)))
}

/** A8 a Settings dialog: a tinted container (A1) with candy buttons. */
@Composable
private fun SettingsDialog(
    title: String,
    text: String,
    onDismiss: () -> Unit,
    accent: Color = Color(0xFF7C3AED),
    confirm: @Composable () -> Unit,
    dismiss: (@Composable () -> Unit)? = null,
) {
    AlertDialog(
        modifier = com.wordocious.app.ui.PopupWidth, // FINISH_SPEC AG: popups cap at ~440 dp
        onDismissRequest = onDismiss,
        containerColor = accentWash(accent, 0.10f),
        title = { Text(title, fontWeight = FontWeight.Black, color = WTheme.text) },
        text = { Text(text, fontWeight = FontWeight.SemiBold, color = WTheme.textSecondary) },
        confirmButton = confirm,
        dismissButton = dismiss,
    )
}

/** Item 25: a section's bubble-lettering palette from its cast accent. */
private fun accentPalette(accent: Color): HeadlinePalette = HeadlinePalette(
    top = androidx.compose.ui.graphics.lerp(accent, Color.White, 0.4f), bottom = accent,
    deep = androidx.compose.ui.graphics.lerp(accent, Color.Black, 0.5f),
    nameTop = androidx.compose.ui.graphics.lerp(accent, Color.White, 0.4f), nameBottom = accent,
)

/** Item 25: a theme row's REAL mini preview: its wall (registry stops + glow) with a small card of four tiles. */
@Composable
private fun ThemeWallPreview(themeId: String) {
    val look = ThemeKit.look(themeId, themeId == "dark")
    val spec = com.wordocious.app.data.SettingsPreviews.theme(com.wordocious.app.data.ThemeChoiceRules.toStored(themeId))
    Box(
        Modifier.size(74.dp, 46.dp).clip(RoundedCornerShape(10.dp)).background(
            Brush.verticalGradient(look?.wallColors() ?: listOf(Color.LightGray, Color.White)),
        ),
        contentAlignment = Alignment.BottomCenter,
    ) {
        Row(
            Modifier.padding(bottom = 6.dp).clip(RoundedCornerShape(7.dp)).background(look?.card?.let(ThemeKit::color) ?: Color.White).padding(horizontal = 6.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            spec.tiles.forEach { t ->
                Box(Modifier.size(13.dp).clip(RoundedCornerShape(3.5.dp)).background(Color(t.hex or 0xFF000000.toInt())), contentAlignment = Alignment.Center) {
                    Text(t.letter, fontSize = 8.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }
    }
}

/** Item 24: the Seasonal row's preview: the season's wall with W-O-R-D tiles in its colors. */
@Composable
private fun SeasonalPreview(entry: ThemeKit.Seasonal) {
    Box(
        Modifier.size(74.dp, 46.dp).clip(RoundedCornerShape(10.dp)).background(Brush.verticalGradient(entry.previewWall.map(ThemeKit::color))),
        contentAlignment = Alignment.Center,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            entry.previewTiles.forEach { t ->
                val dark = t.color.equals("#1F1030", ignoreCase = true)
                Box(Modifier.size(14.dp).clip(RoundedCornerShape(3.5.dp)).background(ThemeKit.color(t.color)), contentAlignment = Alignment.Center) {
                    Text(t.letter, fontSize = 8.5.sp, fontWeight = FontWeight.Black, color = if (dark) Color(0xFFF97316) else Color.White)
                }
            }
        }
    }
}
