package com.wordocious.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.CanvasDrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import kotlin.math.roundToInt

// FINISH_SPEC AR: live lettering for the rotating personalized headlines. Any dynamic
// headline ("WARMING UP · 3 DOWN", "OLIVER LEADS TODAY'S RACE", "YOU'RE #3 TODAY") drawn in
// the title-art style in code: Nunito Black caps, a vertical palette gradient, a thin gold
// outline behind the fill, a 3-step extrusion in the palette's deep shade, a soft white gloss
// on the top of each line and a soft drop shadow. Numbers are gold soft numbers (a touch
// bigger), names take the palette's accent gradient, "·" becomes the tiny gold star sprite.
// The static layers are rasterized ONCE per text + size into a bitmap; the letter-pop
// entrance and the idle gloss sweep only redraw that bitmap (draw phase, no recomposition).

/**
 * AR the layout helpers; the token splitting itself is core [com.wordocious.core.HeadlineTokens]
 * (the web splitter's port, fixture-tested). Headlines are uppercased before splitting.
 */
object HeadlineTokens {
    const val STAR = com.wordocious.core.HeadlineTokens.STAR

    /** The headline's tokens, uppercased (names still match case-insensitively). */
    fun split(text: String, names: List<String> = emptyList()): List<com.wordocious.core.HeadlineTokens.Token> =
        com.wordocious.core.HeadlineTokens.split(text.uppercase(), names)

    /** The space nearest the middle of [text] (a balanced two-line break), or -1 with no space. */
    fun balancedBreak(text: String): Int {
        val mid = text.length / 2f
        var best = -1
        text.forEachIndexed { i, c -> if (c == ' ' && (best < 0 || kotlin.math.abs(i - mid) < kotlin.math.abs(best - mid))) best = i }
        return best
    }
}

/**
 * AR the palettes: the main fill (top → bottom), the extrusion shade, the name accent and the
 * outline (gold; cream on the gold palettes so the outline still reads — iOS parity).
 */
data class HeadlinePalette(
    val top: Color, val bottom: Color, val deep: Color, val nameTop: Color, val nameBottom: Color,
    val outline: Color = Color(0xFFF5C542),
) {
    companion object {
        /** Home banner: purple → magenta. */
        val HOME = HeadlinePalette(Color(0xFF8B5CF6), Color(0xFFD946EF), Color(0xFF4C1D95), Color(0xFFF472B6), Color(0xFFF97316))
        /** Friends race: pink → orange. */
        val FRIENDS = HeadlinePalette(Color(0xFFF472B6), Color(0xFFF97316), Color(0xFF9D174D), Color(0xFFA855F7), Color(0xFF7C3AED))
        /** Leaderboard / Records: gold → amber. */
        val LEADERBOARD = HeadlinePalette(Color(0xFFFCD34D), Color(0xFFF59E0B), Color(0xFF92400E), Color(0xFFA855F7), Color(0xFF7C3AED), OUTLINE_CREAM)
        /** VS: teal → blue. */
        val VS = HeadlinePalette(Color(0xFF2DD4BF), Color(0xFF3B82F6), Color(0xFF1E3A8A), Color(0xFFF472B6), Color(0xFFEC4899))
        /** Stats: blue → violet. */
        val STATS = HeadlinePalette(Color(0xFF60A5FA), Color(0xFF8B5CF6), Color(0xFF312E81), Color(0xFFF472B6), Color(0xFFEC4899))
        /** Celebrations (DOUBLE SWEEP!, FLAWLESS, finish strips): gold. */
        val CELEBRATION = HeadlinePalette(Color(0xFFFDE68A), Color(0xFFF59E0B), Color(0xFFB45309), Color(0xFFA855F7), Color(0xFF7C3AED), OUTLINE_CREAM)

        /** A season's hero greeting lettering (registry surfaces `headline`: top, bottom, deep,
         *  nameTop, nameBottom; gold outline). iOS SeasonKit.Look.headlinePalette. */
        fun season(h: List<Color>?): HeadlinePalette? =
            h?.takeIf { it.size == 5 }?.let { HeadlinePalette(it[0], it[1], it[2], it[3], it[4]) }
    }
}

