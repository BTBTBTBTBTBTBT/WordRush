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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.GameResultsService
import kotlinx.coroutines.delay

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
        visible = true
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
            Row(
                Modifier
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))))
                    .padding(horizontal = 18.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Star, null, tint = Color(0xFFFDE047), modifier = Modifier.size(18.dp))
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("+${result.totalXp} XP", fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color.White)
                    if (result.streakBonus > 0 || result.dailyBonus > 0 || result.sweepBonus > 0 || result.flawlessBonus > 0) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (result.streakBonus > 0)
                                Text("+${result.streakBonus} streak", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDDD6FE))
                            if (result.dailyBonus > 0)
                                Text("+${result.dailyBonus} daily", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDDD6FE))
                            // Web xp-toast: distinct pink "+200 sweep" / yellow "+400 flawless" chips.
                            if (result.sweepBonus > 0)
                                Text("+${result.sweepBonus} sweep", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFFFBCFE8))
                            if (result.flawlessBonus > 0)
                                Text("+${result.flawlessBonus} flawless", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFFFDE047))
                        }
                    }
                    if (result.leveledUp) {
                        Text("Level up! Lv.${result.newLevel}", fontSize = 10.sp, fontWeight = FontWeight.Black, color = Color(0xFFFDE047))
                    }
                }
            }
        }
    }
}
