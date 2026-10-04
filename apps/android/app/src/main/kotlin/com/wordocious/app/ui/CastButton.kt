package com.wordocious.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.layout.layoutId
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.tightTextStyle
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt

// FINISH_SPEC BJ15 — cast-color buttons + art labels (docs/design/brand/buttons/cast/README.md,
// cast/labels.json, labels/labels.json). THE primary button (iOS CastButtonStyle / web CastButton parity):
//   · skin   art_btn_<color>_<s|m|l>[_pressed][_dark], three-slice (caps drawn as is, the middle 1-px column stretched)
//   · label  art_btnlabel_<slug> at ONE cap height (0.42 × h); dynamic text → the live Nunito Black fallback
//   · width  label + 2 × max(0.6 × h, 14 dp @44) — the button widens; a fixed slot shrinks the label
//   · press  the _pressed skin + the label drops 1 dp + the squish; dark theme = the _dark skins
// Performance (founder rule #1): [CastArt.prewarm] (App.onCreate, off main) decodes every skin and pre-scales
// every label to its exact pixel height per size, so nothing decodes on a presenting frame or during a tap.

/** The menu cast colors (Stats slate, Puzzles teal, Go Pro gold, Friends pink, VS blue, WOTD green, Guides orange). */
enum class CastColor(val key: String, val deep: Color) {
    PURPLE("purple", Color(0xFF4F0192)),
    TEAL("teal", Color(0xFF016774)),
    GREEN("green", Color(0xFF1A7724)),
    BLUE("blue", Color(0xFF003091)),
    GOLD("gold", Color(0xFF936801)),
    SLATE("slate", Color(0xFF3B3F51)),
    ORANGE("orange", Color(0xFF934400)),
    PINK("pink", Color(0xFF931048)),
}

/** Cast skin heights: s 32 · m 44 · l 56. */
enum class CastSize(val key: String, val height: Dp) { S("s", 32.dp), M("m", 44.dp), L("l", 56.dp) }

/** The screen's cast color — a [CastButton] without a color uses it (default purple). */
val LocalCastColor = compositionLocalOf { CastColor.PURPLE }

/** An old candy color → its cast color: purple → the screen's, amber → gold, quiet peach → slate. */
fun CandyColor.cast(screen: CastColor? = null): CastColor? = when (this) {
    CandyColor.PURPLE -> screen
    CandyColor.AMBER -> CastColor.GOLD
    CandyColor.PEACH -> CastColor.SLATE
    CandyColor.TEAL -> CastColor.TEAL
    CandyColor.PINK -> CastColor.PINK
}

/** An old candy size → the cast size (large 56, medium 44, small 32). */
val CandySize.cast: CastSize get() = when (this) {
    CandySize.LARGE -> CastSize.L
    CandySize.MEDIUM -> CastSize.M
    CandySize.SMALL -> CastSize.S
}

object CastLabels {
    /** Label-art slugs keyed by the label's letters (A–Z / 0–9). ship-labels.py prints this. */
    val art: Map<String, String> = mapOf(
        "PLAY" to "play", "SIGNIN" to "signin", "DONE" to "done", "GOPRO" to "gopro", "REMATCH" to "rematch",
        "HINT" to "hint", "ADDAFRIEND" to "addfriend", "TAKETHETOUR" to "tour", "SEEALL" to "seeall",
        "SHARERESULTS" to "shareresults", "SHARE" to "share", "ACCEPT" to "accept", "NEXT" to "next",
        "PLAYAGAIN" to "playagain", "TRYAGAIN" to "tryagain", "DECLINE" to "decline", "SENDAGIFT" to "sendgift",
        "UPGRADETOPRO" to "upgrade", "GOTIT" to "gotit", "SEEPRO" to "seepro", "LETSPLAY" to "letsplay",
        "CHALLENGETHEM" to "challengethem", "SEEFRIENDS" to "seefriends", "STARTPLAYING" to "startplaying",
        "UNDO" to "undo", "CONTINUE" to "continue", "HOWTOPLAY" to "howtoplay", "SKIP" to "skip",
        "SHARELINK" to "sharelink", "ERASE" to "erase", "KEEPPLAYING" to "keepplaying", "SAVE" to "save",
        "NOTNOW" to "notnow", "START" to "start", "SIGNUP" to "signup", "INVITE" to "invite", "HEADS" to "heads",
        "TAILS" to "tails", "COPIED" to "copied",
    )

