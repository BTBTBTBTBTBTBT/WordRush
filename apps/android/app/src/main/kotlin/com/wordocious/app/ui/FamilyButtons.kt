package com.wordocious.app.ui

import android.content.Context
import android.graphics.BitmapFactory
import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
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
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.tightTextStyle
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.roundToInt

// The button family (docs/design/brand/buttons/family/README.md; iOS FamilyButtons, web family-button.tsx):
// everything that is not a primary cast button. Technique = FILL + LIGHT MAP: draw the plain shape fill (any
// color), then the art_fam_lm_* sprite (the ChatGPT gloss + shading as a white/black overlay with alpha) on top —
// three-sliced for pills (caps = h / 2, only the middle stretches), nine-sliced for keys (corner 31 px = 10.33 dp).
// One sprite serves every game tint, pressed, dark mode and the colorblind tile palettes.
//   HELPER  34 dp, the game accent's wash, a tinted 3D icon + Nunito Black 12.5 uppercase label in the deep tint
//   QUIET   lavender #ece4ff, purple ink #5b21b6 (large 44 · medium 40 · small 34)
//   ROUND   a bare 28 dp 3D icon in a 44 dp hit area, squish .9
// Performance: [FamilyArt.prewarm] (App.onCreate, off main) decodes every sprite before a button paints.

/** The helper icons (`art_fam_ic_*`): white clay, tinted by MULTIPLY with the ink. */
enum class FamIcon(@DrawableRes val res: Int) {
    DELETE(R.drawable.art_fam_ic_delete), SHUFFLE(R.drawable.art_fam_ic_shuffle), ENTER(R.drawable.art_fam_ic_enter),
    HINT(R.drawable.art_fam_ic_hint), EYE(R.drawable.art_fam_ic_eye), FLAG(R.drawable.art_fam_ic_flag),
    CHECK(R.drawable.art_fam_ic_check), UNDO(R.drawable.art_fam_ic_undo), NEXT(R.drawable.art_fam_ic_next),
    REFRESH(R.drawable.art_fam_ic_refresh), SPARKLES(R.drawable.art_fam_ic_sparkles), PENCIL(R.drawable.art_fam_ic_pencil),
    ERASE(R.drawable.art_fam_ic_erase), XMARK(R.drawable.art_fam_ic_xmark), PLAY(R.drawable.art_fam_ic_play),
    CHART(R.drawable.art_fam_ic_chart),
    ;

    companion object {
        /** A Material icon → its family art (README symbol map), or null (then the vector is drawn in the ink). */
        fun of(vector: ImageVector): FamIcon? = when (vector.name.substringAfterLast('.')) {
            "Backspace" -> DELETE
            "Shuffle" -> SHUFFLE
            "KeyboardReturn" -> ENTER
            "Lightbulb" -> HINT
            "Visibility" -> EYE
            "Flag" -> FLAG
            "Check", "CheckCircle", "DoneAll" -> CHECK
            "Undo", "Replay" -> UNDO
            "ArrowForward", "FastForward" -> NEXT
            "Refresh", "Repeat" -> REFRESH
            "AutoAwesome" -> SPARKLES
            "Edit" -> PENCIL
            "Close", "Cancel" -> XMARK
            "PlayArrow" -> PLAY
            "BarChart" -> CHART
            else -> null
        }

        /** The old candy glyphs → family art (SHARE has none: the vector glyph in the ink). */
        fun of(icon: CandyIcon): FamIcon? = when (icon) {
            CandyIcon.PLAY -> PLAY
            CandyIcon.EYE -> EYE
            CandyIcon.ARROW -> NEXT
            CandyIcon.SHARE -> null
        }
    }
}

/** The chrome icons (`art_fam_cic_*`), drawn as they are. */
enum class FamChrome(@DrawableRes val res: Int) {
    CLOSE(R.drawable.art_fam_cic_close), INFO(R.drawable.art_fam_cic_info), GEM(R.drawable.art_fam_cic_gem),
}

