package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.window.Dialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.theme.WTheme

/**
 * Shared top header for every tab — 1:1 port of iOS `AppHeaderView` /
 * web `app-header.tsx`. WORDOCIOUS wordmark (gradient) + PRO badge (if Pro) +
 * spacer + Help circle + Settings circle (→ Settings) + daily-streak pill
 * (if streak>0) + shield pill. Must appear on Home/Leaderboard/Profile/Records.
 */
@Composable
fun AppHeader(
    onNav: (String) -> Unit = {},
    onSettings: () -> Unit = {},
    onSignIn: () -> Unit = {},
) {
    val profile by AuthService.profile.collectAsState()
    val isGuest by AuthService.isGuest.collectAsState()
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "WORDOCIOUS",
            fontSize = 20.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
            style = TextStyle(brush = WTheme.wordmarkGradient, fontFamily = Nunito),
            maxLines = 1,
        )
        if (AuthService.isProActive) {
            Text(
                "PRO",
                fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp, color = Color.White,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
        Spacer(Modifier.weight(1f))

        var menuOpen by remember { mutableStateOf(false) }
        var streakOpen by remember { mutableStateOf(false) }
        var shieldOpen by remember { mutableStateOf(false) }
        CircleIconButton(onClick = { menuOpen = true }) {
            // iOS uses the BARE `questionmark` glyph inside the circle chrome.
            // Material's HelpOutline is itself a circled "?", which stacked a
            // second ring inside our circle button.
            Text("?", fontSize = 15.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        }
        if (menuOpen) {
            InfoMenuSheet(onNav = { menuOpen = false; onNav(it) }, onDismiss = { menuOpen = false })
        }
        CircleIconButton(onClick = onSettings) {
            Icon(Icons.Filled.Settings, "Settings", tint = WTheme.textMuted, modifier = Modifier.size(15.dp))
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

        // Daily-streak pill (only if a streak exists) — tappable, like iOS.
        val streak = profile?.dailyLoginStreak ?: 0
        if (streak > 0) {
            HeaderPill(
                bg = listOf(Color(0xFFFFFBEB), Color(0xFFFFF7ED)), border = Color(0xFFFDE68A),
                onClick = { streakOpen = true },
            ) {
                Icon(painterResource(R.drawable.ic_flame), null, tint = Color(0xFFF97316), modifier = Modifier.size(13.dp))
                Text("$streak", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF92400E))
            }
        }
        // Shield pill (always shown when signed in) — tappable, like iOS.
        if (profile != null) {
            HeaderPill(
                bg = listOf(WTheme.surfaceHover, WTheme.surfaceHover), border = Color(0xFFC4B5FD),
                onClick = { shieldOpen = true },
            ) {
                Icon(painterResource(R.drawable.ic_shield), null, tint = Color(0xFF8B5CF6), modifier = Modifier.size(13.dp))
                Text("${profile?.streakShields ?: 0}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF5B21B6))
            }
        }

        // Explainer popovers — iOS opens these on pill tap (AppHeaderView
        // streakPopover / shieldPopover). Without them the pills were inert
        // numbers with nothing telling the player what a shield even is.
        val p = profile
        if (streakOpen && p != null) {
            HeaderInfoPopover(onDismiss = { streakOpen = false }) {
                PopoverTitle(iconTint = Color(0xFFF97316), title = "Daily Streak") {
                    Icon(painterResource(R.drawable.ic_flame), null, tint = Color(0xFFF97316), modifier = Modifier.size(16.dp))
                }
                PopoverStatRow("Current", "${p.dailyLoginStreak} ${if (p.dailyLoginStreak == 1) "day" else "days"}")
                PopoverStatRow("Best", "${p.bestDailyLoginStreak} ${if (p.bestDailyLoginStreak == 1) "day" else "days"}")
                PopoverDivider()
                PopoverBody(
                    "Play any daily puzzle each day to keep your streak going. " +
                        "Miss a day and it resets — unless you use a streak shield.",
                )
            }
        }
        if (shieldOpen && p != null) {
            HeaderInfoPopover(onDismiss = { shieldOpen = false }) {
                PopoverTitle(iconTint = Color(0xFF8B5CF6), title = "Streak Shields") {
                    Icon(painterResource(R.drawable.ic_shield), null, tint = Color(0xFF8B5CF6), modifier = Modifier.size(16.dp))
                }
                PopoverStatRow("Available", "${p.streakShields} ${if (p.streakShields == 1) "shield" else "shields"}")
                PopoverDivider()
                PopoverBody(
                    "Shields protect your streak if you miss a day. Earn a free shield every " +
                        "7-day streak milestone. PRO members get 4 shields each billing period.",
                )
            }
        }
    }
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
private fun PopoverTitle(iconTint: Color, title: String, icon: @Composable () -> Unit) {
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

@Composable
private fun CircleIconButton(onClick: () -> Unit, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(WTheme.surfaceAlt)
            .border(1.5.dp, WTheme.borderAlt, CircleShape)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}

@Composable
private fun HeaderPill(
    bg: List<Color>,
    border: Color,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .background(Brush.linearGradient(bg))
            .border(1.5.dp, border, CircleShape)
            .then(if (onClick != null) Modifier.clickableNoRipple(onClick) else Modifier)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) { content() }
}
