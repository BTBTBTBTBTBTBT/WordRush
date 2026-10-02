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

/** The tile's outline (radius 24% of size): use it for any ring / border / glow around a tile. */
fun letterTileShape(size: Dp): Shape = RoundedCornerShape(size * 0.24f)

/** Avatar outline: circle for an uploaded photo, the tile's rounded square otherwise. */
fun avatarShape(hasPhoto: Boolean, size: Dp): Shape = if (hasPhoto) CircleShape else letterTileShape(size)

/**
 * The §20 letter tile, filling a [size] box (scales 20–120 dp). [emoji] (the
 * player's chosen avatar emoji) replaces the initials when set. [accentHex] is
 * the player's profile accent when known. No animation; identical in dark mode.
 */
@Composable
fun LetterTileAvatar(
    username: String?,
    size: Dp,
    modifier: Modifier = Modifier,
    accentHex: String? = null,
    emoji: String? = null,
) {
    val base = remember(username, accentHex) { LetterTileColors.baseRgb(username, accentHex) }
    val edge = remember(base) { LetterTileColors.darken(base, 0.22f) }
    val light = remember(base) { LetterTileColors.lighten(base, 0.18f) }
    val bottom = remember(base) { LetterTileColors.darken(base, 0.06f) }
    val density = LocalDensity.current
    val sizePx = with(density) { size.toPx() }
    val faceH = size * 0.93f
    Box(modifier.size(size)) {
        Canvas(Modifier.fillMaxSize()) {
            val s = this.size.minDimension
            val r = CornerRadius(s * 0.24f)
            val fh = s * 0.93f
            // Body = the tile's thickness, shown as the bottom lip.
            drawRoundRect(rgbColor(edge), cornerRadius = r)
            // Face.
            drawRoundRect(
                Brush.verticalGradient(
                    0f to rgbColor(light), 0.7f to rgbColor(base), 1f to rgbColor(bottom),
                    startY = 0f, endY = fh,
                ),
                size = Size(s, fh), cornerRadius = r,
            )
            // Gloss: starts 8% of size from the top, 0.42 × face height tall, inset 8% left/right (web/iOS parity).
            val gTop = s * 0.08f
            val gH = fh * 0.42f
            drawRoundRect(
                Brush.verticalGradient(
                    listOf(Color.White.copy(alpha = 0.30f), Color.White.copy(alpha = 0f)),
                    startY = gTop, endY = gTop + gH,
                ),
                topLeft = Offset(s * 0.08f, gTop),
                size = Size(s - s * 0.16f, gH),
                cornerRadius = CornerRadius(s * 0.18f),
            )
        }
        val e = emoji?.trim().orEmpty()
        val baseStyle = TextStyle(
            fontFamily = Nunito,
            fontWeight = FontWeight.Black,
            color = Color.White,
            textAlign = TextAlign.Center,
            platformStyle = PlatformTextStyle(includeFontPadding = false),
            lineHeightStyle = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.Both),
        )
        // Centered on the FACE, not the whole box.
        Box(Modifier.fillMaxWidth().height(faceH), contentAlignment = Alignment.Center) {
            if (e.isNotEmpty()) {
                Text(e, maxLines = 1, softWrap = false, style = baseStyle.copy(fontSize = with(density) { (size * 0.5f).toSp() }))
            } else {
                val letters = LetterTileColors.initials(username)
                val factor = if (letters.length == 1) 0.56f else 0.42f
                Text(
                    letters, maxLines = 1, softWrap = false,
                    style = baseStyle.copy(
                        fontSize = with(density) { (size * factor).toSp() },
                        letterSpacing = (-0.02f).em,
                        shadow = Shadow(rgbColor(edge, 0.45f), Offset(0f, sizePx * 0.03f), sizePx * 0.02f),
                    ),
                )
            }
        }
    }
}
