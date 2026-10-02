package com.wordocious.app.ui

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarOptions
import com.wordocious.core.AvatarPresets
import kotlin.random.Random

// FINISH_SPEC AN — the mascot avatar's public API on Android:
//  • MascotAvatar(config, initial, size, modifier, pro) — the one renderer (AN1/AN5), any
//    size 16–200 dp, cached composed bitmaps (MascotComposer + MascotKey LRU).
//  • AvatarParts — the option catalog per builder category (labels, Pro-only flags, the
//    `art_av_*` drawable lookups, presets, randomize) for the Edit Profile builder (AN4).
//  • PhotoAvatar / AvatarSquareFrame / avatarTileShape — AN6 rounded-square photos with
//    the same frame language.

/** AN6: the avatar tile / photo shape — a rounded square, radius ≈ 22%. */
fun avatarTileShape(size: Dp): Shape = RoundedCornerShape(size * 0.22f)

/**
 * AN1/AN5 — the player's mascot with their [initial] as the white body letter, [size]
 * square (16–200 dp; ≤ 28 dp drops the pattern + every accessory except hats). [pro]
 * adds the AA2 crown and, when no frame is chosen, the Pro gold frame. Decorative: the
 * caller's row carries the name.
 */
@Composable
fun MascotAvatar(
    config: AvatarConfig,
    initial: String,
    size: Dp,
    modifier: Modifier = Modifier,
    pro: Boolean = false,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val dark = WTheme.isDark
    val px = with(density) { size.roundToPx() }.coerceAtLeast(1)
    val drawn = if (pro && config.frame == "none") config.copy(frame = "pro") else config
    val key = remember(drawn, initial, px, dark, size) { MascotKey.of(drawn, initial, size.value, px, dark) }
    val image = remember(key) { MascotComposer.image(context, key) }
    Box(modifier.size(size)) {
        Image(
            image, contentDescription = null, contentScale = ContentScale.Fit, filterQuality = FilterQuality.High,
            modifier = Modifier.fillMaxSize().clearAndSetSemantics { },
        )
        if (pro) ProAvatarCrown(size)
    }
}

/** AN6: the rounded-square frame (none, bronze … diamond, "pro") filling a [size] box. Decorative. */
@Composable
fun AvatarSquareFrame(frame: String, size: Dp, modifier: Modifier = Modifier) {
    if (MascotComposer.frameColors(frame) == null) return
    Canvas(modifier.size(size).clearAndSetSemantics { }) {
        drawIntoCanvas { MascotComposer.drawFrame(it.nativeCanvas, frame, this.size.minDimension) }
    }
}

/** The frame's stroke width on a [size] avatar (the photo / face is inset by it). */
fun avatarSquareFrameWidth(size: Dp): Dp = (size * 0.07f).coerceAtLeast(1.dp)

/**
 * AN6 — an uploaded photo as a rounded SQUARE (never a circle), with the player's
 * [frame] (bronze … diamond, "pro") as a rounded-square frame and, for [pro], the AA2
 * crown (+ the Pro gold frame when no frame is chosen).
 */
@Composable
fun PhotoAvatar(
    url: String,
    size: Dp,
    modifier: Modifier = Modifier,
    frame: String? = null,
    pro: Boolean = false,
    contentDescription: String? = null,
) {
    val drawn = frame?.takeIf { MascotComposer.frameColors(it) != null } ?: if (pro) "pro" else null
    Box(modifier.size(size)) {
        val inset = if (drawn != null) avatarSquareFrameWidth(size) * 0.85f else 0.dp
        val inner = size - inset * 2
        coil.compose.AsyncImage(
            model = url, contentDescription = contentDescription,
            modifier = Modifier.align(Alignment.Center).size(inner).clip(avatarTileShape(inner)),
            contentScale = ContentScale.Crop,
        )
        if (drawn != null) AvatarSquareFrame(drawn, size, Modifier.fillMaxSize())
        if (pro) ProAvatarCrown(size)
    }
}

// ── AN2/AN4 the option catalog ─────────────────────────────────────────────