    fun key(text: String): String = text.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }
    fun slug(text: String): String? = art[key(text)]
    /** max(0.6 × h, 14 dp at 44). */
    fun inset(h: Dp): Dp = max(0.6f * h.value, 14f * h.value / 44f).dp
    /** The cap height in whole pixels. */
    fun capPx(h: Dp, density: Float): Int = (h.value * 0.42f * density).roundToInt()
}

/** Decoded skins + pre-scaled labels (thread-safe; filled off main by [prewarm]). */
object CastArt {
    private val skins = ConcurrentHashMap<String, ImageBitmap>()
    private val labels = ConcurrentHashMap<String, ImageBitmap>()

    private fun id(context: Context, name: String): Int =
        context.resources.getIdentifier(name, "drawable", context.packageName)

    private fun decode(context: Context, name: String): Bitmap? {
        val id = id(context, name)
        if (id == 0) return null
        return BitmapFactory.decodeResource(context.resources, id, BitmapFactory.Options().apply { inScaled = false })
    }

    fun skinName(c: CastColor, s: CastSize, pressed: Boolean, dark: Boolean) =
        "art_btn_${c.key}_${s.key}${if (pressed) "_pressed" else ""}${if (dark) "_dark" else ""}"

    fun skin(context: Context, c: CastColor, s: CastSize, pressed: Boolean, dark: Boolean): ImageBitmap? {
        val name = skinName(c, s, pressed, dark)
        skins[name]?.let { return it }
        val bmp = decode(context, name) ?: return null
        bmp.prepareToDraw()
        return bmp.asImageBitmap().also { skins[name] = it }
    }

    /** A label pre-scaled to [px] pixels tall (drawn 1:1 — never resampled on screen). */
    fun label(context: Context, slug: String, px: Int): ImageBitmap? {
        val key = "$slug@$px"
        labels[key]?.let { return it }
        val src = decode(context, "art_btnlabel_$slug") ?: return null
        val w = max(1, (src.width * px.toFloat() / src.height).roundToInt())
        val out = if (src.height == px) src else Bitmap.createScaledBitmap(src, w, px, true)
        out.prepareToDraw()
        return out.asImageBitmap().also { labels[key] = it }
    }

    /** Decode every skin + every label at each size's pixel height. Call off main (App.onCreate). */
    fun prewarm(context: Context, density: Float) {
        for (c in CastColor.entries) for (s in CastSize.entries) for (p in listOf(false, true)) for (d in listOf(false, true)) {
            skin(context, c, s, p, d)
        }
        for (slug in CastLabels.art.values.toSet()) for (s in CastSize.entries) label(context, slug, CastLabels.capPx(s.height, density))
    }
}

/**
 * FINISH_SPEC BJ15 THE primary button: a cast-color skin with an art label ([text] looked up by its
 * letters; dynamic text falls back to live lettering at the same cap height). [color] null = the
 * screen's [LocalCastColor]. [fill] = stretch to the width given; otherwise hug the label.
 */
