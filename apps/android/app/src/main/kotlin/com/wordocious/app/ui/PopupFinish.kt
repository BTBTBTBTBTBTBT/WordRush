package com.wordocious.app.ui

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.sin
import kotlin.random.Random

// The finishing build, phase 2 (docs/FINISH_SPEC.md G1–G5): the shared parts of the
// popups and celebrations with custom art — the scene art springing in with a bounce
// (and an optional soft glow behind it), one-shot confetti, the moment colors and the
// popup close control. Reduce Motion: no spring, no confetti, everything instant.

/** G the moment colors: pink for Flawless, gold for the Sweep, purple for shields, gold for Pro. */
object MomentInk {
    val flawless = Color(0xFFEC4899)
    val sweep = Color(0xFFF5A524)
    val shield = Color(0xFF7C3AED)
    val pro = Color(0xFFF5A524)
    /** G2 the shield header (#a78bfa → #7c3aed → #6d28d9, the mockup's `.pop` shield head). */
    val shieldHeader: Brush
        get() = Brush.linearGradient(
            0f to Color(0xFFA78BFA), 0.6f to Color(0xFF7C3AED), 1f to Color(0xFF6D28D9),
        )
    /** G1 the gold top bar / header. */
    val proBar: Brush
        get() = Brush.horizontalGradient(listOf(Color(0xFFFFD66B), Color(0xFFF5A524), Color(0xFFE8901A)))

    /** The confetti palettes per moment. */
    val flawlessConfetti = listOf(Color(0xFFEC4899), Color(0xFFF472B6), Color(0xFFFBCFE8), Color(0xFFA855F7), Color(0xFFFFD66B), Color(0xFFFFFFFF))
    val sweepConfetti = listOf(Color(0xFFF5A524), Color(0xFFFFD66B), Color(0xFFF97316), Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFF34D399))
    val shieldConfetti = listOf(Color(0xFFA78BFA), Color(0xFF7C3AED), Color(0xFFF5A524), Color(0xFFFFD66B), Color(0xFFF472B6), Color(0xFF60A5FA))
}

/**
 * G a scene image ([res], decorative) [height] tall, springing in from small with a
 * bounce after [delayMs] (Reduce Motion: shown at once). [glow] paints a soft radial
 * glow of that color behind it (the "streak saved" beat, the celebrations).
 */
@Composable
fun SceneArtPop(
    @DrawableRes res: Int,
    height: Dp,
    modifier: Modifier = Modifier,
    glow: Color? = null,
    delayMs: Long = 0L,
) {
    val still = WTheme.reducedMotion
    val scale = remember { Animatable(if (still) 1f else 0.35f) }
    val alpha = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(still) {
        if (still) {
            scale.snapTo(1f); alpha.snapTo(1f)
            // Spec U: the spring-in hop still sounds under Reduce Motion (motion only is off).
            if (delayMs > 0) delay(delayMs)
            com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.HOP)
        } else {
            if (delayMs > 0) delay(delayMs)
            com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.HOP)
            launch { alpha.animateTo(1f, tween(160)) }
            // AZ: the shared spring family (was a separate bouncy 0.42 / 240 spring).
            scale.animateTo(1f, Motion.springIn())
        }
    }
    Box(
        modifier.fillMaxWidth().height(height).clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        if (glow != null) {
            Box(
                Modifier.matchParentSize().graphicsLayer { this.alpha = alpha.value }.drawBehind {
                    drawCircle(
                        Brush.radialGradient(
                            listOf(glow.copy(alpha = 0.55f), glow.copy(alpha = 0.18f), glow.copy(alpha = 0f)),
                            center = center, radius = size.minDimension * 0.62f,
                        ),
                        radius = size.minDimension * 0.62f,
                    )
                },
            )
        }
        Image(
            // AZ: the scene decoded at its shown size and cached, so the spring's first frame is ready.
            artPainter(res, height * 1.6f),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxHeight().graphicsLayer {
                scaleX = scale.value; scaleY = scale.value; this.alpha = alpha.value
                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0.85f)
            },
        )
    }
}

