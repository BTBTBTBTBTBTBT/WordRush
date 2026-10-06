package com.wordocious.app.ui.game

import androidx.compose.animation.AnimatedVisibility
import com.wordocious.app.ui.theme.WTheme
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.ui.semantics.semantics
import com.wordocious.app.ui.FinishInk
import com.wordocious.app.ui.SoftNumber
import com.wordocious.app.ui.tintedPill
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.GameResultsService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first

/**
 * Post-game XP toast — ports the web effects/xp-toast.tsx and iOS XpToastView:
 * a purple gradient pill at the top with a star, "+N XP", bonus chips
 * (streak / daily), and a level-up line. Slides in from the top, auto-dismisses
 * after 3s. Non-interactive (sits above the victory/post-game content).
 */
@Composable
fun XpToast(result: GameResultsService.XpResult, onDismiss: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        // FINISH_SPEC V3: a level-up that crosses into a new tier queues the tier-badge popup
        // (once per level per session, however often this toast re-composes).
        if (com.wordocious.app.ui.BadgeMath.tierChangedOnLevelUp(result.leveledUp, result.newLevel)) {
            // A late result's tier popup waits for a calm moment (CelebrationGate, 2026-10-03).
            com.wordocious.app.ui.BadgeMoments.levelUp(result.newLevel, late = result.late)
        }
        // FINISH_SPEC BJ2: never animates in under the win / lose card (one big thing at a
        // time) — wait for the card to close, then a short beat after it.
        androidx.compose.runtime.snapshotFlow { com.wordocious.app.ui.BadgeMoments.holds > 0 }.first { !it }
        val wait = com.wordocious.app.ui.BadgeMoments.lastHoldReleaseMs + FinishMotion.XP_AFTER_HOLD_MS -
            android.os.SystemClock.uptimeMillis()
        if (wait > 0) delay(wait)
        visible = true
        // Level up: the jingle as "Level up!" shows (a tier-crossing level-up plays it on its
        // tier popup instead, so one level-up = one jingle).
        if (result.leveledUp && !com.wordocious.app.ui.BadgeMath.tierChangedOnLevelUp(true, result.newLevel)) {
            com.wordocious.app.data.SoundManager.levelUp()
        }
        // Web: 3s dwell, extended to 5s when sweep/flawless chips need reading.
        delay(if (result.sweepBonus + result.flawlessBonus > 0) 5000L else 3000L)
        visible = false
        delay(320)
        onDismiss()
    }

    Box(Modifier.fillMaxSize().padding(top = 12.dp), contentAlignment = Alignment.TopCenter) {
        // Web fade-in-up: rise 8dp with a 300ms ease-out fade (xp-toast.tsx),
        // not a full-height slide. Snap under reduced motion.
        val dur = if (WTheme.reducedMotion) 0 else 300
        AnimatedVisibility(
            visible = visible,
            enter = slideInVertically(tween(dur, easing = EaseOut)) { 16 } + fadeIn(tween(dur, easing = EaseOut)),
            exit = slideOutVertically(tween(dur)) { 16 } + fadeOut(tween(dur)),
        ) {
            // FINISH_SPEC A1 / A2 / G5: a tinted lavender pill (wash, line, purple band) with
            // the XP as a soft number and the bonuses as small tinted chips.
            val purple = Color(0xFF7C3AED)
            Row(
                Modifier
                    // iOS: soft violet glow under the pill (PostGameEffects).
                    .shadow(10.dp, RoundedCornerShape(20.dp), ambientColor = purple, spotColor = purple)
                    .tintedPill(purple, 20.dp)
                    .padding(start = 14.dp, end = 18.dp, top = 14.dp, bottom = 10.dp)
                    .semantics(mergeDescendants = true) { },
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Star, null, tint = Color(0xFFF5A524), modifier = Modifier.size(22.dp))
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        SoftNumber("+${result.totalXp}", 20.sp)
                        Text("XP", fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textSecondary else FinishInk.label,
                            modifier = Modifier.padding(bottom = 2.dp))
                    }
                    if (result.streakBonus > 0 || result.dailyBonus > 0 || result.sweepBonus > 0 || result.flawlessBonus > 0) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (result.streakBonus > 0) XpChip("+${result.streakBonus} streak", Color(0xFFF97316))
                            if (result.dailyBonus > 0) XpChip("+${result.dailyBonus} daily", purple)
                            // Web xp-toast: distinct pink "+200 sweep" / gold "+400 flawless" chips.
                            if (result.sweepBonus > 0) XpChip("+${result.sweepBonus} sweep", Color(0xFFEC4899))
                            if (result.flawlessBonus > 0)
                                // §244: a live streak outranks the raw bonus number.
                                XpChip(
                                    if (result.flawlessStreak >= 2) "FLAWLESS \u00D7${result.flawlessStreak}" else "+${result.flawlessBonus} flawless",
                                    Color(0xFFF5A524),
                                )
                        }
                    }
                    if (result.leveledUp) {
                        // FINISH_SPEC V3: the new tier badge with the level in soft numbers.
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text("Level up!", fontSize = 11.sp, fontWeight = FontWeight.Black,
                                color = if (WTheme.isDark) Color(0xFFFDE047) else Color(0xFFB45309))
                            com.wordocious.app.ui.LevelBadge(result.newLevel, 20.dp, numberSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

/** A small tinted bonus chip on the XP toast. */
@Composable
private fun XpChip(text: String, accent: Color) {
    Text(
        text, fontSize = 10.sp, fontWeight = FontWeight.Black,
        color = if (WTheme.isDark) accent else com.wordocious.app.ui.darkenInk(accent),
        modifier = Modifier
            .background(com.wordocious.app.ui.accentWash(accent, 0.16f), RoundedCornerShape(50))
            .border(1.dp, com.wordocious.app.ui.accentLine(accent), RoundedCornerShape(50))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    )
}