@Composable
fun CastButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: CastColor? = null,
    size: CastSize = CastSize.L,
    fill: Boolean = false,
    enabled: Boolean = true,
    contentDescription: String = text,
    leading: (@Composable () -> Unit)? = null,
    /** BJ15 round 2: a small live line under the label art, inside the same height (the share candy's countdown). */
    subtitle: String? = null,
) {
    val c = color ?: LocalCastColor.current
    val context = LocalContext.current
    val dark = WTheme.isDark
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val still = WTheme.reducedMotion
    val press by androidx.compose.animation.core.animateFloatAsState(
        if (pressed && !still) 1f else 0f,
        if (pressed) androidx.compose.animation.core.tween(70)
        else androidx.compose.animation.core.spring(dampingRatio = 0.3f, stiffness = 700f),
        label = "castPress",
    )
    val skin = remember(c, size, pressed, dark) { CastArt.skin(context, c, size, pressed, dark) }
    val h = size.height
    Box(
        modifier
            .then(if (fill) Modifier.fillMaxWidth() else Modifier)
            .height(h)
            .widthIn(min = h * 1.6f)
            .graphicsLayer {
                val s = 1f - 0.08f * press
                scaleX = s; scaleY = s
                alpha = if (enabled) 1f else 0.55f
            }
            .squishFeedback(interaction)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                this.contentDescription = contentDescription
            }
            .drawBehind { skin?.let { drawThreeSlice(it) } }
            .padding(horizontal = CastLabels.inset(h)),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            Modifier.offset(y = if (pressed) 1.dp else 0.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            leading?.invoke()
            if (subtitle == null) {
                CastLabel(text, c, size)
            } else {
                androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CastLabel(text, c, size, capScale = 0.78f)
                    CastLiveText(subtitle, c, size.height.value * 0.18f)
                }
            }
        }
    }
}

/** The three-slice: left half + right half drawn as is (scaled to the height), the middle 1-px column stretched. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawThreeSlice(img: ImageBitmap) {
    val k = size.height / img.height
    val left = floor(img.width / 2f).toInt()
    val right = img.width - left - 1
    val lw = (left * k).roundToInt()
    val rw = (right * k).roundToInt()
    val hh = size.height.roundToInt()
    val w = size.width.roundToInt()
    val mid = max(0, w - lw - rw)
    val fq = FilterQuality.High
    drawImage(img, IntOffset(0, 0), IntSize(left, img.height), IntOffset(0, 0), IntSize(lw, hh), filterQuality = fq)
    if (mid > 0) drawImage(img, IntOffset(left, 0), IntSize(1, img.height), IntOffset(lw, 0), IntSize(mid, hh), filterQuality = fq)
    drawImage(img, IntOffset(left + 1, 0), IntSize(right, img.height), IntOffset(lw + mid, 0), IntSize(rw, hh), filterQuality = fq)
}

/** The label: art lettering at the cap height (shrinks only in a fixed slot), or the live fallback. */
@Composable
fun CastLabel(text: String, color: CastColor, size: CastSize, capScale: Float = 1f) {
    val context = LocalContext.current
    val density = LocalDensity.current.density
    val capPx = CastLabels.capPx(size.height * capScale, density)
    val slug = CastLabels.slug(text)
    val img = remember(slug, capPx) { slug?.let { CastArt.label(context, it, capPx) } }
    if (img != null) {
        Box(Modifier.shrinkToSlot(), contentAlignment = Alignment.Center) {
            // Drawn 1:1 at the pre-scaled pixel size; only a too-narrow slot scales it down (shrinkToSlot).
            val k = 1f
            val wDp = (img.width / density).dp
            val hDp = (img.height / density).dp
            val shadow = color.deep.copy(alpha = 0.56f)
            val halo = Color(0xFF9A5A00).copy(alpha = 0.55f)
            val gold = color == CastColor.GOLD
            Canvas(Modifier.size(wDp, hDp)) {
                val dst = IntSize(this.size.width.roundToInt(), this.size.height.roundToInt())
                val src = IntSize(img.width, img.height)
                val tint = ColorFilter.tint(shadow)
                // labels.json artLabelShadow: the label's alpha in the deep hue, 1 dp down (soft: two passes).
                drawImage(img, IntOffset.Zero, src, IntOffset(0, (1f * density).roundToInt()), dst, alpha = 0.6f, colorFilter = tint)
                drawImage(img, IntOffset.Zero, src, IntOffset(0, (1.6f * density).roundToInt()), dst, alpha = 0.35f, colorFilter = tint)
                if (gold) {
                    // gold.artHalo: a deeper-amber ring behind the cream label (0.75 dp spread).
                    val r = (0.75f * density).roundToInt().coerceAtLeast(1)
                    val ht = ColorFilter.tint(halo)
                    for ((dx, dy) in listOf(r to 0, -r to 0, 0 to r, 0 to -r, r to r, -r to r, r to -r, -r to -r)) {
                        drawImage(img, IntOffset.Zero, src, IntOffset(dx, dy), dst, alpha = 0.6f, colorFilter = ht)
                    }
                }
                drawImage(img, IntOffset.Zero, src, IntOffset.Zero, dst, filterQuality = if (k == 1f) FilterQuality.None else FilterQuality.High)
            }
        }
    } else {
        CastLiveText(text.uppercase(), color, capPx / density)
    }
}

