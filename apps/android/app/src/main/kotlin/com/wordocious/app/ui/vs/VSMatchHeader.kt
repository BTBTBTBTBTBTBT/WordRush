package com.wordocious.app.ui.vs

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.TileState
import com.wordocious.core.evaluateGuess
import kotlinx.coroutines.delay
import kotlin.math.max
import kotlin.math.min

// In-match VS helpers. The persistent tug-of-war header card was retired by
// the VS polish pass (founder 2026-10-01): a match now shows the solo header +
// the compact VsOpponentBar (VSOpponentStrip.kt).

/** Max count of CORRECT tiles in any single row across all boards (opponent tiles). */
fun bestRowGreens(tiles: Map<Int, List<List<TileState>>>): Int {
    var best = 0
    for (rows in tiles.values) for (row in rows) {
        val greens = row.count { it == TileState.CORRECT }
        if (greens > best) best = greens
    }
    return best
}

/** Three pulsing dots (staggered 0.2s) — web animate-pulse parity. */
@Composable
fun TypingDots(dotSize: androidx.compose.ui.unit.Dp = 4.dp, color: Color = Color(0xFFEC4899)) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(3) { i ->
            var on by remember { mutableStateOf(true) }
            LaunchedEffect(Unit) {
                delay(i * 200L)
                while (true) { on = !on; delay(500) }
            }
            val alpha by animateFloatAsState(if (on) 1f else 0.3f, tween(if (WTheme.reducedMotion) 0 else 450), label = "typingDot$i")
            Box(Modifier.size(dotSize).graphicsLayer { this.alpha = alpha }.clip(CircleShape).background(color))
        }
    }
}

/** Moment callout — a soft white pill with a teal dot (VS polish §1: no
 *  gradient toast). */
@Composable
fun VsCalloutPill(text: String) {
    Row(
        Modifier.padding(horizontal = 24.dp)
            .shadow(6.dp, RoundedCornerShape(50), ambientColor = Color(0x334C1D95), spotColor = Color(0x334C1D95))
            .clip(RoundedCornerShape(50)).background(Color.White)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(VsTeal.ink))
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = VsTeal.deep, maxLines = 2)
    }
}
