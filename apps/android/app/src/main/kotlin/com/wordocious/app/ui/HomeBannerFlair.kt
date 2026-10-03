package com.wordocious.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// FINISH_SPEC BJ6 round 3 (founder 10-03: "That window needs flair, nothing too crazy, but it
// looks unfinished"): static, cheap, symmetric touches on the Good Morning card — no looping
// animation, no blur, no outline. Numbers pinned by HomeHostRulesTest.

/** BJ6: the headline's designed max size (core HEADLINE_MAX_SIZE, dp). */
internal val HOME_HEADLINE_SP: Float = com.wordocious.core.HEADLINE_MAX_SIZE.toFloat()

/** BJ6 round 4: the sparkles flanking line 1 and their gap to the lettering. */
internal val HOME_SPARKLE = 12.dp
internal val HOME_SPARKLE_GAP = 4.dp

/** The headline lines' side room (a sparkle + its gap each side). */
internal val HOME_HEADLINE_SIDES = (HOME_SPARKLE + HOME_SPARKLE_GAP) * 2

/** LiveHeadline's own lettering pad beyond the core 0.24 em edge (5 dp a side). */
internal const val HOME_HEADLINE_ART_PAD = 10f

/** BJ6 round 4: the device's lettering size + the em budget per line. */
internal data class HomeHeadlineFit(val size: Int, val maxEm: Double)

/**
 * The fit for a [lineWidth] dp line slot, decided once per width: core headlineFontSize on the
 * width less LiveHeadline's fixed lettering pad (its other pad is the core 0.24 em edge), so a
 * line that fits the em budget renders at exactly that size, never shrunk.
 */
internal fun homeHeadlineFit(lineWidth: Float): HomeHeadlineFit {
    val usable = (lineWidth - HOME_HEADLINE_ART_PAD).coerceAtLeast(1f).toDouble()
    val size = com.wordocious.core.headlineFontSize(usable)
    return HomeHeadlineFit(size, usable / size)
}

/** Name headlines (and every stacked layout) render at exactly the fit size; nameless one-liners may shrink. */
internal fun homeHeadlineFixedSize(headline: String, name: String?, stacked: Boolean): Boolean {
    if (stacked) return true
    val n = name?.trim().orEmpty()
    return n.isNotEmpty() && headline.uppercase().contains(n.uppercase())
}

/** The brand candy cap across the card's top edge (purple → pink), like the game cards' trim. */
internal val HOME_CAP_COLORS = listOf(Color(0xFF7C3AED), Color(0xFFEC4899))
internal const val HOME_CAP_BAND = 8f

/** BJ6 round 3: the progress rows' side padding (was 12) and the icons' size cap / minimum gap. */
internal const val HOME_ROW_PAD_X = 8f
internal const val HOME_TILE_MAX = 36f
internal const val HOME_TILE_GAP_MIN = 4f

/**
 * BJ6 round 3 (founder: the progress icons "a snag bigger"): the one tile size both rows share —
 * as large as [slots] tiles fit in [rowWidth] dp with ≥ [HOME_TILE_GAP_MIN] gaps (the 10-tile
 * Puzzles row sets the limit), at most [HOME_TILE_MAX].
 */
internal fun homeTileSize(rowWidth: Float, slots: Int): Float {
    val n = slots.coerceAtLeast(1)
    return ((rowWidth - HOME_TILE_GAP_MIN * (n - 1)) / n).coerceIn(0f, HOME_TILE_MAX)
}

/** The two progress rows' tint band (lavender ~10%): the card reads as two zones. */
internal val HOME_ROWS_TINT = Color(0xFF7C3AED).copy(alpha = 0.07f)

/** Cast colors for the corner confetti (W, O, D, C, I, S). */
private val HOME_CONFETTI = listOf(
    Color(0xFF8B2CF5), Color(0xFFFF2F91), Color(0xFF0A6CFF), Color(0xFF00B4BE), Color(0xFF4CC77A), Color(0xFFF5A623),
)

