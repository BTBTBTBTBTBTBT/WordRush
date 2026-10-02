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
import com.wordocious.app.ui.FinishInk
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
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

/**
 * Moment callout (VS polish §1; FINISH_SPEC K1): an in-match notice — a tinted pill in
 * the event's [accent] with its 4 dp top band, a small cast [pose] that fits the moment
 * (O2 "gasp" by default: the opponent is close / solved a board; A7 callers pass a
 * different character when O2 is on screen), the line in Nunito Black. Pops in with a
 * spring (instant with Reduce Motion) and is announced politely.
 */
@Composable
fun VsCalloutPill(
    text: String,
    accent: Color = Color(0xFFEC4899),
    pose: Pair<com.wordocious.app.ui.MascotId, String>? = com.wordocious.app.ui.MascotId.O2 to "gasp",
) {
    val still = WTheme.reducedMotion
    val pop = remember(text) { androidx.compose.animation.core.Animatable(if (still) 1f else 0.85f) }
    LaunchedEffect(text) { if (!still) pop.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.5f, stiffness = 520f)) }
    Row(
        Modifier.padding(horizontal = 24.dp)
            .graphicsLayer { scaleX = pop.value; scaleY = pop.value }
            .vsPill(accent, 50.dp, amount = 0.16f)
            .semantics { liveRegion = LiveRegionMode.Polite; contentDescription = text }
            .padding(start = if (pose != null) 4.dp else 14.dp, end = 14.dp, top = 5.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (pose != null) VsCastPose(pose.first, pose.second, 30.dp)
        else Box(Modifier.size(7.dp).clip(CircleShape).background(accent))
        Text(text, fontSize = 12.sp, fontWeight = FontWeight.Black, color = FinishInk.heading, maxLines = 2)
    }
}
