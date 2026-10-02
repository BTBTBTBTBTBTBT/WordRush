package com.wordocious.app.ui

import com.wordocious.core.AvatarConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.floatOrNull

// FINISH_SPEC AN1/AN2/AN5 — the pure (JVM-testable) half of the mascot avatar
// engine: the back→front layer plan with the small-size simplification, the
// composed-bitmap cache key + a weighted LRU, and the parts manifest (anchors per
// body shape in 0–1 body coords + per-part slot/scale). The drawing lives in
// MascotComposer.kt, the Compose renderer + option catalog in MascotAvatar.kt.

/** The layers, back → front (AN1). */
enum class MascotLayer {
    /** The rounded-square tile behind the mascot (the frame's back). */
    TILE,
    /** A back accessory (cape) — drawn behind the body. */
    BACK_ACC,
    /** The body art (white, glossy) tinted by the color via multiply. */
    BODY,
    /** The pattern, clipped to the body and multiplied (dropped when "solid" or small). */
    PATTERN,
    /** The player's initial as the white body letter. */
    LETTER,
    /** Cheeks / nose. */
    NOSE,
    EYES,
    MOUTH,
    /** Glasses / mustache. */
    FACE_ACC,
    /** A front neck accessory (bow tie). */
    NECK_ACC,
    /** Hats. */
    HEAD_ACC,
    /** The front frame (bronze … diamond, Pro gold). */
    FRAME,
}

/** Back accessories (drawn behind the body); every other neck accessory sits in front. */
val MASCOT_BACK_ACCESSORIES: Set<String> = setOf("cape", "wings")

object MascotLayers {
    /** AN5: at or below this size (dp) the pattern and every accessory except hats are dropped. */
    const val SMALL_DP = 28f

    fun isSmall(sizeDp: Float): Boolean = sizeDp <= SMALL_DP

    /** The config actually drawn at [sizeDp]: small avatars keep body, color, face, hat and frame only. */
    fun simplify(config: AvatarConfig, sizeDp: Float): AvatarConfig =
        if (!isSmall(sizeDp)) config
        else config.copy(pattern = "solid", patternColor = config.color, face = "none", neck = "none")

    /** The layers drawn for [config] at [sizeDp], back → front. */
    fun plan(config: AvatarConfig, sizeDp: Float): List<MascotLayer> {
        val c = simplify(config, sizeDp)
        return buildList {
            add(MascotLayer.TILE)
            if (c.neck != "none" && c.neck in MASCOT_BACK_ACCESSORIES) add(MascotLayer.BACK_ACC)
            add(MascotLayer.BODY)
            if (c.pattern != "solid") add(MascotLayer.PATTERN)
            add(MascotLayer.LETTER)
            if (c.nose != "none") add(MascotLayer.NOSE)
            add(MascotLayer.EYES)
            add(MascotLayer.MOUTH)
            if (c.face != "none") add(MascotLayer.FACE_ACC)
            if (c.neck != "none" && c.neck !in MASCOT_BACK_ACCESSORIES) add(MascotLayer.NECK_ACC)
            if (c.head != "none") add(MascotLayer.HEAD_ACC)
            if (c.frame != "none") add(MascotLayer.FRAME)
        }
    }
}

/**
 * One composed bitmap: the (already simplified) config, the letter, the pixel size,
 * dark mode and whether the Pro crown is painted in (share images only — on screen
 * the crown is a Compose overlay outside the tile).
 */
data class MascotKey(
    val config: AvatarConfig,
    val initial: String,
    val px: Int,
    val dark: Boolean,
    val crown: Boolean = false,
) {
    companion object {
        /** The cache key for drawing [config] at [sizeDp] (= [px] pixels): small sizes share a simplified key. */
        fun of(config: AvatarConfig, initial: String, sizeDp: Float, px: Int, dark: Boolean, crown: Boolean = false): MascotKey =
            MascotKey(MascotLayers.simplify(config, sizeDp), initial.take(2).ifEmpty { "?" }, px.coerceAtLeast(1), dark, crown)
    }

    /** The bitmap's size in bytes (ARGB_8888). */
    val bytes: Long get() = px.toLong() * px.toLong() * 4L
}

