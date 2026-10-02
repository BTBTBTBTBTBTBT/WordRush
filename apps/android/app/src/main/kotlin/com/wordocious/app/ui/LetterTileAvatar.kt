package com.wordocious.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.em
import com.wordocious.app.ui.theme.Nunito

/**
 * ART_SPEC §20 — the no-photo avatar is a LETTER TILE, not an initials circle:
 * a rounded square (radius 24% of size) with a darker bottom lip, a glossy
 * gradient face and the player's initials in white Nunito Black. Pure color
 * math lives here so it is unit-testable on the JVM (LetterTileColorsTest).
 */
object LetterTileColors {
    /** Cast letters (MASCOT_SPEC cast colors). */
    private val CAST: Map<Char, Int> = mapOf(
        'W' to 0x8B2CF5, 'O' to 0xFF2F91, 'R' to 0x8E96A8, 'D' to 0x0A6CFF,
        'C' to 0x00B4BE, 'I' to 0x4CC77A, 'U' to 0x9B3DF3, 'S' to 0xF5A623,
    )

    /** Every other first character: palette[(uppercase char code) mod 9]. */
    val PALETTE: List<Int> = listOf(
        0x8B2CF5, 0xFF9F1A, 0x0A6CFF, 0xFF2F91, 0x00B4BE, 0x4CC77A, 0x9B3DF3, 0xF5A623, 0xF0782C,
    )

    /** Parse "#RRGGBB" / "RRGGBB" to 0xRRGGBB, null when absent or malformed. */
    fun parseHex(hex: String?): Int? {
        val h = hex?.trim()?.removePrefix("#") ?: return null
        if (h.length != 6) return null
        return h.toIntOrNull(16)
    }

    /**
     * The tile's `base` RGB (0xRRGGBB): a set profile accent wins — only a real
     * swatch from [ProfileAccent.palette] (web tileBaseColor parity) — else the
     * first letter's color.
     */
    fun baseRgb(username: String?, accentHex: String? = null): Int {
        val accent = accentHex?.trim()
        if (!accent.isNullOrEmpty() && ProfileAccent.palette.any { it.second.equals(accent, ignoreCase = true) }) {
            parseHex(accent)?.let { return it }
        }
        val c = username?.trim()?.firstOrNull()?.uppercaseChar() ?: '?'
        return CAST[c] ?: PALETTE[c.code % PALETTE.size]
    }

    /** "#RRGGBB" of [baseRgb] (tests + debugging). */
    fun baseHex(username: String?, accentHex: String? = null): String =
        "#%06X".format(baseRgb(username, accentHex))

    /** First two characters of the username, uppercased (one if the name has one). */
    fun initials(username: String?): String =
        username?.trim().orEmpty().take(2).trim().uppercase().ifEmpty { "?" }

    /** Mix toward white by [f] (0..1). */
    fun lighten(rgb: Int, f: Float): Int = mix(rgb, 0xFFFFFF, f)

    /** Mix toward black by [f] (0..1). */
    fun darken(rgb: Int, f: Float): Int = mix(rgb, 0x000000, f)

    private fun mix(a: Int, b: Int, f: Float): Int {
        fun ch(v: Int, s: Int) = (v shr s) and 0xFF
        fun m(s: Int) = Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * f).coerceIn(0, 255)
        return (m(16) shl 16) or (m(8) shl 8) or m(0)
    }
}

private fun rgbColor(rgb: Int, alpha: Float = 1f): Color = Color(0xFF000000L or rgb.toLong()).copy(alpha = alpha)

/** The tile's outline (AN6: radius ≈ 22% of size): use it for any ring / border / glow around a tile. */
fun letterTileShape(size: Dp): Shape = RoundedCornerShape(size * 0.22f)

/** Avatar outline (AN6): photos and mascots are both rounded squares now — never a circle. */
@Suppress("UNUSED_PARAMETER")
fun avatarShape(hasPhoto: Boolean, size: Dp): Shape = avatarTileShape(size)

/**
 * FINISH_SPEC AN5: every no-photo avatar is the player's MASCOT (MascotAvatar) with
 * their initial as the white body letter — the saved config (MascotAvatars, by
 * username), else a worn AH character's preset, else the deterministic default seeded
 * by the username in the player's [accentHex]. Every caller (leaderboards, podium,
 * Friends, VS, Records, profiles) switches with no call-site edits. [emoji] is ignored
 * (AM2). [pro] adds the AA2 crown + the Pro gold frame when no frame is chosen.
 */
@Composable
fun LetterTileAvatar(
    username: String?,
    size: Dp,
    modifier: Modifier = Modifier,
    accentHex: String? = null,
    emoji: String? = null,
    /** AA2: a Pro player's avatar wears the Pro gold frame + the tiny crown at its top-right. */
    pro: Boolean = false,
    /**
     * FINISH_SPEC AH: the cast character worn as the avatar ("w", "o1", … AvatarCast.IDS) —
     * drawn as that character's mascot PRESET (AN2). Null = the player's recorded choice
     * when [lookup] (CastAvatars, by username).
     */
    castId: String? = null,
    /** AH: the level-tier frame ("bronze" … "diamond"); null = the recorded one when [lookup]. */
    frame: String? = null,
    /** AH: false draws exactly what is passed (Edit Profile's live, unsaved choice). */
    lookup: Boolean = true,
    /** AN: an explicit mascot (e.g. the builder's live preview); null = resolved as above. */
    config: com.wordocious.core.AvatarConfig? = null,
) {
    @Suppress("UNUSED_VARIABLE") val retiredEmoji = emoji
    val look = if (lookup && (castId == null || frame == null)) com.wordocious.app.data.CastAvatars.lookFor(username) else null
    val recorded = if (lookup && config == null && castId == null) com.wordocious.app.data.MascotAvatars.configFor(username) else null
    val cast = com.wordocious.app.data.AvatarCast.normalize(castId ?: look?.castId)
    val ring = com.wordocious.app.data.AvatarFrame.normalize(frame ?: look?.frame)
    val resolved = remember(config, recorded, cast, ring, username, accentHex) {
        config ?: com.wordocious.app.data.MascotConfigRules.forDisplay(recorded, cast, ring, username, accentHex)
    }
    val initial = remember(username) { com.wordocious.app.data.MascotConfigRules.initialOf(username) }
    MascotAvatar(resolved, initial, size, modifier, pro = pro)
}