private class ConfettiBit(
    val x: Float, val delay: Float, val dur: Float, val sway: Float, val spin: Float,
    val w: Float, val h: Float, val color: Color, val round: Boolean,
)

/**
 * G one-shot confetti (≈4 s): [count] soft rounded bits in [colors] falling the full
 * height with a gentle sway and spin, fading out at the end. One canvas, one clock.
 * Off with Reduce Motion (draws nothing). Decorative.
 */
@Composable
fun PopupConfetti(
    colors: List<Color>,
    modifier: Modifier = Modifier,
    count: Int = 64,
) {
    if (WTheme.reducedMotion) return
    // FINISH_SPEC AD: Battery Saver halves the burst.
    // AZ: capped (one Canvas, draw-phase only — the clock is read in the draw lambda).
    val n = com.wordocious.app.ui.theme.CalmMotion.confettiCount(count, WTheme.calmMotion).coerceAtMost(Motion.CONFETTI_MAX)
    val bits = remember(colors, n) {
        List(n) {
            ConfettiBit(
                x = Random.nextFloat(),
                delay = Random.nextInt(0, 700).toFloat(),
                dur = Random.nextInt(2200, 3600).toFloat(),
                sway = 0.6f + Random.nextFloat() * 1.4f,
                spin = (if (Random.nextBoolean()) 1 else -1) * (240f + Random.nextFloat() * 480f),
                w = 6f + Random.nextFloat() * 6f,
                h = 9f + Random.nextFloat() * 7f,
                color = colors[Random.nextInt(colors.size)],
                round = Random.nextInt(4) == 0,
            )
        }
    }
    val clock = remember { Animatable(0f) }
    LaunchedEffect(Unit) { clock.animateTo(4400f, tween(4400, easing = LinearEasing)) }
    Canvas(modifier.fillMaxSize().clearAndSetSemantics { }) {
        val ms = clock.value
        val d = density
        bits.forEach { b ->
            val t = ((ms - b.delay) / b.dur).coerceIn(0f, 1f)
            if (t <= 0f || t >= 1f) return@forEach
            val x = b.x * size.width + sin(t * 6.283f * b.sway) * 16f * d
            val y = -20f * d + (size.height + 40f * d) * t
            val fade = if (t > 0.75f) (1f - t) / 0.25f else 1f
            val w = b.w * d
            val h = (if (b.round) b.w else b.h) * d
            rotate(b.spin * t, Offset(x, y)) {
                drawRoundRect(
                    b.color.copy(alpha = fade),
                    topLeft = Offset(x - w / 2f, y - h / 2f),
                    size = Size(w, h),
                    cornerRadius = CornerRadius(if (b.round) w / 2f else 2f * d),
                )
            }
        }
    }
}

/**
 * G a popup's close control: a bare X (no bubble) in [tint] inside a 44 dp tap area,
 * with the icon squish. TalkBack reads [contentDescription].
 */
@Composable
fun PopupClose(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = Color.White,
    contentDescription: String = "Close",
    enabled: Boolean = true,
) {
    Box(
        modifier.size(SOFT_CONTROL_TAP).squishClickable(contentDescription, enabled = enabled, icon = true, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        // Button family §3: the soft 3D X ([tint] kept for callers; the art carries its own colors).
        FamCloseGlyph(24.dp)
    }
}

/** A full-screen dim that swallows taps (popups sit on it). [onTap] null = inert. */
@Composable
fun PopupScrim(onTap: (() -> Unit)?, modifier: Modifier = Modifier, color: Color = Color(0x731E0F3C), content: @Composable BoxScope.() -> Unit) {
    // Spec U: popup / sheet open = whoosh (once per open).
    FeedbackOnShow(com.wordocious.app.data.FeedbackEvent.WHOOSH)
    Box(
        modifier.fillMaxSize().windowScrim(color).then(
            if (onTap != null) Modifier.clickableNoRipple(onTap) else Modifier.clickableNoRipple { },
        ),
        contentAlignment = Alignment.Center,
        content = content,
    )
}
