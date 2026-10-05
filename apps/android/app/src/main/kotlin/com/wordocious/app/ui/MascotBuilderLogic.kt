package com.wordocious.app.ui

import com.wordocious.app.data.AvatarCast
import com.wordocious.core.AvatarConfig
import com.wordocious.core.AvatarFit
import com.wordocious.core.AvatarFitManifest
import com.wordocious.core.AvatarOptions
import com.wordocious.core.AvatarPresets
import com.wordocious.core.LevelTier
import com.wordocious.core.enforceAvatarPro
import com.wordocious.core.validateAvatar
import kotlin.random.Random

// FINISH_SPEC AN4 (+ AN addendum) — the pure half of the "Make your mascot" builder
// (the screen is ui/MascotBuilder.kt). Tabs, the option list per tab, applying /
// reading an option on a config, Pro gating, level-tier frame locks and Randomize.
// Empty slots are "none" (backdrop: "auto"), colors are swatch ids — the core
// AvatarConfig shape. No Compose / Android here, so it is JVM-tested (MascotBuilderLogicTest).

/** The builder's category tabs, in order (AN4 + the addendum's Backdrop, before Frame like AvatarCategory). */
enum class BuilderTab(val label: String) {
    PRESETS("Presets"),
    BODY("Body"),
    COLOR("Color"),
    PATTERN("Pattern"),
    EYES("Eyes"),
    NOSE("Nose"),
    CHEEKS("Cheeks"),
    MOUTH("Mouth"),
    HATS("Hats"),
    EXTRAS("Extras"),
    BACKDROP("Backdrop"),
    FRAME("Frame"),
}

/**
 * One option tile. [slot] is the AvatarConfig field it sets ("body", "color",
 * "pattern", "eyes", "nose", "mouth", "head", "face", "neck", "bg", "frame") or
 * "preset" (a cast id) / "extras" (the Extras tab's None: clears face + neck).
 */
data class BuilderOption(val slot: String, val id: String)

object MascotBuilderLogic {
    const val NONE = "none"

    /** The fit manifest (set by the screen from the bundled avatar-parts.json): conflicting picks swap out. */
    @Volatile var fit: AvatarFitManifest? = null

    /** The swatch slots (glossy round grid, grouped by row). */
    val SWATCH_SLOTS = setOf("color", "patternColor", "accColor")

    /** The swatch ids of a picker row (core AvatarSwatch.group), in order. */
    fun swatchRow(group: String): List<String> = AvatarOptions.SWATCHES.filter { it.group == group }.map { it.id }

    /** True while a white (tintable) accessory is worn: the accessory color row shows. */
    fun tintableWorn(c: AvatarConfig): Boolean = c.head in AvatarOptions.TINTABLE || c.neck in AvatarOptions.TINTABLE

    private val PART_SLOTS = setOf("eyes", "nose", "cheeks", "mouth", "head", "face", "neck")

    /** The (slot, id) a pick would swap out (it doesn't fit with it), else null. */
    fun conflict(config: AvatarConfig, o: BuilderOption): Pair<String, String>? {
        val m = fit ?: return null
        return if (o.slot in PART_SLOTS) AvatarFit.pickConflict(config, o.slot, o.id, m) else null
    }

    /** The tiles a tab shows, in order. Optional slots start with their "none" / "auto" tile. */
    fun options(tab: BuilderTab): List<BuilderOption> = when (tab) {
        BuilderTab.PRESETS -> AvatarPresets.IDS.map { BuilderOption("preset", it) }
        BuilderTab.BODY -> AvatarOptions.BODIES.map { BuilderOption("body", it) }
        BuilderTab.COLOR -> emptyList()   // the glossy swatch grid (SwatchGrid) instead of tiles
        BuilderTab.PATTERN -> AvatarOptions.PATTERNS.map { BuilderOption("pattern", it) }
        // founder 10-05: None on any body part (eyes and mouth too)
        BuilderTab.EYES -> (listOf(NONE) + AvatarOptions.EYES).map { BuilderOption("eyes", it) }
        BuilderTab.NOSE -> AvatarOptions.NOSES.map { BuilderOption("nose", it) }
        BuilderTab.CHEEKS -> AvatarOptions.CHEEKS.map { BuilderOption("cheeks", it) }
        BuilderTab.MOUTH -> (listOf(NONE) + AvatarOptions.MOUTHS).map { BuilderOption("mouth", it) }
        BuilderTab.HATS -> listOf(BuilderOption("head", NONE)) +
            AvatarOptions.HEADS.filter { it != NONE }.map { BuilderOption("head", it) }
        BuilderTab.EXTRAS -> listOf(BuilderOption("extras", NONE)) +
            AvatarOptions.FACES.filter { it != NONE }.map { BuilderOption("face", it) } +
            AvatarOptions.NECKS.filter { it != NONE }.map { BuilderOption("neck", it) }
        BuilderTab.BACKDROP -> AvatarOptions.BACKDROP_IDS.map { BuilderOption("bg", it) }
        BuilderTab.FRAME -> listOf(BuilderOption("frame", NONE)) +
            AvatarOptions.FRAMES.filter { it != NONE }.map { BuilderOption("frame", it) }
    }

