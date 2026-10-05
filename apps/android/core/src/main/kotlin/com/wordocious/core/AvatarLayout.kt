package com.wordocious.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

// The mascot FIT SYSTEM — 1:1 port of packages/core/src/avatar-layout.ts (pinned by
// avatar-layout-fixtures.json, AvatarLayoutFixtureTest). One layout every renderer draws: per-body anchors
// place AND scale every part, hats clear the eyes, conflicting picks swap out, and the whole composition is
// scaled uniformly into the padded tile. Rects are fractions of the avatar's CONTENT square.

data class AvatarRect(val x: Double, val y: Double, val w: Double, val h: Double)

data class AvatarLayoutLayer(val layer: String, val field: String, val id: String, val art: String, val rect: AvatarRect, val tint: Boolean)

/** [letterIndex]: the white initial is drawn just before layers[letterIndex] (== layers.size: after the last layer). */
data class AvatarLayout(val scale: Double, val body: AvatarRect, val letter: AvatarRect, val layers: List<AvatarLayoutLayer>, val bounds: AvatarRect, val letterIndex: Int = 1)

/** avatar-parts.json v2 (the fit manifest), read leniently from its JSON. */
class AvatarFitManifest(val root: JsonObject) {
    class Body(val o: JsonObject) {
        private fun d(k: String) = (o[k] as? JsonPrimitive)?.doubleOrNull ?: 0.0
        private fun sub(k: String, f: String) = ((o[k] as? JsonObject)?.get(f) as? JsonPrimitive)?.doubleOrNull ?: 0.0
        private fun arr(k: String) = (o[k] as? JsonArray)?.map { (it as JsonPrimitive).doubleOrNull ?: 0.0 } ?: emptyList()
        val eyeY = d("eyeY"); val mouthY = d("mouthY"); val cheekY = d("cheekY"); val neckY = d("neckY")
        val mustacheY = d("mustacheY"); val shoulderW = d("shoulderW")
        val headX = sub("headTop", "x"); val headY = sub("headTop", "y"); val headW = sub("headTop", "w")
        val faceX = sub("face", "x"); val faceW = sub("face", "w")
        val backX = sub("back", "x"); val backY = sub("back", "y"); val backW = sub("back", "w")
        val capeY = sub("cape", "y"); val handX = sub("hand", "x"); val handY = sub("hand", "y")
        val letterBox = arr("letterBox"); val bounds = arr("bounds")
        fun override(key: String): Triple<Double, Double, Double> {
            val ov = ((o["overrides"] as? JsonObject)?.get(key) as? JsonObject) ?: return Triple(0.0, 0.0, 1.0)
            fun g(k: String) = (ov[k] as? JsonPrimitive)?.doubleOrNull
            return Triple(g("dx") ?: 0.0, g("dy") ?: 0.0, g("scale") ?: 1.0)
        }
    }
    class Item(val o: JsonObject) {
        private fun d(k: String) = (o[k] as? JsonPrimitive)?.doubleOrNull ?: 0.0
        val w = d("w"); val aspect = d("aspect")
        val anchor = (o["anchor"] as? JsonArray)?.map { (it as JsonPrimitive).doubleOrNull ?: 0.5 } ?: listOf(0.5, 0.5)
        val slot = (o["slot"] as? JsonPrimitive)?.content ?: "eyes"
        val layer = (o["layer"] as? JsonPrimitive)?.content ?: "eyes"
        val tint = (o["tint"] as? JsonPrimitive)?.booleanOrNull ?: false
        val overFace = (o["overFace"] as? JsonPrimitive)?.booleanOrNull ?: false
        /** Integrated parts drawn per body (the scarf): art `art-av-<kind>-<id>-<body>` at [x, y, w, h] body units. */
        val perBody: Map<String, List<Double>> = (o["perBody"] as? JsonObject)?.mapValues { e ->
            (e.value as? JsonArray)?.map { (it as JsonPrimitive).doubleOrNull ?: 0.0 } ?: emptyList()
        } ?: emptyMap()
        /**
         * v3 integrated parts: per body, the pieces [layer, x, y, w, h] (body units), art
         * `art-av-<kind>-<id>-<body>-<layer>`; null for a classic part. A body missing from the map draws nothing.
         */
        val pieces: Map<String, List<Piece>>? = (o["pieces"] as? JsonObject)?.mapValues { e ->
            (e.value as? JsonArray)?.map { el ->
                val a = el as JsonArray
                fun n(i: Int) = (a[i] as JsonPrimitive).doubleOrNull ?: 0.0
                Piece((a[0] as JsonPrimitive).content, n(1), n(2), n(3), n(4))
            } ?: emptyList()
        }
        /** Eyes only: the visible top of the eye ink as a fraction of the art canvas (brows clear tall eyes). */
        val inkTop: Double? = (o["inkTop"] as? JsonPrimitive)?.doubleOrNull
        /** Seasonal parts (AvatarSeason): the season-registry id it belongs to; shown in season or when saved. */
        val season: String? = (o["season"] as? JsonPrimitive)?.content
    }
    data class Piece(val layer: String, val x: Double, val y: Double, val w: Double, val h: Double)
    data class Conflict(val a: String, val aIds: List<String>, val b: String, val bIds: List<String>)

