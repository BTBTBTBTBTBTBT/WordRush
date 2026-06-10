package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Streak-at-risk modal — ports web modals/streak-shield-modal.tsx: flame with
 * a red "!" badge, the big streak number, the shield-count pill, "Use Shield"
 * (purple gradient) when shields remain or the no-shields Pro copy, and a
 * muted "Let Streak Reset" decline.
 */
@Composable
fun StreakShieldModal(
    streak: Int,
    shields: Int,
    onUseShield: suspend () -> Unit,
    onDecline: suspend () -> Unit,
    onClose: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }

    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)).clickableNoRipple { if (!busy) onClose() },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.padding(24.dp).fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface)
                .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
                .clickableNoRipple { }
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.fillMaxWidth()) {
                Icon(
                    Icons.Filled.Close, "Close", tint = WTheme.textMuted,
                    modifier = Modifier.align(Alignment.TopEnd).size(20.dp)
                        .clickableNoRipple { if (!busy) onClose() },
                )
            }
            // Flame + "!" badge
            Box {
                Icon(Icons.Filled.LocalFireDepartment, null, tint = Color(0xFFF97316), modifier = Modifier.size(56.dp))
                Box(
                    Modifier.align(Alignment.TopEnd).size(20.dp).clip(CircleShape).background(Color(0xFFEF4444)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("!", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
            }
            Text("Streak at Risk!", fontSize = 20.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text("$streak", fontSize = 48.sp, fontWeight = FontWeight.Black, color = WTheme.text)
            Text(
                "day streak will be lost if you don't play today",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
            )
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(WTheme.surfaceHover)
                    .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(50))
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(Icons.Filled.Shield, null, tint = Color(0xFF5B21B6), modifier = Modifier.size(14.dp))
                Text("$shields", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF5B21B6))
            }
            if (shields > 0) {
                Text(
                    if (busy) "Using Shield..." else "Use Shield ($shields left)",
                    fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))))
                        .clickableNoRipple {
                            if (!busy) {
                                busy = true
                                scope.launch { onUseShield(); busy = false }
                            }
                        }
                        .padding(vertical = 12.dp),
                )
            } else {
                Text(
                    "You have no streak shields. Pro subscribers get 4 shields per billing period.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                )
            }
            Text(
                "Let Streak Reset",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.clickableNoRipple {
                    if (!busy) {
                        busy = true
                        scope.launch { onDecline(); busy = false }
                    }
                }.padding(8.dp),
            )
        }
    }
}
