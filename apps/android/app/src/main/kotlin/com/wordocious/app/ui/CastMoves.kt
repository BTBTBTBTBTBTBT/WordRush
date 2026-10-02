package com.wordocious.app.ui

import kotlin.math.abs
import kotlin.random.Random

// FINISH_SPEC A5: the living cast header's per-character moves, ported from the
// `.castrow` keyframes in docs/design/brand/mockups/game-kit.html. Pure (no Android),
// so the keyframe sampling and the one-at-a-time picker are unit-tested.

/**
 * One transform frame. Translations are FRACTIONS of the figure's own size (CSS
 * `translate(8%)` = 0.08); rotation and skew in degrees.
 */
data class CastXf(
    val tx: Float = 0f,
    val ty: Float = 0f,
    val rot: Float = 0f,
    val sx: Float = 1f,
    val sy: Float = 1f,
    val skewX: Float = 0f,
) {
    companion object {
        val IDENTITY = CastXf()
    }
}

/** A keyframe at [at] (0..1 of the move's duration). */
data class CastKey(val at: Float, val xf: CastXf)

/** A CSS cubic-bezier timing function (applied per keyframe segment, as CSS does). */
data class Bezier(val x1: Float, val y1: Float, val x2: Float, val y2: Float) {
    /** Eased progress for linear time [t] in 0..1 (y may overshoot 1 for springy curves). */
    fun ease(t: Float): Float {
        if (t <= 0f) return 0f
        if (t >= 1f) return 1f
        // Solve x(u) = t for u by Newton's method with a bisection fallback.
        var u = t
        repeat(8) {
            val x = sample(u, x1, x2) - t
            if (abs(x) < 1e-5f) return sample(u, y1, y2)
            val d = slope(u, x1, x2)
            if (abs(d) < 1e-6f) return@repeat
            u -= x / d
        }
        var lo = 0f
        var hi = 1f
        u = t
        repeat(30) {
            val x = sample(u, x1, x2)
            if (abs(x - t) < 1e-5f) return sample(u, y1, y2)
            if (x < t) lo = u else hi = u
            u = (lo + hi) / 2f
        }
        return sample(u, y1, y2)
    }

    private fun sample(u: Float, p1: Float, p2: Float): Float {
        val v = 1f - u
        return 3f * v * v * u * p1 + 3f * v * u * u * p2 + u * u * u
    }

    private fun slope(u: Float, p1: Float, p2: Float): Float {
        val v = 1f - u
        return 3f * v * v * p1 + 6f * v * u * (p2 - p1) + 3f * u * u * (1f - p2)
    }

    companion object {
        val EASE_IN_OUT = Bezier(0.42f, 0f, 0.58f, 1f)
        val EASE_OUT = Bezier(0f, 0f, 0.58f, 1f)
    }
}

/** A character's move: [durationMs], its timing [easing], keyframes and the transform origin (fractions). */
data class CastMove(
    val id: MascotId,
    val name: String,
    val durationMs: Int,
    val easing: Bezier,
    val keys: List<CastKey>,
    val originX: Float = 0.5f,
    val originY: Float = 0.85f,
)

object CastMoves {
    private fun k(at: Float, tx: Float = 0f, ty: Float = 0f, rot: Float = 0f, sx: Float = 1f, sy: Float = 1f, skewX: Float = 0f) =
        CastKey(at, CastXf(tx, ty, rot, sx, sy, skewX))

    private val ID = CastXf.IDENTITY

    /** A5 every cast member's move (game-kit.html `.cm.act-*`). */
    val moves: Map<MascotId, CastMove> = listOf(
        // O1 the cheerleader spins a 360 (900 ms).
        CastMove(MascotId.O1, "spin", 900, Bezier(0.45f, 0f, 0.25f, 1f),
            listOf(k(0f), k(0.85f, rot = 372f), k(1f, rot = 360f)), originY = 0.55f),
        // W hops with a squash (700 ms).
        CastMove(MascotId.W, "hop", 700, Bezier(0.3f, 1.5f, 0.5f, 1f),
            listOf(k(0f), k(0.15f, sx = 1.06f, sy = 0.9f), k(0.45f, ty = -0.22f, sx = 0.96f, sy = 1.05f), k(0.8f, sx = 1.06f, sy = 0.93f), k(1f))),
        // R nods off, then jolts awake (1.6 s).
        CastMove(MascotId.R, "nod", 1600, Bezier.EASE_IN_OUT,
            listOf(k(0f), k(0.55f, rot = -10f, ty = 0.04f), k(0.7f, rot = -10f, ty = 0.04f), k(0.8f, rot = 4f, ty = -0.06f), k(1f))),
        // D double-bounces (760 ms).
        CastMove(MascotId.D, "double", 760, Bezier.EASE_OUT,
            listOf(k(0f), k(0.2f, ty = -0.10f), k(0.4f), k(0.6f, ty = -0.07f), k(0.8f), k(1f))),
        // O2 pulses like a star with a tilt (820 ms).
        CastMove(MascotId.O2, "star", 820, Bezier(0.3f, 1.5f, 0.5f, 1f),
            listOf(k(0f), k(0.4f, sx = 1.16f, sy = 1.16f, rot = -6f), k(0.7f, sx = 0.97f, sy = 0.97f, rot = 3f), k(1f))),
        // C leans in, curious (1.2 s).
        CastMove(MascotId.C, "peek", 1200, Bezier.EASE_IN_OUT,
            listOf(k(0f), k(0.3f, tx = 0.08f, rot = 9f), k(0.65f, tx = 0.08f, rot = 9f), k(1f))),
        // I wiggles shyly (900 ms).
        CastMove(MascotId.I, "wiggle", 900, Bezier.EASE_IN_OUT,
            listOf(k(0f), k(0.2f, rot = -9f), k(0.4f, rot = 8f), k(0.6f, rot = -6f), k(0.8f, rot = 4f), k(1f))),
        // O3 jumps (760 ms).
        CastMove(MascotId.O3, "jump", 760, Bezier(0.3f, 1.4f, 0.5f, 1f),
            listOf(k(0f), k(0.2f, sx = 1.08f, sy = 0.88f), k(0.5f, ty = -0.30f, rot = -8f), k(0.82f, sx = 1.05f, sy = 0.94f), k(1f))),
        // U levitates (1.8 s).
        CastMove(MascotId.U, "float", 1800, Bezier.EASE_IN_OUT,
            listOf(k(0f), k(0.5f, ty = -0.14f), k(1f))),
        // S dashes with a jitter (700 ms).
        CastMove(MascotId.S, "dash", 700, Bezier.EASE_IN_OUT,
            listOf(k(0f), k(0.15f, tx = -0.06f, skewX = 8f), k(0.35f, tx = 0.10f, skewX = -10f), k(0.55f, tx = -0.04f, skewX = 4f), k(0.75f, tx = 0.03f), k(1f))),
    ).associateBy { it.id }