/** A small thread-safe LRU bounded by total weight (e.g. bitmap bytes). */
class WeightedLru<K, V>(private val maxWeight: Long, private val weigh: (K, V) -> Long) {
    private val map = LinkedHashMap<K, V>(32, 0.75f, true)
    private var total = 0L

    @Synchronized fun get(key: K): V? = map[key]

    @Synchronized fun put(key: K, value: V) {
        map.remove(key)?.let { total -= weigh(key, it) }
        val w = weigh(key, value)
        if (w > maxWeight) return
        map[key] = value
        total += w
        val it = map.entries.iterator()
        while (total > maxWeight && it.hasNext()) {
            val e = it.next()
            total -= weigh(e.key, e.value)
            it.remove()
        }
    }

    @Synchronized fun getOrPut(key: K, make: () -> V): V = get(key) ?: make().also { put(key, it) }

    @Synchronized fun clear() { map.clear(); total = 0 }

    val size: Int @Synchronized get() = map.size
    val weight: Long @Synchronized get() = total
    @Synchronized fun containsKey(key: K): Boolean = map.containsKey(key)
}

// ── The parts manifest (AN2) ────────────────────────────────────────────────

data class AvPoint(val x: Float, val y: Float)
data class AvHeadTop(val x: Float, val y: Float, val w: Float)
data class AvBox(val x: Float, val y: Float, val w: Float, val h: Float)

/** Where the face, letter and accessories sit on one body shape (0–1 body coords). */
data class BodyAnchors(
    val faceCenter: AvPoint,
    val eyeY: Float,
    val mouthY: Float,
    val cheekY: Float,
    val headTop: AvHeadTop,
    val neckY: Float,
    val letterBox: AvBox,
)

/** One part's anchor slot ("eyes", "mouth", "nose", "cheeks", "head", "face", "neck", "back") + scale (× body width). */
data class PartPlacement(val slot: String, val scale: Float, val dx: Float = 0f, val dy: Float = 0f)

data class AvatarManifest(
    val bodies: Map<String, BodyAnchors>,
    /** Keyed "<category>:<id>" (category = body / eyes / mouth / nose / acc) or a whole category "<field>" (eyes / mouth / nose / head / face / neck). */
    val parts: Map<String, PartPlacement>,
) {
    fun anchors(body: String): BodyAnchors = bodies[body] ?: bodies["classic"] ?: AvatarManifests.DEFAULT_ANCHORS

    /** A part's placement: its own entry, else its category's ([field] = the config field for accessories), else the code default. */
    fun placement(category: String, id: String, field: String = category): PartPlacement {
        parts["$category:$id"]?.let { return it }
        val d = AvatarManifests.defaultPlacement(category, id)
        // A category entry gives the scale; back accessories keep their own slot.
        return parts[field]?.let { if (d.slot == "back") d else it.copy(dx = d.dx, dy = d.dy) } ?: d
    }
}

object AvatarManifests {
    /** The asset the placeholder / real manifest ships as (a copy of packages/core/src/avatar-parts.json). */
    const val ASSET = "avatar-parts.json"

    /** The body rect (left, top, right, bottom) of each code-drawn placeholder shape, 0–1. */
    val BODY_RECTS: Map<String, FloatArray> = mapOf(
        "classic" to floatArrayOf(0.12f, 0.06f, 0.88f, 0.88f),
        "tall" to floatArrayOf(0.22f, 0.02f, 0.78f, 0.90f),
        "wide" to floatArrayOf(0.04f, 0.20f, 0.96f, 0.88f),
        "blob" to floatArrayOf(0.08f, 0.08f, 0.92f, 0.90f),
        "bean" to floatArrayOf(0.14f, 0.04f, 0.86f, 0.90f),
        "star" to floatArrayOf(0.03f, 0.02f, 0.97f, 0.94f),
    )

