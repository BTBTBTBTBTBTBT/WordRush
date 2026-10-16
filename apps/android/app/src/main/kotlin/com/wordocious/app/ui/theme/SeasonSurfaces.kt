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
    /** The season accent as TEXT on a light surface (registry `accentText`; the palette accent is a fill, docs/review/a11y-1016.md #11). */
    val accentText: Color? = null,
    /**
     * Time of day (registry `surfaces.tod.<t>.tone == "light"`): the ON-WALL chrome ink turns dark because the sky behind it is light.
     * It never changes the card tone: the windows stay dark glass with light ink.
     */
    val wallInkDark: Boolean = false,
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

    /** The ink for chrome drawn straight on the wall (not on a card): the card ink, or its dark twin when the sky is light. */
    fun wallInk(light: Color): Color = if (wallInkDark) WALL_INK_DARK else light

    companion object {
        /** The ON-WALL chrome ink when the time's sky is light (same value on iOS SeasonSurface.wallInk and web --season-wall-ink). */
        val WALL_INK_DARK = Color(0xFF1B1230)

        private fun mix(a: Color?, b: Color?, t: Float): Color? = when {
            a == null -> b
            b == null -> a
            else -> androidx.compose.ui.graphics.lerp(a, b, t)
        }

        private fun mixList(a: List<Color>?, b: List<Color>?, t: Float): List<Color>? =
            if (a == null || b == null || a.size != b.size) (if (t < 0.5f) a else b) else a.indices.map { androidx.compose.ui.graphics.lerp(a[it], b[it], t) }

        /** The in-between look of a time-of-day cross-fade: every color / opacity lerps, the discrete bits (tone, wall ink) follow [to]. */
        fun lerp(from: SeasonSurfaces, to: SeasonSurfaces, t: Float): SeasonSurfaces = when {
            t <= 0f -> from
            t >= 1f -> to
            else -> to.copy(
                card = mix(from.card, to.card, t), cardOpacity = from.cardOpacity + (to.cardOpacity - from.cardOpacity) * t,
                hero = mix(from.hero, to.hero, t), heroOpacity = from.heroOpacity + (to.heroOpacity - from.heroOpacity) * t,
                raised = mix(from.raised, to.raised, t), cap = mixList(from.cap, to.cap, t),
                glow = mix(from.glow, to.glow, t), text = mix(from.text, to.text, t),
                textMuted = mix(from.textMuted, to.textMuted, t), textSecondary = mix(from.textSecondary, to.textSecondary, t),
            )
        }
    }
}