    private val fit = root["fit"] as? JsonObject
    val pad = (fit?.get("pad") as? JsonPrimitive)?.doubleOrNull ?: 0.05
    val maxBody = (fit?.get("maxBody") as? JsonPrimitive)?.doubleOrNull ?: 0.86
    val minBody = (fit?.get("minBody") as? JsonPrimitive)?.doubleOrNull ?: 0.5
    val layerOrder: List<String> = (root["layerOrder"] as? JsonArray)?.map { (it as JsonPrimitive).content } ?: emptyList()
    val bodies: Map<String, Body> = (root["bodies"] as? JsonObject)?.mapValues { Body(it.value as JsonObject) } ?: emptyMap()
    val items: Map<String, Item> = (root["items"] as? JsonObject)?.mapValues { Item(it.value as JsonObject) } ?: emptyMap()
    val conflicts: List<Conflict> = (root["conflicts"] as? JsonArray)?.map { el ->
        val o = el as JsonObject
        fun ids(k: String) = (o[k] as? JsonArray)?.map { (it as JsonPrimitive).content } ?: emptyList()
        Conflict((o["a"] as JsonPrimitive).content, ids("aIds"), (o["b"] as JsonPrimitive).content, ids("bIds"))
    } ?: emptyList()

    companion object {
        fun parse(text: String?): AvatarFitManifest? = runCatching {
            AvatarFitManifest(Json.parseToJsonElement(text ?: return null) as JsonObject)
        }.getOrNull()

        fun of(el: JsonElement?): AvatarFitManifest? = (el as? JsonObject)?.let { AvatarFitManifest(it) }
    }
}

object AvatarFit {
    val PART_FIELDS = listOf("cheeks", "eyes", "nose", "mouth", "face", "head", "neck", "held", "wrap", "feet", "pet", "brows", "extra")
    private val FIELD_KIND = mapOf("cheeks" to "cheeks", "eyes" to "eyes", "nose" to "nose", "mouth" to "mouth", "face" to "acc", "head" to "acc", "neck" to "acc",
        "held" to "acc", "wrap" to "acc", "feet" to "acc", "pet" to "acc", "brows" to "brows", "extra" to "acc")
    /** The layers drawn before the white initial (the letter sits ON the 'under' garments: apron, sash, belt). */
    val LAYERS_UNDER_LETTER = setOf("back", "body", "pattern", "under")

    /** The manifest item key for a config field + id (held + mug → acc:mug, brows + happy → brows:happy). */
    fun itemKey(field: String, id: String): String = "${kind(field)}:$id"
    const val HAT_EYE_CLEARANCE = 0.012
    const val SMALL_SIZE = 28

    fun kind(field: String): String = FIELD_KIND[field] ?: "acc"

    private fun r4(v: Double): Double = (v * 10000).roundToLong() / 10000.0

    fun value(c: AvatarConfig, field: String): String = when (field) {
        "cheeks" -> c.cheeks; "eyes" -> c.eyes; "nose" -> c.nose; "mouth" -> c.mouth
        "face" -> c.face; "head" -> c.head; "neck" -> c.neck
        "held" -> c.held; "wrap" -> c.wrap; "feet" -> c.feet; "pet" -> c.pet; "brows" -> c.brows; "extra" -> c.extra
        else -> "none"
    }

    fun setting(c: AvatarConfig, field: String, id: String): AvatarConfig = when (field) {
        "cheeks" -> c.copy(cheeks = id); "eyes" -> c.copy(eyes = id); "nose" -> c.copy(nose = id); "mouth" -> c.copy(mouth = id)
        "face" -> c.copy(face = id); "head" -> c.copy(head = id); "neck" -> c.copy(neck = id); "body" -> c.copy(body = id)
        "held" -> c.copy(held = id); "wrap" -> c.copy(wrap = id); "feet" -> c.copy(feet = id); "pet" -> c.copy(pet = id)
        "brows" -> c.copy(brows = id); "extra" -> c.copy(extra = id)
        else -> c
    }