    /**
     * The config with [o] applied. Picking any mascot part shows the mascot (display
     * "mascot", like AvatarParts.apply); a frame dresses the photo too, so it leaves the
     * display alone. A preset keeps the player's frame and backdrop (earned / chosen, not
     * part of a character's look).
     */
    fun apply(config: AvatarConfig, o: BuilderOption): AvatarConfig {
        val c = when (o.slot) {
            "preset" -> (AvatarPresets.forCast(o.id) ?: config).copy(frame = config.frame, bg = config.bg)
            "body" -> config.copy(body = o.id)
            // The pattern color follows the body color while it matches it (its default).
            "color" -> config.copy(color = o.id, patternColor = if (config.patternColor == config.color) o.id else config.patternColor)
            "pattern" -> config.copy(pattern = o.id)
            "patternColor" -> config.copy(patternColor = o.id)
            "accColor" -> config.copy(accColor = o.id)
            "eyes", "nose", "cheeks", "mouth", "head", "face", "neck" ->
                fit?.let { AvatarFit.applyPick(config, o.slot, o.id, it) } ?: AvatarFit.setting(config, o.slot, o.id)
            "extras" -> config.copy(face = NONE, neck = NONE)
            "bg" -> config.copy(bg = o.id)
            "frame" -> config.copy(frame = o.id)
            else -> config
        }
        return if (o.slot == "frame") c else c.copy(display = AvatarOptions.DISPLAY_MASCOT)
    }

    private val TOGGLE_SLOTS = setOf("head", "face", "neck")

    /** What a tap does: picking the worn hat / extra again takes it off; everything else applies. */
    fun tap(config: AvatarConfig, o: BuilderOption): AvatarConfig =
        if (o.slot in TOGGLE_SLOTS && o.id != NONE && isSelected(config, o)) apply(config, o.copy(id = NONE))
        else apply(config, o)

    /** True when [config] currently wears [o]. A preset is "selected" when the look matches it exactly. */
    fun isSelected(config: AvatarConfig, o: BuilderOption): Boolean = when (o.slot) {
        "preset" -> presetLook(o.id, config) == config.copy(display = AvatarOptions.DISPLAY_MASCOT)
        "body" -> config.body == o.id
        "color" -> config.color == o.id
        "pattern" -> config.pattern == o.id
        "eyes" -> config.eyes == o.id
        "nose" -> config.nose == o.id
        "cheeks" -> config.cheeks == o.id
        "patternColor" -> config.patternColor == o.id
        "accColor" -> config.accColor == o.id
        "mouth" -> config.mouth == o.id
        "head" -> config.head == o.id
        "face" -> config.face == o.id
        "neck" -> config.neck == o.id
        "extras" -> config.face == NONE && config.neck == NONE
        "bg" -> config.bg == o.id
        "frame" -> config.frame == o.id
        else -> false
    }

    private fun presetLook(castId: String, config: AvatarConfig): AvatarConfig? =
        AvatarPresets.forCast(castId)?.copy(frame = config.frame, bg = config.bg, display = AvatarOptions.DISPLAY_MASCOT)

    /** The cast preset whose look [config] wears exactly (frame / backdrop / display aside), or null — AH's avatar_cast_id. */
    fun presetOf(config: AvatarConfig): String? =
        AvatarPresets.IDS.firstOrNull { isSelected(config, BuilderOption("preset", it)) }

    /** AA4 + addendum ★: the option is Pro only (crown / halo / tiara, wings / gold chain, aurora / galaxy, diamond / Pro frames). */
    fun isProOnly(o: BuilderOption): Boolean =
        AvatarOptions.isProOnly(if (o.slot in SWATCH_SLOTS) "color" else o.slot, o.id)

    /** A free player sees the PRO pill and the tap opens the paywall. Pro players are never locked. */
    fun proLocked(o: BuilderOption, isPro: Boolean): Boolean = !isPro && isProOnly(o)

    /** The level tier a frame needs (null for "none" and the Pro-only "pro" frame). */
    fun frameTier(o: BuilderOption): LevelTier? =
        if (o.slot != "frame") null else LevelTier.entries.firstOrNull { it.key == o.id }