/** Decoded family sprites (thread-safe; filled off main by [prewarm]). */
object FamilyArt {
    val LM_FROST = R.drawable.art_fam_lm_frost
    val LM_FROST_PRESSED = R.drawable.art_fam_lm_frost_pressed
    val LM_KEY = R.drawable.art_fam_lm_key
    /** The key light map's corner in source pixels (124 × 150 @3x → 10.33 dp). */
    const val KEY_CORNER_PX = 31

    private val cache = ConcurrentHashMap<Int, ImageBitmap>()

    fun get(context: Context, @DrawableRes res: Int): ImageBitmap? {
        cache[res]?.let { return it }
        val bmp = runCatching {
            BitmapFactory.decodeResource(context.resources, res, BitmapFactory.Options().apply { inScaled = false })
        }.getOrNull() ?: return null
        bmp.prepareToDraw()
        return bmp.asImageBitmap().also { cache[res] = it }
    }

    /** Decode every family sprite. Call off main (App.onCreate). */
    fun prewarm(context: Context) {
        for (res in listOf(LM_FROST, LM_FROST_PRESSED, LM_KEY)) get(context, res)
        for (i in FamIcon.entries) get(context, i.res)
        for (c in FamChrome.entries) get(context, c.res)
    }
}

@Composable
internal fun famBitmap(@DrawableRes res: Int): ImageBitmap? {
    val context = LocalContext.current
    return remember(res) { FamilyArt.get(context, res) }
}

/** mix(a, b, t): t of [b] over [a]. */
internal fun famMix(a: Color, b: Color, t: Float): Color = Color(TintMath.over(b.toArgb(), t, a.toArgb()))

/** The pill light map, THREE-SLICED: caps (half the sprite's height) drawn at h / 2, the middle stretched. */
internal fun DrawScope.drawLightMap3(img: ImageBitmap, alpha: Float = 1f) {
    val cap = img.height / 2
    val k = size.height / img.height
    val capDst = (cap * k).roundToInt()
    val w = size.width.roundToInt()
    val h = size.height.roundToInt()
    val left = minOf(capDst, w / 2)
    val right = minOf(capDst, w - left)
    val mid = (w - left - right).coerceAtLeast(0)
    val fq = FilterQuality.High
    drawImage(img, IntOffset(0, 0), IntSize(cap, img.height), IntOffset(0, 0), IntSize(left, h), alpha = alpha, filterQuality = fq)
    if (mid > 0) drawImage(img, IntOffset(cap, 0), IntSize(img.width - 2 * cap, img.height), IntOffset(left, 0), IntSize(mid, h), alpha = alpha, filterQuality = fq)
    drawImage(img, IntOffset(img.width - cap, 0), IntSize(cap, img.height), IntOffset(left + mid, 0), IntSize(right, h), alpha = alpha, filterQuality = fq)
}

/** The key light map, NINE-SLICED: [srcCorner] px corners drawn at [dstCorner] px, edges + center stretched. */
internal fun DrawScope.drawNineSlice(img: ImageBitmap, srcCorner: Int, dstCorner: Float, alpha: Float = 1f) {
    val w = size.width.roundToInt()
    val h = size.height.roundToInt()
    val c = minOf(dstCorner.roundToInt(), w / 2, h / 2)
    val sx = intArrayOf(0, srcCorner, img.width - srcCorner, img.width)
    val sy = intArrayOf(0, srcCorner, img.height - srcCorner, img.height)
    val dx = intArrayOf(0, c, w - c, w)
    val dy = intArrayOf(0, c, h - c, h)
    for (i in 0..2) for (j in 0..2) {
        val sw = sx[i + 1] - sx[i]; val sh = sy[j + 1] - sy[j]
        val dw = dx[i + 1] - dx[i]; val dh = dy[j + 1] - dy[j]
        if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue
        drawImage(img, IntOffset(sx[i], sy[j]), IntSize(sw, sh), IntOffset(dx[i], dy[j]), IntSize(dw, dh), alpha = alpha, filterQuality = FilterQuality.High)
    }
}

