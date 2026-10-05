package com.wordocious.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ui.TintMath

/**
 * A season's windows (season registry `surfaces`; iOS SeasonKit.Look, web season-kit
 * SeasonSurfaces): the page cards, the Home hero card, the game cards' drip caps and the game
 * board tray recolor so the whole screen reads seasonal. Every slot is optional — a missing one
 * keeps the normal look. Flat translucent fills only (no blur).
 */
data class SeasonSurfaces(
    val dark: Boolean,
    val card: Color?,
    val cardOpacity: Float,
    val hero: Color?,
    val heroOpacity: Float,
    val raised: Color?,
    val cap: List<Color>?,
    val capTint: Float,
    val glow: Color?,
    val text: Color?,
    val textMuted: Color?,
    val textSecondary: Color?,
    val headline: List<Color>?,
    val bannerGlow: Color?,
    val cobweb: Color?,
) {
    /** A card's translucent fill (null = the normal fill). */
    val cardFill: Color? get() = card?.copy(alpha = cardOpacity)
    val heroFill: Color? get() = hero?.copy(alpha = heroOpacity) ?: cardFill

    /** The drip cap's three stops for a game color (lip, body with a hint of the game, base). */
    fun capStops(game: Color): List<Color>? = cap?.takeIf { it.size == 3 }?.let {
        listOf(it[0], Color(TintMath.over(game.copy(alpha = 1f).toArgb(), capTint, it[1].toArgb())), it[2])
    }

    /** A wash of [accent] over the season card (deeper on dark cards so the tint still reads). */
    fun wash(accent: Color, amount: Float): Color {
        val base = card ?: return accent
        return Color(TintMath.over(accent.copy(alpha = 1f).toArgb(), if (dark) minOf(1f, amount * 2.4f) else amount * 1.4f, base.toArgb()))
    }

    /** A game color as on-card text on a dark season card (lifted so it reads). */
    fun onCard(accent: Color): Color = if (!dark) accent
        else Color(TintMath.over(accent.copy(alpha = 1f).toArgb(), 0.55f, 0xFFFFFFFF.toInt()))

    /** The theme palette under the season (on-card ink + the opaque card for sheets). */
    fun palette(base: Palette): Palette = base.copy(
        surface = card ?: base.surface,
        surfaceAlt = raised ?: base.surfaceAlt,
        surfaceHover = raised ?: base.surfaceHover,
        text = text ?: base.text,
        textMuted = textMuted ?: base.textMuted,
        textSecondary = textSecondary ?: base.textSecondary,
    )
}
