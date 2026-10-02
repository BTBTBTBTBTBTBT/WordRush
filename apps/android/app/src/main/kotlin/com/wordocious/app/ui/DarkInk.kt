package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wordocious.app.ui.theme.WTheme

// FINISH_SPEC AD (dark mode audit): the tinted cards fall back to the dark surface in
// the dark theme (accentWash / accentLine / gameCardBg), so a text ink picked for the
// light wash (violet-600, gray-600, amber-700…) drops under the web ink rule there
// (≥ 4.5:1). These are the lifted inks the dark theme uses instead, and the WCAG math
// the unit test checks them with.

/** WCAG 2.x relative luminance + contrast ratio on ARGB ints. Pure. */
object InkContrast {
    /** The web ink rule for body text. */
    const val AA = 4.5

    fun luminance(argb: Int): Double {
        fun ch(shift: Int): Double {
            val c = ((argb ushr shift) and 0xFF) / 255.0
            return if (c <= 0.03928) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * ch(16) + 0.7152 * ch(8) + 0.0722 * ch(0)
    }

    fun ratio(fg: Int, bg: Int): Double {
        val a = luminance(fg)
        val b = luminance(bg)
        return (maxOf(a, b) + 0.05) / (minOf(a, b) + 0.05)
    }
}

/** The dark theme's lifted text inks (Tailwind 300 stops), each ≥ 4.5:1 on the dark surface. */
object DarkInk {
    /** For violet-600 / violet-700 / violet-800 text (#7C3AED, #6D28D9, #5B21B6). */
    val violet = Color(0xFFC4B5FD)
    /** For amber-700 / amber-800 text (#B45309, #92400E). */
    val amber = Color(0xFFFCD34D)
    /** For green-700 text (#047857). */
    val green = Color(0xFF6EE7B7)

    /** Every lifted ink (the unit test checks each against the dark surfaces). */
    val all: List<Color> get() = listOf(violet, amber, green)
}

/** [light] in the light themes, [dark] in the dark theme (for text on a theme-following card). */
fun darkSafe(light: Color, dark: Color): Color = if (WTheme.isDark) dark else light

/** The brand purple as small text on a theme-following card: violet-600, violet-300 in dark. */
val purpleTextInk: Color get() = darkSafe(Color(0xFF7C3AED), DarkInk.violet)

/**
 * [tintedPill] that stays light in every theme — for pills inside a card that is itself
 * fixed light (the Friends page cards, the gift card), whose inks are the light ones.
 */
fun Modifier.lightTintedPill(accent: Color, corner: Dp = 12.dp): Modifier {
    val shape = RoundedCornerShape(corner)
    return this.clip(shape)
        .background(Wash.mix(accent, 0.12f))
        .drawBehind { drawRect(accent, Offset.Zero, Size(size.width, 4.dp.toPx())) }
        .border(1.5.dp, Wash.mix(accent, 0.30f), shape)
}