/** A key cap's paint: the state [fill] in a 10 dp rounded rect, then the key light map nine-sliced over it (no lip). */
@Composable
fun Modifier.famKeyCap(fill: Color): Modifier {
    val map = famBitmap(FamilyArt.LM_KEY)
    return this.drawBehind {
        drawRoundRect(fill, cornerRadius = CornerRadius(10.dp.toPx()))
        map?.let { drawNineSlice(it, FamilyArt.KEY_CORNER_PX, 10.333f * density) }
    }
}

/** Just the key light map (over per-board quadrant cells). */
@Composable
fun Modifier.famKeyLightMap(): Modifier {
    val map = famBitmap(FamilyArt.LM_KEY)
    return this.drawBehind { map?.let { drawNineSlice(it, FamilyArt.KEY_CORNER_PX, 10.333f * density) } }
}

/** A tinted 3D helper icon: the white clay multiplied by [ink], fit in [size]. */
@Composable
fun FamIconImage(icon: FamIcon, ink: Color, size: Dp = 18.dp, modifier: Modifier = Modifier) {
    val img = famBitmap(icon.res) ?: return
    Image(
        img, contentDescription = null, contentScale = ContentScale.Fit,
        colorFilter = ColorFilter.tint(ink, BlendMode.Modulate),
        modifier = modifier.size(size),
    )
}

/** The helper colors for a [tint] (README §1). */
internal data class HelperColors(val fill: Color, val fillPressed: Color, val ink: Color)

internal fun helperColors(tint: Color, dark: Boolean): HelperColors = if (dark) {
    val base = Color(0xFF231C40)
    HelperColors(famMix(base, tint, 0.34f), famMix(base, tint, 0.42f), famMix(tint, Color.White, 0.65f))
} else {
    HelperColors(famMix(Color.White, tint, 0.20f), famMix(Color.White, tint, 0.27f), famMix(tint, Color.Black, 0.32f))
}

/** Outside a game, the old candy variant's tint: purple #7c3aed, pink #db2777, amber #d97706, teal #0d9488. */
fun CandyColor.helperTint(): Color = when (this) {
    CandyColor.PINK -> Color(0xFFDB2777)
    CandyColor.AMBER -> Color(0xFFD97706)
    CandyColor.TEAL -> Color(0xFF0D9488)
    CandyColor.PURPLE, CandyColor.PEACH -> Color(0xFF7C3AED)
}

/** Saturation .25 (the used / disabled look; the 50% alpha is the pill's). */
internal fun famDesaturate(c: Color): Color {
    val g = 0.2126f * c.red + 0.7152f * c.green + 0.0722f * c.blue
    fun ch(v: Float) = (g + (v - g) * 0.25f).coerceIn(0f, 1f)
    return Color(ch(c.red), ch(c.green), ch(c.blue), c.alpha)
}

private fun HelperColors.spent(): HelperColors = HelperColors(famDesaturate(fill), famDesaturate(fillPressed), famDesaturate(ink))

/**
 * The shared capsule: [fill] (pressed [fillPressed]) + the frost light map, squish .94 on press, the
 * content 1 dp down while pressed; [used] = saturation .25 + 50%. [circle] = the h × h helper.
 */
