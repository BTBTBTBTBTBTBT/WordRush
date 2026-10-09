package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.keyframes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.R
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.app.ui.theme.tightTextStyle
import kotlinx.coroutines.launch
import androidx.compose.runtime.setValue

// The finishing build (docs/FINISH_SPEC.md, founder-approved 2026-10-02): the shared
// parts every screen is rebuilt from. A1 tinted surfaces (no plain white), A2 soft
// numbers, A3 bubble-free soft 3D header controls with the squish, A8 the glossy
// candy buttons, and the cast pose helper. Visual reference: the mockups in
// docs/design/brand/mockups (game-kit.html, finishing-touches.html). Mirrors the web
// and iOS finishing kits.

// ── A1 · tinted surfaces ──────────────────────────────────────────────────

/**
 * A1 pure color mixing (CSS `color-mix(in srgb, accent N%, white)`): [accent] at
 * [amount] over white, opaque. The card wash is 12–14%, its border 30–35%.
 */
object Wash {
    /** The card / tile wash (A1: 12–14%). */
    const val CARD = 0.13f
    /** The 1.5 dp border (A1: 30–35%). */
    const val LINE = 0.32f
    /** A selected icon tile (finishing-touches `.gi.on`). */
    const val SELECTED = 0.26f

    /** [accent] at [amount] over white as ARGB (alpha of [accent] ignored). */
    fun mixArgb(accent: Int, amount: Float): Int = TintMath.over(accent or (0xFF shl 24), amount, 0xFFFFFFFF.toInt())

    /** [accent] at [amount] over white. */
    fun mix(accent: Color, amount: Float): Color = Color(mixArgb(accent.copy(alpha = 1f).toArgb(), amount))
}

/** A1 a surface's soft wash of [accent]; dark mode keeps its existing dark surface. */
fun accentWash(accent: Color, amount: Float = Wash.CARD): Color =
    if (WTheme.isDark) WTheme.surface else Wash.mix(accent, amount)

/** A1 the matching 1.5 dp border; dark mode keeps its existing border. */
fun accentLine(accent: Color, amount: Float = Wash.LINE): Color =
    if (WTheme.isDark) WTheme.border else Wash.mix(accent, amount)

/** The finishing kit's fixed inks (the mockups' palette). */
object FinishInk {
    /** A2 soft numbers on light backgrounds. */
    val softNumber = Color(0xFF3B1A78)
    /** A2 soft numbers in dark mode. */
    val softNumberDark = Color(0xFFE9DDFF)
    /** Card headings and labels. */
    val heading = Color(0xFF2A1650)
    val label = Color(0xFF5B3C96)
    val muted = Color(0xFF6F5F8F)
    /** The lavender page card (finishing-touches `--tint:#f5eeff;--tline:#e2d3ff`). */
    val lavender = Color(0xFFF5EEFF)
    val lavenderLine = Color(0xFFE2D3FF)
    /** The card shadow (0 8 20 rgba(60,30,110,.10)). */
    val cardShadow = Color(0x1A3C1E6E)
}

/**
 * A1 a tinted card: the accent wash, a 1.5 dp border in the accent line, radius
 * [corner], a soft violet lift, and the game-card [bar] (10 dp) across the top
 * (null = no bar). Dark mode keeps the existing dark surface + border.
 */
