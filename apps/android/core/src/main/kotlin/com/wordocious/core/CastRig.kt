package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * The cast puppets (2.7.1): the header's ten characters drawn from their rigs (layers cut
 * from the canonical hero art, docs/design/brand/animation/<id>/). The bundle
 * (res/raw/cast_rigs.json + drawable-nodpi/rig_<id>_<layer>) is written by
 * docs/design/brand/animation/rig-engine/ship-rigs.py — the identical JSON web and iOS read.
 * [CastRig.evaluate] ports that script's reference evaluator; all three platforms are held
 * to its draw ops by rig-engine/rig-golden.json (CastRigTest; web cast-rig.test.ts; iOS
 * CastRigTests).
 */
class CastRigBundle(val tap: CastRigTap, val cast: List<String>, val rigs: Map<String, CastRig>) {
    companion object {
        fun parse(text: String): CastRigBundle {
            val o = Json.parseToJsonElement(text).jsonObject
            val t = o["tap"]!!.jsonObject
            val tap = CastRigTap(
                dur = t.d("dur"), hop = t.d("hop"), hopT = t["hopT"]!!.jsonArray.map { it.jsonPrimitive.doubleOrNull!! },
                sq = keys(t["sq"]!!), laugh = keys(t["laugh"]!!),
            )
            val rigs = o["rigs"]!!.jsonObject.mapValues { (_, v) -> CastRig.parse(v.jsonObject) }
            return CastRigBundle(tap, o["cast"]!!.jsonArray.map { it.jsonPrimitive.content }, rigs)
        }

        internal fun keys(e: JsonElement): List<CastRigKey> = e.jsonArray.map { k ->
            val a = k.jsonArray
            CastRigKey(a[0].jsonPrimitive.doubleOrNull!!, a[1].jsonPrimitive.doubleOrNull!!, a.getOrNull(2)?.jsonPrimitive?.content)
        }

        private fun JsonObject.d(k: String) = this[k]!!.jsonPrimitive.doubleOrNull!!
    }
}

data class CastRigKey(val t: Double, val v: Double, val ease: String?)

class CastRigTap(val dur: Double, val hop: Double, val hopT: List<Double>, val sq: List<CastRigKey>, val laugh: List<CastRigKey>) {
    /** The tap's (hop hero px, squash) at [t] s — also drives the costumed (season) figures. */
    fun pose(t: Double): Pair<Double, Double> {
        if (t < 0 || t >= dur) return 0.0 to 0.0
        val h0 = hopT[0]
        val h1 = hopT[1]
        val hp = if (t >= h0 && t < h1) -hop * sin((t - h0) / (h1 - h0) * PI) else 0.0
        return hp to CastRig.kfVal(sq, t)
    }
}

class CastRigTrack(val kf: List<CastRigKey>?, val period: Double?, val offset: Double?, val osc: List<Double>?, val env: List<CastRigKey>?)

/** A value: a number, a track name, or a summed list of those (null = absent). */
typealias CastRigSpec = JsonElement?

class CastRigLayer(
    val img: String, val pivot: List<Double>?, val at: List<Double>?, val pivotInImg: List<Double>?,
    val rot: CastRigSpec, val dx: CastRigSpec, val dy: CastRigSpec, val s: CastRigSpec, val sx: CastRigSpec, val sy: CastRigSpec,
    val alpha: CastRigSpec, val `when`: String?, val shadow: Boolean,
)

data class CastRigBox(val x: Double, val y: Double, val w: Double, val h: Double)

/** mascot px = hero px * s + (ox, oy), in the [size]-px `mascot_<id>` square. */
data class CastRigMascot(val size: Double, val s: Double, val ox: Double, val oy: Double)

/**
 * One draw: the layer image drawn into (0, 0, w, h) hero px under the affine
 * [a, b, c, d, tx, ty] (x' = a x + c y + tx, y' = b x + d y + ty), at [alpha].
 */
class CastRigOp(val layer: String, val m: DoubleArray, val alpha: Double)