    /** Anchors derived from a body rect: a compact face on top, the letter on the belly. */
    fun anchorsFor(r: FloatArray, star: Boolean = false): BodyAnchors {
        val (l, t, rr, b) = listOf(r[0], r[1], r[2], r[3])
        val w = rr - l; val h = b - t
        val cx = (l + rr) / 2f
        if (star) {
            // The letter in the star's middle, the face just above it.
            return BodyAnchors(
                faceCenter = AvPoint(cx, t + h * 0.36f), eyeY = t + h * 0.33f, mouthY = t + h * 0.44f,
                cheekY = t + h * 0.41f, headTop = AvHeadTop(cx, t + h * 0.12f, w * 0.36f), neckY = t + h * 0.5f,
                letterBox = AvBox(cx - w * 0.17f, t + h * 0.5f, w * 0.34f, h * 0.3f),
            )
        }
        return BodyAnchors(
            faceCenter = AvPoint(cx, t + h * 0.25f),
            eyeY = t + h * 0.21f,
            mouthY = t + h * 0.335f,
            cheekY = t + h * 0.30f,
            headTop = AvHeadTop(cx, t + h * 0.02f, (w * 0.82f).coerceAtMost(0.7f)),
            neckY = t + h * 0.43f,
            letterBox = AvBox(cx - w * 0.33f, t + h * 0.43f, w * 0.66f, h * 0.47f),
        )
    }

    val DEFAULT_ANCHORS: BodyAnchors = anchorsFor(BODY_RECTS.getValue("classic"))

    val DEFAULT: AvatarManifest = AvatarManifest(
        bodies = BODY_RECTS.mapValues { (k, r) -> anchorsFor(r, star = k == "star") },
        parts = emptyMap(),
    )

    /** The slot + scale a part uses when the manifest doesn't list it. */
    fun defaultPlacement(category: String, id: String): PartPlacement = when (category) {
        "eyes" -> PartPlacement("eyes", 0.46f)
        "mouth" -> PartPlacement("mouth", 0.26f)
        "nose" -> if (id == "blush" || id == "freckles") PartPlacement("cheeks", 0.56f) else PartPlacement("nose", 0.14f)
        "acc" -> when (id) {
            "heart-glasses" -> PartPlacement("face", 0.56f)
            "monocle" -> PartPlacement("face", 0.2f, dx = 0.13f)
            "mustache" -> PartPlacement("face", 0.3f, dy = 0.1f)
            "cape", "wings" -> PartPlacement("back", 1.0f)
            "bowtie", "scarf", "chain" -> PartPlacement("neck", 0.3f)
            "halo" -> PartPlacement("head", 0.8f, dy = -0.08f)
            else -> PartPlacement("head", 1.0f)
        }
        else -> PartPlacement(category, 1.0f)
    }

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    private fun JsonElement?.f(): Float? = (this as? JsonPrimitive)?.floatOrNull

    private fun JsonObject.f(vararg keys: String): Float? = keys.firstNotNullOfOrNull { this[it].f() }

    private fun point(el: JsonElement?, fallback: AvPoint): AvPoint = when (el) {
        is JsonObject -> AvPoint(el.f("x") ?: fallback.x, el.f("y") ?: fallback.y)
        is JsonArray -> AvPoint(el.getOrNull(0).f() ?: fallback.x, el.getOrNull(1).f() ?: fallback.y)
        else -> fallback
    }

    private fun box(el: JsonElement?, fallback: AvBox): AvBox = when (el) {
        is JsonObject -> AvBox(el.f("x") ?: fallback.x, el.f("y") ?: fallback.y, el.f("w", "width") ?: fallback.w, el.f("h", "height") ?: fallback.h)
        is JsonArray -> AvBox(
            el.getOrNull(0).f() ?: fallback.x, el.getOrNull(1).f() ?: fallback.y,
            el.getOrNull(2).f() ?: fallback.w, el.getOrNull(3).f() ?: fallback.h,
        )
        else -> fallback
    }

    private fun anchors(o: JsonObject, d: BodyAnchors): BodyAnchors {
        val ht = o["headTop"] as? JsonObject
        return BodyAnchors(
            faceCenter = point(o["faceCenter"], d.faceCenter),
            eyeY = o.f("eyeY") ?: d.eyeY,
            mouthY = o.f("mouthY") ?: d.mouthY,
            cheekY = o.f("cheekY") ?: d.cheekY,
            headTop = if (ht == null) d.headTop else AvHeadTop(ht.f("x") ?: d.headTop.x, ht.f("y") ?: d.headTop.y, ht.f("w", "width") ?: d.headTop.w),
            neckY = o.f("neckY") ?: d.neckY,
            letterBox = box(o["letterBox"], d.letterBox),
        )
    }