@Composable
fun TintedCard(
    accent: Color,
    modifier: Modifier = Modifier,
    corner: Dp = 20.dp,
    bar: Brush? = SolidColor(accent),
    barHeight: Dp = 10.dp,
    tint: Color = accentWash(accent),
    line: Color = accentLine(accent),
    contentPadding: androidx.compose.foundation.layout.PaddingValues =
        androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 12.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(8.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(corner)
    // Season surfaces: the season's translucent card with a faint accent, no outline (flat fill, no blur).
    val season = com.wordocious.app.ui.theme.WTheme.season?.takeIf { it.cardFill != null }
    Column(
        if (season != null) modifier.clip(shape).background(season.wash(accent, 0.06f).copy(alpha = season.cardOpacity))
        else modifier
            .shadow(6.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow)
            .clip(shape)
            .background(tint)
            .border(1.5.dp, line, shape),
    ) {
        if (bar != null) Box(Modifier.fillMaxWidth().height(barHeight).background(bar))
        Column(Modifier.fillMaxWidth().padding(contentPadding), verticalArrangement = verticalArrangement, content = content)
    }
}

/**
 * A1 an icon tile as a mini game card (finishing-touches `.gi`): the accent wash, a
 * 1.5 dp accent-line border, a 4 dp accent bar across the top and a soft accent
 * shadow. [selected] = a stronger tint, a full-accent border and a soft accent ring.
 */
fun Modifier.miniGameCard(accent: Color, corner: Dp, selected: Boolean = false): Modifier = composed {
    val shape = RoundedCornerShape(corner)
    val a = accent.copy(alpha = 1f)
    val dark = WTheme.isDark
    val bg = if (dark) WTheme.surface else Wash.mix(a, if (selected) Wash.SELECTED else Wash.CARD)
    val line = if (selected) a else if (dark) WTheme.border else Wash.mix(a, 0.34f)
    this
        .then(
            if (selected) Modifier.border(3.dp, a.copy(alpha = 0.22f), RoundedCornerShape(corner + 3.dp)).padding(3.dp)
            else Modifier,
        )
        .shadow(3.dp, shape, clip = false, ambientColor = a.copy(alpha = 0.2f), spotColor = a.copy(alpha = 0.35f))
        .clip(shape)
        .background(bg)
        .drawWithContent {
            drawContent()
            drawRect(a, Offset.Zero, Size(size.width, 4.dp.toPx()))
        }
        .border(if (selected) 2.dp else 1.5.dp, line, shape)
}

// ── A2 · soft numbers ─────────────────────────────────────────────────────

/**
 * A2 the soft-number text style: Nunito Black, dark purple #3b1a78, tabular
 * figures, a soft white highlight under it (dark mode: light lilac on a soft dark
 * shadow). Never the gradient / gold digit art.
 */
@Composable
fun softNumberStyle(fontSize: TextUnit, color: Color? = null): TextStyle {
    val px = LocalDensity.current.density
    val dark = WTheme.isDark
    return tightTextStyle(
        TextStyle(
            fontFamily = Nunito,
            fontWeight = FontWeight.Black,
            fontSize = fontSize,
            color = color ?: if (dark) FinishInk.softNumberDark else FinishInk.softNumber,
            fontFeatureSettings = "tnum",
            letterSpacing = (-0.01).em,
            shadow = if (dark) Shadow(Color.Black.copy(alpha = 0.4f), Offset(0f, 3f * px), 8f * px)
            else Shadow(Color.White.copy(alpha = 0.8f), Offset(0f, 1f * px), 0f),
        ),
    )
}

/** A2 a big number (streaks, points, ranks, timers, stat tiles) in the soft style. */
@Composable
fun SoftNumber(text: String, fontSize: TextUnit, modifier: Modifier = Modifier, color: Color? = null) {
    Text(text, modifier = modifier, style = softNumberStyle(fontSize, color), maxLines = 1, softWrap = false)
}

// ── A9 · everything tappable squishes ─────────────────────────────────────

/**
 * A9 the press scales (pure, unit-tested): touch-down sinks a button / card / chip to
 * .92 and an icon to (.86, .80); release springs past 1 (1.05 / icons 1.08) and
 * settles, ≈260 ms. Big surfaces press more gently ([attenuation]) and full-screen
 * scrims not at all, so a tap on a dim never shrinks the sheet it holds.
 */
object Squish {
    const val DOWN = 0.92f
    const val ICON_DOWN_X = 0.86f
    const val ICON_DOWN_Y = 0.80f
    const val OVERSHOOT = 1.05f
    /** AK a game card / tile: press to 0.95, spring back through 1.02 (full depth at any size). */
    const val CARD_DOWN = 0.95f
    const val CARD_OVERSHOOT = 1.02f
    const val ICON_OVERSHOOT = 1.08f
    const val DOWN_MS = 90
    const val RELEASE_MS = 260

    /** Full press depth up to this height (dp); gentler above it. */
    const val FULL_UNTIL_DP = 72f
    /** At and above this height (dp) the press keeps [MIN_DEPTH] of its depth. */
    const val GENTLE_AT_DP = 300f
    const val MIN_DEPTH = 0.4f
    /** Taller than this (dp), or a scrim-sized area: no squish. */
    const val NONE_ABOVE_DP = 360f

    /** How much of the press depth an element [heightDp] tall × [widthDp] wide keeps (0 = none). */
    fun attenuation(widthDp: Float, heightDp: Float): Float = when {
        heightDp > NONE_ABOVE_DP || widthDp * heightDp > 360f * 300f -> 0f
        heightDp <= FULL_UNTIL_DP -> 1f
        heightDp >= GENTLE_AT_DP -> MIN_DEPTH
        else -> 1f - (1f - MIN_DEPTH) * (heightDp - FULL_UNTIL_DP) / (GENTLE_AT_DP - FULL_UNTIL_DP)
    }

    /** The scale actually applied for an animated [scale] at [attenuation]. */
    fun applied(scale: Float, attenuation: Float): Float = 1f + (scale - 1f) * attenuation
}

private suspend fun Animatable<Float, *>.squishRelease(down: Float, overshoot: Float) {
    // A quick tap releases before the sink lands: play the sink first so it reads.
    val sunk = value <= down + 0.02f
    animateTo(1f, keyframes {
        durationMillis = Squish.RELEASE_MS + if (sunk) 0 else 60
        if (!sunk) down at 60
        overshoot at (if (sunk) 120 else 170)
        1f at durationMillis
    })
}

/**
 * A9 THE shared press: an interaction-source-driven scale — down to [Squish.DOWN]
 * (icons: .86 / .80) on touch-down, a bouncy spring past 1 on release (≈260 ms).
 * Off with Reduce Motion. It scales what comes after it in the modifier chain, so
 * put it (or [squishClickable]) first to press the whole element.
 */
fun Modifier.pressSquish(interaction: InteractionSource, icon: Boolean = false, card: Boolean = false): Modifier = composed {
    // Spec U: press · soft / release (sound stays on under Reduce Motion).
    if (WTheme.reducedMotion) return@composed this.squishFeedback(interaction)
    // AK: a game card / tile presses to 0.95 and springs back through 1.02 at full depth
    // (no size attenuation), with a slight darken while held.
    val downX = if (icon) Squish.ICON_DOWN_X else if (card) Squish.CARD_DOWN else Squish.DOWN
    val downY = if (icon) Squish.ICON_DOWN_Y else if (card) Squish.CARD_DOWN else Squish.DOWN
    val over = if (icon) Squish.ICON_OVERSHOOT else if (card) Squish.CARD_OVERSHOOT else Squish.OVERSHOOT
    val sx = remember { Animatable(1f) }
    val sy = remember { Animatable(1f) }
    LaunchedEffect(interaction) {
        var job: kotlinx.coroutines.Job? = null
        interaction.interactions.collect { i ->
            when (i) {
                is PressInteraction.Press -> {
                    job?.cancel()
                    job = launch {
                        launch { sx.animateTo(downX, androidx.compose.animation.core.tween(Squish.DOWN_MS)) }
                        sy.animateTo(downY, androidx.compose.animation.core.tween(Squish.DOWN_MS))
                    }
                }
                is PressInteraction.Release, is PressInteraction.Cancel -> {
                    job?.cancel()
                    job = launch {
                        launch { sx.squishRelease(downX, over) }
                        sy.squishRelease(downY, over)
                    }
                }
            }
        }
    }
    this.squishFeedback(interaction).graphicsLayer {
        val x = sx.value
        val y = sy.value
        if (x != 1f || y != 1f) {
            val a = if (card) 1f else Squish.attenuation(size.width / density, size.height / density)
            scaleX = Squish.applied(x, a)
            scaleY = Squish.applied(y, a)
        }
    }.then(
        if (card) Modifier.drawWithContent {
            drawContent()
            // The lip-compress darken: up to 6% while the card is sunk.
            val depth = ((1f - sy.value) / (1f - Squish.CARD_DOWN)).coerceIn(0f, 1f)
            if (depth > 0.01f) drawRect(Color.Black.copy(alpha = 0.06f * depth))
        } else Modifier,
    )
}

/** Back-compat name for [pressSquish] (A3 header controls). */
fun Modifier.squish(interaction: MutableInteractionSource, icon: Boolean = true): Modifier = pressSquish(interaction, icon)

/**
 * A tappable that squishes on press (A9), no ripple, announced as a [role] with
 * [label] (null = keep the children's own semantics). Put it first in the chain so
 * the whole element presses. [icon] = the icon press (.86 / .80).
 */
fun Modifier.squishClickable(
    label: String? = null,
    role: Role = Role.Button,
    enabled: Boolean = true,
    icon: Boolean = false,
    card: Boolean = false,
    onClick: () -> Unit,
): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    this
        .pressSquish(interaction, icon, card)
        .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick)
        .then(
            if (label != null) Modifier.semantics(mergeDescendants = true) {
                this.role = role
                contentDescription = label
            } else Modifier,
        )
}

