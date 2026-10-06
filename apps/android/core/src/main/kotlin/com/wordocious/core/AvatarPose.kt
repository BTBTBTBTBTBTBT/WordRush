package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

// Poses + the living mascot — 1:1 port of packages/core/src/avatar-pose.ts (pinned by avatar-pose-fixtures.json,
// AvatarPoseFixtureTest). Every player body is rigged ONCE (feet behind, base, two mitten arms); poses are SHARED
// DATA (avatar-poses.json): a rotation / offset per limb plus a small body squash. This file turns a pose into
// per-layer affine matrices (body units) and evaluates the living mascot (breathe, blink, its saved pose,
// tap = hop + laugh, moment reactions). Pure.
//
// Everything new ships behind AvatarLiveConfig.LIVING_MASCOT (OFF): with it off no surface draws a pose, the Pose
// tab is hidden and every mascot renders exactly as before.

/** The feature flag + performance rules (founder: smooth over pretty). */
object AvatarLiveConfig {
    /** OFF until verified on devices: poses, the Pose tab and the living mascot all stand down. */
    const val LIVING_MASCOT: Boolean = false
    /** At most this many mascots animate on one screen (the player's own first); the rest hold their pose frame. */
    const val MAX_ANIMATED: Int = 3
    /** Android holds still between moves (like the cast): breathing only while a move / reaction plays. */
    const val ANDROID_IDLE_STILL: Boolean = true
}

/**
 * [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (the canvas / SVG / CGAffineTransform order).
 * Always 6 entries.
 */
typealias AvatarMatrix = List<Double>

data class AvatarPoseLimb(val rot: Double? = null, val dx: Double? = null, val dy: Double? = null)
data class AvatarPoseBody(val dy: Double? = null, val rot: Double? = null, val sx: Double? = null, val sy: Double? = null)
data class AvatarPoseFeet(val dy: Double? = null, val sx: Double? = null, val sy: Double? = null)

/** A pose spec (TS AvatarPoseSpec): arms.L / arms.R ([armL] / [armR]), body, feet; null = the field is absent. */
data class AvatarPoseSpec(
    val armL: AvatarPoseLimb? = null,
    val armR: AvatarPoseLimb? = null,
    val body: AvatarPoseBody? = null,
    val feet: AvatarPoseFeet? = null,
) {
    fun arm(side: String): AvatarPoseLimb? = if (side == "L") armL else armR
}

data class AvatarPoseWave(val limb: String, val amp: Double, val period: Double)
data class AvatarPoseBounce(val amp: Double, val period: Double)
data class AvatarPoseLive(val wave: AvatarPoseWave? = null, val bounce: AvatarPoseBounce? = null)

/** A pose's shared data: its label, its spec, and its living extras (a waving arm, a cheer bounce). */
data class AvatarPoseDef(val label: String, val spec: AvatarPoseSpec, val live: AvatarPoseLive? = null)

data class AvatarRigArm(val pivot: List<Double>, val hand: List<Double>, val handR: List<Double>, val box: List<Double>? = null)
data class AvatarRigFeet(val pivot: List<Double>, val box: List<Double>? = null)

/** A rigged body (body units): shoulder pivots, hand centers, the hip-line center (feet pivot), the floor. */
data class AvatarBodyRig(val armL: AvatarRigArm, val armR: AvatarRigArm, val feet: AvatarRigFeet, val floor: Double, val hips: Double)

