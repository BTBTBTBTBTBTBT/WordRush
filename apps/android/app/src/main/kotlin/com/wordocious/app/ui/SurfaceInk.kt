package com.wordocious.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ui.theme.WTheme

// Founder 10-10 (readability): one place to ask "is the surface this text sits on dark?". That is the dark theme OR a dark
// season's night cards (Halloween): WTheme.isDark follows the season's `dark` flag, and vsDarkSeason is the season-only flag
// (the Friends / VS / pocket-game pages stay light in the dark THEME and only go night under a dark SEASON). Ink picked for a
// card must key off this, never off a fixed light-theme hex. Ink only; backgrounds keep their own helpers. iOS SurfaceInk.
object SurfaceInk {
    /** The dark theme or a dark season's night cards. */
    val surfaceDark: Boolean get() = WTheme.isDark || com.wordocious.app.ui.vs.vsDarkSeason

    /** [light] on a light surface, [night] on a dark one (the dark theme and the season's night cards alike). */
    fun ink(light: Color, night: Color): Color = if (surfaceDark) night else light

    /** Hex convenience for the common fixed-ink pair (0xRRGGBB). */
    fun ink(light: Long, night: Long): Color = Color(0xFF000000 or (if (surfaceDark) night else light))

    /** For the light-only pages (Friends, VS, pocket games): night only under a dark SEASON, never the dark theme. */
    fun seasonInk(light: Long, night: Long): Color = Color(0xFF000000 or (if (com.wordocious.app.ui.vs.vsDarkSeason) night else light))

    /** Error text: red-600 on light surfaces, red-400 (about 5:1) on dark ones. */
    val errorRed: Color get() = ink(0xDC2626, 0xF87171)

    /** WCAG luminance a lifted label ink reaches on a dark surface (iOS Color.bubbleInk). */
    const val LIFTED_LUMA = 0.62

    /**
     * A bubble-lettering label ink: itself on light surfaces; on a dark one lifted toward white until its luminance is at
     * least [LIFTED_LUMA] (the glyph's own white rim washed a mid lavender out on the night cards). Idempotent. [dark]
     * defaults to the live surface; pass it to keep the pure math testable.
     */
    fun lift(c: Color, dark: Boolean = WTheme.isDark): Color {
        if (!dark) return c
        val src = c.copy(alpha = 1f).toArgb()
        if (InkContrast.luminance(src) >= LIFTED_LUMA) return c
        var k = 0.45f
        while (k <= 0.9f + 1e-4f) {
            val mixed = TintMath.over(0xFFFFFFFF.toInt(), k, src)
            if (InkContrast.luminance(mixed) >= LIFTED_LUMA) return Color(mixed)
            k += 0.05f
        }
        return Color(TintMath.over(0xFFFFFFFF.toInt(), 0.9f, src))
    }
}
