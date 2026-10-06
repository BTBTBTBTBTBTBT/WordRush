package com.wordocious.app.ui

import android.os.SystemClock
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import com.wordocious.core.MelodyState
import com.wordocious.core.MusicalCast
import com.wordocious.core.MusicalMelody
import com.wordocious.core.MusicalTiming
import kotlin.math.roundToLong

// The musical cast easter egg (docs/cloud-prompts/10; core MusicalCast, a 1:1 port of packages/core/src/musical-cast.ts).
// Behind the musicalCast flag: ON in debug builds, OFF in release until the founder approves. A long-press on any
// header figure turns all ten "musical" — a squash-and-pop rippling out from the pressed one, then a soft gold glow
// behind each and a little note badge on its shoulder. Each tap then plays that hero's scale note in its own voice
// (SoundManager.castNote) + a selection haptic + a small hop (no laugh) + a floating note that rises and fades (in place
// under Reduce Motion; shown with sound off too). A tune played right unlocks its secret achievement
// (AchievementService.unlockTune; guests nothing). Long-press again → back, the laughs return.
// Same perf rules as the cast puppets: everything here is drawn by the header's own frame clock, which runs only while
// something moves (the pop, a hop, a floating note) and never while the tab is hidden. Web: components/ui/cast-header.tsx;
// iOS: AppHeaderView.swift.

/** The musical mode, shared by every tab's cast header (toggle it on Home, it's musical on Stats too). */
object MusicalCastState {
    /** The flag: on in debug builds, off in release. */
    val enabled: Boolean = MusicalCast.enabled(com.wordocious.app.BuildConfig.DEBUG)

    var on by mutableStateOf(false)
        private set
    /** The ripple's center: the hero that was long-pressed. */
    var from by mutableStateOf("w")
        private set
    /** When the last toggle happened (ms, System.nanoTime base — the header's frame clock); null = never. */
    var toggledAt by mutableStateOf<Long?>(null)
        private set
    /** The last toggle was an instant swap (Reduce Motion): no pop, the touches switch at once. */
    var instant by mutableStateOf(false)
        private set
    private var melody: MelodyState = MusicalCast.MELODY_START

    fun toggle(fromId: String, nowMs: Long, reduceMotion: Boolean) {
        from = fromId
        toggledAt = nowMs
        instant = reduceMotion
        on = !on
        melody = MusicalCast.MELODY_START
    }

    /** One note into the melody matcher (uptime clock) → the tune it just completed, if any. */
    fun tap(castId: String): MusicalMelody? {
        val r = MusicalCast.melodyTap(melody, castId, SystemClock.uptimeMillis())
        melody = r.state
        return r.matched
    }
}

/** The timing math of the musical touches (pure, so it can be tested without a device). */
object MusicalCastMotion {
    /** CSS `ease-out`, the web transform's easing. */
    private val easeOut = CubicBezierEasing(0f, 0f, 0.58f, 1f)
    /** The badge's little overshoot (web `cubic-bezier(0.3, 1.5, 0.5, 1)`). */
    private val overshoot = CubicBezierEasing(0.3f, 1.5f, 0.5f, 1f)
    const val GLOW_FADE_MS = 260L
    const val BADGE_FADE_MS = 200L
    const val BADGE_SCALE_MS = 320L
    /** A note tap's hop: half the transform pop, this long. */
    const val HOP_MS = 300L
    const val FLOAT_MS = 1100L
    const val FLOAT_STILL_MS = 600L
    /** At most this many floating notes at once (per header). */
    const val MAX_FLOATS = 12
    /** The floating notes' colors (cast candy colors), cycled per tap. */
    val NOTE_COLORS = listOf(Color(0xFF7C3AED), Color(0xFFEC4899), Color(0xFFF59E0B), Color(0xFF0EA5E9), Color(0xFF22C55E))

    /** Each hero's touches switch on partway through its own pop (the ripple). */
    fun touchDelayMs(index: Int, from: String): Long =
        MusicalCast.transformDelays(from, false)[index] + (MusicalTiming.popMs * 0.4).roundToLong()

