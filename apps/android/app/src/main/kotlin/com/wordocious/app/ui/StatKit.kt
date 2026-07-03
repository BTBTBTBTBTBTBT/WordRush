package com.wordocious.app.ui

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
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.ui.theme.WTheme

/**
 * Shared visual grammar for the Profile + Records stat pages — ports
 * components/profile/stat-kit.tsx (and iOS StatKit.swift). Every section uses
 * SectionHeader; every stat cell uses StatCell; every chart sits in a
 * ChartCard; every Pro gate uses ProLockOverlay. One look, defined once.
 */

/** Uppercase tracked section label with an accent tick + optional right control. */
@Composable
fun SectionHeader(
    label: String,
    accent: Color = WTheme.primary,
    right: (@Composable () -> Unit)? = null,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(4.dp).height(14.dp).clip(RoundedCornerShape(50)).background(accent))
        Spacer(Modifier.width(8.dp))
        Text(
            label.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black,
            color = WTheme.textMuted, letterSpacing = 1.2.sp,
        )
        Spacer(Modifier.weight(1f))
        right?.invoke()
    }
}

/**
 * The standard card surface: 16dp radius, 1.5dp border, optional 3dp top
 * accent bar (mode color), like the leaderboard card.
 */
@Composable
fun KitCard(
    accent: Color? = null,
    padded: Boolean = true,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(WTheme.surface)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp)),
    ) {
        if (accent != null) Box(Modifier.fillMaxWidth().height(3.dp).background(accent))
        Column(Modifier.fillMaxWidth().padding(if (padded) 16.dp else 0.dp), content = content)
    }
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
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        if (icon != null) Icon(icon, null, tint = color ?: WTheme.textMuted, modifier = Modifier.size(16.dp))
        val valueColor = if (icon == null) (color ?: WTheme.text) else WTheme.text
        if (countUp != null) {
            CountUpNumber(target = countUp, suffix = countSuffix, color = valueColor)
        } else {
            Text(
                value, fontSize = 18.sp, fontWeight = FontWeight.Black,
                color = valueColor, maxLines = 1,
            )
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
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.text)
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
 * The single Pro gate: blurred sample content + a gradient lock pill that
 * opens the Pro screen. Ports stat-kit.tsx ProLockOverlay / iOS ProLockOverlay.
 * (Modifier.blur needs API 31; older devices still get the 0.6-alpha dim +
 * the lock pill over static sample data, so nothing real ever leaks.)
 */
@Composable
fun ProLockOverlay(
    label: String = "Unlock with Pro",
    onGoPro: () -> Unit,
    content: @Composable () -> Unit,
) {
    Box(Modifier.fillMaxWidth()) {
        Box(
            Modifier.fillMaxWidth().blur(3.dp).alpha(0.6f)
                .clearAndSetSemantics { },
        ) { content() }
        // Transparent scrim eats taps on the blurred content underneath.
        Box(Modifier.matchParentSize().clickableNoRipple(onGoPro))
        Row(
            Modifier.align(Alignment.Center).clip(RoundedCornerShape(50))
                .background(Brush.horizontalGradient(listOf(Color(0xFFA78BFA), Color(0xFFEC4899))))
                .clickableNoRipple(onGoPro).padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text("🔒", fontSize = 11.sp)
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color.White)
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
    Text(
        "$shown$suffix", fontSize = 18.sp, fontWeight = FontWeight.Black,
        color = color, maxLines = 1,
    )
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
    this
        .scale(scale)
        .clickable(interactionSource = interaction, indication = null, onClick = onClick)
}