/** The builder's category tabs (AN4 + addendum Backdrop), in order. */
enum class AvatarCategory(val label: String) {
    BODY("Body"), COLOR("Color"), PATTERN("Pattern"), EYES("Eyes"), NOSE("Nose"),
    MOUTH("Mouth"), HATS("Hats"), EXTRAS("Extras"), BACKDROP("Backdrop"), FRAME("Frame"),
}

/**
 * One pickable option. [id] is the stored id; null = "None" (Hats / Extras / Frame →
 * stored "none"). [colorHex] = the swatch's tint (Color) or the backdrop's first color.
 */
data class AvatarOption(
    val category: AvatarCategory,
    val id: String?,
    val label: String,
    val pro: Boolean = false,
    val colorHex: String? = null,
)

object AvatarParts {
    val categories: List<AvatarCategory> = AvatarCategory.entries

    private val LABELS: Map<String, String> = mapOf(
        // bodies
        "classic" to "Classic", "tall" to "Tall", "wide" to "Wide", "blob" to "Blob", "bean" to "Bean", "star" to "Star",
        // patterns
        "solid" to "Solid", "twotone" to "Two-tone", "stripes" to "Stripes", "dots" to "Polka dots",
        "gradient" to "Gradient", "sparkle" to "Sparkle",
        // eyes
        "beady" to "Beady", "happy" to "Happy", "sparkly" to "Sparkly", "sleepy" to "Sleepy", "wink" to "Wink",
        "hearts" to "Hearts", "stars" to "Stars", "glasses" to "Round glasses", "cyclops" to "Cyclops",
        // nose / cheeks
        "button" to "Button nose", "red" to "Red nose", "blush" to "Blush", "freckles" to "Freckles",
        // mouths
        "smile" to "Smile", "grin" to "Big grin", "tongue" to "Tongue out", "o" to "Little o", "cat" to "Cat",
        "toothy" to "Toothy grin", "smirk" to "Smirk", "tiny" to "Tiny smile", "gasp" to "Gasp",
        // hats
        "crown" to "Crown", "party" to "Party hat", "beanie" to "Beanie", "sprout" to "Sprout", "nightcap" to "Nightcap",
        "headphones" to "Headphones", "bow" to "Bow", "wizard" to "Wizard hat", "pirate" to "Pirate hat",
        "cowboy" to "Cowboy hat", "chef" to "Chef hat", "grad" to "Grad cap", "halo" to "Halo", "flower" to "Flower",
        "tophat" to "Top hat", "propeller" to "Propeller cap", "catears" to "Cat ears", "bunnyears" to "Bunny ears",
        "tiara" to "Tiara", "viking" to "Viking helmet", "sweatband" to "Sweatband",
        // extras
        "mustache" to "Mustache", "heart-glasses" to "Heart shades", "monocle" to "Monocle",
        "cape" to "Cape", "wings" to "Wings", "bowtie" to "Bow tie", "scarf" to "Scarf", "chain" to "Gold chain",
        // backdrops
        "auto" to "Auto", "lilac" to "Lilac", "bubblegum" to "Bubblegum", "sky" to "Sky", "mint" to "Mint",
        "lemon" to "Lemon", "peach" to "Peach", "cloud" to "Cloud", "night" to "Night", "sunset" to "Sunset",
        "ocean" to "Ocean", "cottoncandy" to "Cotton candy", "aurora" to "Aurora", "galaxy" to "Galaxy",
        "polka" to "Polka", "starry" to "Starry", "sunburst" to "Sunburst", "checkers" to "Checkers", "confetti" to "Confetti",
        // frames
        "bronze" to "Bronze", "silver" to "Silver", "gold" to "Gold", "platinum" to "Platinum",
        "diamond" to "Diamond", "pro" to "Pro gold",
    )

    private fun labelOf(id: String): String = LABELS[id] ?: id.replace('-', ' ').replaceFirstChar { it.uppercase() }

    /** Color swatch label ("Purple"). */
    private fun colorLabel(id: String): String = id.replaceFirstChar { it.uppercase() }

