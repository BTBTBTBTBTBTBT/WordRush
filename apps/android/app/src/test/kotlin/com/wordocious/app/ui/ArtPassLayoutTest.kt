package com.wordocious.app.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

/** docs/ART_SPEC.md §14 (header art sizing), §15 (game tints), §17 (the widget's day host), §19 (wallpapers, section titles, big game titles). */
class ArtPassLayoutTest {
    @Test fun headerArtFillsTheWidthBetweenTheCorners() {
        // ≈900 × 220 art on a 236 dp gap: the width rule lands mid-range.
        assertEquals(57.68f, gameTitleArtHeight(236.dp, 220f / 900f, 44.dp, 72.dp).value, 0.01f)
    }

    @Test fun headerArtCapsAt72AndFloorsAt44() {
        assertEquals(72f, gameTitleArtHeight(400.dp, 0.25f, 44.dp, 72.dp).value, 0f)
        // MUDDLE-short / ProperNoundle-long: under 44 the floor wins and the art centers.
        assertEquals(44f, gameTitleArtHeight(236.dp, 155f / 900f, 44.dp, 72.dp).value, 0f)
        // No floor (the Play card): the width rule alone.
        assertEquals(30f, gameTitleArtHeight(120.dp, 0.25f, 0.dp, 52.dp).value, 0.001f)
    }

    @Test fun overBlendsOntoTheBase() {
        assertEquals(0xFFFFFFFF.toInt(), TintMath.over(0xFF7C3AED.toInt(), 0f, 0xFFFFFFFF.toInt()))
        assertEquals(0xFF7C3AED.toInt(), TintMath.over(0xFF7C3AED.toInt(), 1f, 0xFFFFFFFF.toInt()))
        // 10% black over white: 255 × 0.9 = 229.5 → 230.
        assertEquals(0xFFE6E6E6.toInt(), TintMath.over(0xFF000000.toInt(), 0.10f, 0xFFFFFFFF.toInt()))
    }

    @Test fun gameTintStopsFollowTheSpec() {
        val accent = 0xFF7C3AED.toInt()
        assertArrayEquals(
            intArrayOf(
                TintMath.over(accent, 0.06f, 0xFFFFFFFF.toInt()),
                TintMath.over(accent, 0.10f, 0xFFFFFFFF.toInt()),
                TintMath.over(accent, 0.04f, 0xFFFFF7FB.toInt()),
            ),
            TintMath.gameLight(accent),
        )
        assertArrayEquals(
            intArrayOf(
                TintMath.over(accent, 0.10f, 0xFF120D1F.toInt()),
                TintMath.over(accent, 0.14f, 0xFF120D1F.toInt()),
                TintMath.over(accent, 0.08f, 0xFF120D1F.toInt()),
            ),
            TintMath.gameDark(accent),
        )
        // Opaque, and the light stops stay pale (every channel ≥ 0xE6).
        TintMath.gameLight(accent).forEach { c ->
            assertEquals(0xFF, c ushr 24)
            listOf(16, 8, 0).forEach { sh -> assert(((c ushr sh) and 0xFF) >= 0xE6) }
        }
    }

    @Test fun dayHostMatchesTheDayTitleArt() {
        // 2026-10-05 is a Monday.
        val expected = listOf(MascotId.D, MascotId.I, MascotId.U, MascotId.S, MascotId.O2, MascotId.O1, MascotId.O3)
        expected.forEachIndexed { i, id -> assertEquals(id, Mascots.dayHost(LocalDate.of(2026, 10, 5).plusDays(i.toLong()))) }
    }

    @Test fun bigGameTitleCapsAt120And56OnShortScreens() { // BA1: 56 on short screens (was 84)
        assertEquals(120f, gameHeaderTitleMax(800.dp).value, 0f)
        assertEquals(120f, gameHeaderTitleMax(700.dp).value, 0f)
        assertEquals(56f, gameHeaderTitleMax(699.dp).value, 0f)
        // A 411 dp phone: 411 − 20 (screen inset) − 32 = 359 dp wide; ≈900 × 280 art → ≈112 dp.
        assertEquals(111.69f, gameTitleArtHeight(359.dp, 280f / 900f, 44.dp, gameHeaderTitleMax(914.dp)).value, 0.01f)
    }

    @Test fun sectionTitlesAre78PercentUpTo340() {
        assertEquals(280.8f, sectionTitleArtWidth(360.dp).value, 0.01f)
        assertEquals(340f, sectionTitleArtWidth(600.dp).value, 0f)
    }

    @Test fun everyGameWithTitleArtHasAWallpaper() {
        val ids = listOf(
            "practice", "gauntlet", "quordle", "octordle", "sequence", "rescue", "six", "seven", "propernoundle",
            "sudoku", "scramble", "hub", "crossword", "groups", "ladder", "cryptogram", "wordsearch", "regions",
        )
        ids.forEach { id ->
            assert(gameTitleArtRes(id) != null) { id }
            assert(gameWallpaperRes(id) != null) { id }
        }
        assertEquals(ids.size, ids.mapNotNull { gameWallpaperRes(it) }.toSet().size)
        assertEquals(null, gameWallpaperRes("vs"))
        assertEquals(PageTint.values().size, PageTint.values().map { it.wallpaperRes() }.toSet().size)
    }
}
