package com.wordocious.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ModeGen
import com.wordocious.app.ui.theme.Palettes
import com.wordocious.app.ui.theme.SeasonSurfaces
import com.wordocious.app.ui.theme.WTheme
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Season readability (WCAG AA: 4.5:1 text, 3:1 large text / non-text UI) for EVERY season in
 * assets/season-registry.json, on the surfaces the Android app really paints each season ink on
 * (SeasonSurfaces → TintedCard, gameCardBg, the Home hero, tabBarLook, helperColors). The wall
 * behind a translucent card is art, so it is checked over the darkest and the lightest wall stop
 * (wallDark; wallLight too when the tone is light).
 */
class SeasonContrastTest {
    private val seasons = SeasonKit.parse(File("src/main/assets/season-registry.json").readText())

    /** The page accents a TintedCard washes with: the brand ones + every catalog game. */
    private val pageAccents = listOf(0xFF7C3AED, 0xFFEC4899, 0xFFF5A524, 0xFF2563EB, 0xFF0D9488, 0xFFF97316, 0xFF6366F1)
        .map { Color(it) } + ModeGen.enabled.map { it.accent }

    /** The darkest + the lightest wall stop the season can paint. */
    private fun walls(e: SeasonKit.Entry): List<Int> {
        val dark = e.surfaces?.dark == true
        val stops = (e.palette.wallDark + if (dark) emptyList<Color>() else e.palette.wallLight)
            .map { it.toArgb() }.sortedBy { InkContrast.luminance(it) }
        return listOf(stops.first(), stops.last())
    }

    /** A (translucent) fill composited over an opaque [base]. */
    private fun over(fill: Color, base: Int): Int = TintMath.over(fill.copy(alpha = 1f).toArgb(), fill.alpha, base)

    /** The on-card inks the theme takes under the season (SeasonSurfaces.palette over its base). */
    private fun inks(s: SeasonSurfaces): List<Pair<String, Int>> {
        val p = s.palette(if (s.dark) Palettes.Dark else Palettes.Light)
        return listOf("text" to p.text.toArgb(), "textSecondary" to p.textSecondary.toArgb(), "textMuted" to p.textMuted.toArgb())
    }

    private fun muted(s: SeasonSurfaces): Int = inks(s).last().second

    private fun expect(ink: Int, bg: Int, min: Double, what: String) {
        val r = InkContrast.ratio(ink, bg)
        assertTrue("$what: ${hex(ink)} on ${hex(bg)} is ${"%.2f".format(r)}:1, needs $min", r >= min)
    }

    private fun hex(c: Int) = "#%06X".format(c and 0xFFFFFF)

    /** Runs [block] with [s] as the active season (WTheme.season), restoring the old one. */
    private fun <T> withSeason(s: SeasonSurfaces, block: () -> T): T {
        val old = WTheme.season
        return try {
            WTheme.season = s
            block()
        } finally {
            WTheme.season = old
        }
    }

    @Test fun registryParses() {
        assertFalse(seasons.isEmpty())
        seasons.forEach { assertTrue(it.id, it.palette.wallDark.isNotEmpty()) }
    }

    /**
     * Page cards (TintedCard: the page accent washed over the season card, at cardOpacity over the
     * wall) and the opaque card (the sheets' surface; the VS + Friends night pages, VsInk.page /
     * FriendsInk.page / FRIENDS_SHEET) under the on-card inks.
     */
    @Test fun onCardInksOnTheSeasonCard() {
        for (e in seasons) {
            val s = e.surfaces?.takeIf { it.cardFill != null } ?: continue
            val bgs = walls(e).flatMap { w ->
                listOf(over(s.cardFill!!, w)) + pageAccents.map { over(s.wash(it, 0.06f).copy(alpha = s.cardOpacity), w) }
            } + s.card!!.toArgb()
            for (bg in bgs) for ((n, ink) in inks(s)) expect(ink, bg, 4.5, "${e.id} $n on the card")
        }
    }

    /** Chips inside cards (WTheme.surfaceAlt / surfaceHover = raised, opaque). */
    @Test fun onCardInksOnRaisedChips() {
        for (e in seasons) {
            val s = e.surfaces ?: continue
            val raised = s.raised?.toArgb() ?: continue
            for ((n, ink) in inks(s)) expect(ink, raised, 4.5, "${e.id} $n on raised")
        }
    }