class CastRig private constructor(
    val id: String,
    val cycle: Double,
    private val breath: DoubleArray, // origin x, origin y, period, sy, sx
    private val root: Map<String, JsonElement>,
    private val blinkHalf: String?,
    private val blinkClosed: String?,
    private val eyesTrack: String?,
    val laugh: List<String>,
    private val patchAfter: String?,
    blinkSeed: Double,
    blinkStart: Double,
    private val tracks: Map<String, CastRigTrack>,
    val layers: List<CastRigLayer>,
    val lay: Map<String, CastRigBox>,
    val mascot: CastRigMascot,
    private val warp: List<DoubleArray>,
    private val hasGesture: Boolean,
) {
    private val blinks = blinkTimes(blinkSeed, blinkStart)

    /** How long (s) the signature move plays in real time (0 = none). */
    val gestureSeconds: Double get() = if (hasGesture) warp.last()[0] else 0.0

    companion object {
        private val EASE: Map<String, (Double) -> Double> = mapOf(
            "linear" to { x -> x },
            "in" to { x -> x * x },
            "out" to { x -> 1 - (1 - x) * (1 - x) },
            "inOut" to { x -> if (x < 0.5) 2 * x * x else 1 - (-2 * x + 2).pow(2) / 2 },
            "sine" to { x -> 0.5 - 0.5 * cos(PI * x) },
            "inCubic" to { x -> x * x * x },
            "outCubic" to { x -> 1 - (1 - x).pow(3) },
            "outBack" to { x -> 1 + 2.4 * (x - 1).pow(3) + 1.4 * (x - 1).pow(2) },
            "outBackSoft" to { x -> 1 + 1.9 * (x - 1).pow(3) + 0.9 * (x - 1).pow(2) },
            "step" to { x -> if (x < 1) 0.0 else 1.0 },
        )

        fun kfVal(kf: List<CastRigKey>, t: Double): Double {
            if (t <= kf[0].t) return kf[0].v
            for (i in 1 until kf.size) if (t < kf[i].t) {
                val a = kf[i - 1]
                val b = kf[i]
                val p = (t - a.t) / (b.t - a.t)
                val e = EASE[b.ease ?: "inOut"] ?: EASE.getValue("inOut")
                return a.v + (b.v - a.v) * e(p)
            }
            return kf.last().v
        }

        fun blinkTimes(seed: Double, start: Double): DoubleArray {
            val out = ArrayList<Double>()
            var t = start
            var s = seed
            while (t < 900) {
                out += t
                s = (s * 9301 + 49297) % 233280
                t += 3 + 2 * (s / 233280)
            }
            return out.toDoubleArray()
        }

        private fun nums(e: JsonElement?): List<Double>? = (e as? JsonArray)?.map { it.jsonPrimitive.doubleOrNull!! }
        private fun str(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeIf { it.isString }?.content
        private fun spec(e: JsonElement?): CastRigSpec = if (e == null || e is JsonNull) null else e

        internal fun parse(o: JsonObject): CastRig {
            val br = o["breath"] as? JsonObject
            val breath = if (br != null) {
                val org = nums(br["origin"])!!
                doubleArrayOf(org[0], org[1], br["period"]!!.jsonPrimitive.doubleOrNull!!, br["sy"]!!.jsonPrimitive.doubleOrNull!!, br["sx"]!!.jsonPrimitive.doubleOrNull!!)
            } else doubleArrayOf(512.0, 960.0, 3.4, 0.012, 0.006)
            val blink = o["blink"] as? JsonObject
            val tracks = o["tracks"]!!.jsonObject.mapValues { (_, v) ->
                val t = v.jsonObject
                CastRigTrack(
                    kf = t["kf"]?.let { CastRigBundle.keys(it) },
                    period = t["period"]?.jsonPrimitive?.doubleOrNull,
                    offset = t["offset"]?.jsonPrimitive?.doubleOrNull,
                    osc = nums(t["osc"]),
                    env = t["env"]?.let { CastRigBundle.keys(it) },
                )
            }
            val layers = o["layers"]!!.jsonArray.map { e ->
                val l = e.jsonObject
                CastRigLayer(
                    img = l["img"]!!.jsonPrimitive.content, pivot = nums(l["pivot"]), at = nums(l["at"]), pivotInImg = nums(l["pivotInImg"]),
                    rot = spec(l["rot"]), dx = spec(l["dx"]), dy = spec(l["dy"]), s = spec(l["s"]), sx = spec(l["sx"]), sy = spec(l["sy"]),
                    alpha = spec(l["alpha"]), `when` = str(l["when"]), shadow = (l["shadow"] as? JsonPrimitive)?.booleanOrNull == true,
                )
            }
            val lay = o["lay"]!!.jsonObject.mapValues { (_, v) ->
                val b = v.jsonObject
                CastRigBox(b["x"]!!.jsonPrimitive.doubleOrNull!!, b["y"]!!.jsonPrimitive.doubleOrNull!!, b["w"]!!.jsonPrimitive.doubleOrNull!!, b["h"]!!.jsonPrimitive.doubleOrNull!!)
            }
            val m = o["mascot"]!!.jsonObject
            return CastRig(
                id = o["id"]!!.jsonPrimitive.content,
                cycle = o["cycle"]!!.jsonPrimitive.doubleOrNull!!,
                breath = breath,
                root = (o["root"] as? JsonObject) ?: emptyMap(),
                blinkHalf = str(blink?.get("half")),
                blinkClosed = str(blink?.get("closed")),
                eyesTrack = str(o["eyesTrack"]),
                laugh = (o["laugh"] as? JsonArray)?.map { it.jsonPrimitive.content } ?: emptyList(),
                patchAfter = str(o["patchAfter"]),
                blinkSeed = o["blinkSeed"]!!.jsonPrimitive.doubleOrNull!!,
                blinkStart = o["blinkStart"]!!.jsonPrimitive.doubleOrNull!!,
                tracks = tracks,
                layers = layers,
                lay = lay,
                mascot = CastRigMascot(m["size"]!!.jsonPrimitive.doubleOrNull!!, m["s"]!!.jsonPrimitive.doubleOrNull!!, m["ox"]!!.jsonPrimitive.doubleOrNull!!, m["oy"]!!.jsonPrimitive.doubleOrNull!!),
                warp = o["warp"]!!.jsonArray.map { p -> p.jsonArray.map { it.jsonPrimitive.doubleOrNull!! }.toDoubleArray() },
                hasGesture = o["gestureWindow"] is JsonArray,
            )
        }

        private fun mul(m: DoubleArray, n: DoubleArray) = doubleArrayOf(
            m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
        )
        private fun T(x: Double, y: Double) = doubleArrayOf(1.0, 0.0, 0.0, 1.0, x, y)
        private fun S(x: Double, y: Double) = doubleArrayOf(x, 0.0, 0.0, y, 0.0, 0.0)
        private fun Rd(deg: Double): DoubleArray {
            val r = deg * PI / 180
            return doubleArrayOf(cos(r), sin(r), -sin(r), cos(r), 0.0, 0.0)
        }
    }

    private fun isFree(tr: CastRigTrack): Boolean =
        if (tr.kf != null) (tr.period ?: 0.0) != 0.0 && abs((tr.period ?: 0.0) - cycle) > 1e-6 else tr.env == null

    private fun pmod(a: Double, p: Double) = ((a % p) + p) % p

    private fun trackVal(name: String, t: Double, g: Double): Double {
        val tr = tracks[name] ?: return 0.0
        val free = isFree(tr)
        val c = if (free) t else g
        var v = 0.0
        tr.kf?.let { kf ->
            val P = if ((tr.period ?: 0.0) != 0.0) tr.period!! else cycle
            val o = tr.offset ?: 0.0
            v += kfVal(kf, if (free) pmod(c - o, P) else min(c, P))
        }
        tr.osc?.let { osc ->
            val amp = osc[0]
            val per = osc[1]
            val t0 = osc.getOrElse(2) { 0.0 }
            val bounce = osc.getOrElse(3) { 0.0 }
            var o = if (bounce != 0.0) -abs(amp * sin(PI * (c - t0) / per)) else amp * sin(2 * PI * (c - t0) / per)
            tr.env?.let { o *= kfVal(it, min(c, cycle)) }
            v += o
        }
        return v
    }

    private fun restVal(name: String) = tracks[name]?.kf?.first()?.v ?: 0.0

    private fun v(spec: CastRigSpec, t: Double, g: Double, still: Boolean, dflt: Double): Double = when (spec) {
        null, is JsonNull -> dflt
        is JsonPrimitive -> if (spec.isString) (if (still) restVal(spec.content) else trackVal(spec.content, t, g)) else spec.doubleOrNull ?: dflt
        is JsonArray -> spec.sumOf { v(it, t, g, still, 0.0) }
        else -> dflt
    }

    private fun warpG(r: Double): Double {
        if (r <= warp[0][0]) return warp[0][1]
        for (i in 1 until warp.size) if (r < warp[i][0]) {
            val a = warp[i - 1]
            val b = warp[i]
            return a[1] + (b[1] - a[1]) * (r - a[0]) / (b[0] - a[0])
        }
        return warp.last()[1]
    }

    private fun blinkState(t: Double): String? {
        val tt = t % 900
        for (b in blinks) {
            if (b > tt) break
            val d = tt - b
            if (d < 0.16) return if (d < 0.04 || d > 0.12) "half" else "closed"
        }
        return null
    }

    /**
     * The draw ops for one frame, back to front. [t] wall clock (s); [gr] seconds since the
     * signature move started (null = rest); [tap] seconds since a tap (null = none); [still]
     * Reduce Motion (the pose holds; a tap only fades the laughing face in and out).
     */
    fun evaluate(B: CastRigBundle, t: Double, gr: Double?, tap: Double?, still: Boolean, laughOk: Boolean = true): List<CastRigOp> {
        val TP = B.tap
        val g = if (gr == null || still || gr >= warp.last()[0]) 0.0 else warpG(gr)
        var hop = 0.0
        var sq = 0.0
        var la = 0.0
        if (tap != null && tap >= 0 && tap < TP.dur) {
            la = if (laughOk) kfVal(TP.laugh, tap) else 0.0
            if (!still) { val p = TP.pose(tap); hop = p.first; sq = p.second }
        }
        val ops = ArrayList<CastRigOp>(12)
        for (L in layers) {
            if (!L.shadow) continue
            val l = lay.getValue(L.img)
            val f = min(1.0, max(0.0, -hop / TP.hop))
            val cx = l.x + l.w / 2
            val cy = l.y + l.h / 2
            val fl = if (still) 0.0 else v(root["dy"], t, g, still, 0.0)
            val gg = min(1.2, max(0.5, 1 - 0.35 * f + min(0.0, fl) * 0.004))
            ops += CastRigOp(L.img, mul(mul(mul(T(cx, cy), S(gg, gg)), T(-cx, -cy)), T(l.x, l.y)), 1 - 0.45 * f)
        }
        val br = if (still) 0.0 else sin(t / breath[2] * PI * 2)
        val sy = 1 + breath[3] * br + sq
        val sx = 1 - breath[4] * br - sq * 0.6
        val o = nums(root["origin"]) ?: listOf(breath[0], breath[1])
        val rdx = v(root["dx"], t, g, still, 0.0)
        val rdy = v(root["dy"], t, g, still, 0.0)
        val rrot = v(root["rot"], t, g, still, 0.0)
        val rsx = v(root["sx"], t, g, still, 1.0)
        val rsy = v(root["sy"], t, g, still, 1.0)
        val rootM = mul(mul(mul(mul(T(rdx, rdy + hop), T(o[0], o[1])), Rd(rrot)), S(sx * rsx, sy * rsy)), T(-o[0], -o[1]))

        fun patches() {
            if (la > 0.002) for (p in laugh) { val l = lay.getValue(p); ops += CastRigOp(p, mul(rootM, T(l.x, l.y)), la) }
            if (la >= 0.998 || still || (blinkHalf == null && blinkClosed == null)) return
            var e = blinkState(t)
            eyesTrack?.let { et ->
                val ev = trackVal(et, t, g)
                if (ev >= 1.5) e = "closed" else if (ev >= 0.5 && e != "closed") e = "half"
            }
            val p = when (e) { "half" -> blinkHalf; "closed" -> blinkClosed; else -> null }
            if (p != null) lay[p]?.let { l -> ops += CastRigOp(p, mul(rootM, T(l.x, l.y)), 1 - la) }
        }

        var patched = false
        for (L in layers) {
            if (L.shadow) continue
            val aMul = when (L.`when`) { "laugh" -> la; "nolaugh" -> 1 - la; else -> 1.0 }
            val l = lay.getValue(L.img)
            val piv = L.pivot ?: listOf(l.x, l.y)
            val at = L.at ?: piv
            val pin = L.pivotInImg ?: listOf(piv[0] - l.x, piv[1] - l.y)
            val rot = v(L.rot, t, g, still, 0.0)
            val dx = v(L.dx, t, g, still, 0.0)
            val dy = v(L.dy, t, g, still, 0.0)
            val s = v(L.s, t, g, still, 1.0)
            val lsx = v(L.sx, t, g, still, 1.0) * s
            val lsy = v(L.sy, t, g, still, 1.0) * s
            var alpha = if (L.alpha == null) 1.0 else min(1.0, max(0.0, v(L.alpha, t, g, still, 1.0)))
            alpha *= aMul
            val atRest = abs(rot) < 0.01 && abs(dx) < 0.05 && abs(dy) < 0.05 && abs(lsx - 1) < 1e-3 && abs(lsy - 1) < 1e-3
            if (alpha > 0.002 && !(L.`when` == "active" && atRest)) {
                ops += CastRigOp(L.img, mul(mul(mul(mul(rootM, T(at[0] + dx, at[1] + dy)), Rd(rot)), S(lsx, lsy)), T(-pin[0], -pin[1])), alpha)
            }
            if (patchAfter != null && L.img == patchAfter) { patches(); patched = true }
        }
        if (!patched) patches()
        return ops
    }
}