    /** AH: a tier frame above the player's level is locked (dimmed, a lock, "Lv N"). */
    fun tierLocked(o: BuilderOption, level: Int): Boolean {
        val t = frameTier(o) ?: return false
        return t.minLevel > level.coerceAtLeast(1)
    }

    /** True when the player may wear [o] right now. */
    fun canWear(o: BuilderOption, isPro: Boolean, level: Int): Boolean = !proLocked(o, isPro) && !tierLocked(o, level)

    /**
     * Drop anything the player may not wear (a Pro item after Pro lapsed — core
     * enforceAvatarPro — or a tier frame above their level): what Save writes.
     */
    fun sanitize(config: AvatarConfig, isPro: Boolean, level: Int): AvatarConfig {
        var c = enforceAvatarPro(validateAvatar(config, config), isPro)
        if (tierLocked(BuilderOption("frame", c.frame), level)) c = c.copy(frame = NONE)
        return c
    }

    /**
     * Randomize: a fresh, always-valid look — body, color, pattern, eyes, nose, mouth,
     * sometimes a hat / extra — never a Pro item for a free player; the player's frame,
     * backdrop and display are kept (a frame / backdrop they can no longer wear is
     * dropped). Never returns the same look twice in a row.
     */
    fun randomize(current: AvatarConfig, isPro: Boolean, level: Int, random: Random = Random.Default): AvatarConfig {
        fun <T> List<T>.any(r: Random): T = this[r.nextInt(size)]
        fun wearable(slot: String, ids: List<String>) = ids.filter { it != NONE && canWear(BuilderOption(slot, it), isPro, level) }
        val kept = sanitize(current, isPro, level)
        val colors = AvatarOptions.COLORS.filter { isPro || !AvatarOptions.isProOnly("color", it) }
        repeat(8) {
            val color = colors.any(random)
            val pattern = if (random.nextInt(100) < 45) "solid" else AvatarOptions.PATTERNS.any(random)
            val patternColor = if (pattern == "solid") color else colors.filter { it != color }.any(random)
            val next = kept.copy(
                body = AvatarOptions.BODIES.any(random),
                color = color,
                pattern = pattern,
                patternColor = patternColor,
                eyes = AvatarOptions.EYES.any(random),
                nose = if (random.nextInt(100) < 50) NONE else AvatarOptions.NOSES.any(random),
                cheeks = if (random.nextInt(100) < 50) NONE else AvatarOptions.CHEEKS.any(random),
                mouth = AvatarOptions.MOUTHS.any(random),
                head = if (random.nextInt(100) < 55) wearable("head", AvatarOptions.HEADS).any(random) else NONE,
                face = if (random.nextInt(100) < 25) wearable("face", AvatarOptions.FACES).any(random) else NONE,
                neck = if (random.nextInt(100) < 25) wearable("neck", AvatarOptions.NECKS).any(random) else NONE,
            )
            // never a combination the fit system rules out (the face extra yields)
            val fitted = if (conflict(next, BuilderOption("face", next.face)) != null) next.copy(face = NONE) else next
            if (fitted != current) return fitted
        }
        return kept.copy(color = AvatarOptions.COLORS.first { it != current.color })
    }

    /** The tile's spoken label, e.g. "Eyes: Hearts, selected" / "Hats: Crown, Pro only" / "Frame: Gold, locked, reach level 26". */
    fun a11yLabel(tab: BuilderTab, o: BuilderOption, name: String, selected: Boolean, isPro: Boolean, level: Int): String {
        val head = if (o.slot == "preset") "Start from $name" else "${tab.label}: $name"
        val tier = frameTier(o)
        val state = when {
            tierLocked(o, level) && tier != null -> ", locked, reach level ${tier.minLevel}"
            proLocked(o, isPro) -> ", Pro only"
            selected -> ", selected"
            else -> ""
        }
        return head + state
    }

    /** A fallback display name for an option id (the app's AvatarParts labels win when present). */
    fun fallbackName(o: BuilderOption): String {
        if (o.id == NONE) return when (o.slot) {
            "head" -> "No hat"
            "extras", "face", "neck" -> "No extras"
            "frame" -> "No frame"
            else -> "None"
        }
        return when (o.slot) {
            "preset" -> AvatarCast.name(o.id) ?: o.id.uppercase()
            "bg" -> if (o.id == "auto") "Auto" else o.id.replaceFirstChar { it.uppercaseChar() }
            else -> o.id.replace('-', ' ').replaceFirstChar { it.uppercaseChar() }
        }
    }
}
