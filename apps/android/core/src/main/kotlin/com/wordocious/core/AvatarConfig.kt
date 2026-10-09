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

/**
 * One color swatch: the stored id + the flat tint hex, its picker row, and (Pro specials) gradient `stops`
 * multiplied onto the white art (`dir` h = left→right, v = top→bottom, d = diagonal).
 */
data class AvatarSwatch(
    val id: String,
    val hex: String,
    val group: String = "bright",
    val pro: Boolean = false,
    val stops: List<String> = emptyList(),
    val dir: String = "v",
)

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
    /** Round 2: blush / freckles moved here from [nose] (old configs migrate in validateAvatar). */
    val cheeks: String = "none",
    val mouth: String = "smile",
    val head: String = "none",
    val face: String = "none",
    val neck: String = "none",
    /** 10-05 integrated parts (docs/design/brand/avatar/INTEGRATION.md); missing in older configs = "none". */
    val held: String = "none",
    val wrap: String = "none",
    val feet: String = "none",
    val pet: String = "none",
    val brows: String = "none",
    val extra: String = "none",
    /** The tint for white accessories (AvatarOptions.TINTABLE): a swatch id, or "default". */
    val accColor: String = "default",
    val frame: String = "none",
    /** A backdrop id (AvatarOptions.BACKDROP_IDS); "auto" = a light tint of the body color. */
    val bg: String = "auto",
    /** "mascot" | "photo": which one the avatar shows (a photo display needs a photo URL). */
    val display: String = AvatarOptions.DISPLAY_MASCOT,
    /**
     * 10-06 poses (AvatarPose.kt, the Dressing Room's Pose tab): a pose id from AvatarPoses.IDS. Missing = "none"
     * (written only when set). Drawn only while AvatarLiveConfig.LIVING_MASCOT is on.
     */
    val pose: String = "none",
)

object AvatarOptions {
    // Round 2 (founder 10-03): ~2× every category, CHEEKS, 33 colors + 5 Pro specials, 14 patterns, accColor.
    val BODIES: List<String> = listOf("classic", "tall", "wide", "blob", "bean", "star", "drop", "pear", "cloud", "chunky", "mini", "hex",
        // item 50 (2.8): the new shapes; pumpkin / ghost / bat / cone are the Halloween bodies (manifest bodies.<id>.season)
        "heart", "moon", "egg", "bell", "triangle", "diamond", "shield", "burst", "flower", "gumdrop", "can", "potato", "catear", "bunnyear", "pumpkin", "ghost", "cone", "bat")
    /** The bodies added in 2.8: the maker's Body tab tags them NEW. */
    val NEW_BODIES: Set<String> = setOf("heart", "moon", "egg", "bell", "triangle", "diamond", "shield", "burst", "flower", "gumdrop", "can", "potato", "catear", "bunnyear", "pumpkin", "ghost", "cone", "bat")
    val PATTERNS: List<String> = listOf(
        "solid", "twotone", "stripes", "dots", "gradient", "sparkle",
        "hearts", "stars", "zigzag", "checkers", "tiedye", "leopard", "galaxy", "colorblock",
    )
    val EYES: List<String> = listOf(
        "beady", "happy", "sparkly", "sleepy", "wink", "hearts", "stars", "glasses", "cyclops",
        "sunglasses", "determined", "anime", "joy", "droopy", "biground", "sideglance", "dizzy",
    )
    val MOUTHS: List<String> = listOf(
        "smile", "grin", "tongue", "o", "cat", "toothy", "smirk", "tiny", "gasp",
        "laugh", "whistle", "fang", "kissy", "braces", "oops", "tongueside", "teeth",
    )
    val NOSES: List<String> = listOf("none", "button", "red", "pointy", "bignose", "cat", "piggy", "clownstar")
    val CHEEKS: List<String> = listOf("none", "blush", "freckles", "hearts", "starfreckles", "sparkle", "bandage")

    /** Hats (21 + round 2: 12, + none). Pro-only: crown, halo, tiara. */
    val HEADS: List<String> = listOf(
        "none", "crown", "party", "beanie", "sprout", "nightcap", "headphones", "emo-pink-headphones", "bow", "wizard", "pirate", "cowboy", "chef",
        "grad", "halo", "flower", "tophat", "propeller", "catears", "bunnyears", "tiara", "viking", "sweatband", 
        "cap", "baseball-cap", "baseball-batting-helmet", "football-helmet", "punk-studded-cap", "beret", "minicrown", "flowercrown", "bucket", "santa", "witch", "astronaut", "bigbow", "goth-skull-bow", "goth-bat-wing-clip", "pombeanie", "bearears", "mohawk", "punk-mohawk", "punk-liberty-spikes",
        // seasonal (avatar-parts.json `season`; AvatarSeason decides when they show): Halloween 10-05
        "pumpkinhat", "candycornhat", "witchnight", "batears",
    )