    /** How long after a toggle something still moves (the last pop, the last badge settling). */
    fun transformBusyMs(from: String): Long =
        maxOf(MusicalCast.transformDuration(from, false), MusicalCast.CAST_IDS.indices.maxOf { touchDelayMs(it, from) } + BADGE_SCALE_MS)

    private fun progress(elapsed: Long, dur: Long): Float = (elapsed.toFloat() / dur).coerceIn(0f, 1f)

    /** The glow's opacity (0..1) for figure [index] at [now]. */
    fun glow(index: Int, on: Boolean, from: String, toggledAt: Long?, instant: Boolean, now: Long): Float {
        if (toggledAt == null || instant) return if (on) 1f else 0f
        val p = easeOut.transform(progress(now - toggledAt - touchDelayMs(index, from), GLOW_FADE_MS))
        return if (on) p else 1f - p
    }

    /** The note badge's (opacity, scale) for figure [index] at [now]. */
    fun badge(index: Int, on: Boolean, from: String, toggledAt: Long?, instant: Boolean, now: Long): Pair<Float, Float> {
        if (toggledAt == null || instant) return if (on) 1f to 1f else 0f to 0.3f
        val el = now - toggledAt - touchDelayMs(index, from)
        val a = easeOut.transform(progress(el, BADGE_FADE_MS))
        val s = overshoot.transform(progress(el, BADGE_SCALE_MS))
        return if (on) a to (0.3f + 0.7f * s) else (1f - a) to (1f - 0.7f * s)
    }

    /** The squash-and-pop for figure [index] at [now] (sx, sy, lift % of height), or null when it isn't popping. */
    fun pop(index: Int, from: String, toggledAt: Long?, instant: Boolean, now: Long): Triple<Float, Float, Float>? {
        if (toggledAt == null || instant) return null
        val el = now - toggledAt - MusicalCast.transformDelays(from, false)[index]
        if (el <= 0 || el >= MusicalTiming.popMs) return null
        val k = MusicalCast.popAt(easeOut.transform(el.toFloat() / MusicalTiming.popMs).toDouble())
        return Triple(k.sx.toFloat(), k.sy.toFloat(), k.lift.toFloat())
    }

    /** A note tap's small hop (half the pop) [el] ms in, or null when done. */
    fun hop(el: Long): Triple<Float, Float, Float>? {
        if (el < 0 || el >= HOP_MS) return null
        val k = MusicalCast.popAt(easeOut.transform(el.toFloat() / HOP_MS).toDouble())
        return Triple(1 + (k.sx.toFloat() - 1) / 2, 1 + (k.sy.toFloat() - 1) / 2, k.lift.toFloat() / 2)
    }

    /** A floating note [el] ms in → (opacity, x, y in its own size, scale, rotation°); null when gone. [still] = Reduce Motion. */
    fun float(el: Long, drift: Float, still: Boolean): FloatPose? {
        if (still) {
            if (el < 0 || el >= FLOAT_STILL_MS) return null
            val t = el.toFloat() / FLOAT_STILL_MS
            return FloatPose(if (t < 0.2f) t / 0.2f else 1f - (t - 0.2f) / 0.8f, 0f, 0f, 1f, 0f)
        }
        if (el < 0 || el >= FLOAT_MS) return null
        val u = easeOut.transform(el.toFloat() / FLOAT_MS)
        return if (u < 0.25f) {
            val v = u / 0.25f
            FloatPose(v, drift / 3 / 100 * v, -0.6f * v, 0.5f + 0.5f * v, 0f)
        } else {
            val v = (u - 0.25f) / 0.75f
            FloatPose(1f - v, (drift / 3 + (drift - drift / 3) * v) / 100, -0.6f - 1.6f * v, 1f - 0.1f * v, drift / 3 * v)
        }
    }

    data class FloatPose(val alpha: Float, val x: Float, val y: Float, val scale: Float, val rot: Float)
}

/** One header's note-tap effects: the hops and the floating notes (per header; snapshot state, read in draw). */
class MusicalCastFx {
    data class FloatNote(val castId: String, val at: Long, val drift: Float, val color: Color, val still: Boolean)

    val hops = mutableStateMapOf<String, Long>()
    val floats = mutableStateListOf<FloatNote>()
    private var n = 0

