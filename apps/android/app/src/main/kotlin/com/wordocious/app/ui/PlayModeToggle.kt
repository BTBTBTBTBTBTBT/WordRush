package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AllInclusive
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

enum class PlayMode { DAILY, UNLIMITED }

/**
 * Pro-only pill at the top of Home (web PlayModeToggle). Flips the whole home
 * screen into Unlimited: mode cards route to fresh-seeded (non-daily) puzzles,
 * the Daily hero swaps to UnlimitedHero, and cards never show the daily-limit
 * lock (Pro bypasses caps; the seed difference lands a new puzzle each tap).
 */
@Composable
fun PlayModeToggle(value: PlayMode, onChange: (PlayMode) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(50)).padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        TogglePill("Daily", Icons.Filled.Star, value == PlayMode.DAILY, Modifier.weight(1f)) { onChange(PlayMode.DAILY) }
        TogglePill("Unlimited", Icons.Filled.AllInclusive, value == PlayMode.UNLIMITED, Modifier.weight(1f)) { onChange(PlayMode.UNLIMITED) }
    }
}

@Composable
private fun TogglePill(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Row(
        modifier.clip(RoundedCornerShape(50)).background(if (active) WTheme.surface else Color.Transparent)
            .clickableNoRipple(onClick).padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (active) Color(0xFF7C3AED) else WTheme.textMuted, modifier = Modifier.size(14.dp))
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = if (active) Color(0xFF7C3AED) else WTheme.textMuted, modifier = Modifier.padding(start = 4.dp))
    }
}

/** Static hero shown under the toggle in Unlimited mode (web UnlimitedHero).
 *  Fixed HERO_HEIGHT == DailyHero so toggling never shifts the cards below. */
@Composable
fun UnlimitedHero() {
    Column(
        Modifier.fillMaxWidth().height(HERO_HEIGHT).clip(RoundedCornerShape(14.dp))
            .background(Brush.linearGradient(listOf(Color(0xFFFCE7F3), Color(0xFFEDE9FE))))
            .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(14.dp)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.AllInclusive, null, tint = Color(0xFF7C3AED), modifier = Modifier.size(20.dp))
            Text("Unlimited Play", fontSize = 18.sp, fontWeight = FontWeight.Black,
                style = TextStyle(brush = Brush.linearGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899)))))
            Icon(Icons.Filled.AllInclusive, null, tint = Color(0xFFEC4899), modifier = Modifier.size(20.dp))
        }
        Text("Infinite puzzles · All stats count", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED), modifier = Modifier.padding(top = 2.dp))
    }
}
