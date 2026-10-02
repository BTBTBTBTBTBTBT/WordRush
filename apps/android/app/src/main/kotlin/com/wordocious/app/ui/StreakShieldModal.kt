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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.draw.alpha
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
 * Streak-at-risk modal — ports web modals/streak-shield-modal.tsx. Restyled to
 * the home redesign's look (founder, 2026-10-01: the old card "looks dated"): a
 * soft warm header with the flame and the number, an all-caps headline, no
 * bubbles, one flat rounded button. Same actions: "USE A SHIELD" when shields
 * remain (or the no-shields Pro note) and a muted "Let it reset" decline.
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
    val shieldsAfter = (shields - 1).coerceAtLeast(0)
    val cardShape = RoundedCornerShape(22.dp)

    Box(
        Modifier.fillMaxSize().background(Color(0x731E1B4B)).clickableNoRipple { if (!busy && !saved) onClose() },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.padding(16.dp).widthIn(max = 384.dp).fillMaxWidth()
                .graphicsLayer { scaleX = 0.9f + 0.1f * appear; scaleY = 0.9f + 0.1f * appear; alpha = appear }
                .shadow(24.dp, cardShape, ambientColor = Color(0x404C1D95), spotColor = Color(0x404C1D95))
                .clip(cardShape)
                // FINISH_SPEC A1: the lavender card, not white.
                .background(accentWash(Color(0xFF7C3AED), 0.08f))
                .clickableNoRipple { },
        ) {
            if (saved) {
                Column(Modifier.fillMaxWidth()) {
                    Column(
                        Modifier.fillMaxWidth()
                            .background(Brush.verticalGradient(listOf(Color(0xFFEDE9FE), Color(0xFFE0E7FF))))
                            .padding(start = 24.dp, end = 24.dp, top = 32.dp, bottom = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon3D(Icon3DName.SHIELD, 64.dp)
                        Text(
                            "STREAK SAVED!", fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp,
                            color = Color(0xFF4C1D95), modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                    Text(
                        "Your $streak-day streak is safe \u00B7 $shieldsAfter ${if (shieldsAfter == 1) "shield" else "shields"} left",
                        fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF4B5563), textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 20.dp),
                    )
                }
                return@Box
            }
            Column(Modifier.fillMaxWidth()) {
                // Warm header: flame, the number, DAY STREAK.
                Column(
                    Modifier.fillMaxWidth()
                        .background(Brush.verticalGradient(listOf(Color(0xFFFFF3E0), Color(0xFFFDE7F0))))
                        .padding(start = 24.dp, end = 24.dp, top = 32.dp, bottom = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon3D(Icon3DName.FLAME, 56.dp)
                    Text(
                        "$streak", fontSize = 52.sp, lineHeight = 52.sp, fontWeight = FontWeight.Black,
                        color = Color(0xFF78350F), modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        "DAY STREAK", fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp,
                        color = Color(0xFFB45309), modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "DON'T LOSE YOUR STREAK!", fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp,
                        color = Color(0xFF4C1D95), textAlign = TextAlign.Center,
                    )
                    Text(
                        "Your $streak-day streak ends if you don't play today.",
                        fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF4B5563), textAlign = TextAlign.Center,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon3D(Icon3DName.SHIELD, 20.dp)
                        Text(
                            "$shields ${if (shields == 1) "shield" else "shields"}",
                            fontSize = 12.sp, fontWeight = FontWeight.Black, color = Color(0xFF6D28D9),
                        )
                    }
                    // Shields are the only way to save a streak. No shields: the Pro note.
                    if (shields > 0) {
                        val btnShape = RoundedCornerShape(14.dp)
                        Box(
                            Modifier.padding(top = 4.dp).fillMaxWidth().height(48.dp)
                                .shadow(8.dp, btnShape, ambientColor = Color(0x4D6D28D9), spotColor = Color(0x4D6D28D9))
                                .clip(btnShape)
                                .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))))
                                .alpha(if (busy) 0.5f else 1f)
                                .clickableNoRipple {
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
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                if (busy) "USING A SHIELD\u2026" else "USE A SHIELD",
                                fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 0.6.sp, color = Color.White,
                            )
                        }
                    } else {
                        Text(
                            "You're out of shields. Pro members get 4 every billing period.",
                            fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6B7280), textAlign = TextAlign.Center,
                        )
                    }
                    Text(
                        "Let it reset",
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF6B7280),
                        textAlign = TextAlign.Center,
                        // iOS spans the full card width so the whole row is the tap target.
                        modifier = Modifier.fillMaxWidth().alpha(if (busy) 0.5f else 1f).clickableNoRipple {
                            if (!busy) {
                                busy = true
                                scope.launch { onDecline(); busy = false }
                            }
                        }.padding(vertical = 8.dp),
                    )
                }
            }
            // Close X (36dp target), hidden on the saved beat.
            Box(
                Modifier.align(Alignment.TopEnd).padding(top = 12.dp, end = 12.dp).size(36.dp)
                    .clickableNoRipple { if (!busy) onClose() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Close, "Close", tint = Color(0xFF92400E), modifier = Modifier.size(20.dp))
            }
        }
    }
}
