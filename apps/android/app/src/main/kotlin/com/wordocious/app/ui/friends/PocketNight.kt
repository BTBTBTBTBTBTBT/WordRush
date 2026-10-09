package com.wordocious.app.ui.friends

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ui.TintMath
import com.wordocious.app.ui.theme.SeasonSurfaces
import com.wordocious.app.ui.theme.WTheme

/**
 * The wave-3 surfaces' inks and fills under a DARK season (2.8 item 24; Halloween: card #1C0F30, text #F7EEFF, accent
 * #F97316). The pocket boards, the Friends cards, the waiting strip and the pocket help card were drawn for the fixed-light
 * Friends page (lavender / amber washes with a deep-purple ink); on a dark season card those washes turn into the
 * season's night glass and every ink swaps to its light twin, taken from the season's own tokens (`text`, `textMuted`,
 * `raised`, `card`), so a future dark season recolors them with no code. Out of season (or a light season) every value is
 * the original light one, unchanged.
 *
 * Pure: each function takes the season's surfaces ([WTheme.season] by default), so the contrast test can feed it the
 * registry's Halloween block without any UI state (SeasonContrastTest.wave3SurfacesOnTheHalloweenCard).
 */
object PocketNight {
    private val PURPLE = Color(0xFF7C3AED)
    private val AMBER = Color(0xFFF59E0B)
    private val FALLBACK_CARD = Color(0xFF1C0F30)
    private val FALLBACK_TEXT = Color(0xFFF7EEFF)
    private val FALLBACK_MUTED = Color(0xFFC8B6E2)
    private val FALLBACK_RAISED = Color(0xFF2C1846)

    /** True under a dark season (the Friends pages' `vsDarkSeason`). */
    fun night(s: SeasonSurfaces? = WTheme.season): Boolean = s?.dark == true

    /** The season card the washes sit on (the page card; opaque). */
    fun card(s: SeasonSurfaces? = WTheme.season): Color = s?.card ?: FALLBACK_CARD

    /** A night wash of [accent] over the season card (the Friends cards' `friendsWash`, same half-strength rule). */
    private fun wash(s: SeasonSurfaces?, accent: Color, amount: Float): Color =
        s?.takeIf { it.dark && it.card != null }?.wash(accent, amount * 0.5f) ?: accent

    /** The deep ink (light: #4C1D95; night: the season's text). Headlines, letters, labels on the card or a chip. */
    fun ink(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) s?.text ?: FALLBACK_TEXT else Color(0xFF4C1D95)

    /** The quiet ink (light: #6F5F8F; night: the season's muted text). */
    fun muted(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) s?.textMuted ?: FALLBACK_MUTED else Color(0xFF6F5F8F)

    /** Your side's chip (light #EDE9FE) and its won twin (#DDD6FE). */
    fun youTint(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) wash(s, PURPLE, 0.16f) else Color(0xFFEDE9FE)
    fun youWon(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) wash(s, PURPLE, 0.34f) else Color(0xFFDDD6FE)

    /** Their side's chip (light #FEF3C7) and its won twin (#FDE68A). */
    fun themTint(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) wash(s, AMBER, 0.16f) else Color(0xFFFEF3C7)
    fun themWon(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) wash(s, AMBER, 0.34f) else Color(0xFFFDE68A)

    /** A filled board cell / tile (light: white; night: the season's raised chip). */
    fun cell(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) s?.raised ?: FALLBACK_RAISED else Color.White

    /** An empty board cell (light: white at 55%; night: the raised chip at 55% over the card). */
    fun cellEmpty(s: SeasonSurfaces? = WTheme.season): Color = cell(s).copy(alpha = 0.55f)

    /** A keyboard / picker key face (light #F1EAFF; night: raised). */
    fun keyFace(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) s?.raised ?: FALLBACK_RAISED else Color(0xFFF1EAFF)

    /** The purple ink for text on [youTint] (light: the tile purple; night: a lifted lavender). */
    fun purpleInk(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) Color(0xFFC4B5FD) else PURPLE

    /** The amber ink for text on [themTint] (light #B45309; night: a lifted gold). */
    fun amberInk(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) Color(0xFFFCD34D) else Color(0xFFB45309)

    /** A filled cell's border (light #DCCFF5 / #E5E7EB; night: the muted ink at 45%). */
    fun cellLine(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) muted(s).copy(alpha = 0.45f) else Color(0xFFDCCFF5)