    private fun none(category: AvatarCategory) = AvatarOption(category, null, "None")

    /** Every option in [category], in display order. */
    fun options(category: AvatarCategory): List<AvatarOption> = when (category) {
        AvatarCategory.BODY -> AvatarOptions.BODIES.map { AvatarOption(category, it, labelOf(it)) }
        AvatarCategory.COLOR -> AvatarOptions.SWATCHES.map { AvatarOption(category, it.id, colorLabel(it.id), colorHex = it.hex) }
        AvatarCategory.PATTERN -> AvatarOptions.PATTERNS.map { AvatarOption(category, it, labelOf(it)) }
        AvatarCategory.EYES -> AvatarOptions.EYES.map { AvatarOption(category, it, labelOf(it)) }
        AvatarCategory.NOSE -> AvatarOptions.NOSES.map { AvatarOption(category, it, if (it == "none") "None" else labelOf(it)) }
        AvatarCategory.MOUTH -> AvatarOptions.MOUTHS.map { AvatarOption(category, it, labelOf(it)) }
        AvatarCategory.HATS -> listOf(none(category)) + AvatarOptions.HEADS.filter { it != "none" }
            .map { AvatarOption(category, it, labelOf(it), pro = AvatarOptions.isProOnly("head", it)) }
        AvatarCategory.EXTRAS -> listOf(none(category)) +
            AvatarOptions.FACES.filter { it != "none" }.map { AvatarOption(category, it, labelOf(it)) } +
            AvatarOptions.NECKS.filter { it != "none" }.map { AvatarOption(category, it, labelOf(it), pro = AvatarOptions.isProOnly("neck", it)) }
        AvatarCategory.BACKDROP -> listOf(AvatarOption(category, "auto", "Auto")) + AvatarOptions.BACKDROPS.map {
            AvatarOption(category, it.id, labelOf(it.id), pro = AvatarOptions.isProOnly("bg", it.id), colorHex = it.colors.firstOrNull())
        }
        AvatarCategory.FRAME -> listOf(none(category)) + AvatarOptions.FRAMES.filter { it != "none" }
            .map { AvatarOption(category, it, labelOf(it), pro = AvatarOptions.isProOnly("frame", it)) }
    }

    /** The option's label ("Wizard hat"), or the id. */
    fun label(category: AvatarCategory, id: String?): String =
        options(category).firstOrNull { it.id == id?.takeIf { v -> v != "none" || category == AvatarCategory.NOSE } }?.label ?: id ?: "None"

    /** Pro-only (crown/halo/tiara, wings/chain, aurora/galaxy, diamond/Pro frames): the gold PRO pill → G1. */
    fun isProOnly(category: AvatarCategory, id: String?): Boolean = when (category) {
        AvatarCategory.HATS -> AvatarOptions.isProOnly("head", id)
        AvatarCategory.EXTRAS -> AvatarOptions.isProOnly("neck", id)
        AvatarCategory.BACKDROP -> AvatarOptions.isProOnly("bg", id)
        AvatarCategory.FRAME -> AvatarOptions.isProOnly("frame", id)
        else -> false
    }

    /** Whether [option] is what [config] wears. Extras: either the face or the neck slot. */
    fun isSelected(config: AvatarConfig, option: AvatarOption): Boolean {
        val id = option.id ?: "none"
        return when (option.category) {
            AvatarCategory.BODY -> config.body == id
            AvatarCategory.COLOR -> config.color == id
            AvatarCategory.PATTERN -> config.pattern == id
            AvatarCategory.EYES -> config.eyes == id
            AvatarCategory.NOSE -> config.nose == id
            AvatarCategory.MOUTH -> config.mouth == id
            AvatarCategory.HATS -> config.head == id
            AvatarCategory.EXTRAS -> if (option.id == null) config.face == "none" && config.neck == "none"
                else config.face == id || config.neck == id
            AvatarCategory.BACKDROP -> config.bg == id
            AvatarCategory.FRAME -> config.frame == id
        }
    }