/**
 * The top-LEFT corner's confetti as (x fraction of the width, y dp, radius dp); the top-right
 * corner mirrors it (x → 1 − x), so the card stays symmetric. 2–4 dp dots.
 */
internal val HOME_CORNER_DOTS: List<Triple<Float, Float, Float>> = listOf(
    Triple(0.05f, 18f, 1.5f), Triple(0.11f, 30f, 1.0f), Triple(0.17f, 16f, 2.0f),
    Triple(0.08f, 46f, 1.2f), Triple(0.22f, 38f, 1.0f),
)

/** Mirrored dot x positions (fractions) for both corners, left first then right. */
internal fun homeCornerDotXs(): List<Float> = HOME_CORNER_DOTS.map { it.first } + HOME_CORNER_DOTS.map { 1f - it.first }

/**
 * The frosted strip's fill + flair: the lilac frost with a very soft diagonal sheen (instead of
 * flat), the brand candy cap with frosting drips across the top edge ([cap] false when the
 * scene band already carries its own top bar), and the mirrored corner confetti.
 */
internal fun Modifier.homeStripFlair(cap: Boolean): Modifier = this.drawWithCache {
    val u = density
    val frost = FinishInk.lavender
    val fill = Brush.linearGradient(
        0f to frost.copy(alpha = 0.84f), 0.5f to frost.copy(alpha = 0.74f), 1f to frost.copy(alpha = 0.66f),
        start = Offset.Zero, end = Offset(size.width, size.height),
    )
    val sheen = Brush.linearGradient(
        0f to Color.White.copy(alpha = 0f), 0.42f to Color.White.copy(alpha = 0.22f), 0.58f to Color.White.copy(alpha = 0f),
        start = Offset.Zero, end = Offset(size.width, size.height),
    )
    val capPath = Path().apply {
        moveTo(0f, 0f)
        lineTo(size.width, 0f)
        lineTo(size.width, HOME_CAP_BAND * u)
        for (seg in CardTrimGeometry.segments(size.width / u, band = HOME_CAP_BAND)) {
            quadraticTo(seg[0] * u, seg[1] * u, seg[2] * u, seg[3] * u)
        }
        close()
    }
    val capBrush = Brush.horizontalGradient(HOME_CAP_COLORS)
    val capGloss = Brush.verticalGradient(
        listOf(Color.White.copy(alpha = 0.35f), Color.White.copy(alpha = 0f)), startY = 0f, endY = HOME_CAP_BAND * u,
    )
    val xs = homeCornerDotXs()
    val dots = HOME_CORNER_DOTS + HOME_CORNER_DOTS
    onDrawBehind {
        drawRect(fill)
        drawRect(sheen)
        if (cap) {
            drawPath(capPath, capBrush)
            drawPath(capPath, capGloss)
        }
        dots.forEachIndexed { i, (_, y, r) ->
            // Mirrored pairs share a color, so left and right read the same.
            val c = HOME_CONFETTI[(i % HOME_CORNER_DOTS.size) % HOME_CONFETTI.size]
            drawCircle(c.copy(alpha = 0.3f), r * u, Offset(xs[i] * size.width, (y + (if (cap) HOME_CAP_BAND else 0f)) * u))
        }
    }
}

/** A small gold four-point sparkle (code-drawn, not an emoji), [size] square. Decorative. */
@Composable
internal fun GoldSparkle(size: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size).clearAndSetSemantics { }) {
        val w = this.size.width
        val c = w / 2f
        val waist = w * 0.14f
        val star = Path().apply {
            moveTo(c, 0f)
            quadraticTo(c + waist * 0.4f, c - waist * 0.4f, w, c)
            quadraticTo(c + waist * 0.4f, c + waist * 0.4f, c, w)
            quadraticTo(c - waist * 0.4f, c + waist * 0.4f, 0f, c)
            quadraticTo(c - waist * 0.4f, c - waist * 0.4f, c, 0f)
            close()
        }
        drawPath(star, Brush.radialGradient(listOf(Color(0xFFFFE7A3), Color(0xFFF5A524)), center = Offset(c, c), radius = c))
    }
}
