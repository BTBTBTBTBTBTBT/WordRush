package com.wordocious.core

import kotlin.math.max
import kotlin.math.pow

/**
 * FINISH_SPEC BJ9 / BJ10 — the game open/close ("grow + soft rise") and the menu /
 * sheet "soft pop" timing and geometry. Mirrors iOS `Sources/Core/MotionSpec.swift`
 * and web `lib/motion-spec.ts` (same numbers; each platform's tests pin them).
 *
 * Rules (founder, 10-03): only a cheap shell (one rounded shape in the card's color)
 * moves; the live game is never transformed — it's built under the shell and only
 * revealed. Transform / alpha / one shape's bounds, one driver, no blur.
 */
object MotionSpec {
    // BJ9 open
    const val LIFT_SCALE = 1.03f
    const val LIFT_RISE_DP = 4f
    const val LIFT_MS = 120
    const val GROW_MS = 440
    const val SHELL_FADE_IN_MS = 100
    /** The real game fades in over the LAST 60% of the grow. */
    const val REVEAL_FRACTION = 0.6f

    // BJ9 close
    const val CLOSE_FADE_MS = 180
    const val SHRINK_MS = 380
    const val SHRINK_FADE_FRACTION = 0.3f

    // BJ9 without a source frame: a centered soft rise
    const val RISE_SCALE = 0.96f
    const val RISE_OFFSET_DP = 14f
    const val RISE_MS = 340

    /** Reduce Motion: a plain cross-fade. */
    const val CROSS_FADE_MS = 220

    /** An armed source card is consumed by a game opened within this window. */
    const val ARM_WINDOW_MS = 800L

    // BJ10 soft pop
    const val POP_SCALE = 0.94f
    const val POP_MS = 420
    const val POP_DAMPING = 0.82f
    const val POP_DISMISS_MS = 200
    const val DIM_ALPHA = 0.28f

    enum class OpenKind { GROW, RISE, CROSS_FADE }

    fun openKind(hasSource: Boolean, reduceMotion: Boolean): OpenKind = when {
        reduceMotion -> OpenKind.CROSS_FADE
        hasSource -> OpenKind.GROW
        else -> OpenKind.RISE
    }

    /** A plain rect (no Android types in core). */
    data class Box(val left: Float, val top: Float, val width: Float, val height: Float) {
        val right get() = left + width
        val bottom get() = top + height
        val centerX get() = left + width / 2
        val centerY get() = top + height / 2
    }

    /** The card after the lift: scaled about its center, raised [riseDp] (px). */
    fun liftedFrame(card: Box, rise: Float): Box {
        val w = card.width * LIFT_SCALE
        val h = card.height * LIFT_SCALE
        return Box(card.centerX - w / 2, card.centerY - h / 2 - rise, w, h)
    }

    /** The soft rise's starting frame: the screen scaled 0.96 about its center, [offset] lower. */
    fun riseStartFrame(screen: Box, offset: Float): Box {
        val w = screen.width * RISE_SCALE
        val h = screen.height * RISE_SCALE
        return Box(screen.centerX - w / 2, screen.centerY - h / 2 + offset, w, h)
    }

    /** (delay ms, duration ms) of the game's reveal, from the tap. */
    fun revealTiming(kind: OpenKind): Pair<Int, Int> = when (kind) {
        OpenKind.GROW -> (LIFT_MS + GROW_MS * (1 - REVEAL_FRACTION)).toInt() to (GROW_MS * REVEAL_FRACTION).toInt()
        OpenKind.RISE -> (RISE_MS * (1 - REVEAL_FRACTION)).toInt() to (RISE_MS * REVEAL_FRACTION).toInt()
        OpenKind.CROSS_FADE -> 0 to CROSS_FADE_MS
    }

    fun openDurationMs(kind: OpenKind): Int = revealTiming(kind).let { it.first + it.second }

    fun closeDurationMs(kind: OpenKind): Int = when (kind) {
        OpenKind.GROW -> CLOSE_FADE_MS + SHRINK_MS
        OpenKind.RISE -> CLOSE_FADE_MS + (RISE_MS * 0.7f).toInt()
        OpenKind.CROSS_FADE -> CROSS_FADE_MS
    }

    /** A source worth growing from: non-degenerate and at least a quarter on screen. */
    fun usableSource(frame: Box?, screen: Box): Box? {
        val f = frame ?: return null
        if (f.width < 24f || f.height < 24f || !f.width.isFinite() || !f.height.isFinite()) return null
        val l = max(f.left, screen.left); val t = max(f.top, screen.top)
        val r = minOf(f.right, screen.right); val b = minOf(f.bottom, screen.bottom)
        if (r <= l || b <= t) return null
        return if ((r - l) * (b - t) >= f.width * f.height * 0.25f) f else null
    }

