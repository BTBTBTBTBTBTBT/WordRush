package com.wordocious.core

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// FINISH_SPEC AN3 (+ AN addendum) — the build-your-own-mascot avatar config
// (profiles.avatar_config jsonb null). 1:1 port of packages/core/src/avatar-config.ts:
// the option ids per category, the 16 color swatches (stored by id), the backdrops,
// `validateAvatar` (unknown / missing fields → the fallback's), `defaultAvatar(userId,
// accent)` (FNV-1a seeded body / eyes / mouth from the friendly subsets, the accent's
// nearest swatch), `enforceAvatarPro` and the ten cast presets. Pinned by
// avatar-config-fixtures.json (AvatarConfigFixtureTest).
//
// `display` ("mascot" | "photo", coordinator 10-02: the mascot never replaces the
// photo) says which one every renderer shows; a "photo" display without a photo URL
// falls back to the mascot. Its default is a function of whether the player has a photo.

/** One color swatch: the stored id + the tint hex. */
data class AvatarSwatch(val id: String, val hex: String)

/** One backdrop: kind "solid" (colors[0]), "gradient" (TL → BR blend) or "pattern" (colors[0] + motif colors). */
data class AvatarBackdrop(val id: String, val kind: String, val colors: List<String>)

/** profiles.avatar_config. Every slot holds an id ("none" = nothing). */
data class AvatarConfig(
    val v: Int = 1,
    val body: String = "classic",
    /** A swatch id (AvatarOptions.SWATCHES). */
    val color: String = "purple",
    val pattern: String = "solid",
    /** A swatch id (defaults to [color]). */
    val patternColor: String = "purple",
    val eyes: String = "beady",
    val nose: String = "none",
    val mouth: String = "smile",
    val head: String = "none",
    val face: String = "none",
    val neck: String = "none",
    val frame: String = "none",
    /** A backdrop id (AvatarOptions.BACKDROP_IDS); "auto" = a light tint of the body color. */
    val bg: String = "auto",
    /** "mascot" | "photo": which one the avatar shows (a photo display needs a photo URL). */
    val display: String = AvatarOptions.DISPLAY_MASCOT,
)

object AvatarOptions {
    val BODIES: List<String> = listOf("classic", "tall", "wide", "blob", "bean", "star")
    val PATTERNS: List<String> = listOf("solid", "twotone", "stripes", "dots", "gradient", "sparkle")
    val EYES: List<String> = listOf("beady", "happy", "sparkly", "sleepy", "wink", "hearts", "stars", "glasses", "cyclops")
    val MOUTHS: List<String> = listOf("smile", "grin", "tongue", "o", "cat", "toothy", "smirk", "tiny", "gasp")
    val NOSES: List<String> = listOf("none", "button", "red", "blush", "freckles")

    /** Hats (21 + none). Pro-only: crown, halo, tiara. */
    val HEADS: List<String> = listOf(
        "none", "crown", "party", "beanie", "sprout", "nightcap", "headphones", "bow", "wizard", "pirate", "cowboy", "chef",
        "grad", "halo", "flower", "tophat", "propeller", "catears", "bunnyears", "tiara", "viking", "sweatband",
    )

    /** Face extras. */
    val FACES: List<String> = listOf("none", "mustache", "heart-glasses", "monocle")

    /** Neck / back extras. Pro-only: wings, chain. */
    val NECKS: List<String> = listOf("none", "cape", "wings", "bowtie", "scarf", "chain")

    val FRAMES: List<String> = listOf("none", "bronze", "silver", "gold", "platinum", "diamond", "pro")

