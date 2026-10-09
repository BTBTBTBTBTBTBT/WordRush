package com.wordocious.app.ui

import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.layout.layout
import kotlin.math.roundToInt

// 2.8 item 14 (founder 10-07): a clean scroll edge under the cast header on Home, Leaderboard,
// Stats and Friends (iOS HeaderScroll.swift / web parity).
//  - Content no longer meets the header in a hard cut: the tab content's top edge dissolves (an
//    alpha mask drawn with DstIn, so it works over any wallpaper / Halloween surface), growing
//    from 0 to FADE_HEIGHT_DP over the first few dp of scroll — at rest the first row is opaque.
//  - The cast row gently condenses (a slimmer row; the counters / help / settings row stays) as
//    the page scrolls and expands again at the top.
//  - Reduce Motion / Low Power (WTheme.calmMotion) = fade only, the row never changes size.
// Cost: ONE nested-scroll connection per tab accumulates the consumed scroll (clamped); the
// state is read only in the layout phase (the row's height) and the draw phase (the mask), so
// scrolling never recomposes anything, and the offscreen layer exists only while scrolled.
//
// Off-switch (suggested flag): `header_condense` (the fade stays; only the condense is gated).

object HeaderScrollSpec {
    /** dp of scroll over which the cast row reaches its slimmest. */
    const val CONDENSE_DISTANCE_DP = 64f
    /** The slimmest the cast row gets (fraction of its full size). */
    const val MIN_SCALE = 0.64f
    /** The soft fade at the tab content's top edge. */
    const val FADE_HEIGHT_DP = 16f
    /** dp of scroll before the fade is fully in. */
    const val FADE_RAMP_DP = 8f

    fun progress(offsetDp: Float): Float = (offsetDp / CONDENSE_DISTANCE_DP).coerceIn(0f, 1f)
    fun fade(offsetDp: Float): Float = (offsetDp / FADE_RAMP_DP).coerceIn(0f, 1f)
    fun scale(progress: Float): Float = 1f - (1f - MIN_SCALE) * progress
}

/** One tab's scroll position as the header sees it (dp, 0 at the top). */
@Stable
class HeaderScrollState : NestedScrollConnection {
    var offsetPx by mutableFloatStateOf(0f)
        private set

    fun reset() { offsetPx = 0f }

    override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
        if (consumed.y != 0f) {
            // Finger up (content moves up) is a negative consumed y = scrolled further down the page.
            offsetPx = (offsetPx - consumed.y).coerceIn(0f, MAX_PX)
        }
        return Offset.Zero
    }

    companion object {
        /** Far enough past both ramps in any density (the clamp only stops unbounded drift). */
        private const val MAX_PX = 4000f
    }
}

/** The tab content's soft top edge: content dissolves as it passes under the header. */
fun Modifier.headerScrollFade(state: HeaderScrollState): Modifier = this
    .graphicsLayer {
        // The offscreen layer only exists while scrolled — at rest this is a plain draw.
        compositingStrategy = if (state.offsetPx > 0f) CompositingStrategy.Offscreen else CompositingStrategy.Auto
    }
    .drawWithContent {
        drawContent()
        val offsetDp = state.offsetPx / density
        val f = HeaderScrollSpec.fade(offsetDp)
        if (f > 0f) {
            val h = HeaderScrollSpec.FADE_HEIGHT_DP * density * f
            // DstIn keeps the content where the mask is opaque: transparent at the very top, opaque by h.
            drawRect(
                brush = Brush.verticalGradient(listOf(Color.Black.copy(alpha = 1f - f), Color.Black), startY = 0f, endY = h),
                topLeft = Offset.Zero,
                size = Size(size.width, h),
                blendMode = BlendMode.DstIn,
            )
        }
    }

/**
 * The cast row's height follows the scroll (layout phase only): children draw scaled from the top
 * by the same factor, so nothing inside re-lays out. [calm] (Reduce Motion / Low Power) = never.
 */
fun Modifier.condensesWith(state: HeaderScrollState?, calm: Boolean): Modifier {
    if (state == null || calm) return this
    return this
        .layout { measurable, constraints ->
            val p = measurable.measure(constraints)
            val scale = HeaderScrollSpec.scale(HeaderScrollSpec.progress(state.offsetPx / density))
            layout(p.width, (p.height * scale).roundToInt()) { p.placeRelative(0, 0) }
        }
        .graphicsLayer {
            val scale = HeaderScrollSpec.scale(HeaderScrollSpec.progress(state.offsetPx / density))
            scaleX = scale
            scaleY = scale
            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0f)
        }
}