    /** Face extras. */
    val FACES: List<String> = listOf("none", "mustache", "heart-glasses", "punk-heart-shades", "emo-star-shades", "monocle", "starglasses", "goth-bat-sunglasses", "roundglasses", "eyepatch", "facepaint", "mask", "curlymustache")

    /** Neck / back extras. Pro-only: wings, chain. */
    val NECKS: List<String> = listOf("none", "cape", "wings", "bowtie", "scarf", "chain", "medal", "goth-moon-pendant", "backpack", "bubbletea", "guitar", "supercape", "fairywings", "batwings", "cattail")

    /** White glossy accessories that take the accessory color. */
    val TINTABLE: List<String> = listOf("supercape", "backpack", "wings", "chef", "astronaut")

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

    /** The swatches in rows: the original 16 first (stable; the seeded default only picks from them), then round 2. */
    val SWATCHES: List<AvatarSwatch> = listOf(
        AvatarSwatch("purple", "#7c3aed"), AvatarSwatch("violet", "#8b5cf6"), AvatarSwatch("pink", "#ec4899"), AvatarSwatch("red", "#ef4444"),
        AvatarSwatch("orange", "#f97316"), AvatarSwatch("amber", "#f5a524"), AvatarSwatch("yellow", "#eab308"), AvatarSwatch("green", "#22c55e"),
        AvatarSwatch("emerald", "#10b981"), AvatarSwatch("teal", "#0d9488"), AvatarSwatch("sky", "#0ea5e9"), AvatarSwatch("blue", "#2563eb"),
        AvatarSwatch("lilac", "#c4b5fd", "pastel"), AvatarSwatch("peach", "#fdba74", "pastel"), AvatarSwatch("mint", "#86efac", "pastel"), AvatarSwatch("slate", "#64748b", "neutral"),
        AvatarSwatch("rose", "#fb7185"), AvatarSwatch("lime", "#84cc16"),
        AvatarSwatch("bubblegum", "#f9a8d4", "pastel"), AvatarSwatch("babyblue", "#93c5fd", "pastel"), AvatarSwatch("butter", "#fde68a", "pastel"),
        AvatarSwatch("coral", "#fca5a5", "pastel"), AvatarSwatch("seafoam", "#99f6e4", "pastel"),
        AvatarSwatch("navy", "#1e3a8a", "deep"), AvatarSwatch("plum", "#6b21a8", "deep"), AvatarSwatch("forest", "#166534", "deep"),
        AvatarSwatch("maroon", "#881337", "deep"), AvatarSwatch("charcoal", "#374151", "deep"), AvatarSwatch("chocolate", "#78350f", "deep"),
        AvatarSwatch("white", "#f8fafc", "neutral"), AvatarSwatch("cream", "#fef3c7", "neutral"), AvatarSwatch("sand", "#d6c7a1", "neutral"), AvatarSwatch("stone", "#a8a29e", "neutral"),
        AvatarSwatch("gold", "#f5b82e", "special", true, listOf("#fff1b8", "#f5b82e", "#b7791f"), "v"),
        AvatarSwatch("silver", "#cbd5e1", "special", true, listOf("#ffffff", "#cbd5e1", "#7c8798"), "v"),
        AvatarSwatch("rainbow", "#a855f7", "special", true, listOf("#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#8b5cf6"), "h"),
        AvatarSwatch("holo", "#c4b5fd", "special", true, listOf("#f9a8d4", "#c4b5fd", "#99f6e4", "#fde68a", "#f9a8d4"), "d"),
        AvatarSwatch("neon", "#39ff14", "special", true, listOf("#d9ff6b", "#39ff14", "#00e5a0"), "d"),
    )
    val COLOR_GROUPS: List<String> = listOf("bright", "pastel", "deep", "neutral", "special")

    /** A swatch by id (unknown → purple). */
    fun swatch(id: String?): AvatarSwatch = SWATCHES.firstOrNull { it.id == id } ?: SWATCHES[0]

    /** The swatch ids, in order. */
    val COLORS: List<String> = SWATCHES.map { it.id }