    /**
     * The Home hero (HomeBannerView): the clock line (subInk = textSecondary) on the hero fill, the
     * WORDOCIOUS / PUZZLES row labels (tierInk NONE = textSecondary) on the rows band (raised at
     * 45% over the hero), and the greeting lettering's fills (headline top, bottom, nameTop,
     * nameBottom; large text) on the hero fill.
     */
    @Test fun heroInks() {
        for (e in seasons) {
            val s = e.surfaces ?: continue
            val fill = s.heroFill ?: continue
            val sub = inks(s)[1].second
            for (w in walls(e)) {
                val hero = over(fill, w)
                expect(sub, hero, 4.5, "${e.id} hero clock line")
                s.raised?.let { expect(sub, over(it.copy(alpha = 0.45f), hero), 4.5, "${e.id} hero row label") }
                s.headline?.let { h ->
                    for (i in listOf(0, 1, 3, 4)) expect(h[i].toArgb(), hero, 3.0, "${e.id} headline[$i] on the hero")
                }
            }
        }
    }

    /**
     * The Home game cards (ModeCardView): gameCardBg (the game color over the season card, a
     * finished daily deeper — SeasonDone) at cardOpacity over the wall; the name in
     * SeasonSurfaces.onCard and the subtitle in textMuted.
     */
    @Test fun gameCardInks() {
        for (e in seasons) {
            val s = e.surfaces?.takeIf { it.cardFill != null } ?: continue
            withSeason(s) {
                for (m in ModeGen.enabled) {
                    for (done in if (m.dailyEligible) listOf(false, true) else listOf(false)) {
                        val card = gameCardBg(m.accent, done)
                        for (w in walls(e)) {
                            val bg = over(card, w)
                            val what = "${e.id} ${m.id} card${if (done) " (finished)" else ""}"
                            expect(muted(s), bg, 4.5, "$what subtitle")
                            expect(s.onCard(m.accent).toArgb(), bg, 4.5, "$what name")
                        }
                    }
                }
            }
        }
    }

    /**
     * The tab bar (MainScreen): the season's bar (tabBarLook: raised → card); the selected label
     * #FDBA74 and its #F97316 underline pill (fixed while a season card is on); unselected labels
     * in textMuted on a dark tone, the fixed #8A78AD on a light one.
     */
    @Test fun tabBarInks() {
        for (e in seasons) {
            val s = e.surfaces?.takeIf { it.card != null } ?: continue
            val look = withSeason(s) { tabBarLook(0) }
            for (bg in listOf(look.top, look.bottom).map { it.toArgb() }) {
                expect(0xFFFDBA74.toInt(), bg, 4.5, "${e.id} selected tab label")
                expect(0xFFF97316.toInt(), bg, 3.0, "${e.id} selected tab underline")
                expect(if (s.dark) muted(s) else 0xFF8A78AD.toInt(), bg, 4.5, "${e.id} tab label")
            }
        }
    }

    /**
     * The helper pill (buttonTint) and the quiet pill (quietTint), helperColors: fill, pressed fill
     * and ink. The dark look follows the season's tone (WTheme.isDark); without surfaces it follows
     * the player's theme (both).
     */
    @Test fun helperAndQuietPills() {
        for (e in seasons) {
            val schemes = e.surfaces?.let { listOf(it.dark) } ?: listOf(true, false)
            for (dark in schemes) {
                for ((n, tint) in listOf("buttonTint" to e.palette.buttonTint, "quietTint" to e.palette.quietTint)) {
                    val c = helperColors(tint, dark)
                    expect(c.ink.toArgb(), c.fill.toArgb(), 4.5, "${e.id} $n pill label")
                    expect(c.ink.toArgb(), c.fillPressed.toArgb(), 4.5, "${e.id} $n pill label (pressed)")
                }
            }
        }
    }

    /**
     * A selected helper (a toggle that is on, e.g. the Sudoku / pad notes toggle, PadKit): the
     * solid buttonTint (black 15% over it pressed) with a white 12.5-sp label — in a game the
     * season tint wins over the game's.
     */
    @Test fun selectedHelperOnButtonTint() {
        for (e in seasons) {
            val t = e.palette.buttonTint
            expect(Color.White.toArgb(), t.toArgb(), 4.5, "${e.id} selected helper label")
            expect(Color.White.toArgb(), famMix(t, Color.Black, 0.15f).toArgb(), 4.5, "${e.id} selected helper label (pressed)")
        }
    }
}
