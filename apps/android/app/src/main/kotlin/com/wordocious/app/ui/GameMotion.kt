package com.wordocious.app.ui

import android.os.SystemClock
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.MotionSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * FINISH_SPEC BJ9 — games "grow + soft rise" from the tapped card and shrink back
 * (iOS GameTransition.swift, web game-transition.ts; numbers in core MotionSpec).
 *
 * Smoothness rules: ONE driver (an elapsed-time Animatable) is read only in draw /
 * graphicsLayer lambdas, so a frame of the transition never recomposes or re-lays
 * out anything. What moves is the shell (one rounded rect drawn between Home and
 * the game layer) and the tapped card's own layer (the lift). The game is composed
 * — built — in the very first frame under the shell at alpha 0 and only revealed
 * (its layer's alpha) over the last 60% of the grow; Home keeps drawing under the
 * shell until the reveal ends. Closing fades the game's layer (0.18 s), then the
 * shell shrinks into the same card's CURRENT bounds. Reduce Motion: a cross-fade.
 */
object GameMotion {
    enum class Phase { IDLE, OPENING, CLOSING }

    private class Source(var coords: LayoutCoordinates?, var color: Color, var radius: Float)

    private val sources = HashMap<String, Source>()
    private var armedKey: String? = null
    private var armedAt = 0L

    /** Snapshot state, read in draw lambdas only. */
    var phase by mutableStateOf(Phase.IDLE)
        private set
    private val clock = Animatable(0f)

    private var kind = MotionSpec.OpenKind.RISE
    private var card: MotionSpec.Box? = null
    private var liftKey: String? = null
    private var closeKey: String? = null
    private var color = Color(0xFFF3EEFF)
    private var radius = 0f
    private var density = 1f
    private var screen = MotionSpec.Box(0f, 0f, 1f, 1f)
    private var scope: CoroutineScope? = null
    private var job: Job? = null
    private var gameUp = false
    private var fadedOut = false

    fun register(key: String, coords: LayoutCoordinates, color: Color, radiusPx: Float) {
        val s = sources[key]
        if (s == null) sources[key] = Source(coords, color, radiusPx)
        else { s.coords = coords; s.color = color; s.radius = radiusPx }
    }

    private var armedFrame: MotionSpec.Box? = null
    private var armedFrameOnly = false

    /**
     * The tap about to open a game: remember its card. [frameOnly]: the control's page
     * closes as the game opens (Strategy's PLAY) — grow from where it was, and close as a
     * soft rise (the card is gone).
     */
    fun arm(key: String, frameOnly: Boolean = false) {
        armedKey = key
        armedAt = SystemClock.uptimeMillis()
        armedFrame = bounds(key)
        armedFrameOnly = frameOnly
    }

    private fun bounds(key: String?): MotionSpec.Box? {
        val c = key?.let { sources[it]?.coords }?.takeIf { it.isAttached } ?: return null
        val r = c.boundsInWindow()
        return MotionSpec.Box(r.left, r.top, r.width, r.height)
    }

    /** Called from the game layer's first frame (before it draws). */
    internal fun gameEntered() {
        // Sound Lab pick "Page Breeze": once per open (leaving never plays it).
        com.wordocious.app.data.SoundManager.fire(com.wordocious.app.data.FeedbackEvent.GAME_OPEN)
        gameUp = true
        fadedOut = false
        val key = armedKey?.takeIf { SystemClock.uptimeMillis() - armedAt <= MotionSpec.ARM_WINDOW_MS }
        armedKey = null
        val frameOnly = armedFrameOnly
        val frame = MotionSpec.usableSource(if (key == null) null else (bounds(key) ?: armedFrame), screen)
        armedFrame = null; armedFrameOnly = false
        kind = MotionSpec.openKind(frame != null, WTheme.reducedMotion)
        card = frame
        liftKey = if (frame != null && !frameOnly) key else null
        closeKey = liftKey
        val src = key?.let { sources[it] }
        if (frame != null && src != null) { color = src.color; radius = src.radius }
        else { color = WTheme.bg; radius = 28f * density }
        // Founder 10-10: in a dark season the shell under the page is the season's night card (never a pale slab).
        WTheme.season?.takeIf { it.dark }?.card?.let { color = it }
        run(Phase.OPENING, from = 0f, to = MotionSpec.openDurationMs(kind).toFloat())
    }

    /** The game layer left composition (the close's state change landed). */
    internal fun gameLeft() {
        gameUp = false
        liftKey = null
        // Land in the card's bounds NOW (Home re-laid out under the shell).
        val live = MotionSpec.usableSource(bounds(closeKey), screen)
        card = live
        if (kind == MotionSpec.OpenKind.GROW && live == null) kind = MotionSpec.OpenKind.RISE
        val start = if (fadedOut || kind == MotionSpec.OpenKind.CROSS_FADE) clock.value.coerceAtLeast(0f)
                    else MotionSpec.CLOSE_FADE_MS.toFloat()
        if (kind == MotionSpec.OpenKind.CROSS_FADE && !fadedOut) { phase = Phase.IDLE; return }
        run(Phase.CLOSING, from = start, to = MotionSpec.closeDurationMs(kind).toFloat())
    }

    /**
     * Close the game with its fade: the game's layer fades (0.18 s) BEFORE [commit]
     * removes it, then the shell shrinks. Any path that clears the game directly
     * skips straight to the shrink.
     */
    fun close(commit: () -> Unit) {
        val s = scope
        if (!gameUp || s == null || phase == Phase.CLOSING) { commit(); return }
        job?.cancel()
        kind = if (WTheme.reducedMotion) MotionSpec.OpenKind.CROSS_FADE else kind
        phase = Phase.CLOSING
        job = s.launch {
            clock.snapTo(0f)
            val fade = if (kind == MotionSpec.OpenKind.CROSS_FADE) MotionSpec.CROSS_FADE_MS else MotionSpec.CLOSE_FADE_MS
            clock.animateTo(fade.toFloat(), tween(fade, easing = LinearEasing))
            fadedOut = true
            commit()
        }
    }

    private fun run(p: Phase, from: Float, to: Float) {
        val s = scope ?: run { phase = Phase.IDLE; return }
        job?.cancel()
        phase = p
        job = s.launch {
            clock.snapTo(from)
            clock.animateTo(to, tween((to - from).toInt().coerceAtLeast(1), easing = LinearEasing))
            if (phase == p) phase = Phase.IDLE
        }
    }

    /** Home keeps drawing under the shell while a game opens / closes. */
    fun homeShows(): Boolean = phase != Phase.IDLE

    /** The game layer's alpha (1 when idle). */
    fun gameAlpha(): Float {
        val ms = clock.value
        return when (phase) {
            Phase.IDLE -> 1f
            Phase.OPENING -> MotionSpec.openFrame(kind, ms, card, screen, radius, MotionSpec.LIFT_RISE_DP * density, MotionSpec.RISE_OFFSET_DP * density).gameAlpha
            Phase.CLOSING -> if (gameUp) MotionSpec.closeFrame(kind, ms, card, screen, radius, MotionSpec.RISE_OFFSET_DP * density).gameAlpha else 1f
        }
    }

    /** The tapped card's lift (scale, rise px), identity for every other card. */
    internal fun lift(key: String): Pair<Float, Float> {
        if (phase != Phase.OPENING || liftKey != key) return 1f to 0f
        val f = MotionSpec.openFrame(kind, clock.value, card, screen, radius, MotionSpec.LIFT_RISE_DP * density, MotionSpec.RISE_OFFSET_DP * density)
        return f.liftScale to f.liftRise
    }

    internal fun drawShell(scope: androidx.compose.ui.graphics.drawscope.DrawScope) {
        val p = phase
        if (p == Phase.IDLE) return
        val ms = clock.value
        val (box, alpha, r) = if (p == Phase.OPENING) {
            val f = MotionSpec.openFrame(kind, ms, card, screen, radius, MotionSpec.LIFT_RISE_DP * density, MotionSpec.RISE_OFFSET_DP * density)
            Triple(f.shell, f.shellAlpha, f.shellRadius)
        } else {
            val f = MotionSpec.closeFrame(kind, ms, card, screen, radius, MotionSpec.RISE_OFFSET_DP * density)
            Triple(f.shell, f.shellAlpha, f.shellRadius)
        }
        if (alpha <= 0f) return
        scope.drawRoundRect(
            color = color, topLeft = Offset(box.left, box.top), size = Size(box.width, box.height),
            cornerRadius = CornerRadius(r, r), alpha = alpha.coerceIn(0f, 1f),
        )
    }

    internal fun attach(scope: CoroutineScope, density: Float, w: Float, h: Float) {
        this.scope = scope
        this.density = density
        if (w > 0f && h > 0f) screen = MotionSpec.Box(0f, 0f, w, h)
    }
}

/** BJ9: the shell layer (between Home and the game layer); draws nothing when idle. */
@Composable
fun GameMotionShell(modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current.density
    Box(
        modifier.fillMaxSize()
            .onGloballyPositioned { GameMotion.attach(scope, density, it.size.width.toFloat(), it.size.height.toFloat()) }
            .drawBehind { GameMotion.drawShell(this) },
    )
}

/** BJ9: put inside the game layer while a game is up (enter = open, leave = close). */
@Composable
fun GameMotionMarker() {
    DisposableEffect(Unit) {
        GameMotion.gameEntered()
        onDispose { GameMotion.gameLeft() }
    }
}

/**
 * BJ9: this view is a card that launches games — its bounds are read on demand (the
 * callback only keeps a reference), and it lifts (scale 1.03, up 4) when tapped.
 */
fun Modifier.gameLaunchSource(key: String, color: Color, radius: Dp): Modifier = this
    .onGloballyPositioned { GameMotion.register(key, it, color, radius.value * systemDensity) }
    .graphicsLayer {
        val (s, rise) = GameMotion.lift(key)
        scaleX = s; scaleY = s; translationY = -rise
    }

private val systemDensity: Float get() = android.content.res.Resources.getSystem().displayMetrics.density

/** The game layer's alpha (read in its graphicsLayer: no recomposition). */
fun Modifier.gameMotionLayer(): Modifier = graphicsLayer { alpha = GameMotion.gameAlpha() }

/** Default radius of a launch card. */
val GAME_SOURCE_RADIUS = 16.dp