    /**
     * [config] wearing [option]. Extras fill their own slot (face: mustache / shades /
     * monocle; neck: cape / wings / bow tie / scarf / chain); tapping a worn extra takes it
     * off; "None" clears both. Picking a mascot part also switches display to "mascot".
     */
    fun apply(config: AvatarConfig, option: AvatarOption): AvatarConfig {
        val id = option.id ?: "none"
        val c = when (option.category) {
            AvatarCategory.BODY -> config.copy(body = id)
            AvatarCategory.COLOR -> config.copy(color = id, patternColor = if (config.patternColor == config.color) id else config.patternColor)
            AvatarCategory.PATTERN -> config.copy(pattern = id)
            AvatarCategory.EYES -> config.copy(eyes = id)
            AvatarCategory.NOSE -> config.copy(nose = id)
            AvatarCategory.MOUTH -> config.copy(mouth = id)
            AvatarCategory.HATS -> config.copy(head = id)
            AvatarCategory.EXTRAS -> when {
                option.id == null -> config.copy(face = "none", neck = "none")
                id in AvatarOptions.FACES -> config.copy(face = if (config.face == id) "none" else id)
                else -> config.copy(neck = if (config.neck == id) "none" else id)
            }
            AvatarCategory.BACKDROP -> config.copy(bg = id)
            AvatarCategory.FRAME -> config.copy(frame = id)
        }
        return if (option.category == AvatarCategory.FRAME) c else c.copy(display = AvatarOptions.DISPLAY_MASCOT)
    }

    /** The art name an option ships under (`art_av_<category>_<id>`, "-" → "_"), or null (colors, patterns, backdrops, frames, None). */
    fun drawableName(category: AvatarCategory, id: String?): String? {
        val v = id?.takeIf { it != "none" }?.replace('-', '_') ?: return null
        return when (category) {
            AvatarCategory.BODY -> "art_av_body_$v"
            AvatarCategory.EYES -> "art_av_eyes_$v"
            AvatarCategory.MOUTH -> "art_av_mouth_$v"
            AvatarCategory.NOSE -> "art_av_nose_$v"
            AvatarCategory.HATS, AvatarCategory.EXTRAS -> "art_av_acc_$v"
            else -> null
        }
    }

    /** The drawable id of an option's art (0 = not shipped yet: the code-drawn placeholder is used). */
    fun drawableId(context: Context, category: AvatarCategory, id: String?): Int =
        drawableName(category, id)?.let { MascotComposer.drawableId(context, it) } ?: 0

    /** AN2 presets: the ten cast members as one-tap starting points (cast id → config), WORDOCIOUS order. */
    fun presets(): List<Pair<String, AvatarConfig>> =
        AvatarPresets.IDS.mapNotNull { id -> AvatarPresets.forCast(id)?.let { id to it } }

    /** A playful random mascot (keeps the frame, backdrop and display; Pro-only items only when [pro]). */
    fun randomize(current: AvatarConfig, pro: Boolean, random: Random = Random.Default): AvatarConfig {
        fun allowed(field: String, ids: List<String>) = ids.filter { it != "none" && (pro || !AvatarOptions.isProOnly(field, it)) }
        val color = AvatarOptions.COLORS.random(random)
        val pattern = if (random.nextFloat() < 0.4f) "solid" else AvatarOptions.PATTERNS.random(random)
        return current.copy(
            body = AvatarOptions.BODIES.random(random),
            color = color,
            pattern = pattern,
            patternColor = if (pattern == "solid") color else AvatarOptions.COLORS.filter { it != color }.random(random),
            eyes = AvatarOptions.EYES.random(random),
            nose = AvatarOptions.NOSES.random(random),
            mouth = AvatarOptions.MOUTHS.random(random),
            head = if (random.nextFloat() < 0.5f) allowed("head", AvatarOptions.HEADS).random(random) else "none",
            face = if (random.nextFloat() < 0.25f) allowed("face", AvatarOptions.FACES).random(random) else "none",
            neck = if (random.nextFloat() < 0.25f) allowed("neck", AvatarOptions.NECKS).random(random) else "none",
        )
    }
}
