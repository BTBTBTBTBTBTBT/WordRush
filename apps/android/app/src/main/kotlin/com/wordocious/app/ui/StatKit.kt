package com.wordocious.app.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.layout.ContentScale
import com.wordocious.app.R
import kotlin.math.roundToInt
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * Shared visual grammar for the Profile + Records stat pages — ports
 * components/profile/stat-kit.tsx (and iOS StatKit.swift). Every section uses
 * SectionHeader; every stat cell uses StatCell; every chart sits in a
 * ChartCard; every Pro gate uses ProStatsInvite. One look, defined once.
 */

/**
 * A section title in the bubble lettering (2.8 item 16: "section titles via BubbleText"), tinted in the section's cast
 * color (core StatsProfile.sectionTitleColor; an unlisted title takes [accent]), with an optional right control.
 */
@Composable
fun SectionHeader(
    label: String,
    accent: Color = WTheme.primary,
    right: (@Composable () -> Unit)? = null,
) {
    val named = com.wordocious.core.StatsProfile.sectionTitleColor(label)
    val tint = if (named == com.wordocious.core.StatsProfile.CAST_W) accent else coreHexColor(named)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        BubbleText(
            label.uppercase(), ThemeKit.accentPalette(tint), Modifier.widthIn(max = 240.dp), maxSize = 22, minSize = 13,
            align = TextAlign.Start,
        )
        Spacer(Modifier.weight(1f))
        right?.invoke()
    }
}

/**
 * The standard Stats card surface (finishing build A1, C3): a tinted card — with an
 * [accent], that accent's wash + line and the game-card top bar in it; without one, the
 * mockup's lavender chart card (#f6f1ff / #e6dcfb, no bar). Never plain white.
 */
@Composable
fun KitCard(
    accent: Color? = null,
    padded: Boolean = true,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    StatsCard(
        swatch = if (accent != null) StatsInk.of(accent) else StatsInk.CHART,
        bar = accent?.let { androidx.compose.ui.graphics.SolidColor(it) },
        corner = 18.dp,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(if (padded) 16.dp else 0.dp),
        verticalArrangement = Arrangement.Top,
        content = content,
    )
}

/** One stat: icon, big value, small uppercase label, optional sub line. */
@Composable
fun StatCell(
    icon: ImageVector?,
    label: String,
    value: String,
    sub: String? = null,
    color: Color? = null,
    modifier: Modifier = Modifier,
    /** When set, the big value counts up from 0 on appear (F4). `value` stays
     *  the fallback for Reduced Motion / non-integer cells. */
    countUp: Int? = null,
    countSuffix: String = "",
    /** A 3D set icon in place of [icon] (HEADER_SPEC §2: wins → trophy, streaks → flame). */
    icon3d: Icon3DName? = null,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        if (icon3d != null) Icon3D(icon3d, 18.dp)
        else if (icon != null) Icon(icon, null, tint = color ?: WTheme.textMuted, modifier = Modifier.size(16.dp))
        val valueColor = if (icon == null && icon3d == null) (color ?: WTheme.text) else WTheme.text
        // A2: every stat value is a soft number.
        @Suppress("UNUSED_VARIABLE") val unusedColor = valueColor
        if (countUp != null) {
            SoftCountUp(countUp, 18.sp, countSuffix)
        } else {
            SoftNumber(value, 18.sp)
        }
        Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, letterSpacing = 0.4.sp, maxLines = 1)
        // Always reserve the sub line so grids of cells stay equal-height.
        Text(sub ?: " ", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted, maxLines = 1)
    }
}

/** One stat for a [StatGrid] row. */
data class KitStat(
    val icon: ImageVector?,
    val label: String,
    val value: String,
    val sub: String? = null,
    val color: Color? = null,
)