/** A3 the header controls' icon height (a step smaller than the cast). */
val SOFT_CONTROL_ICON: Dp = 23.dp
/** A3 the header controls' number size. */
val SOFT_CONTROL_NUMBER: TextUnit = 17.sp
/** A3 the full tap area. */
val SOFT_CONTROL_TAP: Dp = 44.dp

/**
 * A3 a header control: the bare soft 3D icon (no circle or pill behind it), 23 dp,
 * an optional soft [number] beside it (17 sp), a full 44 dp tap area, and the
 * squish on press. [contentDescription] labels the whole control for TalkBack.
 */
@Composable
fun SoftControl(
    icon: Icon3DName,
    contentDescription: String,
    onClick: (() -> Unit)?,
    modifier: Modifier = Modifier,
    number: String? = null,
    iconSize: Dp = SOFT_CONTROL_ICON,
    alpha: Float = 1f,
    colorFilter: ColorFilter? = null,
) {
    // 2.8 items 7 + 48: the counter pops for a beat the moment its number GROWS (the streak just extended).
    val n = number?.toIntOrNull()
    var lastN by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(n) }
    val pop = androidx.compose.runtime.remember { androidx.compose.animation.core.Animatable(1f) }
    androidx.compose.runtime.LaunchedEffect(n) {
        val old = lastN
        lastN = n
        if (old != null && n != null && n > old && !WTheme.calmMotion) {
            pop.animateTo(1.32f, androidx.compose.animation.core.spring(dampingRatio = 0.45f, stiffness = 700f))
            pop.animateTo(1f, androidx.compose.animation.core.spring(dampingRatio = 0.6f, stiffness = 300f))
        }
    }
    Row(
        modifier
            .heightIn(min = SOFT_CONTROL_TAP)
            .widthIn(min = SOFT_CONTROL_TAP)
            .graphicsLayer { scaleX = pop.value; scaleY = pop.value }
            .then(
                if (onClick != null) Modifier.squishClickable(contentDescription, icon = true, onClick = onClick)
                else Modifier.clearAndSetSemantics { this.contentDescription = contentDescription },
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon3D(icon, iconSize, alpha = alpha, colorFilter = colorFilter)
        if (number != null) {
            Spacer(Modifier.width(5.dp))
            SoftNumber(number, SOFT_CONTROL_NUMBER)
        }
    }
}

