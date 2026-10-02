package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import kotlin.random.Random

// FINISH_SPEC A5: the living cast header (option A) on Home and the tab pages. The ten
// cast heroes (`mascot_<id>`), each trimmed to its figure and drawn as its own image,
// spell WORDOCIOUS edge to edge; every 2.6–5 s ONE random character (never the same
// twice in a row) plays its move (CastMoves). Off with Reduce Motion (the in-app
// toggle or the system "Remove animations") and while its tab is hidden.
// Visual reference: the `.castrow` in docs/design/brand/mockups/game-kit.html.

/**
 * Where the header's cast row sits in the window (F2: the cold-start intro glides the
 * row it builds into exactly this rectangle). Null until a header has been laid out.
 */
object CastHeaderAnchor {
    var bounds by mutableStateOf<Rect?>(null)
}

/** A cast hero trimmed to its figure (CastCrops), as a painter. */
@Composable
fun rememberCastPainter(id: MascotId): BitmapPainter {
    val bitmap: ImageBitmap = ImageBitmap.imageResource(id.res)
    val crop = CastCrops.crops.getValue(id)
    return remember(bitmap, crop) {
        // Clamp to the decoded bitmap (the crops are in 512-px source coordinates).
        val k = bitmap.width / 512f
        BitmapPainter(
            bitmap,
            IntOffset((crop.left * k).roundToInt(), (crop.top * k).roundToInt()),
            IntSize(
                (crop.width * k).roundToInt().coerceAtMost(bitmap.width - (crop.left * k).roundToInt()),
                (crop.height * k).roundToInt().coerceAtMost(bitmap.height - (crop.top * k).roundToInt()),
            ),
            filterQuality = FilterQuality.High,
        )
    }
}

/**
 * A5 The living cast header: the ten trimmed figures at one shared height across the
 * full width given (2.2% overlap, every second figure a step higher), with one
 * character at a time playing its move. [crown] puts the 3D crown on W (the Pro
 * header marker). [live] = false keeps it still (the cold-start intro's static copy).
 * Decorative row, announced once as "Wordocious".
 */
@Composable
fun LivingCastHeader(
    modifier: Modifier = Modifier,
    crown: Boolean = false,
    live: Boolean = true,
    reportAnchor: Boolean = true,
) {
    val hidden by LocalTabHidden.current
    val still = WTheme.reducedMotion || !live
    var acting by remember { mutableStateOf<MascotId?>(null) }
    val progress = remember { Animatable(0f) }
    LaunchedEffect(still, hidden) {
        acting = null
        if (still || hidden) return@LaunchedEffect
        val random = Random(System.nanoTime())
        delay(CastMoves.FIRST_DELAY_MS)
        var last: MascotId? = null
        while (true) {
            val id = CastMoves.pickNext(last, random)
            last = id
            val move = CastMoves.moves.getValue(id)
            progress.snapTo(0f)
            acting = id
            progress.animateTo(1f, tween(move.durationMs, easing = LinearEasing))
            acting = null
            delay((CastMoves.nextGapMs(random) - move.durationMs).coerceAtLeast(400L))
        }
    }

    val painters = MascotId.entries.map { rememberCastPainter(it) }
    Layout(
        modifier = modifier
            .semantics { contentDescription = "Wordocious" }
            .then(
                if (reportAnchor) Modifier.onGloballyPositioned { CastHeaderAnchor.bounds = it.boundsInWindow() }
                else Modifier,
            ),
        content = {
            MascotId.entries.forEachIndexed { i, id ->
                Box(
                    Modifier.drawWithContent {
                        val who = acting
                        if (who != id) {
                            drawContent()
                            return@drawWithContent
                        }
                        val move = CastMoves.moves.getValue(id)
                        val xf = CastMoves.sample(move, progress.value)
                        val w = size.width
                        val h = size.height
                        val px = w * move.originX
                        val py = h * move.originY
                        val canvas = drawContext.canvas
                        canvas.save()
                        canvas.translate(xf.tx * w + px, xf.ty * h + py)
                        if (xf.rot != 0f) canvas.rotate(xf.rot)
                        if (xf.sx != 1f || xf.sy != 1f) canvas.scale(xf.sx, xf.sy)
                        if (xf.skewX != 0f) canvas.skew(xf.skewX, 0f)
                        canvas.translate(-px, -py)
                        drawContent()
                        canvas.restore()
                    },
                ) {
                    Image(painters[i], contentDescription = null, contentScale = ContentScale.FillBounds, modifier = Modifier.fillMaxSize())
                    if (crown && id == MascotId.W) {
                        CrownOnW()
                    }
                }
            }
        },
    ) { measurables, constraints ->
        val width = if (constraints.hasBoundedWidth) constraints.maxWidth else (360.dp.roundToPx())
        val h = CastCrops.figureHeight(width.toFloat())
        val lift = CastCrops.STAGGER * h
        val crownSpace = if (crown) h * CROWN_SPACE else 0f
        val total = (h + lift + crownSpace).roundToInt()
        val overlap = CastCrops.OVERLAP * width
        val placeables = measurables.mapIndexed { i, m ->
            val id = MascotId.entries[i]
            val w = (CastCrops.crops.getValue(id).aspect * h).roundToInt().coerceAtLeast(1)
            m.measure(Constraints.fixed(w, h.roundToInt().coerceAtLeast(1)))
        }
        layout(width, total) {
            var x = 0f
            placeables.forEachIndexed { i, p ->
                val y = total - h - (if (i % 2 == 1) lift else 0f)
                p.place(x.roundToInt(), y.roundToInt())
                x += p.width - overlap
            }
        }
    }
}

/** How much headroom the Pro crown takes above the row (fraction of the figure height). */
private const val CROWN_SPACE = 0.32f

/** The Pro crown on W's top edge (~45% of W's width), riding W's moves. */
@Composable
private fun androidx.compose.foundation.layout.BoxScope.CrownOnW() {
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.matchParentSize()) {
        val size = maxWidth * 0.45f
        Icon3D(
            Icon3DName.CROWN, size,
            Modifier.align(Alignment.TopCenter).offset(y = -size * 0.62f).requiredSize(size),
        )
    }
}