/** Grid of StatCells on one KitCard (defaults 4-up like the summary row). */
@Composable
fun StatGrid(stats: List<KitStat>, cols: Int = 4, accent: Color? = null) {
    KitCard(accent = accent) {
        stats.chunked(cols).forEachIndexed { i, row ->
            if (i > 0) Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { s ->
                    StatCell(s.icon, s.label, s.value, s.sub, s.color, Modifier.weight(1f))
                }
                repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** Chart frame: title row + optional timeframe hint + consistent empty state. */
@Composable
fun ChartCard(
    title: String,
    hint: String? = null,
    /** When set, renders the empty-state message instead of children. */
    empty: String? = null,
    accent: Color? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    KitCard(accent = accent) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
            Spacer(Modifier.weight(1f))
            if (hint != null) Text(hint, fontSize = 9.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
        }
        Spacer(Modifier.height(8.dp))
        if (empty != null) {
            Text(
                empty, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), textAlign = TextAlign.Center,
            )
        } else {
            content()
        }
    }
}

/**
 * FINISH_SPEC BJ17: the GO PRO sign cast (ChatGPT / API art, art_gopro_sign_<id>): all ten holding the
 * gold GO PRO lettering. The Stats locked sections and the free finish upsell use them; [prewarm] decodes
 * every display size off main at launch (App.onCreate) so none pops in.
 */
object GoProSign {
    val cast = listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s")   // cast order (web GOPRO_SIGN_CAST)
    fun res(id: String): Int = when (id) {
        "o1" -> R.drawable.art_gopro_sign_o1; "r" -> R.drawable.art_gopro_sign_r
        "d" -> R.drawable.art_gopro_sign_d; "o2" -> R.drawable.art_gopro_sign_o2
        "c" -> R.drawable.art_gopro_sign_c; "i" -> R.drawable.art_gopro_sign_i
        "o3" -> R.drawable.art_gopro_sign_o3; "u" -> R.drawable.art_gopro_sign_u
        "s" -> R.drawable.art_gopro_sign_s; else -> R.drawable.art_gopro_sign_w
    }
    /** A deterministic pick from the local date (same formula as web / iOS), so the finish upsell changes daily. */
    fun ofDay(date: java.time.LocalDate = java.time.LocalDate.now()): String =
        cast[(date.year * 372 + date.monthValue * 31 + date.dayOfMonth) % cast.size]
    /** Longest-side sizes in use: the Stats full / compact blocks and the finish card. */
    val sizes = listOf(116, 60, 64)
    fun prewarm(context: android.content.Context, density: Float) {
        for (id in cast) for (dp in sizes) ArtBitmaps.get(context, res(id), ArtBitmaps.bucketPx((dp * density).roundToInt()))
    }
}

/**
 * The single Pro gate (FINISH_SPEC BJ17, founder 10-03: "a mascot saying go pro… instead of it being
 * blurred out"): no blur and no sample numbers behind glass. The section keeps its own header; in place
 * of the stats, a cast member holds up the gold GO PRO sign, one line says what Pro unlocks HERE, and the
 * gold cast GO PRO button opens the Pro screen. [compact] = the small sign art beside the line + a small
 * button, for every locked section after the first on a page (one big sign per page).
 */
@Composable
fun ProStatsInvite(line: String, onGoPro: () -> Unit, compact: Boolean = false, cast: String = "w") {
    val art = GoProSign.res(cast)
    val text = @Composable { align: TextAlign ->
        Text(line, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 17.sp, textAlign = align,
            color = if (WTheme.isDark) WTheme.text else FinishInk.heading)
    }
    if (compact) {
        Row(
            Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(artPainter(art, 60.dp), contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.size(60.dp))
            Column(Modifier.widthIn(max = 230.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                text(TextAlign.Start)
                CastButton("Go Pro", onClick = onGoPro, color = CastColor.GOLD, size = CastSize.S)
            }
        }
    } else {
        Column(
            Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Item 20: the free player's own mascot on the pedestal with the Stats scene (the cast sign stays on the compact rows).
            ProScene(com.wordocious.core.StatsProfile.ProBenefit.STATS, height = 128.dp, caption = false)
            Box(Modifier.widthIn(max = 280.dp)) { text(TextAlign.Center) }
            CastButton("Go Pro", onClick = onGoPro, color = CastColor.GOLD, size = CastSize.M)
        }
    }
}

/**
 * F1: content-swap transition — a soft fade+rise (~220ms) so switching the
 * Solo/VS/VS CPU toggle or the selected mode eases in instead of snapping.
 * Wraps [AnimatedContent] keyed on [targetState]; Reduced Motion → instant
 * crossfade (no slide). The mode picker / hero above the toggle are NOT wrapped
 * so they never re-animate.
 */
@Composable
fun <T> SwapFade(targetState: T, content: @Composable (T) -> Unit) {
    val dur = if (WTheme.reducedMotion) 0 else 220
    androidx.compose.animation.AnimatedContent(
        targetState = targetState,
        transitionSpec = {
            val enter = androidx.compose.animation.fadeIn(tween(dur)) +
                androidx.compose.animation.slideInVertically(tween(dur)) { if (WTheme.reducedMotion) 0 else it / 12 }
            val exit = androidx.compose.animation.fadeOut(tween(if (WTheme.reducedMotion) 0 else dur / 2))
            enter togetherWith exit
        },
        label = "swapFade",
    ) { content(it) }
}

/**
 * F3: fades + rises a self-fetching card in the moment its data lands, instead
 * of popping. Drive [visible] from a loaded flag / non-empty row check; once it
 * flips true the content eases in (~300ms). Reduced Motion snaps to visible.
 */
@Composable
fun AsyncEntrance(visible: Boolean, content: @Composable () -> Unit) {
    val target = if (visible) 1f else 0f
    val alpha by animateFloatAsState(
        target, animationSpec = tween(if (WTheme.reducedMotion) 0 else 300), label = "asyncAlpha",
    )
    val offset by animateFloatAsState(
        if (visible) 0f else 8f,
        animationSpec = tween(if (WTheme.reducedMotion) 0 else 300), label = "asyncOffset",
    )
    Box(
        Modifier
            .alpha(if (WTheme.reducedMotion) target else alpha)
            .offset(y = (if (WTheme.reducedMotion) 0f else offset).dp),
    ) { content() }
}

/**
 * A number that counts up from 0 to [target] over ~500ms on first appear (F4).
 * For the marquee profile stats — respects Reduced Motion (snaps to final).
 * Snaps (no re-count) when the target changes afterward (toggle / refresh).
 */
@Composable
fun CountUpNumber(target: Int, suffix: String = "", color: Color) {
    var shown by remember { mutableIntStateOf(if (WTheme.reducedMotion || target <= 0) target else 0) }
    LaunchedEffect(target) {
        if (WTheme.reducedMotion || target <= 0) { shown = target; return@LaunchedEffect }
        val steps = minOf(target, 24)
        val stepMs = (500L / steps).coerceAtLeast(1L)
        for (i in 1..steps) {
            kotlinx.coroutines.delay(stepMs)
            shown = Math.round(target.toFloat() * i / steps)
        }
        shown = target
    }
    @Suppress("UNUSED_VARIABLE") val unusedColor = color
    SoftNumber("$shown$suffix", 18.sp)
}

/**
 * Tactile press feedback (F2): a subtle scale-down + light haptic on touch, so
 * profile buttons/chips feel responsive like the game keyboard. Reusable across
 * the app via `Modifier.pressScale { onClick() }` (a rippleless clickable with
 * the scale/haptic baked in). Respects Reduced Motion (no scale, no haptic).
 */
@Composable
fun Modifier.pressScale(scaleTo: Float = 0.96f, onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    val haptics = LocalHapticFeedback.current
    var pressed by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    LaunchedEffect(interaction) {
        interaction.interactions.collect { i ->
            when (i) {
                is PressInteraction.Press -> {
                    pressed = true
                    if (!WTheme.reducedMotion) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                }
                is PressInteraction.Release, is PressInteraction.Cancel -> pressed = false
            }
        }
    }
    val scale by animateFloatAsState(
        if (pressed && !WTheme.reducedMotion) scaleTo else 1f,
        animationSpec = tween(if (WTheme.reducedMotion) 0 else 120), label = "pressScale",
    )
    // A9: the shared squish (.92 on touch-down, a spring past 1 on release) replaces the
    // old flat scale; [scaleTo] / [scale] are kept for the haptic-only call sites.
    @Suppress("UNUSED_VARIABLE") val unused = scale
    this
        .pressSquish(interaction)
        .clickable(interactionSource = interaction, indication = null, onClick = onClick)
}
