package com.wordocious.app.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

/**
 * Streak-at-risk window — ports web modals/streak-shield-modal.tsx, in the finishing
 * look (FINISH_SPEC G2): a lavender card with the purple shield header
 * (#a78bfa → #7c3aed → #6d28d9) carrying U guarding the flame (`art_scene_shield_guard`),
 * the streak and shield counts as soft-number tiles, USE A SHIELD as the large purple
 * candy button and "Let it reset" as the soft peach one. Spending a shield swaps the
 * card to a "Streak saved!" beat (the art springing in on a glow, confetti) for 1.8 s
 * before closing. Reduce Motion: no spring, no confetti. Same actions as before.
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
    val feedbackView = androidx.compose.ui.platform.LocalView.current
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        com.wordocious.app.data.Haptics.warning(feedbackView)
        shown = true
    }
    // Spec U: shield saved = streak · medium.
    LaunchedEffect(saved) {
        if (saved) com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.STREAK, feedbackView)
    }
    val appear by animateFloatAsState(
        targetValue = if (shown) 1f else 0f,
        animationSpec = if (WTheme.reducedMotion) snap()
                        else spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow),
        label = "shieldAppear",
    )
    val shieldsAfter = (shields - 1).coerceAtLeast(0)
    val cardShape = RoundedCornerShape(24.dp)
    val purple = MomentInk.shield

    PopupScrim(onTap = { if (!busy && !saved) onClose() }) {
        Box(
            Modifier.padding(16.dp).widthIn(max = 384.dp).fillMaxWidth()
                .graphicsLayer { scaleX = 0.9f + 0.1f * appear; scaleY = 0.9f + 0.1f * appear; alpha = appear }
                .shadow(24.dp, cardShape, ambientColor = Color(0x59280F50), spotColor = Color(0x59280F50))
                .clip(cardShape)
                // FINISH_SPEC A1: the lavender popup card (`.pop` --tint #f5efff), not white.
                .background(accentWash(purple, 0.09f))
                .border(1.5.dp, accentLine(purple, 0.26f), cardShape)
                .clickableNoRipple { },
        ) {
            if (saved) {
                SavedBeat(streak, shieldsAfter)
                return@Box
            }
            Column(Modifier.fillMaxWidth()) {
                // G2: the purple shield header with U guarding the flame.
                Box(Modifier.fillMaxWidth().background(MomentInk.shieldHeader)) {
                    Row(
                        Modifier.fillMaxWidth().padding(start = 18.dp, end = 30.dp, top = 16.dp, bottom = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f).padding(end = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            HeaderTitle("DON'T LOSE YOUR STREAK!")
                            Text(
                                "Your $streak-day streak ends if you don't play today.",
                                fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = Color.White.copy(alpha = 0.92f),
                                lineHeight = 1.3.em,
                            )
                        }
                        Image(
                            painterResource(R.drawable.art_scene_shield_guard), contentDescription = null,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.height(112.dp).widthIn(max = 130.dp).clearAndSetSemantics { },
                        )
                    }
                    PopupClose(
                        { if (!busy) onClose() }, Modifier.align(Alignment.TopEnd),
                        enabled = !busy,
                    )
                }
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // A2: the streak and the shields as two soft-number tiles.
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TintedStatTile(
                            Color(0xFFF5A524), "DAY STREAK", "$streak", Modifier.weight(1f),
                            icon = Icon3DName.FLAME, bar = true,
                        )
                        TintedStatTile(
                            purple, if (shields == 1) "SHIELD" else "SHIELDS", "$shields", Modifier.weight(1f),
                            icon = Icon3DName.SHIELD, bar = true,
                        )
                    }
                    // Shields are the only way to save a streak. No shields: the Pro note.
                    if (shields > 0) {
                        CastButton(
                            if (busy) "USING A SHIELD…" else "USE A SHIELD",
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
                            }, size = CastSize.L, fill = true,
                            enabled = !busy, modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        Text(
                            "You're out of shields. Pro members get 4 every billing period.",
                            fontSize = 12.5.sp, fontWeight = FontWeight.Bold,
                            color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.muted,
                            textAlign = TextAlign.Center,
                        )
                    }
                    CastButton(
                        "Let it reset",
                        onClick = {
                            if (!busy) {
                                busy = true
                                scope.launch { onDecline(); busy = false }
                            }
                        },
                        color = CastColor.SLATE, size = CastSize.M, fill = true,
                        enabled = !busy, modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
        // G2: the saved beat's confetti over the whole window (off with Reduce Motion).
        if (saved) PopupConfetti(MomentInk.shieldConfetti)
    }
}

/** G2 the "Streak saved!" beat: the shield art springing in on a glow, the soft streak, the shields left. */
@Composable
private fun SavedBeat(streak: Int, shieldsAfter: Int) {
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().background(MomentInk.shieldHeader).padding(top = 14.dp, bottom = 6.dp)) {
            SceneArtPop(R.drawable.art_scene_shield_guard, height = 150.dp, glow = Color(0xFFFFE9A8))
        }
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "STREAK SAVED!", fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 0.4.sp,
                color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                modifier = Modifier.semantics { heading() },
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon3D(Icon3DName.FLAME, 26.dp)
                SoftNumber("$streak", 30.sp)
                Text(
                    "day streak", fontSize = 13.sp, fontWeight = FontWeight.Black,
                    color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.label,
                )
            }
            Text(
                "Your $streak-day streak is safe · $shieldsAfter ${if (shieldsAfter == 1) "shield" else "shields"} left",
                fontSize = 13.sp, fontWeight = FontWeight.Bold,
                color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.muted, textAlign = TextAlign.Center,
            )
        }
    }
}

/** The white popup headline on a colored header (the mockup's `.pop .head h3`). */
@Composable
internal fun HeaderTitle(text: String, fontSize: androidx.compose.ui.unit.TextUnit = 20.sp) {
    val px = androidx.compose.ui.platform.LocalDensity.current.density
    Text(
        text, fontSize = fontSize, fontWeight = FontWeight.Black, color = Color.White, lineHeight = 1.1.em,
        style = TextStyle(shadow = Shadow(Color(0x1F000000), Offset(0f, 2f * px), 0f)),
        modifier = Modifier.semantics { heading() },
    )
}
