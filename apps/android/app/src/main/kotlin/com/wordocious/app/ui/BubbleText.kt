package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.BUBBLE_CAP_EM
import com.wordocious.core.BUBBLE_MAX_SIZE
import com.wordocious.core.BUBBLE_MIN_SIZE
import com.wordocious.core.BubbleAtlasMetrics
import com.wordocious.core.HeadlineTokens
import com.wordocious.core.bubbleAtlasCovers
import com.wordocious.core.bubbleAtlasLayout
import com.wordocious.core.bubbleFit
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

// 2.8 item 6: the bubble-lettering renderer. ANY string is drawn from the glyph atlas (drawables
// `bubble_<stem>`: A-Z 0-9 star excl quest comma apos dot hyphen amp period colon plus percent — tint MAPS,
// see BubbleGlyphTint) tinted per word through THIS API; a line the atlas can't cover (or with the
// `bubble_atlas` switch off) is drawn by [LiveHeadline] (the live headline font). The fit — scale UP to fill
// the slot, down to a min, then a balanced 2-3 line wrap, never "…" — is core's bubbleFit (parity-pinned with web + iOS).

/** One fitted line: the atlas when it covers the whole line, else the live font. */
@Composable
fun BubbleLine(
    text: String,
    palette: HeadlinePalette,
    sizeDp: Int,
    modifier: Modifier = Modifier,
    names: List<String> = emptyList(),
    sound: Boolean = true,
    align: androidx.compose.ui.text.style.TextAlign = androidx.compose.ui.text.style.TextAlign.Center,
) {
    // `bubble_atlas` off-switch (fail-open): off = the live headline font everywhere.
    if (bubbleAtlasCovers(text) && com.wordocious.app.data.FlagsService.isLive("bubble_atlas")) {
        BubbleAtlasLine(text, palette, sizeDp, modifier, names, align)
    } else {
        val sizeSp = with(LocalDensity.current) { sizeDp.dp.toSp() }
        // The fit is exact, so nothing shrinks; 0.6 is only a safety net, never an ellipsis.
        LiveHeadline(text, palette, modifier, names = names, maxSize = sizeSp, minSize = sizeSp * 0.6f, align = align, maxLines = 1, sound = sound)
    }
}

private val NUMBER_TINT_TOP = Color(0xFFFFE9A3)
private val NUMBER_TINT_BOTTOM = Color(0xFFF59E0B)

/** The atlas path: one tinted glyph image per placed glyph (core layout, cap units), numbers gold, names in the accent. */
@Composable
private fun BubbleAtlasLine(
    text: String,
    palette: HeadlinePalette,
    sizeDp: Int,
    modifier: Modifier,
    names: List<String>,
    align: androidx.compose.ui.text.style.TextAlign,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val layout = remember(text) { bubbleAtlasLayout(text) }
    val kinds = remember(text, names) {
        val out = ArrayList<HeadlineTokens.Kind>()
        for (t in HeadlineTokens.split(text.uppercase(), names)) repeat(t.text.codePointCount(0, t.text.length)) { out.add(t.kind) }
        out
    }
    val capDp = sizeDp * BUBBLE_CAP_EM
    val lineW = (layout.width * capDp).dp
    val lineH = ((layout.asc + layout.desc) * capDp).dp
    val still = WTheme.calmMotion
    val rim = BubbleAtlasMetrics.RIM_HEX
    Box(
        modifier.height(lineH).semantics { contentDescription = text; heading() },
        contentAlignment = when (align) {
            androidx.compose.ui.text.style.TextAlign.Start, androidx.compose.ui.text.style.TextAlign.Left -> Alignment.CenterStart
            androidx.compose.ui.text.style.TextAlign.End, androidx.compose.ui.text.style.TextAlign.Right -> Alignment.CenterEnd
            else -> Alignment.Center
        },
    ) {
        Box(Modifier.size(lineW, lineH)) {
            layout.places.forEachIndexed { i, g ->
                // Keyed by position + glyph: when the text updates (7 -> 8 OF 18) only changed glyphs remount and pop.
                key(i, g.stem, g.ci) {
                    val kind = kinds.getOrNull(g.ci)
                    val top: Int
                    val bottom: Int
                    when (kind) {
                        HeadlineTokens.Kind.NUMBER -> { top = NUMBER_TINT_TOP.toArgb(); bottom = NUMBER_TINT_BOTTOM.toArgb() }
                        HeadlineTokens.Kind.NAME -> { top = palette.nameTop.toArgb(); bottom = palette.nameBottom.toArgb() }
                        else -> { top = palette.top.toArgb(); bottom = palette.bottom.toArgb() }
                    }
                    val m = BubbleAtlasMetrics.glyphs[g.stem]
                    // Never more pixels than the source art has (cap CAP_PX).
                    val pxW = minOf(with(density) { (g.w * capDp).dp.toPx() }, ((m?.w ?: 0.0) * BubbleAtlasMetrics.CAP_PX).toFloat()).roundToInt()
                    val pxH = minOf(with(density) { (g.h * capDp).dp.toPx() }, ((m?.h ?: 0.0) * BubbleAtlasMetrics.CAP_PX).toFloat()).roundToInt()
                    val f0 = (g.y - (layout.asc - 1)).toFloat()
                    val f1 = (g.y + g.h - (layout.asc - 1)).toFloat()
                    val img = remember(g.stem, pxW, pxH, f0, f1, top, bottom) {
                        BubbleGlyphTint.glyph(context, g.stem, pxW, pxH, f0, f1, top, bottom, rim)
                    }
                    val pop = remember { Animatable(if (still) 1f else 0.6f) }
                    LaunchedEffect(Unit) {
                        if (!still) {
                            delay(i * 25L)
                            pop.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = 380f))
                        }
                    }
                    if (img != null) {
                        Image(
                            img, contentDescription = null, contentScale = ContentScale.FillBounds,
                            modifier = Modifier
                                .offset((g.x * capDp).dp, (g.y * capDp).dp)
                                .size((g.w * capDp).dp, (g.h * capDp).dp)
                                .graphicsLayer {
                                    scaleX = pop.value; scaleY = pop.value
                                    alpha = ((pop.value - 0.6f) / 0.4f).coerceIn(0f, 1f)
                                },
                        )
                    }
                }
            }
        }
    }
}

/** Any changing headline: measures its slot, fits it (core bubbleFit), draws each line centered. */
@Composable
fun BubbleText(
    text: String,
    palette: HeadlinePalette,
    modifier: Modifier = Modifier,
    names: List<String> = emptyList(),
    maxSize: Int = BUBBLE_MAX_SIZE,
    minSize: Int = BUBBLE_MIN_SIZE,
    sound: Boolean = true,
    align: androidx.compose.ui.text.style.TextAlign = androidx.compose.ui.text.style.TextAlign.Center,
) {
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val width = maxWidth.value.toDouble()
        val fit = remember(text, width, maxSize, minSize) { bubbleFit(text, width, maxSize, minSize) }
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = when (align) {
                androidx.compose.ui.text.style.TextAlign.Start, androidx.compose.ui.text.style.TextAlign.Left -> Alignment.Start
                androidx.compose.ui.text.style.TextAlign.End, androidx.compose.ui.text.style.TextAlign.Right -> Alignment.End
                else -> Alignment.CenterHorizontally
            },
        ) {
            fit.lines.forEachIndexed { i, line ->
                BubbleLine(line, palette, fit.size, Modifier.fillMaxWidth(), names = names, sound = sound && i == 0, align = align)
            }
        }
    }
}