    /** The (field, id) a pick would swap out, else null. */
    fun pickConflict(worn: Map<String, String>, field: String, id: String, m: AvatarFitManifest): Pair<String, String>? {
        if (id == "none") return null
        for (c in m.conflicts) {
            for ((mine, mineIds, other, otherIds) in listOf(listOf(c.a, c.aIds, c.b, c.bIds), listOf(c.b, c.bIds, c.a, c.aIds))) {
                @Suppress("UNCHECKED_CAST")
                if (mine != field || !((mineIds as List<String>).contains(id) || mineIds.contains("*"))) continue
                val w = worn[other as String]
                @Suppress("UNCHECKED_CAST")
                if (w != null && w != "none" && ((otherIds as List<String>).contains(w) || otherIds.contains("*"))) return other to w
            }
        }
        return null
    }

    fun pickConflict(c: AvatarConfig, field: String, id: String, m: AvatarFitManifest): Pair<String, String>? =
        pickConflict(PART_FIELDS.associateWith { value(c, it) }, field, id, m)

    /** What a swapped-out field resets to (eyes and mouth always draw something). */
    val PICK_RESET = mapOf("eyes" to "beady", "mouth" to "smile")

    /** Set field = id and swap out whatever it conflicts with. */
    fun applyPick(c: AvatarConfig, field: String, id: String, m: AvatarFitManifest): AvatarConfig {
        var next = setting(c, field, id)
        repeat(4) {
            val hit = pickConflict(next, field, id, m) ?: return next
            next = setting(next, hit.first, PICK_RESET[hit.first] ?: "none")
        }
        return next
    }

    private fun wornParts(c: AvatarConfig, small: Boolean, m: AvatarFitManifest): List<Pair<String, String>> {
        val out = mutableListOf<Pair<String, String>>()
        val kept = mutableMapOf<String, String>()
        for (f in listOf("eyes", "mouth", "head", "nose", "cheeks", "neck", "face", "held", "wrap", "feet", "pet", "brows", "extra")) {
            val id = value(c, f)
            if (id.isEmpty() || id == "none") continue
            if (small && f !in setOf("eyes", "mouth", "head", "nose")) continue
            if (m.items["${kind(f)}:$id"] == null) continue
            if (pickConflict(kept, f, id, m) != null) continue
            kept[f] = id
            out.add(f to id)
        }
        return out
    }

    private fun slot(b: AvatarFitManifest.Body, slot: String): Triple<Double, Double, Double> = when (slot) {
        "eyes", "glasses" -> Triple(b.faceX, b.eyeY, b.faceW)
        "nose", "cheeks" -> Triple(b.faceX, b.cheekY, b.faceW)
        "mouth" -> Triple(b.faceX, b.mouthY, b.faceW)
        "mustache" -> Triple(b.faceX, b.mustacheY, b.faceW)
        "head" -> Triple(b.headX, b.headY, b.headW)
        "neck" -> Triple(b.faceX, b.neckY, b.shoulderW)
        "hand" -> Triple(b.handX, b.handY, b.backW)
        "cape" -> Triple(b.backX, b.capeY, b.backW)
        else -> Triple(b.backX, b.backY, b.backW)
    }

