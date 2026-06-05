package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
    onHelp: () -> Unit = {},
    onSettings: () -> Unit = {},
) {
    val profile by AuthService.profile.collectAsState()
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "WORDOCIOUS",
            fontSize = 20.sp, fontWeight = FontWeight.Black, letterSpacing = 0.5.sp,
            style = TextStyle(brush = WTheme.wordmarkGradient),
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

        CircleIconButton(onClick = onHelp) {
            Icon(Icons.AutoMirrored.Filled.HelpOutline, "Help", tint = WTheme.textMuted, modifier = Modifier.size(17.dp))
        }
        CircleIconButton(onClick = onSettings) {
            Icon(Icons.Filled.Settings, "Settings", tint = WTheme.textMuted, modifier = Modifier.size(17.dp))
        }

        // Daily-streak pill (only if a streak exists)
        val streak = profile?.dailyLoginStreak ?: 0
        if (streak > 0) {
            HeaderPill(
                bg = listOf(Color(0xFFFFFBEB), Color(0xFFFFF7ED)), border = Color(0xFFFDE68A),
            ) {
                Icon(Icons.Filled.LocalFireDepartment, null, tint = Color(0xFFF97316), modifier = Modifier.size(13.dp))
                Text("$streak", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF92400E))
            }
        }
        // Shield pill (always shown when signed in)
        if (profile != null) {
            HeaderPill(
                bg = listOf(WTheme.surfaceHover, WTheme.surfaceHover), border = Color(0xFFC4B5FD),
            ) {
                Icon(painterResource(R.drawable.ic_shield), null, tint = Color(0xFF8B5CF6), modifier = Modifier.size(13.dp))
                Text("${profile?.streakShields ?: 0}", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF5B21B6))
            }
        }
    }
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
private fun HeaderPill(bg: List<Color>, border: Color, content: @Composable () -> Unit) {
    Row(
        modifier = Modifier
            .clip(CircleShape)
            .background(Brush.linearGradient(bg))
            .border(1.5.dp, border, CircleShape)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) { content() }
}
