package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.window.Dialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import androidx.compose.foundation.layout.BoxWithConstraints
import com.wordocious.app.ui.theme.WTheme

/**
 * Shared top header for every tab (docs/HEADER_SPEC.md §1; web `app-header.tsx`,
 * iOS `AppHeaderView`). Row 1: the cast title, the ten mascots spelling
 * WORDOCIOUS (it replaces the wordmark and the PRO pill); Pro wears the crown on
 * W over a soft gold glow line, the header's only Pro marker. Row 2: the streak /
 * flawless / shield pills on the left, Sign In (guests) + Help + Settings circles
 * on the right. Must appear on Home/Leaderboard/Stats/Friends.
 */
@Composable
fun AppHeader(
    onNav: (String) -> Unit = {},
    onSettings: () -> Unit = {},
    onSignIn: () -> Unit = {},
) {
    val profile by AuthService.profile.collectAsState()
    val isGuest by AuthService.isGuest.collectAsState()
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 6.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CastTitle(pro = AuthService.isProActive)
        HeaderControlsRow(profile, isGuest, onNav, onSettings, onSignIn)
    }
}

/** Plays the cast title's hop wave once per app session (§1: on first appearance). */
private var castTitleWaved = false

/**
 * §1 row 1: the ten mascots in WORDOCIOUS order, ~36 dp, ~8% overlap, bottoms
 * aligned, centered, tappable to nothing, sized down to fit narrow phones. A
 * one-time hop wave on first appearance (reduce motion: static, via CastRow).
 * Pro: the 3D crown on W (~45% of W's width) and a soft gold glow line beneath.
 */
@Composable
private fun CastTitle(pro: Boolean) {
    val wave = remember { !castTitleWaved.also { castTitleWaved = true } }
    BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
        // n tiles with 8% overlap span size * (n - 0.08 (n - 1)).
        val n = Mascots.cast.size
        val tile = minOf(36.dp, maxWidth / (n - 0.08f * (n - 1)))
        if (pro) {
            // #f59e0b at ~25%, 2 dp, blurred (blur is API 31+; the faded ends carry it below).
            Box(
                Modifier.fillMaxWidth(0.86f).height(2.dp).blur(2.dp, androidx.compose.ui.draw.BlurredEdgeTreatment.Unbounded)
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color.Transparent, Color(0xFFF59E0B).copy(alpha = 0.25f), Color(0xFFF59E0B).copy(alpha = 0.25f), Color.Transparent),
                        ),
                    ),
            )
        }
        CastRow(
            tile,
            Modifier.padding(bottom = if (pro) 3.dp else 0.dp),
            motion = if (wave) MascotMotion.WAVE else MascotMotion.NONE,
            hop = 8.dp, staggerMs = 60, repeats = 1,
            crown = pro, crownWidth = 0.45f,
            gap = -(tile * 0.08f),
        )
    }
}

