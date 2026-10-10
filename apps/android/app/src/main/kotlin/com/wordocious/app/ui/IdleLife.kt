package com.wordocious.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import com.wordocious.app.ui.theme.WTheme

/**
 * Founder 10-10 (iOS IdleLife): a still mascot comes alive: a gentle hop + breathe and a slower sway, as continuous
 * native loops (rememberInfiniteTransition, read in graphicsLayer so a frame never recomposes), started a beat after the
 * first layout. Still under Reduce Motion / Battery Saver. [hop] is in dp, [sway] in degrees, [period] seconds per hop
 * cycle, [delay] seconds before the loops start.
 */
fun Modifier.idleLife(hop: Float = 3f, sway: Float = 1.5f, period: Float = 2.2f, delay: Float = 0f): Modifier = composed {
    val still = WTheme.reducedMotion || WTheme.calmMotion
    if (still) {
        this
    } else {
        var on by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { kotlinx.coroutines.delay(250L + (delay * 1000f).toLong()); on = true }
        val inf = rememberInfiniteTransition(label = "idleLife")
        val hopT by inf.animateFloat(
            0f, 1f, infiniteRepeatable(tween((period * 500f).toInt(), easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "idleHop",
        )
        val swayT by inf.animateFloat(
            -1f, 1f, infiniteRepeatable(tween((period * 750f).toInt(), easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "idleSway",
        )
        this.graphicsLayer {
            transformOrigin = TransformOrigin(0.5f, 1f)
            val t = if (on) hopT else 0f
            scaleX = 1.01f - 0.02f * t
            scaleY = 0.985f + 0.03f * t
            translationY = -hop.dp.toPx() * t
            rotationZ = if (on) sway * swayT else -sway
        }
    }
}
