package com.wordocious.app.ui

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme

/**
 * Daily-limit modal — ports the web ModeLimitModal. Shown when a FREE user taps
 * a mode they've already played today: lock glyph, "{mode} — Played Today",
 * upsell copy, a live "play again tomorrow" countdown, Upgrade to Pro, and an
 * optional "View Solved Puzzle" link.
 */
@Composable
fun ModeLimitModal(
    modeName: String,
    onClose: () -> Unit,
    onGoPro: () -> Unit,
    onViewPuzzle: (() -> Unit)? = null,
) {
    val secs by produceState(initialValue = secondsUntilLocalMidnightLimit()) {
        while (true) { value = secondsUntilLocalMidnightLimit(); kotlinx.coroutines.delay(1000) }
    }
    val countdown = "%02d:%02d:%02d".format(secs / 3600, (secs % 3600) / 60, secs % 60)

    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)).clickableNoRipple(onClose).padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.widthIn(max = 360.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface).clickableNoRipple {}.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(Icons.Filled.Lock, null, tint = WTheme.textMuted, modifier = Modifier.size(48.dp))
            Spacer(Modifier.height(12.dp))
            Text("$modeName — Played Today", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text, textAlign = TextAlign.Center)
            Spacer(Modifier.height(4.dp))
            Text(
                "You've used your free play of $modeName for today. Upgrade to Pro for unlimited replays and ad-free gameplay across all 9 modes.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            Box(
                Modifier.clip(RoundedCornerShape(10.dp)).background(WTheme.surfaceHover).border(1.dp, WTheme.border, RoundedCornerShape(10.dp)).padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                Text("Play again tomorrow in $countdown", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED))
            }
            Spacer(Modifier.height(16.dp))
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                    .clickableNoRipple { onClose(); onGoPro() }.padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(androidx.compose.ui.res.painterResource(R.drawable.ic_crown), null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(Modifier.size(6.dp))
                Text("Upgrade to Pro", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
            Spacer(Modifier.height(12.dp))
            if (onViewPuzzle != null) {
                Text("View Solved Puzzle", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7C3AED), modifier = Modifier.clickableNoRipple { onClose(); onViewPuzzle() })
            } else {
                Text("Come back tomorrow", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, modifier = Modifier.clickableNoRipple(onClose))
            }
        }
    }
}

private fun secondsUntilLocalMidnightLimit(): Long {
    val cal = java.util.Calendar.getInstance()
    val now = cal.timeInMillis
    cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
    cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0)
    cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
    return ((cal.timeInMillis - now) / 1000).coerceAtLeast(0)
}