    fun note(castId: String, nowMs: Long, still: Boolean) {
        if (!still) hops[castId] = nowMs
        if (floats.size < MusicalCastMotion.MAX_FLOATS) {
            val drift = (kotlin.random.Random.nextFloat() * 2 - 1) * 40f
            floats.add(FloatNote(castId, nowMs, drift, MusicalCastMotion.NOTE_COLORS[n++ % MusicalCastMotion.NOTE_COLORS.size], still))
        }
    }

    fun has(castId: String): Boolean = hops.containsKey(castId) || floats.any { it.castId == castId }

    /** Whether a hop or a note is still moving at [now]. */
    fun busy(now: Long): Boolean =
        hops.values.any { now - it < MusicalCastMotion.HOP_MS } ||
            floats.any { now - it.at < if (it.still) MusicalCastMotion.FLOAT_STILL_MS else MusicalCastMotion.FLOAT_MS }

    /** Drop what has finished (called by the frame loop). */
    fun prune(now: Long) {
        if (hops.isNotEmpty()) hops.entries.filter { now - it.value >= MusicalCastMotion.HOP_MS }.forEach { hops.remove(it.key) }
        if (floats.isNotEmpty()) floats.removeAll { now - it.at >= if (it.still) MusicalCastMotion.FLOAT_STILL_MS else MusicalCastMotion.FLOAT_MS }
    }
}

/** A drawn eighth note (never an emoji) in a 20 × 24 box — the same path as web lib/musical-cast.ts NOTE_SVG. */
private val NOTE_PATH = PathParser()
    .parsePathString("M8 3 L17 1 L17 15.5 A3.6 3 -20 1 1 14.6 13 L14.6 5.3 L10.4 6.2 L10.4 18 A3.6 3 -20 1 1 8 15.4 Z")
    .toPath()
private val NOTE_INK = Color(0xFF7C3AED)
private val NOTE_SHADOW = Color(0x4D3C1E6E)
private val GLOW_GOLD = Color(0x8CFDE047)

/** The note path at [left], [top], [width] wide (6:5 tall). */
private fun DrawScope.drawNote(left: Float, top: Float, width: Float, color: Color, alpha: Float, shadow: Boolean = false) {
    val k = width / 20f
    translate(left, top) {
        withTransform({ scale(k, k, pivot = Offset.Zero) }) {
            if (shadow) translate(0f, 1f / k) { drawPath(NOTE_PATH, NOTE_SHADOW, alpha = alpha) }
            drawPath(NOTE_PATH, color, alpha = alpha)
        }
    }
}

/** The soft gold radial glow behind a figure (an ellipse a little wider than the figure box). */
fun DrawScope.drawMusicalGlow(alpha: Float) {
    if (alpha <= 0.01f) return
    val l = -0.08f * size.width
    val r = 1.08f * size.width
    val t = 0.08f * size.height
    val b = 1.04f * size.height
    val c = Offset((l + r) / 2, (t + b) / 2)
    val rx = (r - l) / 2
    val ry = (b - t) / 2
    withTransform({ scale(1f, ry / rx, pivot = c) }) {
        drawCircle(
            Brush.radialGradient(0f to GLOW_GOLD, 0.72f to GLOW_GOLD.copy(alpha = 0f), center = c, radius = rx),
            radius = rx, center = c, alpha = alpha,
        )
    }
}

/**
 * The little note badge on a figure's shoulder (top right). TODO(art): art-cast-musical-<id> — the hero's
 * ChatGPT musical costume replaces this code-drawn badge when it ships.
 */
fun DrawScope.drawMusicalBadge(alpha: Float, scale: Float) {
    if (alpha <= 0.01f) return
    val w = 0.30f * size.width
    val h = w * 6f / 5f
    val left = 0.98f * size.width - w
    val top = 0.04f * size.height
    withTransform({ scale(scale, scale, pivot = Offset(left + w / 2, top + h / 2)) }) {
        drawNote(left, top, w, NOTE_INK, alpha, shadow = true)
    }
}