private val OUTLINE_CREAM = Color(0xFFFFF7D6)
private val NUMBER_TOP = Color(0xFFFFE9A3)
private val NUMBER_BOTTOM = Color(0xFFF59E0B)
private const val NUMBER_SCALE = 1.12f
private const val POP_STAGGER_MS = 25
private const val POP_MS = 260
private const val SWEEP_PERIOD_MS = 6000
private const val SWEEP_MS = 900

/** The measured + rasterized headline. */
private class HeadlineArt(
    val bitmap: ImageBitmap,
    val pad: Float,
    /** Each visible glyph's box in bitmap coordinates (letters and stars, no spaces). */
    val glyphs: List<Rect>,
)

/**
 * AR the shared live headline: [text] in the title-art lettering for [palette]. [names]
 * mark the player / friend names in the text. Auto-shrinks from [maxSize] to [minSize] on
 * one line before breaking into two balanced lines; letters pop in left → right when the
 * text changes (and on first show) with a tiny tick; a slow gloss sweep idles every ~6 s.
 * Reduce Motion / calm: no pop, no sweep. Announced as a heading with the plain text.
 */
@Composable
fun LiveHeadline(
    text: String,
    palette: HeadlinePalette,
    modifier: Modifier = Modifier,
    names: List<String> = emptyList(),
    maxSize: TextUnit = 26.sp,
    minSize: TextUnit = 14.sp,
    align: TextAlign = TextAlign.Center,
    maxLines: Int = 2,
    /** The pop's tiny tick (off for a layer that is laid out but not shown). */
    sound: Boolean = true,
) {
    val measurer = rememberTextMeasurer(cacheSize = 4)
    val fontResolver = androidx.compose.ui.platform.LocalFontFamilyResolver.current
    val star = ImageBitmap.imageResource(R.drawable.art_badge_icon_star_sprite)
    val reduced = WTheme.reducedMotion
    val calm = WTheme.calmMotion
    val paused = ambientMotionPaused()
    BoxWithConstraints(
        modifier.semantics { contentDescription = text; heading() },
        contentAlignment = when (align) {
            TextAlign.Start, TextAlign.Left -> Alignment.CenterStart
            TextAlign.End, TextAlign.Right -> Alignment.CenterEnd
            else -> Alignment.Center
        },
    ) {
        val density = androidx.compose.ui.platform.LocalDensity.current
        val availPx = constraints.maxWidth.takeIf { it != Constraints.Infinity } ?: with(density) { 360.dp.roundToPx() }
        val art = remember(text, palette, names, availPx, maxSize, minSize, align, maxLines, density, star) {
            buildHeadlineArt(measurer, fontResolver, density, text, palette, names, availPx, maxSize, minSize, align, maxLines, star)
        }
        val n = art.glyphs.size
        val total = if (n == 0) 0 else (n - 1) * POP_STAGGER_MS + POP_MS
        val still = reduced || calm
        val pop = remember { Animatable(Float.MAX_VALUE) }
        LaunchedEffect(text) {
            if (still || n == 0) { pop.snapTo(Float.MAX_VALUE); return@LaunchedEffect }
            pop.snapTo(0f)
            // BI7: rotating headlines are silent — they change on their own, not on a tap.
            pop.animateTo(total.toFloat(), tween(total, easing = LinearEasing))
            pop.snapTo(Float.MAX_VALUE)
        }
        // Perf (2026-10-02 measured audit): the band is visible for SWEEP_MS of every
        // SWEEP_PERIOD_MS, but an infinite transition over the whole period asked for a frame
        // (and redrew this offscreen layer) on every vsync of the idle 5.1 s too. Animate only
        // the visible pass, then wait — identical timing, ~85% fewer idle frames.
        val sweepAnim = remember { Animatable(-1f) }
        LaunchedEffect(still, paused) {
            sweepAnim.snapTo(-1f)
            if (still || paused) return@LaunchedEffect
            while (true) {
                sweepAnim.snapTo(0f)
                sweepAnim.animateTo(SWEEP_MS.toFloat(), tween(SWEEP_MS, easing = LinearEasing))
                sweepAnim.snapTo(-1f)
                kotlinx.coroutines.delay((SWEEP_PERIOD_MS - SWEEP_MS).toLong())
            }
        }
        val sweep: State<Float> = sweepAnim.asState()
        val wDp = with(density) { art.bitmap.width.toDp() }
        val hDp = with(density) { art.bitmap.height.toDp() }
        Box(Modifier.size(wDp, hDp).graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
            Canvas(Modifier.size(wDp, hDp)) {
                val t = pop.value
                if (t >= total) {
                    drawImage(art.bitmap)
                } else {
                    art.glyphs.forEachIndexed { i, r ->
                        val u = ((t - i * POP_STAGGER_MS) / POP_MS).coerceIn(0f, 1f)
                        if (u <= 0f) return@forEachIndexed
                        // 0.6 → 1.08 → 1.
                        val s = if (u < 0.65f) 0.6f + 0.48f * (u / 0.65f) else 1.08f - 0.08f * ((u - 0.65f) / 0.35f)
                        val c = r.center
                        val dw = r.width * s
                        val dh = r.height * s
                        drawImage(
                            art.bitmap,
                            srcOffset = IntOffset(r.left.roundToInt(), r.top.roundToInt()),
                            srcSize = IntSize(r.width.roundToInt().coerceAtLeast(1), r.height.roundToInt().coerceAtLeast(1)),
                            dstOffset = IntOffset((c.x - dw / 2f).roundToInt(), (c.y - dh / 2f).roundToInt()),
                            dstSize = IntSize(dw.roundToInt().coerceAtLeast(1), dh.roundToInt().coerceAtLeast(1)),
                            alpha = (u * 2.5f).coerceAtMost(1f),
                        )
                    }
                }
                // The idle gloss sweep: one soft diagonal band across the lettering.
                val st = sweep.value
                if (st in 0f..SWEEP_MS.toFloat() && t >= total) {
                    val p = st / SWEEP_MS
                    val band = size.width * 0.25f
                    val x = -band + p * (size.width + band * 2f)
                    drawRect(
                        Brush.linearGradient(
                            listOf(Color.White.copy(alpha = 0f), Color.White.copy(alpha = 0.55f), Color.White.copy(alpha = 0f)),
                            start = Offset(x - band / 2f, 0f), end = Offset(x + band / 2f, size.height),
                        ),
                        blendMode = BlendMode.SrcAtop,
                    )
                }
            }
        }
    }
}