/** avatar-poses.json, read leniently (like AvatarFitManifest reads avatar-parts.json). */
class AvatarPosesData(
    val version: Int,
    val poses: Map<String, AvatarPoseDef>,
    /** Poses that need a new hand drawing (not shipped). */
    val needsHandArt: List<String>,
    val rigs: Map<String, AvatarBodyRig>,
    /** pose → body → item keys withheld in that pose (they fail the guards there). */
    val withheld: Map<String, Map<String, List<String>>>,
) {
    companion object {
        private fun num(e: JsonElement?): Double? = (e as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
        private fun nums(e: JsonElement?): List<Double>? = (e as? JsonArray)?.map { num(it) ?: 0.0 }
        private fun str(e: JsonElement?): String? = (e as? JsonPrimitive)?.content

        private fun limb(e: JsonElement?): AvatarPoseLimb? = (e as? JsonObject)?.let { AvatarPoseLimb(num(it["rot"]), num(it["dx"]), num(it["dy"])) }

        /** A pose spec from JSON (missing fields stay null, the TS `?? default` semantics). */
        fun spec(o: JsonObject): AvatarPoseSpec {
            val arms = o["arms"] as? JsonObject
            val body = (o["body"] as? JsonObject)?.let { AvatarPoseBody(num(it["dy"]), num(it["rot"]), num(it["sx"]), num(it["sy"])) }
            val feet = (o["feet"] as? JsonObject)?.let { AvatarPoseFeet(num(it["dy"]), num(it["sx"]), num(it["sy"])) }
            return AvatarPoseSpec(limb(arms?.get("L")), limb(arms?.get("R")), body, feet)
        }

        private fun def(id: String, o: JsonObject): AvatarPoseDef {
            val live = (o["live"] as? JsonObject)?.let { l ->
                val w = (l["wave"] as? JsonObject)?.let { AvatarPoseWave(str(it["limb"]) ?: "L", num(it["amp"]) ?: 0.0, num(it["period"]) ?: 1.0) }
                val b = (l["bounce"] as? JsonObject)?.let { AvatarPoseBounce(num(it["amp"]) ?: 0.0, num(it["period"]) ?: 1.0) }
                AvatarPoseLive(w, b)
            }
            return AvatarPoseDef(str(o["label"]) ?: id, spec(o), live)
        }

        private fun arm(o: JsonObject?): AvatarRigArm = AvatarRigArm(
            nums(o?.get("pivot")) ?: listOf(0.0, 0.0), nums(o?.get("hand")) ?: listOf(0.0, 0.0),
            nums(o?.get("handR")) ?: listOf(0.0, 0.0), nums(o?.get("box")),
        )

        private fun rig(o: JsonObject): AvatarBodyRig {
            val feet = o["feet"] as? JsonObject
            return AvatarBodyRig(
                arm(o["armL"] as? JsonObject), arm(o["armR"] as? JsonObject),
                AvatarRigFeet(nums(feet?.get("pivot")) ?: listOf(0.5, 0.0), nums(feet?.get("box"))),
                num(o["floor"]) ?: 1.0, num(o["hips"]) ?: 0.0,
            )
        }

        fun of(el: JsonElement?): AvatarPosesData? {
            val root = el as? JsonObject ?: return null
            return AvatarPosesData(
                version = num(root["version"])?.toInt() ?: 1,
                poses = (root["poses"] as? JsonObject)?.entries?.mapNotNull { (k, v) -> (v as? JsonObject)?.let { k to def(k, it) } }?.toMap() ?: emptyMap(),
                needsHandArt = (root["needsHandArt"] as? JsonArray)?.mapNotNull { str(it) } ?: emptyList(),
                rigs = (root["rigs"] as? JsonObject)?.entries?.mapNotNull { (k, v) -> (v as? JsonObject)?.let { k to rig(it) } }?.toMap() ?: emptyMap(),
                withheld = (root["withheld"] as? JsonObject)?.mapValues { (_, byBody) ->
                    (byBody as? JsonObject)?.mapValues { (_, items) -> (items as? JsonArray)?.mapNotNull { str(it) } ?: emptyList() } ?: emptyMap()
                } ?: emptyMap(),
            )
        }

        fun parse(text: String?): AvatarPosesData? = runCatching { of(Json.parseToJsonElement(text ?: return null)) }.getOrNull()
    }
}

/** The per-part matrices of a pose on a rigged body (body units or content fractions). base = root. */
data class AvatarPoseParts(
    val root: AvatarMatrix,
    val armL: AvatarMatrix,
    val armR: AvatarMatrix,
    val handL: AvatarMatrix,
    val handR: AvatarMatrix,
    val feet: AvatarMatrix,
) {
    val base: AvatarMatrix get() = root

    /** The matrix a ride uses ('none' / unknown = identity). */
    operator fun get(ride: String?): AvatarMatrix = when (ride) {
        "root", "base" -> root; "armL" -> armL; "armR" -> armR; "handL" -> handL; "handR" -> handR; "feet" -> feet
        else -> AvatarPoses.IDENTITY
    }

    fun map(f: (AvatarMatrix) -> AvatarMatrix) = AvatarPoseParts(f(root), f(armL), f(armR), f(handL), f(handR), f(feet))
}

/** A moment the mascot reacts to (win = cheer, loss = shrug, streak +1 = hop, level up = cheer). */
enum class AvatarReaction(val id: String) {
    WIN("win"), LOSS("loss"), STREAK("streak"), LEVELUP("levelup");

    companion object { fun of(id: String?): AvatarReaction? = entries.firstOrNull { it.id == id } }
}

data class AvatarReactionPlay(val kind: AvatarReaction, val t: Double)

data class AvatarLiveInput(
    /** The saved pose ("none" = the body as drawn). */
    val pose: String,
    /** Wall clock (s). */
    val t: Double,
    /** Seconds since a tap, else null. */
    val tap: Double? = null,
    /** A reaction playing + seconds since it started, else null. */
    val reaction: AvatarReactionPlay? = null,
    /** Press-and-hold squish (0 → 1); null = 0. */
    val press: Double? = null,
    /** Reduce Motion: the saved pose holds; a tap only shows the laugh. */
    val still: Boolean = false,
    /** Ambient off (Android between moves): no breathing / waving, blinks keep going. */
    val ambient: Boolean = true,
    /** A per-mascot blink seed (the cast's LCG); null = 7. */
    val blinkSeed: Double? = null,
)

data class AvatarLiveFrame(
    val spec: AvatarPoseSpec,
    /** Eyes scaleY about their center: 1 open, ~0.1 closed (blink), 0.45 happy squint (laugh). */
    val eyes: Double,
    /** 0 → 1: the laughing face (the mouth stretches open 1.25×). */
    val laugh: Double,
)

object AvatarPoses {
    /** The pose ids (stored in the avatar config's `pose`; "none" = the body as drawn). */
    val IDS: List<String> = listOf("none", "wave", "cheer", "hips", "shrug", "flex", "hug", "sit", "jump")
    val IDENTITY: AvatarMatrix = listOf(1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    /** The four rig layers, back → front: feet, base, armL, armR. Art: art-av-body-<body>-<part>. */
    val RIG_PARTS: List<String> = listOf("feet", "base", "armL", "armR")
    /** A held item tilts with its hand at most this much (degrees). */
    const val HELD_TILT = 30.0

    /** The bundled avatar-poses.json (the app installs it from its assets at start); null = no poses. */
    @Volatile var data: AvatarPosesData? = null

    /** JS `Math.round(v * 1e5) / 1e5` (half toward +∞, like AvatarFit's r4). */
    fun r5(v: Double): Double = (v * 100000).roundToLong() / 100000.0

    fun matMul(m: AvatarMatrix, n: AvatarMatrix): AvatarMatrix = listOf(
        m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
    )

    private fun T(x: Double, y: Double): AvatarMatrix = listOf(1.0, 0.0, 0.0, 1.0, x, y)
    private fun S(x: Double, y: Double): AvatarMatrix = listOf(x, 0.0, 0.0, y, 0.0, 0.0)
    private fun Rd(deg: Double): AvatarMatrix {
        val r = (deg * PI) / 180
        return listOf(cos(r), sin(r), -sin(r), cos(r), 0.0, 0.0)
    }
    private fun chain(vararg ms: AvatarMatrix): AvatarMatrix = ms.fold(IDENTITY) { a, b -> matMul(a, b) }

    /** A point through a matrix. */
    fun matApply(m: AvatarMatrix, x: Double, y: Double): Pair<Double, Double> = (m[0] * x + m[2] * y + m[4]) to (m[1] * x + m[3] * y + m[5])

    fun bodyRig(body: String, data: AvatarPosesData): AvatarBodyRig? = data.rigs[body]

    fun poseDef(pose: String?, data: AvatarPosesData): AvatarPoseDef? = if (pose != null && pose.isNotEmpty() && pose != "none") data.poses[pose] else null

    /**
     * The per-part matrices (body units) of a pose spec on a rigged body. Arm rot is OUTWARD-positive degrees about
     * the shoulder pivot for both sides (the viewer's-right arm is mirrored), dx outward-positive, dy down-positive.
     * The body squashes / tilts about the middle of the hip line; body dy lifts the feet too; the feet squash about
     * the floor.
     */
    fun matrices(rig: AvatarBodyRig, spec: AvatarPoseSpec): AvatarPoseParts {
        val b = spec.body ?: AvatarPoseBody()
        val hx = rig.feet.pivot[0]; val hy = rig.feet.pivot[1]
        val lift = T(0.0, b.dy ?: 0.0)
        val root = chain(lift, T(hx, hy), Rd(b.rot ?: 0.0), S(b.sx ?: 1.0, b.sy ?: 1.0), T(-hx, -hy))
        fun arm(side: String): AvatarMatrix {
            val q = spec.arm(side) ?: AvatarPoseLimb()
            val sg = if (side == "L") 1.0 else -1.0
            val pv = (if (side == "L") rig.armL else rig.armR).pivot
            val px = pv[0]; val py = pv[1]
            return chain(root, T(px - sg * (q.dx ?: 0.0), py + (q.dy ?: 0.0)), Rd(sg * (q.rot ?: 0.0)), T(-px, -py))
        }
        val f = spec.feet ?: AvatarPoseFeet()
        val feet = chain(lift, T(hx, rig.floor + (f.dy ?: 0.0)), S(f.sx ?: 1.0, f.sy ?: 1.0), T(-hx, -rig.floor))
        val armL = arm("L"); val armR = arm("R")
        // a hand: moves the rest hand center to where the arm carries it, tilted by the arm's angle clamped to ±HELD_TILT
        fun hand(m: AvatarMatrix, h: List<Double>): AvatarMatrix {
            val (x, y) = matApply(m, h[0], h[1])
            val deg = (atan2(m[1], m[0]) * 180) / PI
            val tilt = max(-HELD_TILT, min(HELD_TILT, deg))
            val k = sqrt(abs(root[0] * root[3] - root[1] * root[2]))
            return chain(T(x, y), Rd(tilt), S(k, k), T(-h[0], -h[1]))
        }
        return AvatarPoseParts(root, armL, armR, hand(armL, rig.armL.hand), hand(armR, rig.armR.hand), feet)
    }

    /** Items withheld in a pose on a body (they fail the per-pose guards). */
    fun withheld(pose: String?, body: String, data: AvatarPosesData): List<String> {
        if (pose == null || pose.isEmpty() || pose == "none") return emptyList()
        return data.withheld[pose]?.get(body) ?: emptyList()
    }

    // ── The living mascot ─────────────────────────────────────────────────

    val REACTION_POSE: Map<AvatarReaction, String> = mapOf(
        AvatarReaction.WIN to "cheer", AvatarReaction.LOSS to "shrug", AvatarReaction.STREAK to "none", AvatarReaction.LEVELUP to "cheer",
    )
    /** How long a reaction plays (s); streak is a hop. */
    val REACTION_SECONDS: Map<AvatarReaction, Double> = mapOf(
        AvatarReaction.WIN to 2.4, AvatarReaction.LOSS to 2.2, AvatarReaction.STREAK to 0.9, AvatarReaction.LEVELUP to 2.6,
    )

    /** The tap: hop + laugh (same feel as the cast's tap). */
    object Tap {
        const val DUR = 1.1
        const val HOP = 0.07
        const val HOP_T0 = 0.06
        const val HOP_T1 = 0.5
        const val LAUGH_IN = 0.08
        const val LAUGH_OUT = 0.85
    }

    /** Ease between the saved pose and a reaction / back (s). */
    const val POSE_BLEND = 0.22

    private fun lerp(a: Double, b: Double, k: Double) = a + (b - a) * k
    private fun smooth(x: Double): Double { val c = min(1.0, max(0.0, x)); return c * c * (3 - 2 * c) }

    private fun limbLerp(a: AvatarPoseLimb?, b: AvatarPoseLimb?, k: Double): AvatarPoseLimb {
        val aa = a ?: AvatarPoseLimb(); val bb = b ?: AvatarPoseLimb()
        return AvatarPoseLimb(lerp(aa.rot ?: 0.0, bb.rot ?: 0.0, k), lerp(aa.dx ?: 0.0, bb.dx ?: 0.0, k), lerp(aa.dy ?: 0.0, bb.dy ?: 0.0, k))
    }

    /** Blend two pose specs (k = 0 → a, 1 → b). */
    fun lerp(a: AvatarPoseSpec, b: AvatarPoseSpec, k: Double): AvatarPoseSpec {
        val ab = a.body ?: AvatarPoseBody(); val bb = b.body ?: AvatarPoseBody()
        val af = a.feet ?: AvatarPoseFeet(); val bf = b.feet ?: AvatarPoseFeet()
        return AvatarPoseSpec(
            limbLerp(a.armL, b.armL, k), limbLerp(a.armR, b.armR, k),
            AvatarPoseBody(lerp(ab.dy ?: 0.0, bb.dy ?: 0.0, k), lerp(ab.rot ?: 0.0, bb.rot ?: 0.0, k), lerp(ab.sx ?: 1.0, bb.sx ?: 1.0, k), lerp(ab.sy ?: 1.0, bb.sy ?: 1.0, k)),
            AvatarPoseFeet(lerp(af.dy ?: 0.0, bf.dy ?: 0.0, k), lerp(af.sx ?: 1.0, bf.sx ?: 1.0, k), lerp(af.sy ?: 1.0, bf.sy ?: 1.0, k)),
        )
    }

    /** The cast's blink schedule (same LCG as cast-rig blinkTimes): a blink starts every 3–5 s. */
    fun blinkTimes(seed: Double, start: Double = 1.3, until: Double = 600.0): List<Double> {
        val out = ArrayList<Double>()
        var t = start
        var s = seed
        while (t < until) {
            out.add(t)
            s = (s * 9301 + 49297) % 233280
            t += 3 + 2 * (s / 233280)
        }
        return out
    }

    private val blinkCache = ConcurrentHashMap<Double, List<Double>>()

    private fun blinkAt(seed: Double, t: Double): Double {
        val bl = blinkCache.getOrPut(seed) { blinkTimes(seed) }
        val tt = ((t % 600) + 600) % 600
        for (b in bl) {
            if (b > tt) break
            val d = tt - b
            if (d < 0.16) return if (d < 0.04 || d > 0.12) 0.5 else 0.1
        }
        return 1.0
    }

    /** One frame of the living mascot: the pose spec to draw + the face. Pure (same input → same frame). */
    fun liveFrame(input: AvatarLiveInput, data: AvatarPosesData): AvatarLiveFrame {
        val t = input.t
        val still = input.still
        val ambient = input.ambient
        val saved = poseDef(input.pose, data)
        var spec: AvatarPoseSpec = saved?.spec ?: AvatarPoseSpec()
        // a reaction blends in, holds, and blends back to the saved pose
        val rx = input.reaction
        var hop = 0.0
        if (rx != null && !still) {
            val dur = REACTION_SECONDS.getValue(rx.kind)
            if (rx.t >= 0 && rx.t < dur) {
                val target = poseDef(REACTION_POSE.getValue(rx.kind), data)?.spec ?: saved?.spec ?: AvatarPoseSpec()
                val k = smooth(min(rx.t, dur - rx.t) / POSE_BLEND)
                spec = lerp(spec, target, k)
                if (rx.kind == AvatarReaction.STREAK || rx.kind == AvatarReaction.WIN || rx.kind == AvatarReaction.LEVELUP) {
                    // a hop (the cheers hop twice)
                    val per = if (rx.kind == AvatarReaction.STREAK) 0.6 else 0.55
                    val n = if (rx.kind == AvatarReaction.STREAK) 1 else 2
                    val tt = rx.t - 0.1
                    if (tt > 0 && tt < per * n) hop = max(hop, 0.06 * sin(((tt % per) / per) * PI))
                }
            }
        }
        val live = (if (rx != null && !still && rx.t < REACTION_SECONDS.getValue(rx.kind)) poseDef(REACTION_POSE.getValue(rx.kind), data)?.live else null) ?: saved?.live
        val sb = spec.body
        var bDy = sb?.dy ?: 0.0; val bRot = sb?.rot ?: 0.0; var bSx = sb?.sx ?: 1.0; var bSy = sb?.sy ?: 1.0
        var lRot = spec.armL?.rot; val lDx = spec.armL?.dx; val lDy = spec.armL?.dy
        var rRot = spec.armR?.rot; val rDx = spec.armR?.dx; val rDy = spec.armR?.dy
        val feet = spec.feet ?: AvatarPoseFeet()
        if (!still && ambient) {
            // breathing (the cast's 3.4 s breath) + the pose's own idle motion
            val br = sin((t / 3.4) * PI * 2)
            bSy *= 1 + 0.012 * br
            bSx *= 1 - 0.006 * br
            live?.wave?.let { w ->
                val add = w.amp * sin((t / w.period) * PI * 2)
                if (w.limb == "L") lRot = (lRot ?: 0.0) + add else rRot = (rRot ?: 0.0) + add
            }
            live?.bounce?.let { bo -> bDy -= bo.amp * abs(sin((t / bo.period) * PI)) }
        }
        // the tap: hop + squash + laugh (Reduce Motion: only the laugh)
        var laugh = 0.0
        val tap = input.tap
        if (tap != null && tap >= 0 && tap < Tap.DUR) {
            laugh = smooth(tap / Tap.LAUGH_IN) * (1 - smooth((tap - Tap.LAUGH_OUT) / (Tap.DUR - Tap.LAUGH_OUT)))
            if (!still) {
                val h0 = Tap.HOP_T0; val h1 = Tap.HOP_T1
                if (tap >= h0 && tap < h1) hop = max(hop, Tap.HOP * sin(((tap - h0) / (h1 - h0)) * PI))
                val sq = if (tap < h0) -0.06 * (tap / h0) else if (tap < h1) 0.04 * sin(((tap - h0) / (h1 - h0)) * PI) else -0.05 * sin(min(1.0, (tap - h1) / 0.25) * PI)
                bSy *= 1 + sq
                bSx *= 1 - sq * 0.6
                // arms fly up a little on the hop
                lRot = (lRot ?: 0.0) + 40 * (hop / Tap.HOP)
                rRot = (rRot ?: 0.0) + 40 * (hop / Tap.HOP)
            }
        }
        if (hop != 0.0) bDy -= hop
        val press = if (still) 0.0 else input.press ?: 0.0
        if (press != 0.0) { bSy *= 1 - 0.08 * press; bSx *= 1 + 0.06 * press }
        var eyes = if (still) 1.0 else blinkAt(input.blinkSeed ?: 7.0, t)
        if (laugh > 0.5) eyes = 0.45
        fun r(v: Double?, d: Double) = r5(v ?: d)
        return AvatarLiveFrame(
            spec = AvatarPoseSpec(
                AvatarPoseLimb(r(lRot, 0.0), r(lDx, 0.0), r(lDy, 0.0)),
                AvatarPoseLimb(r(rRot, 0.0), r(rDx, 0.0), r(rDy, 0.0)),
                AvatarPoseBody(r5(bDy), r5(bRot), r5(bSx), r5(bSy)),
                AvatarPoseFeet(r(feet.dy, 0.0), r(feet.sx, 1.0), r(feet.sy, 1.0)),
            ),
            eyes = eyes,
            laugh = r5(laugh),
        )
    }

    /** The poses the living mascot's fit leaves room for (its reactions + the tap hop never leave the tile). */
    fun liveRoom(data: AvatarPosesData): List<AvatarPoseSpec> = listOfNotNull(
        data.poses["cheer"]?.spec, data.poses["shrug"]?.spec, data.poses["wave"]?.spec,
        AvatarPoseSpec(armL = AvatarPoseLimb(rot = 40.0), armR = AvatarPoseLimb(rot = 40.0), body = AvatarPoseBody(dy = -0.09)),
    )

    /** The laugh's pitch per body (the cast laugh sounds, pitched: small bodies higher, big ones lower). */
    val LAUGH_RATE: Map<String, Double> = mapOf(
        "mini" to 1.32, "bean" to 1.16, "star" to 1.12, "drop" to 1.1, "tall" to 1.04, "classic" to 1.0, "hex" to 0.98,
        "cloud" to 0.96, "pear" to 0.94, "blob" to 0.92, "wide" to 0.88, "chunky" to 0.84,
    )
}