    /** The move's transform at linear time fraction [t] (0..1), eased per keyframe segment like CSS. */
    fun sample(move: CastMove, t: Float): CastXf {
        val keys = move.keys
        if (t <= keys.first().at) return keys.first().xf
        if (t >= keys.last().at) return keys.last().xf
        val i = keys.indexOfLast { it.at <= t }.coerceIn(0, keys.size - 2)
        val a = keys[i]
        val b = keys[i + 1]
        val span = (b.at - a.at).takeIf { it > 0f } ?: return b.xf
        val e = move.easing.ease((t - a.at) / span)
        fun mix(x: Float, y: Float) = x + (y - x) * e
        return CastXf(
            tx = mix(a.xf.tx, b.xf.tx), ty = mix(a.xf.ty, b.xf.ty), rot = mix(a.xf.rot, b.xf.rot),
            sx = mix(a.xf.sx, b.xf.sx), sy = mix(a.xf.sy, b.xf.sy), skewX = mix(a.xf.skewX, b.xf.skewX),
        )
    }

    /**
     * A5 the next performer: ONE random cast member, never the one that just moved
     * ([last]). Uniform over the other nine.
     */
    fun pickNext(last: MascotId?, random: Random): MascotId {
        val pool = MascotId.entries.filter { it != last }
        return pool[random.nextInt(pool.size)]
    }

    /** A5 the wait between moves: 2.6–5 s (game-kit.html `2600 + random × 2400`). */
    fun nextGapMs(random: Random): Long = 2600L + random.nextInt(2401)

    /** The first move waits this long after the header appears. */
    const val FIRST_DELAY_MS = 1200L

    /** Identity check used by the renderer to skip work between moves. */
    fun isIdentity(xf: CastXf): Boolean = xf == ID
}

/**
 * A5 the cast hero images (`mascot_<id>`, 512 sq) trimmed to their opaque bounds,
 * in 512-px source coordinates (left, top, right, bottom). The header lays the
 * trimmed figures edge to edge at one shared height, as the mockup does
 * (its flex weights are these aspect ratios: W 1.09 … I 0.47).
 */
object CastCrops {
    data class Crop(val left: Int, val top: Int, val right: Int, val bottom: Int) {
        val width: Int get() = right - left
        val height: Int get() = bottom - top
        /** width / height. */
        val aspect: Float get() = width.toFloat() / height
    }

    val crops: Map<MascotId, Crop> = mapOf(
        MascotId.W to Crop(20, 59, 491, 492),
        MascotId.O1 to Crop(20, 29, 491, 492),
        MascotId.R to Crop(52, 21, 460, 492),
        MascotId.D to Crop(20, 25, 491, 492),
        MascotId.O2 to Crop(61, 21, 451, 492),
        MascotId.C to Crop(37, 21, 474, 492),
        MascotId.I to Crop(145, 21, 367, 492),
        MascotId.O3 to Crop(24, 21, 488, 492),
        MascotId.U to Crop(20, 39, 491, 492),
        MascotId.S to Crop(20, 23, 491, 492),
    )

    /** The mockup's overlap: each figure tucks 2.2% of the row width under its neighbor. */
    const val OVERLAP = 0.022f
    /** Every second figure stands this fraction of the figure height higher (the mockup's 7 px). */
    const val STAGGER = 0.14f

    /**
     * The shared figure height for a row [width] wide: the ten trimmed figures at one
     * height H, overlapping by [OVERLAP] × width nine times, exactly fill the width.
     */
    fun figureHeight(width: Float): Float {
        val sum = MascotId.entries.sumOf { (crops.getValue(it).aspect).toDouble() }.toFloat()
        return width * (1f + OVERLAP * (MascotId.entries.size - 1)) / sum
    }
}
