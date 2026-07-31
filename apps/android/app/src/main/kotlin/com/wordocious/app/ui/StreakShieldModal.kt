package com.wordocious.app.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
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
    // After a shield is spent, swap the card to a "Streak saved!" beat for
    // 1.8s before closing (iOS/web parity) — the modal owns its own dismissal.
    var saved by remember { mutableStateOf(false) }
    // iOS fires a warning haptic and springs the card in from 0.9×/0 opacity.
    val haptics = LocalHapticFeedback.current
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        shown = true
    }
    val appear by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = if (WTheme.reducedMotion) snap()
                        else spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow),
        label = "shieldAppear",
    )

    Box(
        Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)).clickableNoRipple { if (!busy && !saved) onClose() },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            Modifier.padding(24.dp).widthIn(max = 340.dp).fillMaxWidth()
                .graphicsLayer { scaleX = 0.9f + 0.1f * appear; scaleY = 0.9f + 0.1f * appear; alpha = appear }
                .shadow(20.dp, RoundedCornerShape(20.dp), ambientColor = Color(0x1F000000), spotColor = Color(0x1F000000))
                .clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface)
                .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
                .clickableNoRipple { }
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (saved) {
                Text("\uD83D\uDEE1", fontSize = 44.sp)
                Text("Streak saved!", fontSize = 22.sp, fontWeight = FontWeight.Black, color = WTheme.text)
                Text(
                    "Your $streak-day streak is protected \u00B7 ${(shields - 1).coerceAtLeast(0)} shields left",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                )
                return@Column
            }
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
                // iOS gives this the signature 3D purple (solid #4C1D95 offset shadow).
                Button3D(
                    onClick = {
                        if (!busy) {
                            busy = true
                            scope.launch {
                                onUseShield()
                                busy = false
                                saved = true
                                kotlinx.coroutines.delay(1_800)
                                onClose()
                            }
                        }
                    },
                    face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
                    shadow = Color(0xFF4C1D95),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !busy,
                ) {
                    Text(
                        if (busy) "Using Shield..." else "Use Shield ($shields left)",
                        fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White,
                    )
                }
            } else {
                Text(
                    "You have no streak shields. Pro subscribers get 4 shields per billing period.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, textAlign = TextAlign.Center,
                )
            }
            Text(
                "Let Streak Reset",
                fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                textAlign = TextAlign.Center,
                // iOS spans the full card width so the whole row is the tap target.
                modifier = Modifier.fillMaxWidth().clickableNoRipple {
                    if (!busy) {
                        busy = true
                        scope.launch { onDecline(); busy = false }
                    }
                }.padding(vertical = 6.dp),
            )
        }
    }
}