// ── A8 · glossy candy buttons ─────────────────────────────────────────────

/**
 * A8 the candy button colors (founder-approved ChatGPT design,
 * docs/design/brand/buttons/chatgpt-buttons-*.jpg): a vertical 2-stop gradient; the
 * lip is the bottom color darkened ~35%. [ink] = the label fill, [outlined] = the
 * label wears the dark-purple outline (the quiet peach action does not).
 */
enum class CandyColor(val top: Color, val bottom: Color, val ink: Color, val outlined: Boolean = true) {
    /** Primary. */
    PURPLE(Color(0xFFA66BFF), Color(0xFF6D28D9), Color.White),
    /** Secondary. */
    PINK(Color(0xFFF472B6), Color(0xFFA21CAF), Color.White),
    AMBER(Color(0xFFFFC56B), Color(0xFFF97316), Color.White),
    TEAL(Color(0xFF5EEAD4), Color(0xFF0D9488), Color.White),
    /** Quiet actions: soft peach with dark-purple text. */
    PEACH(Color(0xFFFFD6C2), Color(0xFFFBB38F), Color(0xFF3B1A78), outlined = false),
    ;

    /** The lip: the gradient's bottom color darkened ~35%. */
    val lip: Color get() = Color(TintMath.over(0xFF000000.toInt(), 0.35f, bottom.toArgb()))
}

/** A8 sizes: large 52 dp (primary CTAs), medium 40 dp; small round 40 dp. */
enum class CandySize(val height: Dp, val lip: Dp, val outline: Dp, val fontSize: TextUnit, val icon: Dp, val padH: Dp) {
    LARGE(52.dp, 5.dp, 2.dp, 18.sp, 22.dp, 20.dp),
    MEDIUM(40.dp, 4.dp, 1.5.dp, 14.sp, 17.dp, 14.dp),
    SMALL(34.dp, 4.dp, 1.dp, 12.sp, 14.dp, 12.dp),
}