    val BACKDROPS: List<AvatarBackdrop> = listOf(
        AvatarBackdrop("lilac", "solid", listOf("#ede9fe")),
        AvatarBackdrop("bubblegum", "solid", listOf("#fce7f3")),
        AvatarBackdrop("sky", "solid", listOf("#e0f2fe")),
        AvatarBackdrop("mint", "solid", listOf("#dcfce7")),
        AvatarBackdrop("lemon", "solid", listOf("#fef9c3")),
        AvatarBackdrop("peach", "solid", listOf("#ffedd5")),
        AvatarBackdrop("cloud", "solid", listOf("#f1f5f9")),
        AvatarBackdrop("night", "solid", listOf("#1e1b4b")),
        AvatarBackdrop("sunset", "gradient", listOf("#fb923c", "#ec4899")),
        AvatarBackdrop("ocean", "gradient", listOf("#0ea5e9", "#1e40af")),
        AvatarBackdrop("cottoncandy", "gradient", listOf("#f9a8d4", "#a5b4fc")),
        AvatarBackdrop("aurora", "gradient", listOf("#34d399", "#8b5cf6", "#0ea5e9")),
        AvatarBackdrop("galaxy", "pattern", listOf("#4c1d95", "#fde68a")),
        AvatarBackdrop("polka", "pattern", listOf("#fce7f3", "#f472b6")),
        AvatarBackdrop("starry", "pattern", listOf("#1e3a8a", "#facc15")),
        AvatarBackdrop("sunburst", "pattern", listOf("#fde68a", "#f59e0b")),
        AvatarBackdrop("checkers", "pattern", listOf("#ede9fe", "#c4b5fd")),
        AvatarBackdrop("confetti", "pattern", listOf("#fff7ed", "#ec4899", "#22c55e", "#2563eb", "#f5a524")),
    )
    val BACKDROP_IDS: List<String> = listOf("auto") + BACKDROPS.map { it.id }

    /** The 16 swatches: the cast palette (12) + 4 extras. Ids are stable (stored); hexes are the tint. */
    val SWATCHES: List<AvatarSwatch> = listOf(
        AvatarSwatch("purple", "#7c3aed"), AvatarSwatch("violet", "#8b5cf6"), AvatarSwatch("pink", "#ec4899"), AvatarSwatch("red", "#ef4444"),
        AvatarSwatch("orange", "#f97316"), AvatarSwatch("amber", "#f5a524"), AvatarSwatch("yellow", "#eab308"), AvatarSwatch("green", "#22c55e"),
        AvatarSwatch("emerald", "#10b981"), AvatarSwatch("teal", "#0d9488"), AvatarSwatch("sky", "#0ea5e9"), AvatarSwatch("blue", "#2563eb"),
        AvatarSwatch("lilac", "#c4b5fd"), AvatarSwatch("peach", "#fdba74"), AvatarSwatch("mint", "#86efac"), AvatarSwatch("slate", "#64748b"),
    )

    /** The swatch ids, in order. */
    val COLORS: List<String> = SWATCHES.map { it.id }

    const val DISPLAY_MASCOT = "mascot"
    const val DISPLAY_PHOTO = "photo"
    val DISPLAYS: List<String> = listOf(DISPLAY_MASCOT, DISPLAY_PHOTO)

    /** Pro-only options per field (free players see the gold PRO pill → the Go Pro popup). */
    val PRO_ONLY: Map<String, Set<String>> = mapOf(
        "head" to setOf("crown", "halo", "tiara"),
        "neck" to setOf("wings", "chain"),
        "frame" to setOf("diamond", "pro"),
        "bg" to setOf("aurora", "galaxy"),
    )

    /** Whether [id] in config field [field] ("head", "neck", "frame", "bg") is Pro only. */
    fun isProOnly(field: String, id: String?): Boolean = id != null && PRO_ONLY[field]?.contains(id) == true

    /** The friendly subsets the deterministic default picks from (never the odd ones). */
    internal val DEFAULT_EYES: List<String> = listOf("beady", "happy", "sparkly", "wink")
    internal val DEFAULT_MOUTHS: List<String> = listOf("smile", "grin", "tiny", "cat")
    internal val DEFAULT_BODIES: List<String> = listOf("classic", "tall", "wide", "blob", "bean")
}