/** labels.json live fallback: white Nunito Black, a thin same-hue stroke, a soft same-hue shadow;
 *  sized so its cap height matches the art labels (cap ratio 0.75, round 2). */
@Composable
fun CastLiveText(text: String, color: CastColor, capDp: Float) {
    val d = LocalDensity.current
    val full = (capDp / 0.75f / d.fontScale).sp
    val px = d.density
    val base = tightTextStyle(TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = full, letterSpacing = 0.01.em))
    // Round 2: measured at full size, then scaled down to the slot (never clipped), centered.
    Box(
        Modifier.shrinkToSlot(),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text, maxLines = 1, overflow = TextOverflow.Visible, softWrap = false,
            style = base.copy(
                color = color.deep,
                drawStyle = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.2f * px, join = androidx.compose.ui.graphics.StrokeJoin.Round),
                shadow = Shadow(color.deep.copy(alpha = 0.35f), Offset(0f, 1f * px), 2f * px),
            ),
        )
        Text(text, maxLines = 1, overflow = TextOverflow.Visible, softWrap = false, style = base.copy(color = Color.White))
    }
}

/** BJ15 round 2: text links / tertiary actions stay text (never a cast pill) — brand purple, heavy, no outline. */
@Composable
fun TextLink(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, fontSize: androidx.compose.ui.unit.TextUnit = 14.sp) {
    val interaction = remember { MutableInteractionSource() }
    Text(
        text,
        modifier = modifier
            .squishFeedback(interaction)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .semantics { role = Role.Button }
            .padding(vertical = 6.dp, horizontal = 2.dp),
        style = TextStyle(
            fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = fontSize,
            color = if (WTheme.isDark) Color(0xFFC4A5FF) else Color(0xFF7C3AED),
        ),
        maxLines = 1,
    )
}

/** Round 2: measure the content at its natural width; if the slot is narrower, scale it down to fit
 *  (centered) instead of clipping. Labels never scale up. */
private fun Modifier.shrinkToSlot(): Modifier = layout { m, c ->
    val p = m.measure(c.copy(minWidth = 0, maxWidth = androidx.compose.ui.unit.Constraints.Infinity))
    val w = if (c.hasBoundedWidth) minOf(p.width, c.maxWidth) else p.width
    val k = if (p.width > 0) w.toFloat() / p.width else 1f
    layout(w, p.height) {
        p.placeWithLayer((w - p.width) / 2, 0) { scaleX = k; scaleY = k }
    }
}

/** [CastButtonRow]: this item shares the line's spare width (a cast button); unmarked items keep their size. */
fun Modifier.castFlex(): Modifier = this.then(Modifier.layoutId(CAST_FLEX))

private const val CAST_FLEX = "castFlex"