/** A8 the candy label's dark-purple outline. */
val CANDY_OUTLINE = Color(0xFF3B1A78)
private val CANDY_GOLD = Color(0xFFF5C542)

/** A8 the optional leading icons, drawn white with the dark-purple outline. */
enum class CandyIcon { PLAY, EYE, ARROW, SHARE }

/** A8 a leading icon in the label's white-with-outline treatment. */
@Composable
fun CandyGlyph(icon: CandyIcon, size: Dp, ink: Color = Color.White, outlined: Boolean = true) {
    androidx.compose.foundation.Canvas(Modifier.size(size)) {
        val w = this.size.width
        val h = this.size.height
        val stroke = androidx.compose.ui.graphics.drawscope.Stroke(
            width = w * 0.16f, join = androidx.compose.ui.graphics.StrokeJoin.Round, cap = androidx.compose.ui.graphics.StrokeCap.Round,
        )
        fun shape(path: androidx.compose.ui.graphics.Path) {
            if (outlined) drawPath(path, CANDY_OUTLINE, style = stroke)
            drawPath(path, ink)
        }
        when (icon) {
            CandyIcon.PLAY -> shape(androidx.compose.ui.graphics.Path().apply {
                moveTo(w * 0.28f, h * 0.16f); lineTo(w * 0.86f, h * 0.5f); lineTo(w * 0.28f, h * 0.84f); close()
            })
            CandyIcon.ARROW -> shape(androidx.compose.ui.graphics.Path().apply {
                moveTo(w * 0.10f, h * 0.38f); lineTo(w * 0.50f, h * 0.38f); lineTo(w * 0.50f, h * 0.14f)
                lineTo(w * 0.92f, h * 0.50f); lineTo(w * 0.50f, h * 0.86f); lineTo(w * 0.50f, h * 0.62f)
                lineTo(w * 0.10f, h * 0.62f); close()
            })
            CandyIcon.SHARE -> shape(androidx.compose.ui.graphics.Path().apply {
                moveTo(w * 0.50f, h * 0.08f); lineTo(w * 0.80f, h * 0.38f); lineTo(w * 0.60f, h * 0.38f)
                lineTo(w * 0.60f, h * 0.66f); lineTo(w * 0.40f, h * 0.66f); lineTo(w * 0.40f, h * 0.38f)
                lineTo(w * 0.20f, h * 0.38f); close()
                moveTo(w * 0.12f, h * 0.60f); lineTo(w * 0.26f, h * 0.60f); lineTo(w * 0.26f, h * 0.78f)
                lineTo(w * 0.74f, h * 0.78f); lineTo(w * 0.74f, h * 0.60f); lineTo(w * 0.88f, h * 0.60f)
                lineTo(w * 0.88f, h * 0.92f); lineTo(w * 0.12f, h * 0.92f); close()
            })
            CandyIcon.EYE -> {
                val eye = androidx.compose.ui.graphics.Path().apply {
                    moveTo(w * 0.04f, h * 0.5f)
                    quadraticTo(w * 0.5f, h * 0.02f, w * 0.96f, h * 0.5f)
                    quadraticTo(w * 0.5f, h * 0.98f, w * 0.04f, h * 0.5f)
                    close()
                }
                shape(eye)
                drawCircle(Color(0xFF7C3AED), radius = w * 0.2f, center = Offset(w * 0.5f, h * 0.5f))
                drawCircle(CANDY_OUTLINE, radius = w * 0.1f, center = Offset(w * 0.5f, h * 0.5f))
                drawCircle(Color.White, radius = w * 0.045f, center = Offset(w * 0.44f, h * 0.43f))
            }
        }
    }
}

/**
 * A8 a candy label: Nunito Black in [ink] with the dark-purple outline under it (when
 * [outlined]). Shrinks (to 60% at most) rather than clipping when the width it is
 * given is short.
 */