@Composable
private fun HeaderControlsRow(
    profile: com.wordocious.app.data.Profile?,
    isGuest: Boolean,
    onNav: (String) -> Unit,
    onSettings: () -> Unit,
    onSignIn: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        var menuOpen by remember { mutableStateOf(false) }
        var streakOpen by remember { mutableStateOf(false) }
        var shieldOpen by remember { mutableStateOf(false) }
        var flawlessOpen by remember { mutableStateOf(false) }

        // Pills read AuthService.headerStreak/headerShields, not `profile`
        // directly: the profile row lands a beat after launch, so gating on it
        // made both pills pop in a second late on every cold start. Those fall
        // back to the last known values for exactly that window, and are null
        // on a first launch or after sign-out so nothing is drawn. The popovers
        // still need the real row, so a tap during the window is inert.
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val streak = AuthService.headerStreak ?: 0
            if (streak > 0) {
                HeaderPill(onClick = { if (profile != null) streakOpen = true }) {
                    Icon3D(Icon3DName.FLAME, 20.dp)
                    PillNumber("$streak", HeaderInk.streak)
                }
            }
            // §244: flawless-streak pill — the day-stamped cache written by
            // dailySweepStats(), synchronous like the other header values. Only a
            // live run (>= 2) earns header real estate.
            val flawlessStreak = com.wordocious.app.data.MatchStatsService.cachedFlawlessStreak()
            if (flawlessStreak >= 2) {
                HeaderPill(onClick = { flawlessOpen = true }) {
                    Icon3D(Icon3DName.TROPHY, 20.dp)
                    PillNumber("$flawlessStreak", HeaderInk.trophy)
                }
            }
            // Shield pill (shown once we have a value, cached or live) — tappable, like iOS.
            val shields = AuthService.headerShields
            if (shields != null) {
                HeaderPill(onClick = { if (profile != null) shieldOpen = true }) {
                    Icon3D(Icon3DName.SHIELD, 20.dp)
                    PillNumber("$shields", HeaderInk.shield)
                }
            }

            // Explainer popovers — iOS opens these on pill tap (AppHeaderView
            // streakPopover / shieldPopover). Without them the pills were inert
            // numbers with nothing telling the player what a shield even is.
            val p = profile
            if (streakOpen && p != null) {
                HeaderInfoPopover(onDismiss = { streakOpen = false }) {
                    PopoverTitle(title = "Daily Streak") { Icon3D(Icon3DName.FLAME, 18.dp) }
                    PopoverStatRow("Current", "${p.dailyLoginStreak} ${if (p.dailyLoginStreak == 1) "day" else "days"}")
                    PopoverStatRow("Best", "${p.bestDailyLoginStreak} ${if (p.bestDailyLoginStreak == 1) "day" else "days"}")
                    PopoverDivider()
                    PopoverBody(
                        "Play any daily puzzle each day to keep your streak going. " +
                            "Miss a day and it resets — unless you use a streak shield.",
                    )
                }
            }
            if (flawlessOpen) {
                HeaderInfoPopover(onDismiss = { flawlessOpen = false }) {
                    PopoverTitle(title = "Flawless Streak") { Icon3D(Icon3DName.TROPHY, 18.dp) }
                    PopoverStatRow("Current", "$flawlessStreak ${if (flawlessStreak == 1) "day" else "days"}")
                    PopoverDivider()
                    PopoverBody("Consecutive days winning every Daily Sweep game. Win them all today to keep it alive.")
                }
            }
            if (shieldOpen && p != null) {
                HeaderInfoPopover(onDismiss = { shieldOpen = false }) {
                    PopoverTitle(title = "Streak Shields") { Icon3D(Icon3DName.SHIELD, 18.dp) }
                    PopoverStatRow("Available", "${p.streakShields} ${if (p.streakShields == 1) "shield" else "shields"}")
                    PopoverDivider()
                    PopoverBody(
                        "Shields protect your streak if you miss a day. Earn a free shield every " +
                            "7-day streak milestone. PRO members get 4 shields each billing period.",
                    )
                }
            }
        }

        // Guest — prominent Sign In entry (account tabs also prompt, but Home
        // had none). Opens sign-in as a DISMISSIBLE overlay, matching iOS.
        // This used to call exitGuest(), which flipped the root gate and tore
        // MainScreen down: you lost your tab and your place, and backing out
        // stranded you on the sign-in gate instead of where you started.
        if (isGuest) {
            Text(
                "Sign In", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color.White,
                modifier = Modifier
                    .clip(CircleShape)   // iOS Capsule()
                    .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))))
                    .clickableNoRipple(onSignIn)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }
        HeaderIconButton(Icon3DName.HELP, "Help", onClick = { menuOpen = true })
        if (menuOpen) {
            InfoMenuSheet(onNav = { menuOpen = false; onNav(it) }, onDismiss = { menuOpen = false })
        }
        HeaderIconButton(Icon3DName.GEAR, "Settings", onClick = onSettings)
    }
}

@Composable
private fun PillNumber(text: String, ink: Color) {
    Text(text, fontSize = 15.sp, fontWeight = FontWeight.Black, color = ink, maxLines = 1, style = TextStyle(fontFamily = Nunito))
}

/**
 * The streak/shield explainer bubble. iOS uses a `.popover` anchored to the
 * pill; Compose has no anchored-popover primitive, so this is a small centered
 * dialog with the same 240dp width, padding, and copy.
 */
@Composable
private fun HeaderInfoPopover(onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .width(240.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(14.dp))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content,
        )
    }
}

@Composable
private fun PopoverTitle(title: String, icon: @Composable () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        icon()
        Text(title, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
    }
}

@Composable
private fun PopoverStatRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.weight(1f))
        Text(value, fontSize = 13.sp, fontWeight = FontWeight.Black, color = WTheme.text)
    }
}

@Composable
private fun PopoverDivider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.divider))
}

@Composable
private fun PopoverBody(text: String) {
    Text(text, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = WTheme.textSecondary)
}

/** §1 stat pill: white, radius 999, soft shadow, NO border; 20 dp icon + 15/900 number. */
@Composable
private fun HeaderPill(
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier
            .softWhite()
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(start = 7.dp, end = 10.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) { content() }
}