/** A floating note, rising out of the figure (pose from [MusicalCastMotion.float]). */
fun DrawScope.drawFloatingNote(pose: MusicalCastMotion.FloatPose, color: Color) {
    val w = 0.32f * size.width
    val h = w * 6f / 5f
    val left = 0.30f * size.width + pose.x * w
    val top = 0.10f * size.height + pose.y * h
    val pivot = Offset(left + w / 2, top + h / 2)
    withTransform({
        rotate(pose.rot, pivot)
        scale(pose.scale, pose.scale, pivot)
    }) { drawNote(left, top, w, color, pose.alpha.coerceIn(0f, 1f)) }
}

/** Apply a (sx, sy, lift %) squash-and-pop about the figure's center, then [block]. */
inline fun DrawScope.withPop(pose: Triple<Float, Float, Float>?, block: DrawScope.() -> Unit) {
    if (pose == null) { block(); return }
    val (sx, sy, lift) = pose
    val c = Offset(size.width / 2, size.height / 2)
    withTransform({
        translate(0f, -lift / 100f * size.height)
        scale(sx, sy, pivot = c)
    }) { block() }
}

/**
 * A figure's taps with the musical long-press: [onDown] runs at once (musical mode: the note — return true when it
 * took the tap); a release before [MusicalTiming.longPressMs] without drifting past [MusicalTiming.moveSlop] is a tap
 * ([onTap], unless [onDown] took it); a hold that long is [onLongPress] (the release after it does nothing).
 */
fun Modifier.musicalFigureGestures(onDown: () -> Boolean, onTap: () -> Unit, onLongPress: () -> Unit): Modifier =
    pointerInput(Unit) {
        val slop = MusicalTiming.moveSlop.dp.toPx()
        awaitEachGesture {
            val down = awaitFirstDown()
            val took = onDown()
            val released = withTimeoutOrNull(MusicalTiming.longPressMs) {
                var up = false
                while (true) {
                    val c = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                    if (!c.pressed) {
                        if (!c.isConsumed) { c.consume(); up = true }
                        break
                    }
                    if (c.isConsumed || (c.position - down.position).getDistance() > slop) break
                }
                up
            }
            when (released) {
                null -> {
                    onLongPress()
                    // Swallow the rest of this press (its release is not a tap).
                    while (true) {
                        val ev = awaitPointerEvent()
                        ev.changes.forEach { if (!it.pressed) it.consume() }
                        if (ev.changes.none { it.pressed }) break
                    }
                }
                true -> if (!took) onTap()
                false -> Unit
            }
        }
    }

/** The figure's musical draw: the pop / hop, the glow behind, the badge, the floating notes. [now] = the frame clock. */
fun DrawScope.drawMusicalFigure(
    index: Int, castId: String, fx: MusicalCastFx, now: Long, content: DrawScope.() -> Unit,
) {
    val s = MusicalCastState
    val pop = MusicalCastMotion.pop(index, s.from, s.toggledAt, s.instant, now)
    val hop = fx.hops[castId]?.let { MusicalCastMotion.hop(now - it) }
    val glow = MusicalCastMotion.glow(index, s.on, s.from, s.toggledAt, s.instant, now)
    val (badgeA, badgeS) = MusicalCastMotion.badge(index, s.on, s.from, s.toggledAt, s.instant, now)
    withPop(pop) {
        withPop(hop) {
            drawMusicalGlow(glow)
            content()
            drawMusicalBadge(badgeA, badgeS)
        }
    }
    for (f in fx.floats) {
        if (f.castId != castId) continue
        val pose = MusicalCastMotion.float(now - f.at, f.drift, f.still) ?: continue
        drawFloatingNote(pose, f.color)
    }
}

/** Whether figure [index] is moving at [now] (so its draw must follow the frame clock). */
fun musicalFigureMoving(index: Int, castId: String, fx: MusicalCastFx, now: Long): Boolean {
    val s = MusicalCastState
    val at = s.toggledAt ?: return fx.has(castId)
    if (!s.instant && now - at < MusicalCastMotion.transformBusyMs(s.from)) return true
    return fx.has(castId)
}

/** Whether the musical touches need the frame clock at [now] (the transform, a hop, a note). */
fun musicalBusy(fx: MusicalCastFx, now: Long): Boolean {
    val s = MusicalCastState
    val at = s.toggledAt
    if (at != null && !s.instant && now - at < MusicalCastMotion.transformBusyMs(s.from)) return true
    return fx.busy(now)
}