@Composable
private fun FamPill(
    onClick: () -> Unit,
    modifier: Modifier,
    height: Dp,
    fill: Color,
    fillPressed: Color,
    ink: Color,
    enabled: Boolean,
    used: Boolean,
    circle: Boolean,
    stretch: Boolean,
    padStart: Dp,
    padEnd: Dp,
    contentDescription: String,
    content: @Composable () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val still = WTheme.reducedMotion
    val press by androidx.compose.animation.core.animateFloatAsState(
        if (pressed && !still) 1f else 0f,
        if (pressed) androidx.compose.animation.core.tween(70)
        else androidx.compose.animation.core.spring(dampingRatio = 0.3f, stiffness = 700f),
        label = "famPress",
    )
    val map = famBitmap(if (pressed) FamilyArt.LM_FROST_PRESSED else FamilyArt.LM_FROST)
    val mapAlpha = if (WTheme.isDark) 0.85f else 1f
    val face = if (pressed) fillPressed else fill
    Box(
        modifier
            .then(if (stretch) Modifier.fillMaxWidth() else Modifier)
            .height(height)
            .then(if (circle) Modifier.size(height) else Modifier.widthIn(min = height))
            .graphicsLayer {
                val s = 1f - 0.06f * press
                scaleX = s; scaleY = s
                if (used || !enabled) {
                    alpha = 0.5f
                }
            }
            .squishFeedback(interaction)
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick)
            .semantics(mergeDescendants = true) {
                role = Role.Button
                if (contentDescription.isNotEmpty()) this.contentDescription = contentDescription
            }
            .drawBehind {
                val r = CornerRadius(size.height / 2f)
                drawRoundRect(face, cornerRadius = r)
                map?.let { drawLightMap3(it, mapAlpha) }
            }
            .padding(start = if (circle) 0.dp else padStart, end = if (circle) 0.dp else padEnd),
        contentAlignment = Alignment.Center,
    ) {
        CompositionLocalProvider(LocalContentColor provides ink) {
            Box(Modifier.offset(y = if (pressed) 0.5.dp else (-0.5).dp), contentAlignment = Alignment.Center) { content() }
        }
    }
}

/** Nunito Black uppercase, tracking 0.02 em; shrinks (to 75% at most) rather than clipping. */
@Composable
internal fun FamLabel(text: String, fontSize: Float, ink: Color) {
    val measurer = rememberTextMeasurer()
    BoxWithConstraints(contentAlignment = Alignment.Center) {
        val up = text.uppercase()
        val probe = tightTextStyle(TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = fontSize.sp, letterSpacing = 0.02.em))
        val natural = remember(up, fontSize) { measurer.measure(up, probe, maxLines = 1).size.width }
        val k = if (constraints.hasBoundedWidth && natural > constraints.maxWidth && natural > 0)
            (constraints.maxWidth.toFloat() / natural).coerceAtLeast(0.75f) else 1f
        Text(up, maxLines = 1, softWrap = false, overflow = TextOverflow.Clip, style = probe.copy(color = ink, fontSize = (fontSize * k).sp))
    }
}

/**
 * The HELPER pill (game helpers: Hint, Shuffle, Reveal, Undo …): 34 dp, the [tint]'s wash, the tinted 3D [icon]
 * (or a Material [vector] mapped to its art, else drawn in the ink; or any [leading]) + the uppercase label in the
 * deep tint. Inside a game the tint is always the game's accent ([LocalGameTint]); off a game [tint] (null = purple). [circle] = the icon-only 34 × 34 helper.
 * [selected] = a toggle that is on: the solid tint with white ink. [used] = the spent / disabled look.
 */