    /** "art-av-eyes-beady" / "eyes-beady" / "eyes:beady" / "acc-crown" → "eyes:beady" / "acc:crown". */
    fun partKey(raw: String): String? {
        val s = raw.trim().lowercase().removePrefix("art-av-").removePrefix("art_av_").replace('_', '-')
        val i = s.indexOfFirst { it == ':' || it == '-' }
        if (i <= 0 || i == s.length - 1) return null
        val cat = s.substring(0, i)
        if (cat !in setOf("body", "eyes", "mouth", "nose", "acc")) return null
        return "$cat:${s.substring(i + 1)}"
    }

    /** The manifest's slot names ("eyeY", "headTop", …) → the renderer's slots. */
    fun slotName(raw: String?): String? = when (raw?.trim()) {
        null, "" -> null
        "eyeY" -> "eyes"
        "mouthY" -> "mouth"
        "cheekY" -> "cheeks"
        "headTop" -> "head"
        "neckY" -> "neck"
        "faceCenter" -> "face"
        else -> raw.trim()
    }

    private val CATEGORY_KEYS = setOf("eyes", "mouth", "nose", "head", "face", "neck")

    private fun placement(o: JsonObject, d: PartPlacement): PartPlacement = PartPlacement(
        slot = slotName((o["slot"] as? JsonPrimitive)?.content) ?: slotName((o["anchor"] as? JsonPrimitive)?.content) ?: d.slot,
        scale = o.f("scale") ?: d.scale,
        dx = o.f("dx", "offsetX") ?: d.dx,
        dy = o.f("dy", "offsetY") ?: d.dy,
    )

    /**
     * Read a manifest leniently: `{bodies: {<shape>: {faceCenter, eyeY, …}}, parts: {…}}`
     * where parts is keyed "eyes-beady" / "art-av-eyes-beady" / "eyes:beady" or nested
     * `{eyes: {beady: {slot, scale}}}`. Anything missing keeps the code default;
     * unparseable text → [DEFAULT].
     */
    fun parse(text: String?): AvatarManifest {
        val root = runCatching { json.parseToJsonElement(text ?: return DEFAULT) }.getOrNull() as? JsonObject ?: return DEFAULT
        val bodiesEl = (root["bodies"] ?: root["body"] ?: root["shapes"]) as? JsonObject
        val bodies = DEFAULT.bodies.toMutableMap()
        bodiesEl?.forEach { (k, v) ->
            val o = v as? JsonObject ?: return@forEach
            val id = k.lowercase().removePrefix("art-av-body-").removePrefix("body-")
            val anchorObj = (o["anchors"] as? JsonObject) ?: o
            bodies[id] = anchors(anchorObj, bodies[id] ?: DEFAULT_ANCHORS)
        }
        val parts = mutableMapOf<String, PartPlacement>()
        (root["parts"] as? JsonObject)?.forEach { (k, v) ->
            val o = v as? JsonObject ?: return@forEach
            val direct = partKey(k)
            val isEntry = o.containsKey("scale") || o.containsKey("slot") || o.containsKey("anchor")
            if (isEntry && k.lowercase() in CATEGORY_KEYS) {
                // A whole category: {"eyes": {"slot": "eyeY", "scale": 0.46}}.
                val cat = k.lowercase()
                parts[cat] = placement(o, defaultPlacement(if (cat in setOf("head", "face", "neck")) "acc" else cat, ""))
            } else if (direct != null && isEntry) {
                val (cat, id) = direct.split(":", limit = 2)
                parts[direct] = placement(o, defaultPlacement(cat, id))
            } else {
                // Nested by category.
                val cat = when (val c = k.lowercase()) { "hats", "head", "face", "neck", "extras", "accessories" -> "acc"; else -> c }
                o.forEach { (id, pv) ->
                    val po = pv as? JsonObject ?: return@forEach
                    parts["$cat:${id.lowercase()}"] = placement(po, defaultPlacement(cat, id.lowercase()))
                }
            }
        }
        return AvatarManifest(bodies, parts)
    }
}