    /** Where every layer of [c] goes (content-square fractions). */
    fun layout(c: AvatarConfig, small: Boolean, m: AvatarFitManifest): AvatarLayout {
        val b = m.bodies[c.body] ?: m.bodies["classic"] ?: run {
            val u = AvatarRect(0.07, 0.07, 0.86, 0.86)
            return AvatarLayout(0.86, u, u, emptyList(), u)
        }
        data class P(val layer: String, val field: String, val id: String, val art: String, var rect: AvatarRect, val tint: Boolean)
        val placed = mutableListOf<P>()
        for ((field, id) in wornParts(c, small, m)) {
            val key = "${kind(field)}:$id"
            val it = m.items.getValue(key)
            val pieces = it.pieces
            if (pieces != null) {
                // v3 integrated part: its per-body layers (nothing on a body without room for it)
                for (pc in pieces[c.body] ?: emptyList()) {
                    placed.add(P(pc.layer, field, id, "art-av-${kind(field)}-$id-${c.body}-${pc.layer}", AvatarRect(pc.x, pc.y, pc.w, pc.h),
                        it.tint && id in AvatarOptions.TINTABLE))
                }
                continue
            }
            val pb = it.perBody[c.body]
            if (pb != null && pb.size == 4) {
                placed.add(P(it.layer, field, id, "art-av-${kind(field)}-$id-${c.body}", AvatarRect(pb[0], pb[1], pb[2], pb[3]),
                    it.tint && id in AvatarOptions.TINTABLE))
                continue
            }
            val (px, py, base) = slot(b, it.slot)
            val (dx, dy, sc) = b.override(key)
            val w = base * it.w * sc
            val h = w * it.aspect
            placed.add(P(it.layer, field, id, "art-av-${kind(field)}-$id", AvatarRect(px - it.anchor[0] * w + dx, py - it.anchor[1] * h + dy, w, h),
                it.tint && id in AvatarOptions.TINTABLE))
        }
        val faceTop = placed.filter { it.layer == "eyes" || (it.layer == "face" && m.items["acc:${it.id}"]?.slot == "glasses") }.minOfOrNull { it.rect.y }
        if (faceTop != null) {
            for (p in placed) {
                if (p.layer != "head" || m.items["acc:${p.id}"]?.overFace == true) continue
                val limit = faceTop - HAT_EYE_CLEARANCE
                val bottom = p.rect.y + p.rect.h
                if (bottom > limit) p.rect = p.rect.copy(y = p.rect.y - (bottom - limit))
            }
        }
        // brows sit over the round default eyes (beady); taller eyes lift them by the difference in visible eye top
        val eyesP = placed.firstOrNull { it.layer == "eyes" }
        val ink = m.items["eyes:${c.eyes}"]?.inkTop
        val beady = m.items["eyes:beady"]
        val beadyInk = beady?.inkTop
        if (eyesP != null && ink != null && beady != null && beadyInk != null) {
            val (_, py, base) = slot(b, beady.slot)
            val (_, dy, sc) = b.override("eyes:beady")
            val w = base * beady.w * sc
            val h = w * beady.aspect
            val beadyTop = py - beady.anchor[1] * h + dy + beadyInk * h
            val lift = min(0.0, eyesP.rect.y + ink * eyesP.rect.h - beadyTop)
            if (lift < 0) for (p in placed) if (p.layer == "brows") p.rect = p.rect.copy(y = p.rect.y + lift)
        }
        var x0 = b.bounds[0]; var y0 = b.bounds[1]; var x1 = b.bounds[2]; var y1 = b.bounds[3]
        for (p in placed) {
            x0 = min(x0, p.rect.x); y0 = min(y0, p.rect.y)
            x1 = max(x1, p.rect.x + p.rect.w); y1 = max(y1, p.rect.y + p.rect.h)
        }
        val avail = 1 - 2 * m.pad
        val s = minOf(m.maxBody, avail / (x1 - x0), avail / (y1 - y0))
        val tx = 0.5 - ((x0 + x1) / 2) * s
        val ty = 0.5 - ((y0 + y1) / 2) * s
        fun map(r: AvatarRect) = AvatarRect(r4(tx + r.x * s), r4(ty + r.y * s), r4(r.w * s), r4(r.h * s))
        val bodyRect = map(AvatarRect(0.0, 0.0, 1.0, 1.0))
        val all = listOf(AvatarLayoutLayer("body", "body", c.body, "art-av-body-${c.body}", bodyRect, false)) +
            placed.map { AvatarLayoutLayer(it.layer, it.field, it.id, it.art, map(it.rect), it.tint) }
        val sorted = all.sortedBy { m.layerOrder.indexOf(it.layer) }   // stable
        val lb = b.letterBox
        val after = sorted.indexOfFirst { it.layer !in LAYERS_UNDER_LETTER }.let { if (it < 0) sorted.size else it }
        return AvatarLayout(r4(s), bodyRect, map(AvatarRect(lb[0], lb[1], lb[2], lb[3])), sorted, map(AvatarRect(x0, y0, x1 - x0, y1 - y0)), after)
    }

    // ── Patterns (shared shapes, body-square units) ─────────────────────────

    sealed class Shape {
        data class Rect(val x: Double, val y: Double, val w: Double, val h: Double, val c: String, val a: Double = 1.0) : Shape()
        data class Circle(val x: Double, val y: Double, val r: Double, val c: String, val a: Double = 1.0) : Shape()
        data class Star(val x: Double, val y: Double, val r: Double, val inner: Double, val n: Int, val c: String, val a: Double = 1.0) : Shape()
        data class Heart(val x: Double, val y: Double, val s: Double, val c: String, val a: Double = 1.0) : Shape()
        data class Poly(val pts: List<Pair<Double, Double>>, val c: String, val a: Double = 1.0) : Shape()
        data class Grad(val x1: Double, val y1: Double, val x2: Double, val y2: Double, val stops: List<Triple<Double, String, Double>>) : Shape()
    }