    /** The leave dialog's container (light soft pink #FFF3F9; night: the opaque season card). */
    fun dialog(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) card(s) else Color(0xFFFFF3F9)

    /** The gloss over the score window (light: white 35% fading out; night: a whisper, so the dark glass stays dark). */
    fun frost(s: SeasonSurfaces? = WTheme.season): Float = if (night(s)) 0.06f else 0.35f

    /** The Friends page's pink "solid" as TEXT: #DB2777 on the light card; a lifted pink on a dark one. */
    fun pinkInk(s: SeasonSurfaces? = WTheme.season): Color = if (night(s)) Color(0xFFF9A8D4) else Color(0xFFDB2777)

    // Hubbub's found tiles and rank line (HubScreen): the mini tiles are the tone at low alpha on a dark tray, so their
    // fixed dark inks (brown / violet, drawn for the light washes) turn into light twins in any dark mode, Halloween included.
    /** A pangram tile's word (light: #7A3D00 on the gold wash; dark: a pale gold on the deep gold). */
    fun hubPangramInk(dark: Boolean): Color = if (dark) Color(0xFFFDE68A) else Color(0xFF7A3D00)
    /** A revealed word's ink (light #6D28D9; dark: a pale violet). */
    fun hubRevealedInk(dark: Boolean): Color = if (dark) Color(0xFFDDD6FE) else Color(0xFF6D28D9)
    /** The solved rank line's violet (light #7C3AED; dark: a lifted lavender). */
    fun hubSolvedInk(dark: Boolean): Color = if (dark) Color(0xFFC4B5FD) else Color(0xFF7C3AED)

    /** A game's title gradient on a dark season card: each stop lifted toward white so the lettering reads (light: unchanged). */
    fun title(stops: List<Color>, s: SeasonSurfaces? = WTheme.season): List<Color> =
        if (night(s)) stops.map { Color(TintMath.over(0xFFFFFFFF.toInt(), 0.45f, it.toArgb())) } else stops

    /** The pocket help card's two gradient stops, top then bottom (night: the season's raised chip into its card). */
    fun helpCard(darkTheme: Boolean, s: SeasonSurfaces? = WTheme.season): Pair<Color, Color> = when {
        night(s) -> (s?.raised ?: FALLBACK_RAISED) to card(s)
        darkTheme -> Color(0xFF2A1D4A) to Color(0xFF21163C)
        else -> Color(0xFFFFF8EC) to Color(0xFFF6F0FF)
    }

    /** The help card's top bar (night: the season's cap colors, lip - body - lip; else the lilac, pink, gold bar). */
    fun helpBar(s: SeasonSurfaces? = WTheme.season): List<Color> =
        s?.takeIf { it.dark }?.cap?.takeIf { it.size == 3 }?.let { listOf(it[0], it[1], it[0]) }
            ?: listOf(Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFFFBBF24))

    /**
     * Every (name, ink, fill, minimum ratio) pair these surfaces paint, for the contrast test: body text 4.5, large /
     * heavy display text and non-text marks 3.0. [fill]s are opaque (the cards over the wall are tested separately).
     */
    fun inkPairs(s: SeasonSurfaces?): List<Pair<String, Triple<Color, Color, Double>>> {
        val card = card(s)
        val you = youTint(s)
        val them = themTint(s)
        return listOf(
            "headline on the card" to Triple(ink(s), card, 4.5),
            "muted on the card" to Triple(muted(s), card, 4.5),
            "pink headline on the card" to Triple(pinkInk(s), card, 4.5),
            "ink on your chip" to Triple(ink(s), you, 4.5),
            "ink on your won chip" to Triple(ink(s), youWon(s), 4.5),
            "ink on their chip" to Triple(ink(s), them, 4.5),
            "ink on their won chip" to Triple(ink(s), themWon(s), 4.5),
            "purple ink on your chip" to Triple(purpleInk(s), you, 4.5),
            "amber ink on their chip" to Triple(amberInk(s), them, 4.5),
            "ink on a filled cell" to Triple(ink(s), cell(s), 4.5),
            "ink on a key" to Triple(ink(s), keyFace(s), 4.5),
            "muted on a key" to Triple(muted(s), keyFace(s), 3.0),
        )
    }
}