@Composable
fun CandyLabel(text: String, fontSize: TextUnit, ink: Color = Color.White, outlined: Boolean = true, maxLines: Int = 1) {
    val px = LocalDensity.current.density
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    androidx.compose.foundation.layout.BoxWithConstraints(contentAlignment = Alignment.Center) {
        val probe = tightTextStyle(TextStyle(fontFamily = Nunito, fontWeight = FontWeight.Black, fontSize = fontSize, letterSpacing = 0.02.em))
        val natural = remember(text, fontSize) { measurer.measure(text, probe, maxLines = 1).size.width }
        val k = if (constraints.hasBoundedWidth && natural > constraints.maxWidth && natural > 0)
            (constraints.maxWidth.toFloat() / natural).coerceAtLeast(0.6f) else 1f
        val base = probe.copy(fontSize = fontSize * k)
        Box(contentAlignment = Alignment.Center) {
            if (outlined) {
                Text(
                    text, maxLines = maxLines, overflow = TextOverflow.Clip, softWrap = false,
                    style = base.copy(
                        color = CANDY_OUTLINE,
                        drawStyle = androidx.compose.ui.graphics.drawscope.Stroke(
                            width = (fontSize.value * k / 18f).coerceIn(0.75f, 1f) * 4f * px,
                            join = androidx.compose.ui.graphics.StrokeJoin.Round,
                        ),
                        shadow = Shadow(Color(0x553B1A78), Offset(0f, 1.5f * px), 3f * px),
                    ),
                )
            }
            Text(
                text, maxLines = maxLines, overflow = TextOverflow.Clip, softWrap = false,
                style = base.copy(
                    color = ink,
                    shadow = if (outlined) null else Shadow(Color.White.copy(alpha = 0.7f), Offset(0f, 1f * px), 0f),
                ),
            )
        }
    }
}

/**
 * Now routed to the button family (see the body). Was — A8 THE button (every action button): a pill (radius = height / 2) filled with
 * [color]'s vertical gradient, a thin gold outline just inside the edge, a thick
 * darker bottom lip plus a soft drop shadow, a glossy white highlight across the top
 * half, and a white Nunito Black label with a dark-purple outline (optional leading
 * [icon] in the same treatment). Press = squish (scale .92) with the lip compressing,
 * then the spring back. [fill] = stretch to the width given (the label centers);
 * [trailing] adds a label-styled mark at the end (e.g. "›" on a CTA row).
 */
@Composable
fun CandyButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: CandyColor = CandyColor.PURPLE,
    size: CandySize = CandySize.LARGE,
    icon: CandyIcon? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: String? = null,
    fill: Boolean = false,
    enabled: Boolean = true,
    contentDescription: String = text,
    fontSize: TextUnit? = null,
    /**
     * Founder 10-02: an optional small second line under the label (the share candy's
     * "Next Classic in 3h 12m"), inside the same [size] height — never a taller button.
     */
    subtitle: String? = null,
) {
    // The button family (docs/design/brand/buttons/family/README.md, 10-05): one switch here moves every call site.
    //   SMALL → the HELPER pill (in a game always the game accent's wash; off a game the variant's tint,
    //   PEACH → the small QUIET pill)
    //   PEACH at MEDIUM / LARGE → the QUIET pill · any other MEDIUM / LARGE → the cast primary.
    val famIcon = icon?.let { FamIcon.of(it) }
    val glyph: (@Composable () -> Unit)? = leading
        ?: if (icon != null && famIcon == null) candyGlyphSlot(icon, 14.dp) else null
    val inGame = LocalGameTint.current != null
    when {
        size == CandySize.SMALL && color == CandyColor.PEACH && !inGame -> QuietButton(
            text, onClick, modifier, size = CandySize.SMALL, icon = famIcon, leading = glyph, trailing = trailing,
            fill = fill, enabled = enabled, contentDescription = contentDescription,
        )
        // In a game every helper wears the game accent (a small peach one too).
        size == CandySize.SMALL -> HelperButton(
            text, onClick, modifier,
            tint = if (color == CandyColor.PURPLE || color == CandyColor.PEACH) null else color.helperTint(),
            icon = famIcon, leading = glyph, trailing = trailing, fill = fill, enabled = enabled,
            contentDescription = contentDescription,
        )
        color == CandyColor.PEACH -> QuietButton(
            text, onClick, modifier, size = size, icon = famIcon, leading = glyph, trailing = trailing,
            fill = fill, enabled = enabled, contentDescription = contentDescription,
        )
        else -> CastButton(
            text, onClick, modifier, color = color.cast(), size = size.cast, fill = fill, enabled = enabled,
            contentDescription = contentDescription, leading = leading, subtitle = subtitle,
        )
    }
}

/** A candy glyph (no art in the family) drawn in the helper's ink (LocalContentColor). */
private fun candyGlyphSlot(icon: CandyIcon, size: Dp): @Composable () -> Unit =
    { CandyGlyph(icon, size, androidx.compose.material3.LocalContentColor.current, outlined = false) }