    const val DISPLAY_MASCOT = "mascot"
    const val DISPLAY_PHOTO = "photo"
    val DISPLAYS: List<String> = listOf(DISPLAY_MASCOT, DISPLAY_PHOTO)

    /** 10-05 integrated parts (packages/core AVATAR_HELD …): drawn per body, never bolted on. */
    val HELD: List<String> = listOf("none", "mug", "book", "pencil-big", "balloon", "emo-heart-balloons", "trophy", "baseball-bat", "baseball-glove", "football-football", "soccer-corner-flag", "magnifier", "flashlight", "umbrella", "goth-lace-umbrella", "goth-purple-lantern", "icecream", "spatula", "mic", "wand-star", "candypail")
    /** Body wraps (the necktie and sash were dropped 10-05: no room for a tie blade; the sash read as a stripe across the letter). */
    val WRAPS: List<String> = listOf("none", "bandana", "belt", "apron", "lei", "cape-drape", "vampirecollar")
    val FEET: List<String> = listOf("none", "sneakers", "baseball-cleats", "soccer-cleats", "emo-checker-high-tops", "boots", "punk-combat-boots", "goth-platform-boots", "slippers", "skates", "hockey-skates")
    val PETS: List<String> = listOf("none", "bird", "kitten", "puppy", "snail", "bat", "ghost", "blackcat", "goth-black-cat-plush", "punk-skull-plush", "football-kicking-tee", "soccer-ball", "hockey-puck")
    val BROWS: List<String> = listOf("none", "happy", "worried", "determined", "surprised", "cheeky", "sleepy")
    val EXTRAS: List<String> = listOf("none", "sweat", "tear", "steam", "heart")
    /** The integrated config fields + their options, in the maker's tab order. */
    val INTEGRATED: List<Pair<String, List<String>>> = listOf("held" to HELD, "wrap" to WRAPS, "feet" to FEET, "pet" to PETS, "brows" to BROWS, "extra" to EXTRAS)
    /** Parts that carry the maker's NEW tag (the 10-05 additions + the 7 rebuilt parts; brows as "brows:<id>"). */
    // the 10-05 integrated additions only (seasonal parts carry their season tag instead)
    val NEW_PARTS: Set<String> = (HELD.take(13).drop(1) + WRAPS.take(6).drop(1) + FEET.drop(1) + PETS.take(5).drop(1) + BROWS.drop(1).map { "brows:$it" } + EXTRAS.drop(1) +
        listOf("backpack", "scarf", "chain", "bubbletea", "guitar", "cape", "supercape")).toSet()
    /** One-tap looks (packages/core AVATAR_BUNDLES): field → id picks, applied with AvatarFit.applyPick. */
    data class Bundle(val id: String, val label: String, val pro: Boolean, val picks: List<Pair<String, String>>)
    val BUNDLES: List<Bundle> = listOf(
        Bundle("bookworm", "Bookworm", false, listOf("held" to "book", "face" to "roundglasses", "brows" to "happy")),
        Bundle("athlete", "Athlete", false, listOf("held" to "trophy", "head" to "sweatband", "feet" to "sneakers", "wrap" to "belt")),
        Bundle("chef", "Chef", false, listOf("held" to "spatula", "wrap" to "apron", "head" to "chef")),
        Bundle("explorer", "Explorer", false, listOf("neck" to "backpack", "held" to "magnifier", "head" to "bucket")),
        Bundle("rockstar", "Rock star", true, listOf("held" to "mic", "face" to "starglasses", "neck" to "chain")),
        Bundle("rainyday", "Rainy day", false, listOf("held" to "umbrella", "feet" to "boots")),
        Bundle("magic", "Magic", true, listOf("held" to "wand-star", "wrap" to "cape-drape", "head" to "wizard")),
        Bundle("summer", "Summer", false, listOf("held" to "icecream", "wrap" to "lei")),
    )

