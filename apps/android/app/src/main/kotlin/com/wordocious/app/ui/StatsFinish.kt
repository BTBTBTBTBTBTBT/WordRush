package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

// The finishing build, phase 2 — the Stats tab's own surfaces (docs/FINISH_SPEC.md C3
// "Stats page look", A1, A2, A7): the mockup's swatches (stats-friends-polish.html),
// a tinted card / surface in a swatch, the Today | All-time segmented toggle, the
// colored stat tile with its 3D icon and soft number, the gradient level bar and the
// empty-state card with a cast pose. Built on FinishKit + FinishPages.

/** One of the mockup's card swatches: the wash, its 1.5 dp line, the label ink and the accent (bars). */
data class StatsSwatch(val tint: Color, val line: Color, val ink: Color, val accent: Color)

object StatsInk {
    /** The Stats page accent (PageTint.STATS) + the picker's label ink. */
    val accent = Color(0xFF2563EB)
    val pickerLabel = Color(0xFF2456A8)
    /** The Today | All-time selected segment. */
    val segment = Color(0xFF7C3AED)

    val LAVENDER = StatsSwatch(Color(0xFFF4EEFF), Color(0xFFE2D3FF), Color(0xFF6D28D9), Color(0xFF7C3AED))
    val BLUE = StatsSwatch(Color(0xFFEAF2FF), Color(0xFFCFE0FF), Color(0xFF2456A8), Color(0xFF2563EB))
    val GOLD = StatsSwatch(Color(0xFFFFF4E2), Color(0xFFF8DFB0), Color(0xFFA2560C), Color(0xFFF5A524))
    val PINK = StatsSwatch(Color(0xFFFFEEF7), Color(0xFFFFD0E6), Color(0xFFA0336B), Color(0xFFEC4899))
    val GREEN = StatsSwatch(Color(0xFFEAFAF0), Color(0xFFC7EFD6), Color(0xFF137A3D), Color(0xFF16A34A))
    val TEAL = StatsSwatch(Color(0xFFE6F7F5), Color(0xFFB9E6E0), Color(0xFF0F6B63), Color(0xFF0D9488))
    val MAGENTA = StatsSwatch(Color(0xFFFBEBFD), Color(0xFFF0C8F5), Color(0xFF8E1C9C), Color(0xFFC026D3))
    /** The chart cards (`--tint:#f6f1ff;--tline:#e6dcfb`). */
    val CHART = StatsSwatch(Color(0xFFF6F1FF), Color(0xFFE6DCFB), Color(0xFF5B3C96), Color(0xFF7C3AED))

    /** The player card's purple → pink bar + level bar. */
    val playerBar = Brush.horizontalGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899)))
    val levelBar = Brush.horizontalGradient(listOf(Color(0xFFA855F7), Color(0xFFEC4899)))
    /** Today's blue bar. */
    val todayBar = Brush.horizontalGradient(listOf(Color(0xFF0A6CFF), Color(0xFF60A5FA)))
    /** The charts' purple bars. */
    val chartBars = Brush.verticalGradient(listOf(Color(0xFFA78BFA), Color(0xFF7C3AED)))

    /** A swatch for any [accent] (game / section): the A1 wash + line + darkened ink. */
    fun of(accent: Color): StatsSwatch =
        StatsSwatch(Wash.mix(accent, Wash.CARD), Wash.mix(accent, Wash.LINE), darkenInk(accent), accent)
}

/** The swatch's wash in light mode; dark mode keeps the dark surface (A1). */
@Composable
fun StatsSwatch.surface(): Color = if (WTheme.isDark) WTheme.surface else tint
@Composable
fun StatsSwatch.border(): Color = if (WTheme.isDark) WTheme.border else line
@Composable
fun StatsSwatch.label(): Color = if (WTheme.isDark) WTheme.textSecondary else ink

/**
 * A1 a Stats card in [swatch]: TintedCard with the swatch's wash + line, and the
 * game-card top [bar] (null = none; defaults to the swatch accent).
 */