    /** Ease-out-expo: most of the grow lands early, then it settles. */
    fun expoOut(t: Float): Float = if (t >= 1f) 1f else 1f - 2f.pow(-10f * max(0f, t))

    fun lerp(a: Float, b: Float, p: Float) = a + (b - a) * p

    fun lerp(from: Box, to: Box, p: Float) =
        Box(lerp(from.left, to.left, p), lerp(from.top, to.top, p), lerp(from.width, to.width, p), lerp(from.height, to.height, p))

    /** Everything the open draws at [ms] after the tap — ONE driver (elapsed time). */
    data class OpenFrame(
        val liftScale: Float, val liftRise: Float,   // the tapped card's lift
        val shell: Box, val shellAlpha: Float, val shellRadius: Float,
        val gameAlpha: Float,
    )

    fun openFrame(kind: OpenKind, ms: Float, card: Box?, screen: Box, radius: Float, rise: Float, riseOffset: Float): OpenFrame {
        val (rd, rdur) = revealTiming(kind)
        val gameAlpha = ((ms - rd) / rdur).coerceIn(0f, 1f)
        return when (kind) {
            OpenKind.GROW -> {
                val c = card ?: screen
                val lp = (ms / LIFT_MS).coerceIn(0f, 1f)
                val liftE = 1f - (1f - lp) * (1f - lp)   // ease-out
                val gp = ((ms - LIFT_MS) / GROW_MS).coerceIn(0f, 1f)
                val e = expoOut(gp)
                val start = liftedFrame(c, rise)
                OpenFrame(
                    liftScale = 1f + (LIFT_SCALE - 1f) * liftE, liftRise = rise * liftE,
                    shell = lerp(start, screen, e),
                    shellAlpha = ((ms - LIFT_MS) / SHELL_FADE_IN_MS).coerceIn(0f, 1f),
                    shellRadius = lerp(radius, 0f, e),
                    gameAlpha = gameAlpha,
                )
            }
            OpenKind.RISE -> {
                val p = (ms / RISE_MS).coerceIn(0f, 1f)
                val e = expoOut(p)
                OpenFrame(1f, 0f, lerp(riseStartFrame(screen, riseOffset), screen, e),
                    shellAlpha = (p / 0.45f).coerceIn(0f, 1f), shellRadius = lerp(radius, 0f, e), gameAlpha = gameAlpha)
            }
            OpenKind.CROSS_FADE -> OpenFrame(1f, 0f, screen, 0f, 0f, gameAlpha)
        }
    }

    /** Everything the close draws at [ms] after the dismiss (the game is gone at CLOSE_FADE_MS). */
    data class CloseFrame(val gameAlpha: Float, val shell: Box, val shellAlpha: Float, val shellRadius: Float)

    fun closeFrame(kind: OpenKind, ms: Float, card: Box?, screen: Box, radius: Float, riseOffset: Float): CloseFrame {
        if (kind == OpenKind.CROSS_FADE) {
            return CloseFrame((1f - ms / CROSS_FADE_MS).coerceIn(0f, 1f), screen, 0f, 0f)
        }
        val gameAlpha = (1f - ms / CLOSE_FADE_MS).coerceIn(0f, 1f)
        val t = ms - CLOSE_FADE_MS
        if (t <= 0f) return CloseFrame(gameAlpha, screen, 1f, 0f)
        return if (kind == OpenKind.GROW && card != null) {
            val p = (t / SHRINK_MS).coerceIn(0f, 1f)
            val e = expoOut(p)
            val fadeFrom = 1f - SHRINK_FADE_FRACTION
            CloseFrame(0f, lerp(screen, card, e), (1f - (p - fadeFrom) / SHRINK_FADE_FRACTION).coerceIn(0f, 1f), lerp(0f, radius, e))
        } else {
            val d = RISE_MS * 0.7f
            val p = (t / d).coerceIn(0f, 1f)
            val e = p * p   // ease-in
            CloseFrame(0f, lerp(screen, riseStartFrame(screen, riseOffset), e), 1f - e, lerp(0f, radius, e))
        }
    }
}

/** FINISH_SPEC BJ10: which presentations keep the SYSTEM sheet; everything else soft-pops. */
object SoftPopPolicy {
    val systemSheets = listOf("share", "purchase", "signInApple", "signInGoogle", "photoPicker", "mail", "safari")
    const val FULL_SCREEN_GAMES = "game"
    fun usesSoftPop(kind: String) = kind != FULL_SCREEN_GAMES && kind !in systemSheets
}