private fun buildHeadlineArt(
    measurer: androidx.compose.ui.text.TextMeasurer,
    fontResolver: androidx.compose.ui.text.font.FontFamily.Resolver,
    density: androidx.compose.ui.unit.Density,
    text: String,
    palette: HeadlinePalette,
    names: List<String>,
    availPx: Int,
    maxSize: TextUnit,
    minSize: TextUnit,
    align: TextAlign,
    maxLines: Int,
    star: ImageBitmap,
): HeadlineArt {
    val pxPerDp = density.density
    fun padFor(sizeSp: Float) = (sizeSp * density.fontScale * pxPerDp * 0.12f).coerceAtLeast(3f * pxPerDp) + 5f * pxPerDp

    /** Measure [s] at [sizeSp]; [styled] = with the token brushes (else plain, same geometry). */
    fun measure(s: String, sizeSp: Float, styled: Boolean, wrap: Boolean, m: androidx.compose.ui.text.TextMeasurer = measurer): TextLayoutResult {
        val tokens = HeadlineTokens.split(s, names)
        val placeholders = ArrayList<AnnotatedString.Range<Placeholder>>()
        val annotated = buildAnnotatedString {
            for (tk in tokens) {
                val start = length
                when (tk.kind) {
                    com.wordocious.core.HeadlineTokens.Kind.STAR -> {
                        append(HeadlineTokens.STAR)
                        placeholders += AnnotatedString.Range(Placeholder(0.62.em, 0.62.em, PlaceholderVerticalAlign.TextCenter), start, length)
                    }
                    com.wordocious.core.HeadlineTokens.Kind.NUMBER -> {
                        append(tk.text)
                        addStyle(
                            if (styled) SpanStyle(fontSize = (sizeSp * NUMBER_SCALE).sp, brush = Brush.verticalGradient(listOf(NUMBER_TOP, NUMBER_BOTTOM)))
                            else SpanStyle(fontSize = (sizeSp * NUMBER_SCALE).sp),
                            start, length,
                        )
                    }
                    com.wordocious.core.HeadlineTokens.Kind.NAME -> {
                        append(tk.text)
                        if (styled) addStyle(SpanStyle(brush = Brush.verticalGradient(listOf(palette.nameTop, palette.nameBottom))), start, length)
                    }
                    com.wordocious.core.HeadlineTokens.Kind.TEXT -> append(tk.text)
                }
            }
        }
        val style = TextStyle(
            fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = sizeSp.sp,
            letterSpacing = (-0.01).em, textAlign = align, lineHeight = (sizeSp * 1.12f).sp,
            brush = if (styled) Brush.verticalGradient(listOf(palette.top, palette.bottom)) else null,
        )
        val width = (availPx - 2 * padFor(sizeSp)).roundToInt().coerceAtLeast(1)
        return m.measure(
            annotated, style, softWrap = wrap, maxLines = maxLines,
            constraints = Constraints(maxWidth = width), density = density, placeholders = placeholders,
        )
    }

    val maxSp = maxSize.value
    val minSp = minSize.value.coerceAtMost(maxSp)
    fun fits(r: TextLayoutResult) = !r.didOverflowWidth && !r.hasVisualOverflow
    // 1. One line, shrinking. 2. Two balanced lines, shrinking. 3. Wrap at the minimum.
    var chosenText = text
    var chosenSp = minSp
    var wrap = true
    var found = false
    run {
        var sp = maxSp
        while (sp >= minSp) {
            if (fits(measure(text, sp, styled = false, wrap = false))) { chosenSp = sp; wrap = false; found = true; return@run }
            sp -= 1f
        }
    }
    if (!found && maxLines >= 2) {
        val br = HeadlineTokens.balancedBreak(text)
        if (br > 0) {
            val two = text.substring(0, br) + "\n" + text.substring(br + 1)
            var sp = maxSp
            while (sp >= minSp) {
                if (fits(measure(two, sp, styled = false, wrap = false))) { chosenText = two; chosenSp = sp; wrap = false; found = true; break }
                sp -= 1f
            }
        }
    }
    if (!found) { chosenText = text; chosenSp = minSp; wrap = true }

    // The layers draw on FRESH, uncached paragraphs. A paragraph's paint keeps its last
    // DrawStyle / shader between draws, and the shared measurer's cache hands the same paragraph
    // back to later builds (and, brush being draw-only, to `plain` and `styled` alike) — so a
    // rebuild could draw the outline or fill with a leftover Stroke / gradient: fat, hole-less
    // letters (founder 10-05: "the text is hard to read on android").
    val fresh = androidx.compose.ui.text.TextMeasurer(fontResolver, density, LayoutDirection.Ltr, cacheSize = 0)
    val plain = measure(chosenText, chosenSp, styled = false, wrap = wrap, m = fresh)
    val styled = measure(chosenText, chosenSp, styled = true, wrap = wrap, m = fresh)
    val pad = padFor(chosenSp)
    val w = (plain.size.width + pad * 2).roundToInt().coerceAtLeast(1)
    val h = (plain.size.height + pad * 2).roundToInt().coerceAtLeast(1)
    val bitmap = ImageBitmap(w, h)
    // iOS parity (LiveHeadline.swift `lettering`): the outline reaches 6% of the glyph size past
    // the fill and each 3D edge step is 4.5%. The old 10% half-stroke (up to 4 dp, i.e. an 8 dp
    // stroke) also ran INTO the letters, closing the holes of O / D / A on phones — founder
    // 10-05: "the text is hard to read on android".
    val fontPx = chosenSp * density.fontScale * pxPerDp
    val stroke = (fontPx * 0.06f).coerceIn(1f * pxPerDp, 2.5f * pxPerDp)
    val step = (fontPx * 0.045f).coerceIn(0.75f * pxPerDp, 2f * pxPerDp)
    val lineH = if (plain.lineCount > 0) plain.size.height / plain.lineCount.toFloat() else plain.size.height.toFloat()
    CanvasDrawScope().draw(density, LayoutDirection.Ltr, androidx.compose.ui.graphics.Canvas(bitmap), Size(w.toFloat(), h.toFloat())) {
        val o = Offset(pad, pad)
        // Drop shadow under the deepest extrusion step (filled glyphs, so it never fills a hole).
        drawText(plain, color = palette.deep.copy(alpha = 0.55f), topLeft = o + Offset(0f, step * 4f),
            shadow = Shadow(Color.Black.copy(alpha = 0.28f), Offset(0f, 2f * pxPerDp), 6f * pxPerDp), drawStyle = Fill)
        // The 3D edge: 3 stacked offsets in the deep shade, glyph fills only (iOS parity).
        for (k in 3 downTo 1) {
            drawText(plain, color = palette.deep, topLeft = o + Offset(0f, step * k), drawStyle = Fill)
        }
        // The thin outline behind the fill (gold; cream on the gold palettes).
        drawText(plain, color = palette.outline, topLeft = o, drawStyle = Stroke(stroke * 2f))
        // The fill: palette gradient, gold numbers, accent names. drawStyle = Fill is REQUIRED:
        // Compose keeps a paragraph's last DrawStyle when none is passed, and TextMeasurer's cache
        // can hand `styled` and `plain` the same paragraph (brush is draw-only), so without it the
        // fill (and the gloss) inherit the outline's Stroke — hollow letters, holes painted over.
        drawText(styled, topLeft = o, drawStyle = Fill)
        // The gloss: soft white on the top ~40% of each line.
        drawText(
            plain,
            brush = Brush.verticalGradient(
                0f to Color.White.copy(alpha = 0.5f), 0.4f to Color.White.copy(alpha = 0f), 1f to Color.White.copy(alpha = 0f),
                startY = 0f, endY = lineH, tileMode = TileMode.Repeated,
            ),
            topLeft = o,
            drawStyle = Fill,
        )
        // "·" → the tiny gold star sprite.
        plain.placeholderRects.forEach { r ->
            if (r == null) return@forEach
            drawImage(
                star,
                dstOffset = IntOffset((r.left + pad).roundToInt(), (r.top + pad).roundToInt()),
                dstSize = IntSize(r.width.roundToInt().coerceAtLeast(1), r.height.roundToInt().coerceAtLeast(1)),
            )
        }
    }
    // Glyph boxes for the letter pop (bitmap coordinates, grown by the outline + extrusion).
    val glyphs = ArrayList<Rect>()
    val grow = stroke + step * 4f
    val placeholderIdx = HashSet<Int>()
    run {
        var i = 0
        val txt = plain.layoutInput.text.text
        while (i < txt.length) { if (txt[i] == HeadlineTokens.STAR) placeholderIdx.add(i); i++ }
    }
    val txt = plain.layoutInput.text.text
    var starN = 0
    for (i in txt.indices) {
        val c = txt[i]
        if (c.isWhitespace()) continue
        val box = if (i in placeholderIdx) plain.placeholderRects.getOrNull(starN++) ?: continue else plain.getBoundingBox(i)
        if (box.width <= 0f) continue
        glyphs += Rect(box.left + pad - stroke, box.top + pad - stroke, box.right + pad + stroke, box.bottom + pad + grow)
            .intersect(Rect(0f, 0f, w.toFloat(), h.toFloat()))
    }
    return HeadlineArt(bitmap, pad, glyphs)
}
