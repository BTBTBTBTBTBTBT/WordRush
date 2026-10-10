package com.wordocious.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.StartOffset
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.min

/**
 * Founder 10-09 (iOS CelebrationTrio): the Flawless banner's celebrating cast, alive. Three cheer poses (D, O, I) on one floor
 * under a small bunting that hangs still; each figure hops (stretched at the top, squashed on the landing) with a slower
 * side-to-side sway on top, on its own offset beat, and four gold sparkles twinkle. Every move is a platform-native continuous
 * animation (rememberInfiniteTransition, read in graphicsLayer so a frame never recomposes the tree), started a beat after the
 * first layout. Reduce Motion / Battery Saver: the same scene, still.
 */
@Composable
internal fun CelebrationTrio(
    height: Dp, modifier: Modifier = Modifier,
    /** The three figures, left to right (default: the Flawless D, O, I cheering). */
    images: List<Int> = listOf(R.drawable.art_pose_d_cheer, R.drawable.art_pose_o2_cheer, R.drawable.art_pose_i_cheer),
    bunting: Boolean = true,
    sparkles: Boolean = true,
    /** Seconds per hop (the Halloween idle trio moves slower and spookier). */
    tempo: Float = 0.42f,
    swayDegrees: Float = 4f,
) {
    val still = WTheme.reducedMotion || WTheme.calmMotion
    // Start the loops a beat AFTER the first layout, so the figures hop in place instead of swimming while the size settles.
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(still) {
        started = false
        if (!still) { kotlinx.coroutines.delay(200); started = true }
    }
    val inf = rememberInfiniteTransition(label = "trio")
    BoxWithConstraints(modifier.fillMaxSize().clearAndSetSemantics { }) {
        val w = maxWidth
        val h = height
        val fig = min(h.value * 0.66f, w.value / 3.6f).dp
        val buntingW = min(w.value * 0.36f, 136f).dp
        // the bunting hangs still (only the cast celebrates), centered at 9% of the height
        if (bunting) Image(
            artPainter(R.drawable.age_bunting, buntingW), contentDescription = null, contentScale = ContentScale.Fit,
            modifier = Modifier.offset(x = (w - buntingW) / 2, y = h * 0.09f - h * 0.10f).width(buntingW).height(h * 0.20f),
        )
        // one shared floor shadow
        androidx.compose.foundation.layout.Box(
            Modifier.offset(x = (w - fig * 3.2f) / 2, y = h - 25.dp).size(fig * 3.2f, 14.dp).drawBehind {
                drawOval(
                    Brush.radialGradient(
                        listOf(Color(0xFF2E1065).copy(alpha = 0.28f), Color(0xFF2E1065).copy(alpha = 0f)),
                        center = Offset(size.width / 2f, size.height / 2f), radius = size.width / 2f,
                    ),
                    topLeft = Offset.Zero, size = Size(size.width, size.height),
                )
            },
        )
        images.forEachIndexed { i, res ->
            val delayMs = i * 180
            // hop: 0 = on the ground (stretched wide and low), 1 = at the top; 0.42 s each way
            val hop by inf.animateFloat(
                0f, 1f, infiniteRepeatable(tween((tempo * 1000f).toInt(), easing = FastOutSlowInEasing), RepeatMode.Reverse, initialStartOffset = StartOffset(delayMs)),
                label = "hop$i",
            )
            // sway: -4 to 4 degrees over 0.95 s each way, starting twice as late as the hop
            val sway by inf.animateFloat(
                -swayDegrees, swayDegrees, infiniteRepeatable(tween((tempo * 2260f).toInt(), easing = FastOutSlowInEasing), RepeatMode.Reverse, initialStartOffset = StartOffset(delayMs * 2)),
                label = "sway$i",
            )
            val cx = (w - fig) / 2 + fig * 0.95f * (i - 1)
            Image(
                artPainter(res, fig), contentDescription = null, contentScale = ContentScale.Fit,
                modifier = Modifier.offset(x = cx, y = h - fig - 16.dp).size(fig).graphicsLayer {
                    transformOrigin = TransformOrigin(0.5f, 1f)
                    if (started) {
                        scaleX = 1.04f - 0.07f * hop
                        scaleY = 0.95f + 0.08f * hop
                        translationY = -hop * fig.toPx() * 0.09f
                        rotationZ = sway
                    } else {
                        scaleX = 1.04f; scaleY = 0.95f; rotationZ = -swayDegrees
                    }
                },
            )
        }
        val xs = floatArrayOf(0.22f, 0.78f, 0.35f, 0.66f)
        val ys = floatArrayOf(0.30f, 0.26f, 0.12f, 0.10f)
        for (k in 0 until (if (sparkles) 4 else 0)) {
            val twinkle by inf.animateFloat(
                0f, 1f, infiniteRepeatable(tween(800 + k * 170, easing = FastOutSlowInEasing), RepeatMode.Reverse, initialStartOffset = StartOffset(k * 250)),
                label = "spark$k",
            )
            GoldSparkle(
                9.dp,
                Modifier.offset(x = w * xs[k] - 4.5.dp, y = h * ys[k] - 4.5.dp).graphicsLayer {
                    if (still) {
                        alpha = 0.8f
                    } else {
                        val t = if (started) twinkle else 0f
                        alpha = 0.3f + 0.7f * t
                        val sc = 0.8f + 0.35f * t
                        scaleX = sc; scaleY = sc
                    }
                },
            )
        }
    }
}