/**
 * A8 the small round candy button, now the button family's helper CIRCLE (fill + light map) around an
 * [icon] (or any [content], drawn with LocalContentColor = the deep tint).
 */
@Composable
fun CandyRoundButton(
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: CandyColor = CandyColor.PURPLE,
    diameter: Dp = 40.dp,
    icon: CandyIcon? = null,
    content: (@Composable () -> Unit)? = null,
) {
    // The button family: the icon-only HELPER circle (the game accent's wash in a game; off a game the variant's tint).
    val famIcon = icon?.let { FamIcon.of(it) }
    HelperButton(
        null, onClick, modifier,
        tint = if (color == CandyColor.PURPLE || color == CandyColor.PEACH) null else color.helperTint(),
        icon = famIcon,
        leading = content
            ?: if (icon != null && famIcon == null) candyGlyphSlot(icon, diameter * 0.46f) else null,
        circle = true, height = diameter, contentDescription = contentDescription,
    )
}

// ── The cast poses (art_pose_<character>_<pose>) ──────────────────────────

/**
 * The cast poses shipped in res/drawable-nodpi (`art_pose_<id>_<pose>`, 320 sq,
 * transparent): the 62 personality poses plus each character's VS set (ready,
 * waiting, victory, goodgame), referenced by character + pose name (e.g. `S`, "trophy"). An
 * explicit table rather than a resource-name lookup, so resource shrinking keeps
 * exactly these. Mirrors the web /art/art-pose-* and the iOS image sets.
 */