/** "#rrggbb" → [r, g, b], null unless exactly six hex digits (after removing the first "#" and trimming). */
private fun hexRgb(hex: String): IntArray? {
    val h = hex.replaceFirst("#", "").trim()
    if (h.length != 6 || h.any { it !in '0'..'9' && it !in 'a'..'f' && it !in 'A'..'F' }) return null
    return intArrayOf(h.substring(0, 2).toInt(16), h.substring(2, 4).toInt(16), h.substring(4, 6).toInt(16))
}

/** The swatch id nearest an accent hex (squared RGB distance; ties → the earlier swatch). Unknown → "purple". */
fun nearestAvatarColor(accentHex: String?): String {
    val a = accentHex?.takeIf { it.isNotEmpty() }?.let { hexRgb(it) } ?: return "purple"
    var best = AvatarOptions.SWATCHES[0].id
    var bestD = Long.MAX_VALUE
    for (c in AvatarOptions.SWATCHES) {
        val b = hexRgb(c.hex)!!
        val d = (a[0] - b[0]).toLong().let { it * it } + (a[1] - b[1]).toLong().let { it * it } + (a[2] - b[2]).toLong().let { it * it }
        if (d < bestD) { bestD = d; best = c.id }
    }
    return best
}

/** The default `display` for a player: their photo when they have one, else the mascot. */
fun defaultAvatarDisplay(hasPhoto: Boolean): String =
    if (hasPhoto) AvatarOptions.DISPLAY_PHOTO else AvatarOptions.DISPLAY_MASCOT

/**
 * The deterministic friendly default for a player without a saved mascot: body /
 * eyes / mouth seeded by FNV-1a(userId) (bits 0–7, 8–15, 16–23 picking from the
 * friendly subsets), the accent's nearest swatch, solid, no nose, no accessory, no
 * frame, the auto backdrop; [hasPhoto] picks the default display.
 */
fun defaultAvatar(userId: String?, accentHex: String? = null, hasPhoto: Boolean = false): AvatarConfig {
    val h = ShareCaptions.captionHash(userId?.takeIf { it.isNotEmpty() } ?: "guest")
    val color = nearestAvatarColor(accentHex)
    return AvatarConfig(
        v = 1,
        body = AvatarOptions.DEFAULT_BODIES[((h and 0xFF) % AvatarOptions.DEFAULT_BODIES.size).toInt()],
        color = color,
        pattern = "solid",
        patternColor = color,
        eyes = AvatarOptions.DEFAULT_EYES[(((h ushr 8) and 0xFF) % AvatarOptions.DEFAULT_EYES.size).toInt()],
        nose = "none",
        mouth = AvatarOptions.DEFAULT_MOUTHS[(((h ushr 16) and 0xFF) % AvatarOptions.DEFAULT_MOUTHS.size).toInt()],
        head = "none",
        face = "none",
        neck = "none",
        frame = "none",
        bg = "auto",
        display = defaultAvatarDisplay(hasPhoto),
    )
}

/** A JSON string value (TS `typeof v === 'string'`), else null. */
private fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun pick(value: String?, allowed: List<String>, fallback: String): String =
    if (value != null && value in allowed) value else fallback

/** True when a row carries a stored config (a JSON object) — absent / null → the player's default. */
fun isStoredAvatar(raw: JsonElement?): Boolean = raw is JsonObject

/**
 * A stored / incoming config made safe: every unknown or missing field falls back to
 * [fallback] (default: `defaultAvatar("")`). Non-objects → the fallback.
 */