/**
 * FINISH_SPEC BJ17: a row of cast buttons whose labels must all render at ONE cap height
 * (the finished dock's SHARE RESULTS beside Next / Leaderboard was squeezed to ~64% while its
 * neighbor stayed full size). Every item is measured at its natural width; a line takes items
 * while its [castFlex] items fit at EQUAL widths (each as wide as the widest of them) beside the
 * fixed ones, and then they split the line equally. When they cannot, the next item wraps to a
 * new line (full width), so a label never shrinks. Items align to the top (the share candy's
 * countdown caption hangs below its button); fixed items center on the [controlHeight] band.
 * iOS: CastButtonRow (Layout), web: .cast-row (flex-wrap).
 */
@Composable
fun CastButtonRow(
    modifier: Modifier = Modifier,
    spacing: Dp = 8.dp,
    lineSpacing: Dp = 8.dp,
    /** The row's cast-button height: fixed items (chips, round buttons) center on it. */
    controlHeight: Dp = CastSize.M.height,
    content: @Composable () -> Unit,
) {
    androidx.compose.ui.layout.Layout(content, modifier) { ms, c ->
        val gap = spacing.roundToPx()
        val lineGap = lineSpacing.roundToPx()
        val control = controlHeight.roundToPx()
        val maxW = if (c.hasBoundedWidth) c.maxWidth else Int.MAX_VALUE / 4
        val flex = ms.map { it.layoutId == CAST_FLEX }
        val natural = ms.map { it.maxIntrinsicWidth(androidx.compose.ui.unit.Constraints.Infinity).coerceAtMost(maxW) }
        // Greedy lines: fixed widths + gaps + (flex count × widest flex) must fit.
        val lines = mutableListOf<MutableList<Int>>()
        var cur = mutableListOf<Int>()
        fun fits(items: List<Int>): Boolean {
            val fixed = items.filter { !flex[it] }.sumOf { natural[it] }
            val flexIdx = items.filter { flex[it] }
            val widest = flexIdx.maxOfOrNull { natural[it] } ?: 0
            return fixed + gap * (items.size - 1) + widest * flexIdx.size <= maxW
        }
        for (i in ms.indices) {
            if (cur.isEmpty() || fits(cur + i)) cur.add(i) else { lines.add(cur); cur = mutableListOf(i) }
        }
        if (cur.isNotEmpty()) lines.add(cur)
        val rowW = if (c.hasBoundedWidth) c.maxWidth else lines.maxOfOrNull { l -> l.sumOf { natural[it] } + gap * (l.size - 1) } ?: 0
        val placed = lines.map { l ->
            val fixed = l.filter { !flex[it] }.sumOf { natural[it] }
            val nFlex = l.count { flex[it] }
            val share = if (nFlex > 0) ((rowW - fixed - gap * (l.size - 1)) / nFlex).coerceAtLeast(0) else 0
            l.map { i ->
                val w = if (flex[i]) share else natural[i]
                i to ms[i].measure(androidx.compose.ui.unit.Constraints(minWidth = if (flex[i]) w else 0, maxWidth = w, maxHeight = c.maxHeight))
            }
        }
        fun dy(i: Int, h: Int) = if (flex[i]) 0 else ((control - h) / 2).coerceAtLeast(0)
        val heights = placed.map { l -> l.maxOf { (i, p) -> p.height + dy(i, p.height) } }
        val totalH = heights.sum() + lineGap * (heights.size - 1).coerceAtLeast(0)
        layout(rowW, totalH.coerceIn(c.minHeight, c.maxHeight)) {
            var y = 0
            placed.forEachIndexed { li, l ->
                val used = l.sumOf { it.second.width } + gap * (l.size - 1)
                var x = ((rowW - used) / 2).coerceAtLeast(0)
                for ((i, p) in l) {
                    p.place(x, y + dy(i, p.height)); x += p.width + gap
                }
                y += heights[li] + lineGap
            }
        }
    }
}