@Composable
fun StatsCard(
    swatch: StatsSwatch,
    modifier: Modifier = Modifier,
    bar: Brush? = SolidColor(swatch.accent),
    barHeight: Dp = 10.dp,
    corner: Dp = 20.dp,
    contentPadding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 12.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(10.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    TintedCard(
        swatch.accent, modifier.fillMaxWidth(), corner = corner, bar = bar, barHeight = barHeight,
        tint = swatch.surface(), line = swatch.border(),
        contentPadding = contentPadding, verticalArrangement = verticalArrangement, content = content,
    )
}

/**
 * A1 the same tinted surface as a modifier (for rows / boxes that keep their own layout):
 * wash, 1.5 dp line, radius [corner], a soft lift, and an optional [bar] band drawn
 * across the top (keep ≥ the bar height of top padding inside).
 */
fun Modifier.statsSurface(
    swatch: StatsSwatch = StatsInk.CHART,
    corner: Dp = 16.dp,
    bar: Color? = null,
    barHeight: Dp = 6.dp,
    lift: Boolean = true,
): Modifier = composed {
    val shape = RoundedCornerShape(corner)
    this
        .then(if (lift) Modifier.shadow(4.dp, shape, clip = false, ambientColor = FinishInk.cardShadow, spotColor = FinishInk.cardShadow) else Modifier)
        .clip(shape)
        .background(swatch.surface())
        .then(
            if (bar != null) Modifier.drawWithContent {
                drawContent()
                drawRect(bar, Offset.Zero, Size(size.width, barHeight.toPx()))
            } else Modifier,
        )
        .border(1.5.dp, swatch.border(), shape)
}

/**
 * C3 the picker header's two-segment toggle ("Today | All-time"): a tinted track,
 * the selected segment filled purple (#7C3AED) with white text, squish on press,
 * announced as tabs with the selected state. [selected] null = neither (a game or the
 * Sweep tile is selected below).
 */
@Composable
fun StatsSegmented(
    options: List<Pair<String, String>>,
    selected: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    track: Color = StatsInk.accent,
    fill: Color = StatsInk.segment,
    fontSize: TextUnit = 12.sp,
) {
    val dark = WTheme.isDark
    val shape = RoundedCornerShape(50)
    Row(
        modifier.clip(shape)
            .background(if (dark) WTheme.surfaceAlt else Wash.mix(track, 0.12f))
            .border(1.5.dp, if (dark) WTheme.border else Wash.mix(track, 0.30f), shape)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        options.forEach { (key, label) ->
            val on = key == selected
            Box(
                Modifier.weight(1f)
                    .squishClickable(onClick = { onSelect(key) })
                    .clip(shape)
                    .background(if (on) fill else Color.Transparent)
                    .padding(horizontal = 10.dp, vertical = 6.dp)
                    .semantics(mergeDescendants = true) {
                        role = Role.Tab
                        this.selected = on
                        contentDescription = label
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label, fontSize = fontSize, fontWeight = FontWeight.Black, maxLines = 1,
                    color = if (on) Color.White else if (dark) WTheme.textSecondary else darkenInk(track),
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * C3 a colored stat tile (the mockup's `.mini`): a card in [swatch], a 3D [icon] beside
 * the caps [label], the big soft [value] (A2) and a small [sub] line. [countUp] counts
 * the number up from 0 on first appear (F4; Reduce Motion snaps).
 */
@Composable
fun StatsTile(
    swatch: StatsSwatch,
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    icon: Icon3DName? = null,
    sub: String? = null,
    countUp: Int? = null,
    countSuffix: String = "",
    valueSize: TextUnit = 28.sp,
    onClick: (() -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    StatsCard(
        swatch,
        modifier.then(if (onClick != null) Modifier.squishClickable(onClick = onClick) else Modifier)
            .semantics(mergeDescendants = true) { },
        bar = null,
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (icon != null) Icon3D(icon, 20.dp)
            Text(
                label.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 0.1.em,
                color = swatch.label(), maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        if (countUp != null) SoftCountUp(countUp, valueSize, countSuffix) else SoftNumber(value, valueSize)
        if (sub != null) {
            Text(
                sub, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, maxLines = 2,
            )
        }
        trailing?.invoke()
    }
}

/** A2 + F4 a soft number that counts up from 0 to [target] once (Reduce Motion snaps). */
@Composable
fun SoftCountUp(target: Int, fontSize: TextUnit, suffix: String = "", modifier: Modifier = Modifier) {
    val still = WTheme.reducedMotion
    var shown by androidx.compose.runtime.remember { androidx.compose.runtime.mutableIntStateOf(if (still || target <= 0) target else 0) }
    androidx.compose.runtime.LaunchedEffect(target) {
        if (still || target <= 0) { shown = target; return@LaunchedEffect }
        val steps = minOf(target, 24)
        val stepMs = (500L / steps).coerceAtLeast(1L)
        for (i in 1..steps) {
            kotlinx.coroutines.delay(stepMs)
            shown = Math.round(target.toFloat() * i / steps)
        }
        shown = target
    }
    SoftNumber("${formatCount(shown)}$suffix", fontSize, modifier)
}

/** "1,234" grouping for the soft numbers. */
fun formatCount(n: Int): String = String.format(java.util.Locale.US, "%,d", n)

/** The player card's level bar: a 10 dp track (purple 14%) with the purple → pink fill. */
@Composable
fun StatsLevelBar(progress: Float, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier.fillMaxWidth().height(10.dp).clip(shape)
            .background(Color(0xFF7C3AED).copy(alpha = if (WTheme.isDark) 0.28f else 0.14f))
            .clearAndSetSemantics { },
    ) {
        Box(Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(10.dp).clip(shape).background(StatsInk.levelBar))
    }
}

/** A cast pose for a Stats secondary spot (A7: never D, the Stats host). */
data class StatsPose(val id: MascotId, val pose: String)

object StatsPoses {
    val guest = StatsPose(MascotId.O2, "cheer")
    val noGames = StatsPose(MascotId.O1, "sit")
    val proInsights = StatsPose(MascotId.C, "telescope")
    val proStats = StatsPose(MascotId.R, "cocoa")
    /** The "no data yet" cards, one character each so two never repeat on a page. */
    fun forTitle(title: String): StatsPose = when (title) {
        "Top Words" -> StatsPose(MascotId.I, "reach")
        "Opener Lab" -> StatsPose(MascotId.O3, "sneak")
        "Weekday Form" -> StatsPose(MascotId.S, "stopwatch")
        "Skill Radar" -> StatsPose(MascotId.U, "meditate")
        "Rivalries" -> StatsPose(MascotId.W, "point")
        "Deep Insights" -> StatsPose(MascotId.C, "map")
        else -> StatsPose(MascotId.O2, "lean")
    }
}

/**
 * A1 / A7 / A8 an empty / signed-out state: a tinted card in [swatch] with a cast
 * [pose] (decorative), the line, and an optional candy [action].
 */
@Composable
fun StatsEmptyState(
    pose: StatsPose,
    text: String,
    modifier: Modifier = Modifier,
    swatch: StatsSwatch = StatsInk.BLUE,
    title: String? = null,
    poseSize: Dp = 96.dp,
    bar: Boolean = true,
    action: (@Composable () -> Unit)? = null,
) {
    StatsCard(
        swatch, modifier, bar = if (bar) SolidColor(swatch.accent) else null,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            CastPose(pose.id, pose.pose, poseSize)
            if (title != null) {
                Text(
                    title, fontSize = 17.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center,
                    color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                )
            }
            Text(
                text, fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted,
            )
            if (action != null) Box(Modifier.padding(top = 4.dp)) { action() }
        }
    }
}

/** A caps card title in the card's ink (the mockup's `.lbl`), with an optional right side. */
@Composable
fun StatsCardLabel(text: String, swatch: StatsSwatch, modifier: Modifier = Modifier, right: (@Composable () -> Unit)? = null) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 0.12.em,
            color = swatch.label(), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
        )
        right?.invoke()
    }
}