object CastPoses {
    private val table: Map<MascotId, Map<String, Int>> = mapOf(
        MascotId.W to mapOf(
            "cheer" to R.drawable.art_pose_w_cheer, "fly" to R.drawable.art_pose_w_fly, "hips" to R.drawable.art_pose_w_hips,
            "lean" to R.drawable.art_pose_w_lean, "point" to R.drawable.art_pose_w_point, "proud" to R.drawable.art_pose_w_proud,
            "sit" to R.drawable.art_pose_w_sit, "wave" to R.drawable.art_pose_w_wave,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_w_ready, "waiting" to R.drawable.art_pose_w_waiting,
            "victory" to R.drawable.art_pose_w_victory, "goodgame" to R.drawable.art_pose_w_goodgame,
        ),
        MascotId.O1 to mapOf(
            "cartwheel" to R.drawable.art_pose_o1_cartwheel, "cheer" to R.drawable.art_pose_o1_cheer, "hug" to R.drawable.art_pose_o1_hug,
            "jump" to R.drawable.art_pose_o1_jump, "lean" to R.drawable.art_pose_o1_lean, "sit" to R.drawable.art_pose_o1_sit,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_o1_ready, "waiting" to R.drawable.art_pose_o1_waiting,
            "victory" to R.drawable.art_pose_o1_victory, "goodgame" to R.drawable.art_pose_o1_goodgame,
        ),
        MascotId.R to mapOf(
            "cheer" to R.drawable.art_pose_r_cheer, "cocoa" to R.drawable.art_pose_r_cocoa, "lean" to R.drawable.art_pose_r_lean,
            "sit" to R.drawable.art_pose_r_sit, "sleepwalk" to R.drawable.art_pose_r_sleepwalk, "wake" to R.drawable.art_pose_r_wake,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_r_ready, "waiting" to R.drawable.art_pose_r_waiting,
            "victory" to R.drawable.art_pose_r_victory, "goodgame" to R.drawable.art_pose_r_goodgame,
        ),
        MascotId.D to mapOf(
            "cheer" to R.drawable.art_pose_d_cheer, "eureka" to R.drawable.art_pose_d_eureka, "lean" to R.drawable.art_pose_d_lean,
            "notes" to R.drawable.art_pose_d_notes, "sit" to R.drawable.art_pose_d_sit, "skeptic" to R.drawable.art_pose_d_skeptic,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_d_ready, "waiting" to R.drawable.art_pose_d_waiting,
            "victory" to R.drawable.art_pose_d_victory, "goodgame" to R.drawable.art_pose_d_goodgame,
        ),
        MascotId.O2 to mapOf(
            "cheer" to R.drawable.art_pose_o2_cheer, "gasp" to R.drawable.art_pose_o2_gasp, "lean" to R.drawable.art_pose_o2_lean,
            "sit" to R.drawable.art_pose_o2_sit, "strut" to R.drawable.art_pose_o2_strut, "twirl" to R.drawable.art_pose_o2_twirl,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_o2_ready, "waiting" to R.drawable.art_pose_o2_waiting,
            "victory" to R.drawable.art_pose_o2_victory, "goodgame" to R.drawable.art_pose_o2_goodgame,
        ),
        MascotId.C to mapOf(
            "backpack" to R.drawable.art_pose_c_backpack, "cheer" to R.drawable.art_pose_c_cheer, "lean" to R.drawable.art_pose_c_lean,
            "map" to R.drawable.art_pose_c_map, "sit" to R.drawable.art_pose_c_sit, "telescope" to R.drawable.art_pose_c_telescope,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_c_ready, "waiting" to R.drawable.art_pose_c_waiting,
            "victory" to R.drawable.art_pose_c_victory, "goodgame" to R.drawable.art_pose_c_goodgame,
        ),
        MascotId.I to mapOf(
            "cheer" to R.drawable.art_pose_i_cheer, "giggle" to R.drawable.art_pose_i_giggle, "lean" to R.drawable.art_pose_i_lean,
            "reach" to R.drawable.art_pose_i_reach, "sit" to R.drawable.art_pose_i_sit, "water" to R.drawable.art_pose_i_water,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_i_ready, "waiting" to R.drawable.art_pose_i_waiting,
            "victory" to R.drawable.art_pose_i_victory, "goodgame" to R.drawable.art_pose_i_goodgame,
        ),
        MascotId.O3 to mapOf(
            "cushion" to R.drawable.art_pose_o3_cushion, "handstand" to R.drawable.art_pose_o3_handstand, "laugh" to R.drawable.art_pose_o3_laugh,
            "mustache" to R.drawable.art_pose_o3_mustache, "sit" to R.drawable.art_pose_o3_sit, "sneak" to R.drawable.art_pose_o3_sneak,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_o3_ready, "waiting" to R.drawable.art_pose_o3_waiting,
            "victory" to R.drawable.art_pose_o3_victory, "goodgame" to R.drawable.art_pose_o3_goodgame,
        ),
        MascotId.U to mapOf(
            "lotus" to R.drawable.art_pose_u_lotus, "meditate" to R.drawable.art_pose_u_meditate, "spin" to R.drawable.art_pose_u_spin,
            "stretch" to R.drawable.art_pose_u_stretch, "tea" to R.drawable.art_pose_u_tea, "upside" to R.drawable.art_pose_u_upside,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_u_ready, "waiting" to R.drawable.art_pose_u_waiting,
            "victory" to R.drawable.art_pose_u_victory, "goodgame" to R.drawable.art_pose_u_goodgame,
        ),
        MascotId.S to mapOf(
            "blocks" to R.drawable.art_pose_s_blocks, "flex" to R.drawable.art_pose_s_flex, "sit" to R.drawable.art_pose_s_sit,
            "slide" to R.drawable.art_pose_s_slide, "stopwatch" to R.drawable.art_pose_s_stopwatch, "trophy" to R.drawable.art_pose_s_trophy,
            // The VS set (FINISH_SPEC D): ready, waiting, victory, good game.
            "ready" to R.drawable.art_pose_s_ready, "waiting" to R.drawable.art_pose_s_waiting,
            "victory" to R.drawable.art_pose_s_victory, "goodgame" to R.drawable.art_pose_s_goodgame,
        ),
    )

    /** The pose drawable for [id] + [pose] (lowercase name), or null if that pose was not drawn. */
    @DrawableRes
    fun res(id: MascotId, pose: String): Int? = table[id]?.get(pose.lowercase())

    /** Every pose name drawn for [id]. */
    fun poses(id: MascotId): Set<String> = table[id]?.keys ?: emptySet()

    /** How many poses ship (62 personality poses + 40 VS poses). */
    val count: Int get() = table.values.sumOf { it.size }
}

/**
 * A cast pose image, [size] square, decorative (hidden from TalkBack). Falls back to
 * the character's hero image when the pose is missing.
 */
@Composable
fun CastPose(id: MascotId, pose: String, size: Dp, modifier: Modifier = Modifier) {
    Image(
        painterResource(CastPoses.res(id, pose) ?: id.res),
        contentDescription = null,
        modifier = modifier.size(size).clearAndSetSemantics { },
    )
}