fun validateAvatar(raw: JsonElement?, fallback: AvatarConfig = defaultAvatar("")): AvatarConfig {
    val r = raw as? JsonObject ?: return fallback.copy()
    val colorIds = AvatarOptions.COLORS
    val color = r.string("color")?.takeIf { it in colorIds } ?: fallback.color
    val patternColor = r.string("patternColor")?.takeIf { it in colorIds } ?: color
    return AvatarConfig(
        v = 1,
        body = pick(r.string("body"), AvatarOptions.BODIES, fallback.body),
        color = color,
        pattern = pick(r.string("pattern"), AvatarOptions.PATTERNS, fallback.pattern),
        patternColor = patternColor,
        eyes = pick(r.string("eyes"), AvatarOptions.EYES, fallback.eyes),
        nose = pick(r.string("nose"), AvatarOptions.NOSES, fallback.nose),
        mouth = pick(r.string("mouth"), AvatarOptions.MOUTHS, fallback.mouth),
        head = pick(r.string("head"), AvatarOptions.HEADS, fallback.head),
        face = pick(r.string("face"), AvatarOptions.FACES, fallback.face),
        neck = pick(r.string("neck"), AvatarOptions.NECKS, fallback.neck),
        frame = pick(r.string("frame"), AvatarOptions.FRAMES, fallback.frame),
        bg = r.string("bg")?.takeIf { it in AvatarOptions.BACKDROP_IDS } ?: fallback.bg,
        display = pick(r.string("display"), AvatarOptions.DISPLAYS, fallback.display),
    )
}

/** Validate an already-typed config (e.g. the builder's state) the same way. */
fun validateAvatar(config: AvatarConfig, fallback: AvatarConfig = defaultAvatar("")): AvatarConfig =
    validateAvatar(avatarToJson(config), fallback)

/** Strip Pro-only picks for a free player (crown/halo/tiara → none, wings/chain → none, Pro frames → none, Pro backdrops → auto). */
fun enforceAvatarPro(c: AvatarConfig, isPro: Boolean): AvatarConfig {
    if (isPro) return c
    return c.copy(
        head = if (AvatarOptions.isProOnly("head", c.head)) "none" else c.head,
        neck = if (AvatarOptions.isProOnly("neck", c.neck)) "none" else c.neck,
        frame = if (AvatarOptions.isProOnly("frame", c.frame)) "none" else c.frame,
        bg = if (AvatarOptions.isProOnly("bg", c.bg)) "auto" else c.bg,
    )
}

/** Color swatch hex for a swatch id (unknown → purple). */
fun avatarColorHex(id: String?): String = AvatarOptions.SWATCHES.firstOrNull { it.id == id }?.hex ?: "#7c3aed"

/** A backdrop by id, or null ("auto" / unknown). */
fun avatarBackdrop(id: String?): AvatarBackdrop? = AvatarOptions.BACKDROPS.firstOrNull { it.id == id }

/**
 * The ten cast presets ("Start from W" …): the classic body in the character's
 * bot-cast color (nearest swatch), beady eyes + smile, solid, no accessory.
 */
fun castPreset(castId: String?): AvatarConfig {
    val member = BotCast.MEMBERS.firstOrNull { it.castId == castId }
    val color = nearestAvatarColor(member?.let { "#%06x".format(it.color and 0xFFFFFF) })
    return AvatarConfig(
        v = 1, body = "classic", color = color, pattern = "solid", patternColor = color, eyes = "beady",
        nose = "none", mouth = "smile", head = "none", face = "none", neck = "none", frame = "none", bg = "auto",
    )
}

/** The stored jsonb shape. */
fun avatarToJson(c: AvatarConfig): JsonObject = buildJsonObject {
    put("v", c.v)
    put("body", c.body)
    put("color", c.color)
    put("pattern", c.pattern)
    put("patternColor", c.patternColor)
    put("eyes", c.eyes)
    put("nose", c.nose)
    put("mouth", c.mouth)
    put("head", c.head)
    put("face", c.face)
    put("neck", c.neck)
    put("frame", c.frame)
    put("bg", c.bg)
    put("display", c.display)
}

/** AN2 presets by cast id ("w", "o1", …, WORDOCIOUS order). AH's stored avatar_cast_id maps to its preset. */
object AvatarPresets {
    val IDS: List<String> = listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s")

    fun forCast(castId: String?): AvatarConfig? {
        val id = castId?.trim()?.lowercase()?.takeIf { it in IDS } ?: return null
        return castPreset(id)
    }
}
