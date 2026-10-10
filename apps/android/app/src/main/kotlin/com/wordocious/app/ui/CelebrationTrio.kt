package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
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
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Founder 10-09 (iOS CelebrationTrio): the Flawless banner's celebrating cast, alive. Three cheer poses (D, O, I) on one floor
 * under a small bunting, each bouncing, swaying and squashing on its own offset beat; the bunting sways a touch from its
 * center and four gold sparkles twinkle. Reduce Motion / Battery Saver: the same scene, still. Transform + alpha only, read in
 * graphicsLayer so a frame never recomposes the tree.
 */
@Composable
internal fun CelebrationTrio(height: Dp, modifier: Modifier = Modifier) {
    val still = WTheme.reducedMotion || WTheme.calmMotion
    val time = remember { mutableFloatStateOf(0f) }
    LaunchedEffect(still) {
        if (still) { time.floatValue = 0f; return@LaunchedEffect }
        while (true) androidx.compose.runtime.withFrameNanos { time.floatValue = (it / 1_000_000_000.0 % 100_000.0).toFloat() }
    }
    BoxWithConstraints(modifier.fillMaxSize().clearAndSetSemantics { }) {
        val w = maxWidth
        val h = height
        val fig = min(h.value * 0.74f, w.value / 3.6f).dp
        val bunting = min(w.value * 0.40f, 150f).dp
        val casts = listOf(R.drawable.art_pose_d_cheer, R.drawable.art_pose_o2_cheer, R.drawable.art_pose_i_cheer)
        // the bunting, swaying a touch from its top center
        Image(
            artPainter(R.drawable.age_bunting, bunting), contentDescription = null, contentScale = ContentScale.Fit,
            modifier = Modifier.offset(x = (w - bunting) / 2, y = h * 0.17f - h * 0.15f).width(bunting).height(h * 0.30f)
                .graphicsLayer {
                    transformOrigin = TransformOrigin(0.5f, 0f)
                    rotationZ = if (still) 0f else (sin(time.floatValue * 1.3f) * 1.6f)
                },
        )
        // one shared floor shadow
        androidx.compose.foundation.layout.Box(
            Modifier.offset(x = (w - fig * 3.2f) / 2, y = h - 13.dp).size(fig * 3.2f, 14.dp).drawBehind {
                drawOval(
                    Brush.radialGradient(
                        listOf(Color(0xFF2E1065).copy(alpha = 0.28f), Color(0xFF2E1065).copy(alpha = 0f)),
                        center = Offset(size.width / 2f, size.height / 2f), radius = size.width / 2f,
                    ),
                    topLeft = Offset.Zero, size = Size(size.width, size.height),
                )
            },
        )
        casts.forEachIndexed { i, res ->
            val phase = i * 0.9f
            val cx = (w - fig) / 2 + fig * 0.95f * (i - 1)
            Image(
                artPainter(res, fig), contentDescription = null, contentScale = ContentScale.Fit,
                modifier = Modifier.offset(x = cx, y = h - fig - 4.dp).size(fig).graphicsLayer {
                    if (!still) {
                        val t = time.floatValue
                        val beat = ((t * 2.2f + phase) % (2f * PI.toFloat()))
                        val up = max(0f, sin(beat))                         // 0..1 hop
                        val squash = 1f - 0.06f * max(0f, -sin(beat))        // squash on the landing
                        transformOrigin = TransformOrigin(0.5f, 1f)
                        scaleX = 2f - squash
                        scaleY = squash
                        rotationZ = sin(t * 1.7f + phase) * 4f
                        translationY = -up * fig.toPx() * 0.08f
                    } else {
                        transformOrigin = TransformOrigin(0.5f, 1f)
                    }
                },
            )
        }
        val xs = floatArrayOf(0.22f, 0.78f, 0.35f, 0.66f)
        val ys = floatArrayOf(0.30f, 0.26f, 0.12f, 0.10f)
        for (k in 0 until 4) {
            GoldSparkle(
                9.dp,
                Modifier.offset(x = w * xs[k] - 4.5.dp, y = h * ys[k] - 4.5.dp).graphicsLayer {
                    alpha = if (still) 0.8f else (0.35f + 0.65f * abs(sin(time.floatValue * 1.9f + k)))
                },
            )
        }
    }
}
