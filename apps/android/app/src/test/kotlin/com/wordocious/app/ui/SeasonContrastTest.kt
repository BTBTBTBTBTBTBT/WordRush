package com.wordocious.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import com.wordocious.app.ModeGen
import com.wordocious.app.ui.friends.FRIENDS_CARD_ACCENT
import com.wordocious.app.ui.friends.FriendsPink
import com.wordocious.app.ui.friends.PocketNight
import com.wordocious.app.ui.friends.gradient
import com.wordocious.app.ui.theme.Palettes
import com.wordocious.app.ui.theme.SeasonSurfaces
import com.wordocious.app.ui.theme.WTheme
import com.wordocious.core.FriendlyKind
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
     * 2.8 item 24: the wave-3 surfaces under every DARK season (Halloween: card #1C0F30, text #F7EEFF, accent #F97316) —
     * the Friends cards (pink wash over the season card), the pocket boards' chips / cells / keys (PocketNight), the
     * pocket help card and the first-play guide card, the game title lettering, the waiting strip's inks and Hubbub's
     * found tiles + rank line. Body text 4.5:1; the large display lettering (titles) and the key glyph 3:1.
     */
    @Test fun wave3SurfacesOnTheDarkSeasonCard() {
        for (e in seasons) {
            val s = e.surfaces?.takeIf { it.dark && it.card != null } ?: continue
            val id = e.id
            val card = s.card!!.toArgb()
            val raised = (s.raised ?: s.card!!).toArgb()

            // The pocket boards' chips, cells, keys and the card's own inks.
            for ((name, t) in PocketNight.inkPairs(s)) expect(t.first.toArgb(), t.second.toArgb(), t.third, "$id $name")

            // The Friends cards (friendsCard = the pink wash over the season card): name, muted, headline, presence.
            val friendCard = s.wash(FRIENDS_CARD_ACCENT, Wash.CARD * 0.5f).toArgb()
            for ((n, ink) in listOf(
                "name" to s.text!!, "muted" to s.textMuted!!, "headline" to PocketNight.pinkInk(s), "presence" to FriendsPink.green,
            )) expect(ink.toArgb(), friendCard, 4.5, "$id Friends card $n")

            // The waiting strip / lobby: the status timer and idle bits are VsTeal.label / sub (the season's muted / secondary text) on the card.
            expect(s.textMuted!!.toArgb(), card, 4.5, "$id waiting timer")
            expect(s.textSecondary!!.toArgb(), card, 4.5, "$id waiting idle line")

            // The title lettering (24 sp / 18 sp Black, large text): every pocket game's lifted gradient stop, on the game
            // screen's card and on the help card's two stops.
            for (kind in FriendlyKind.entries) {
                for (stop in PocketNight.title(kind.gradient, s)) {
                    for (bg in listOf(card, raised)) expect(stop.toArgb(), bg, 3.0, "$id ${kind.name} title")
                }
            }
            val help = PocketNight.helpCard(darkTheme = true, s = s)
            for (bg in listOf(help.first, help.second)) {
                for ((n, ink) in listOf("step" to s.text!!, "label" to s.textMuted!!, "win" to s.text!!)) {
                    expect(ink.toArgb(), bg.toArgb(), 4.5, "$id help card $n")
                }
            }

            // The first-play guide card: the section headings take SeasonSurfaces.onCard(game color) on the season card.
            for (m in ModeGen.enabled) expect(s.onCard(m.accent).toArgb(), card, 4.5, "$id guide heading ${m.id}")

            // Hubbub: the found tiles are the tone at low alpha over the tray (the season card / raised / the darkest wall).
            val trays = listOf(card, raised, walls(e).first())
            for (tray in trays) {
                fun tile(tone: Long, alpha: Float) = TintMath.over(Color(tone).toArgb(), alpha, tray)
                for ((name, ink, fill) in listOf(
                    Triple("pangram", PocketNight.hubPangramInk(true), tile(0xFFF5A524, 0.42f)),
                    Triple("pangram (bottom)", PocketNight.hubPangramInk(true), tile(0xFFF5A524, 0.30f)),
                    Triple("revealed", PocketNight.hubRevealedInk(true), tile(0xFF8B5CF6, 0.30f)),
                    Triple("word", s.text!!, tile(0xFFC026D3, 0.30f)),
                    Triple("word (bottom)", s.text!!, tile(0xFFC026D3, 0.20f)),
                )) expect(ink.toArgb(), fill, 4.5, "$id Hubbub $name tile on ${hex(tray)}")
            }
            expect(PocketNight.hubSolvedInk(true).toArgb(), card, 4.5, "$id Hubbub solved rank line")
        }
    }

    /** Out of season / a light season the wave-3 surfaces are exactly the original light ones (nothing changes). */
    @Test fun wave3SurfacesAreUnchangedOutOfSeason() {
        assertTrue(PocketNight.youTint(null) == Color(0xFFEDE9FE))
        assertTrue(PocketNight.themTint(null) == Color(0xFFFEF3C7))
        assertTrue(PocketNight.ink(null) == Color(0xFF4C1D95))
        assertTrue(PocketNight.cell(null) == Color.White)
        assertTrue(PocketNight.keyFace(null) == Color(0xFFF1EAFF))
        assertTrue(PocketNight.pinkInk(null) == Color(0xFFDB2777))
        assertTrue(PocketNight.title(listOf(Color.Red), null) == listOf(Color.Red))
        // The light twins pass on their own light fills.
        for (kind in FriendlyKind.entries) assertTrue(kind.name, PocketNight.title(kind.gradient, null) == kind.gradient)
        expect(PocketNight.ink(null).toArgb(), PocketNight.youTint(null).toArgb(), 4.5, "light ink on your chip")
        expect(PocketNight.hubPangramInk(false).toArgb(), TintMath.over(0xFFF5A524.toInt(), 0.42f, 0xFFFFFFFF.toInt()), 4.5, "light Hubbub pangram")
    }

    /**
     * A selected helper (a toggle that is on, e.g. the Sudoku / pad notes toggle, PadKit): the
     * solid buttonTint (black 15% over it pressed) with a white 12.5-sp label — in a game the
     * season tint wins over the game's.
     */
    @Test fun selectedHelperOnButtonTint() {
        for (e in seasons) {
            val t = e.palette.buttonTint
            val ink = InkContrast.onSolid(t.toArgb())
            expect(ink, t.toArgb(), 4.5, "${e.id} selected helper label")
            expect(ink, famMix(t, Color.Black, 0.15f).toArgb(), 4.5, "${e.id} selected helper label (pressed)")
        }
    }
}
