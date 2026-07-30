package com.wordocious.app.ui.vs

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.clickableNoRipple
import com.wordocious.app.ui.theme.WTheme

/** Seconds until the next LOCAL midnight (daily VS resets locally). */
private fun vsLimitSecondsUntilMidnight(): Long {
    val cal = java.util.Calendar.getInstance()
    val now = cal.timeInMillis
    cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
    cal.set(java.util.Calendar.HOUR_OF_DAY, 0); cal.set(java.util.Calendar.MINUTE, 0)
    cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0)
    return ((cal.timeInMillis - now) / 1000).coerceAtLeast(0)
}

/**
 * "Daily VS Used" modal — ports iOS VSLobbyView.VSLimitModal (web
 * vs-limit-modal.tsx). Shown when a free player taps the greyed-out
 * "Play Daily VS" card: live countdown to midnight, Go Pro, Maybe later.
 */
@Composable
fun VSDailyLimitModal(onGoPro: () -> Unit, onClose: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)).clickableNoRipple(onClose),
        Alignment.Center,
    ) {
        Column(
            Modifier.padding(horizontal = 24.dp).clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface).clickableNoRipple { }
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(
                painterResource(R.drawable.ic_swords), null,
                tint = WTheme.textMuted, modifier = Modifier.size(44.dp),
            )
            Text("Daily VS Used", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(
                "You've played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
            )
            var tick by remember { mutableStateOf(0) }
            LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000); tick++ } }
            @Suppress("UNUSED_EXPRESSION") tick
            val s = vsLimitSecondsUntilMidnight()
            Text(
                "Resets in ${"%02d:%02d:%02d".format(s / 3600, (s % 3600) / 60, s % 60)}",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(WTheme.surfaceHover)
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            )
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFD97706))))
                    .clickableNoRipple { onClose(); onGoPro() }.padding(vertical = 12.dp),
                Alignment.Center,
            ) {
                Text("Go Pro", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
            Text(
                "Maybe later", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.clickableNoRipple(onClose),
            )
        }
    }
}