    /** Pro-only options per field (free players see the gold PRO pill → the Go Pro popup). */
    val PRO_ONLY: Map<String, Set<String>> = mapOf(
        "body" to setOf("moon", "bell", "triangle", "diamond", "shield", "burst", "flower", "catear", "bunnyear", "potato"),
        "head" to setOf("crown", "halo", "tiara"),
        "neck" to setOf("wings", "chain"),
        "held" to setOf("wand-star"),
        "wrap" to setOf("cape-drape"),
        "frame" to setOf("diamond", "pro"),
        "bg" to setOf("aurora", "galaxy"),
        "color" to setOf("gold", "silver", "rainbow", "holo", "neon"),
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
    for (c in AvatarOptions.SWATCHES.take(16)) {
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
        cheeks = "none",
        mouth = AvatarOptions.DEFAULT_MOUTHS[(((h ushr 16) and 0xFF) % AvatarOptions.DEFAULT_MOUTHS.size).toInt()],
        head = "none",
        face = "none",
        neck = "none",
        accColor = "default",
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
    // Round 2: blush / freckles were noses; a config without `cheeks` carries them over (nose → none).
    val rawNose = r.string("nose")
    val legacyCheeks = if (!r.containsKey("cheeks") && (rawNose == "blush" || rawNose == "freckles")) rawNose else null
    return AvatarConfig(
        v = 1,
        body = pick(r.string("body"), AvatarOptions.BODIES, fallback.body),
        color = color,
        pattern = pick(r.string("pattern"), AvatarOptions.PATTERNS, fallback.pattern),
        patternColor = patternColor,
        // founder 10-05: None on any body part — eyes / mouth may be "none" (draws nothing)
        eyes = if (r.string("eyes") == "none") "none" else pick(r.string("eyes"), AvatarOptions.EYES, fallback.eyes),
        nose = if (legacyCheeks != null) "none" else pick(r.string("nose"), AvatarOptions.NOSES, fallback.nose),
        cheeks = legacyCheeks ?: pick(r.string("cheeks"), AvatarOptions.CHEEKS, fallback.cheeks),
        mouth = if (r.string("mouth") == "none") "none" else pick(r.string("mouth"), AvatarOptions.MOUTHS, fallback.mouth),
        head = pick(r.string("head"), AvatarOptions.HEADS, fallback.head),
        face = pick(r.string("face"), AvatarOptions.FACES, fallback.face),
        neck = pick(r.string("neck"), AvatarOptions.NECKS, fallback.neck),
        held = pick(r.string("held"), AvatarOptions.HELD, fallback.held),
        wrap = pick(r.string("wrap"), AvatarOptions.WRAPS, fallback.wrap),
        feet = pick(r.string("feet"), AvatarOptions.FEET, fallback.feet),
        pet = pick(r.string("pet"), AvatarOptions.PETS, fallback.pet),
        brows = pick(r.string("brows"), AvatarOptions.BROWS, fallback.brows),
        extra = pick(r.string("extra"), AvatarOptions.EXTRAS, fallback.extra),
        // the saved pose: a known pose id (else the fallback's); written only when not "none"
        pose = pick(r.string("pose"), AvatarPoses.IDS, fallback.pose),
        accColor = r.string("accColor")?.takeIf { it == "default" || it in colorIds } ?: fallback.accColor,
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
        body = if (AvatarOptions.isProOnly("body", c.body)) "classic" else c.body,
        head = if (AvatarOptions.isProOnly("head", c.head)) "none" else c.head,
        neck = if (AvatarOptions.isProOnly("neck", c.neck)) "none" else c.neck,
        held = if (AvatarOptions.isProOnly("held", c.held)) "none" else c.held,
        wrap = if (AvatarOptions.isProOnly("wrap", c.wrap)) "none" else c.wrap,
        frame = if (AvatarOptions.isProOnly("frame", c.frame)) "none" else c.frame,
        bg = if (AvatarOptions.isProOnly("bg", c.bg)) "auto" else c.bg,
        color = if (AvatarOptions.isProOnly("color", c.color)) "purple" else c.color,
        patternColor = if (AvatarOptions.isProOnly("color", c.patternColor)) (if (AvatarOptions.isProOnly("color", c.color)) "purple" else c.color) else c.patternColor,
        accColor = if (AvatarOptions.isProOnly("color", c.accColor)) "default" else c.accColor,
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
        nose = "none", cheeks = "none", mouth = "smile", head = "none", face = "none", neck = "none", accColor = "default",
        frame = "none", bg = "auto",
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
    put("cheeks", c.cheeks)
    put("mouth", c.mouth)
    put("head", c.head)
    put("face", c.face)
    put("neck", c.neck)
    // 10-05 integrated parts: only the worn ones are written (missing = "none"), like packages/core validateAvatar
    for ((k, v) in listOf("held" to c.held, "wrap" to c.wrap, "feet" to c.feet, "pet" to c.pet, "brows" to c.brows, "extra" to c.extra)) {
        if (v != "none") put(k, v)
    }
    // 10-06 the saved pose: only when set (older configs stay byte-identical)
    if (c.pose != "none") put("pose", c.pose)
    put("accColor", c.accColor)
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

// ---------------------------------------------------------------------------
// FINISH_SPEC BJ5 (founder 10-03: "I updated my profile pic and it isn't
// populating"): ONE avatar resolver, the same precedence on every surface of
// every platform (boards, podiums, Friends, VS, profiles, records, shares):
//   1. the player's custom photo when display = "photo";
//   2. else their saved mascot (avatar_config);
//   3. else the cast hero they wear (avatar_cast_id) as its preset;
//   4. else the deterministic seeded mascot (defaultAvatar by username).
// avatar_frame fills a config without its own frame. A photo is "custom" when the
// player chose it: uploaded to our avatars bucket, or explicitly picked (a saved
// config with display = "photo"). An OAuth provider picture with no saved choice is
// never drawn — the player gets their mascot, so no avatar is ever a plain letter tile.
// 1:1 port of packages/core/src/avatar-config.ts; pinned by avatar-resolve-fixtures.json.

/** The ten cast heroes a player can wear (avatar_cast_id), WORDOCIOUS order. */
val AVATAR_CAST_IDS: List<String> = listOf("w", "o1", "r", "d", "o2", "c", "i", "o3", "u", "s")

/** True for a photo the player uploaded (the public `avatars` storage bucket). */
fun isCustomPhotoUrl(url: String?): Boolean = url != null && url.contains("/storage/v1/object/public/avatars/")

/** Everything a row may carry about a player's look (any field may be missing). */
data class AvatarSource(
    val username: String? = null,
    val avatarUrl: String? = null,
    /** profiles.avatar_config, any shape (validated). */
    val config: JsonElement? = null,
    /** profiles.avatar_cast_id. */
    val castId: String? = null,
    /** profiles.avatar_frame. */
    val frame: String? = null,
    /** profiles.accent_color → the seeded mascot's color. */
    val accentHex: String? = null,
)

/** Which rung of the precedence won. */
enum class AvatarSourceKind(val id: String) { PHOTO("photo"), CONFIG("config"), CAST("cast"), SEEDED("seeded") }

data class ResolvedAvatar(
    val kind: AvatarSourceKind,
    /** The photo to draw (kind PHOTO only), else null. */
    val photoUrl: String?,
    /** The mascot (drawn when photoUrl is null; its frame rings the photo otherwise). */
    val config: AvatarConfig,
)

private fun knownAvatarFrame(v: String?): String? {
    val k = v?.trim()?.lowercase() ?: return null
    return if (k != "none" && k in AvatarOptions.FRAMES) k else null
}

private fun knownAvatarCast(v: String?): String? {
    val k = v?.trim()?.lowercase() ?: return null
    return if (k in AVATAR_CAST_IDS) k else null
}

/** BJ5: the one avatar precedence (see above). Pure; pinned by avatar-resolve-fixtures.json. */
fun resolveAvatar(src: AvatarSource): ResolvedAvatar {
    val seed = (src.username ?: "").trim().lowercase()
    val accent = src.accentHex
    val url = src.avatarUrl?.trim()?.takeIf { it.isNotEmpty() }
    val custom = url != null && isCustomPhotoUrl(url)
    val frame = knownAvatarFrame(src.frame)
    val cast = knownAvatarCast(src.castId)
    fun framed(c: AvatarConfig): AvatarConfig = if (c.frame == "none" && frame != null) c.copy(frame = frame) else c
    val raw = src.config
    if (raw is JsonObject && raw.isNotEmpty()) {
        val saved = framed(validateAvatar(raw, defaultAvatar(seed, accent, custom)))
        if (url != null && saved.display == AvatarOptions.DISPLAY_PHOTO) return ResolvedAvatar(AvatarSourceKind.PHOTO, url, saved)
        return ResolvedAvatar(AvatarSourceKind.CONFIG, null, saved)
    }
    if (custom) {
        val base = if (cast != null) castPreset(cast) else defaultAvatar(seed, accent, true)
        return ResolvedAvatar(AvatarSourceKind.PHOTO, url, framed(base.copy(display = AvatarOptions.DISPLAY_PHOTO)))
    }
    if (cast != null) return ResolvedAvatar(AvatarSourceKind.CAST, null, framed(castPreset(cast)))
    return ResolvedAvatar(AvatarSourceKind.SEEDED, null, framed(defaultAvatar(seed, accent, false)))
}