    fun patternShapes(pattern: String): List<Shape> {
        val out = mutableListOf<Shape>()
        fun grid(step: Double, f: (Double, Double, Int) -> Unit) {
            var row = 0
            var y = step / 2
            while (y < 1.05) {
                var x = if (row % 2 == 1) step else step / 2
                while (x < 1.05) { f(r4(x), r4(y), row); x += step }
                y += step; row++
            }
        }
        when (pattern) {
            "twotone" -> out.add(Shape.Rect(0.0, 0.56, 1.0, 0.44, "ink"))
            "stripes" -> { var y = 0.1; while (y < 1) { out.add(Shape.Rect(0.0, r4(y), 1.0, 0.065, "ink")); y += 0.15 } }
            "dots" -> grid(0.17) { x, y, _ -> out.add(Shape.Circle(x, y, 0.045, "ink")) }
            "gradient" -> out.add(Shape.Grad(0.5, 0.2, 0.5, 0.92, listOf(Triple(0.0, "ink", 0.0), Triple(1.0, "ink", 1.0))))
            "sparkle" -> for ((x, y, r) in listOf(Triple(0.22, 0.22, 0.05), Triple(0.72, 0.18, 0.04), Triple(0.84, 0.46, 0.05), Triple(0.16, 0.56, 0.04),
                Triple(0.5, 0.3, 0.03), Triple(0.32, 0.8, 0.05), Triple(0.7, 0.74, 0.04), Triple(0.58, 0.9, 0.03))) out.add(Shape.Star(x, y, r, r4(r * 0.35), 4, "ink"))
            "hearts" -> grid(0.2) { x, y, _ -> out.add(Shape.Heart(x, y, 0.075, "ink")) }
            "stars" -> grid(0.2) { x, y, _ -> out.add(Shape.Star(x, y, 0.055, 0.024, 5, "ink")) }
            "zigzag" -> {
                var y = 0.12
                while (y < 1.05) {
                    val pts = mutableListOf<Pair<Double, Double>>()
                    for (i in 0..10) pts.add(r4(i / 10.0) to r4(y + if (i % 2 == 1) -0.045 else 0.045))
                    for (i in 10 downTo 0) pts.add(r4(i / 10.0) to r4(y + 0.06 + if (i % 2 == 1) -0.045 else 0.045))
                    out.add(Shape.Poly(pts, "ink"))
                    y += 0.2
                }
            }
            "checkers" -> for (r in 0 until 8) for (cc in 0 until 8) if ((r + cc) % 2 == 0) out.add(Shape.Rect(r4(cc / 8.0), r4(r / 8.0), 0.125, 0.125, "ink"))
            "tiedye" -> for (i in 7 downTo 1) out.add(Shape.Circle(0.42, 0.46, r4(i * 0.11), if (i % 2 == 1) "ink" else "light", if (i % 2 == 1) 0.85 else 0.5))
            "leopard" -> grid(0.22) { x, y, row ->
                val dx = if (row % 2 == 1) 0.02 else -0.02
                out.add(Shape.Circle(r4(x + dx), y, 0.055, "ink"))
                out.add(Shape.Circle(r4(x + dx + 0.012), r4(y - 0.008), 0.03, "base"))
            }
            "galaxy" -> {
                out.add(Shape.Grad(0.0, 0.0, 1.0, 1.0, listOf(Triple(0.0, "ink", 0.95), Triple(1.0, "ink", 0.55))))
                for ((x, y, r) in listOf(Triple(0.18, 0.2, 0.012), Triple(0.7, 0.14, 0.016), Triple(0.42, 0.34, 0.01), Triple(0.86, 0.38, 0.012), Triple(0.25, 0.55, 0.014),
                    Triple(0.6, 0.6, 0.01), Triple(0.8, 0.78, 0.014), Triple(0.35, 0.85, 0.012), Triple(0.12, 0.74, 0.01))) out.add(Shape.Circle(x, y, r, "light"))
                for ((x, y) in listOf(0.55 to 0.24, 0.2 to 0.4, 0.72 to 0.5, 0.5 to 0.82)) out.add(Shape.Star(x, y, 0.04, 0.012, 4, "light"))
            }
            "colorblock" -> out.add(Shape.Rect(0.5, 0.0, 0.5, 1.0, "ink"))
        }
        return out
    }
}