@Composable
fun HelperButton(
    text: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color? = null,
    icon: FamIcon? = null,
    vector: ImageVector? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: String? = null,
    circle: Boolean = false,
    selected: Boolean = false,
    used: Boolean = false,
    enabled: Boolean = true,
    fill: Boolean = false,
    height: Dp = 34.dp,
    contentDescription: String = text ?: "",
) {
    // Inside a game EVERY helper takes the game's accent (a state reads by [selected], never by hue); off a game [tint].
    // Season preview: in season the helpers take the season's button tint (registry palette), an explicit
    // [tint] off a game still wins.
    val season = seasonPalette()?.buttonTint
    val t = LocalGameTint.current?.let { season ?: it } ?: tint ?: season ?: Color(0xFF7C3AED)
    val dark = WTheme.isDark
    val spent = used || !enabled
    val c = remember(t, dark, selected, spent) {
        val base = if (selected) HelperColors(t, famMix(t, Color.Black, 0.15f), Color.White) else helperColors(t, dark)
        if (spent) base.spent() else base
    }
    val art = icon ?: vector?.let { FamIcon.of(it) }
    FamPill(
        onClick, modifier, height, c.fill, c.fillPressed, c.ink, enabled, used, circle, fill,
        padStart = height * 0.34f, padEnd = height * 0.42f, contentDescription = contentDescription,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            when {
                art != null -> FamIconImage(art, c.ink, if (circle) 20.dp else 18.dp)
                vector != null -> Icon(vector, null, tint = c.ink, modifier = Modifier.size(if (circle) 18.dp else 15.dp))
            }
            leading?.invoke()
            if (!circle && !text.isNullOrEmpty()) Box(Modifier.weight(1f, fill = false)) { FamLabel(text, 12.5f, c.ink) }
            if (!circle && trailing != null) FamLabel(trailing, 12.5f, c.ink)
        }
    }
}

/** The QUIET pill (secondary actions: Not now, See all, Decline …): lavender, purple ink. */
@Composable
fun QuietButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: CandySize = CandySize.MEDIUM,
    icon: FamIcon? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: String? = null,
    fill: Boolean = false,
    enabled: Boolean = true,
    contentDescription: String = text,
) {
    val dark = WTheme.isDark
    val h = when (size) { CandySize.LARGE -> 44.dp; CandySize.MEDIUM -> 40.dp; CandySize.SMALL -> 34.dp }
    // Season preview: the quiet pill takes the season's quiet tint (registry palette).
    val season = seasonPalette()?.quietTint
    val sc = season?.let { remember(it, dark) { helperColors(it, dark) } }
    val face = sc?.fill ?: if (dark) Color(0xFF3B3163) else Color(0xFFECE4FF)
    val pressedFace = sc?.fillPressed ?: if (dark) Color(0xFF463A74) else Color(0xFFE2D7FF)
    val ink = sc?.ink ?: if (dark) Color(0xFFDDD0FF) else Color(0xFF5B21B6)
    val fs = if (size == CandySize.SMALL) 12.5f else 13.5f
    FamPill(
        onClick, modifier, h, face, pressedFace, ink, enabled, used = false, circle = false, stretch = fill,
        padStart = h * 0.45f, padEnd = h * 0.45f, contentDescription = contentDescription,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            icon?.let { FamIconImage(it, ink) }
            leading?.invoke()
            Box(Modifier.weight(1f, fill = false)) { FamLabel(text, fs, ink) }
            if (trailing != null) FamLabel(trailing, fs, ink)
        }
    }
}

/** The ROUND icon button: a bare 3D icon ([size], 28 dp) in a 44 dp hit area, squish .9 — no bubble (founder rule). */
@Composable
fun RoundIconButton(
    @DrawableRes res: Int,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 28.dp,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val still = WTheme.reducedMotion
    val press by androidx.compose.animation.core.animateFloatAsState(
        if (pressed && !still) 1f else 0f,
        if (pressed) androidx.compose.animation.core.tween(70)
        else androidx.compose.animation.core.spring(dampingRatio = 0.3f, stiffness = 700f),
        label = "famRoundPress",
    )
    val img = famBitmap(res)
    Box(
        modifier.size(44.dp)
            .graphicsLayer { val s = 1f - 0.1f * press; scaleX = s; scaleY = s }
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .semantics { role = Role.Button; this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        if (img != null) Image(img, null, contentScale = ContentScale.Fit, modifier = Modifier.size(size))
    }
}

/** [RoundIconButton] for the family chrome icons (close / info). */
@Composable
fun RoundIconButton(icon: FamChrome, contentDescription: String, onClick: () -> Unit, modifier: Modifier = Modifier, size: Dp = 28.dp) =
    RoundIconButton(icon.res, contentDescription, onClick, modifier, size)
