package com.wordocious.app.ui

import com.wordocious.app.data.HomeHostPick
import com.wordocious.core.AvatarConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BJ6: the Good Morning host geometry, its render rule, the header + flair pins. */
class HomeHostRulesTest {
    @Test
    fun host_geometry_matches_the_round_3_pin() {
        // Round 3 (founder: "way more prominent" + compact): 88 dp, rising 28 above the card.
        assertEquals(88f, HOME_HOST_BOX.value)
        assertEquals(28f, HOME_HOST_RISE.value)
        // The 22 dp headroom + 6 dp overhang over the header's empty bottom edge mechanism stays.
        assertEquals(22f, HOME_BANNER_TOP.value)
        assertEquals(6f, HOME_HOST_OVERHANG.value)
        // 60 dp inside the card, then 4 to the headline; with the scene band (or no host) a plain 4.
        assertEquals(64f, homeStripTop(sceneBand = false))
        assertEquals(4f, homeStripTop(sceneBand = true))
        assertEquals(4f, homeStripTop(sceneBand = false, hostShown = false))
        assertEquals(38f, HOME_HEADLINE_SP)
    }

    @Test
    fun host_renders_in_every_state_except_a_w_behind_the_celebration_art() {
        val mascot = HomeHostPick.Mascot(AvatarConfig())
        val photo = HomeHostPick.Portrait("https://x/storage/v1/object/public/avatars/a.jpg", "gold")
        // Guests / seeded players: W renders (the iOS bug was a missing guest host).
        assertTrue(homeHostShows(HomeHostPick.W, wVisible = true))
        assertTrue(homeHostShows(mascot, wVisible = true))
        assertTrue(homeHostShows(photo, wVisible = true))
        // The celebration art carries the cast: only a W host steps aside (its space collapses).
        assertFalse(homeHostShows(HomeHostPick.W, wVisible = false))
        assertTrue(homeHostShows(mascot, wVisible = false))
        assertTrue(homeHostShows(photo, wVisible = false))
    }

    @Test
    fun header_share_shows_in_daily_after_a_finished_game_only() {
        assertFalse(homeShareVisible(unlimited = false, playedToday = 0))
        assertTrue(homeShareVisible(unlimited = false, playedToday = 1))
        assertFalse(homeShareVisible(unlimited = true, playedToday = 5))
    }

    @Test
    fun header_controls_are_evenly_spaced() {
        // Each icon control = its 23 dp icon + 4 a side, so neighbors sit 8 dp apart edge to edge.
        assertEquals(8f, HEADER_CONTROL_GAP.value)
        assertEquals(SOFT_CONTROL_ICON.value + 8f, HEADER_CONTROL_W.value)
    }

    @Test
    fun flair_is_symmetric_and_subtle() {
        val xs = homeCornerDotXs()
        val n = HOME_CORNER_DOTS.size
        for (i in 0 until n) assertEquals(1f, xs[i] + xs[i + n], 0.0001f)
        HOME_CORNER_DOTS.forEach { (_, _, r) -> assertTrue(r * 2 in 2f..4f) }
        assertEquals(8f, HOME_CAP_BAND)
        assertTrue(HOME_ROWS_TINT.alpha <= 0.10f)
    }
}

class HomeTileSizeTest {
    @Test
    fun progress_icons_are_as_large_as_fit() {
        // A 390 dp phone: 358 dp card (16 dp page margins) − 2 × 8 row padding = 342 dp; 10 tiles.
        val s = homeTileSize(342f, 10)
        assertEquals((342f - 36f) / 10f, s, 0.001f)
        assertTrue(s > (334f - 45f) / 10f) // bigger than before (12 dp padding, 5 dp gaps)
        // Wide screens cap at 36; gaps never drop under 4.
        assertEquals(36f, homeTileSize(600f, 10), 0.001f)
        assertTrue(342f - 10 * s >= 4f * 9 - 0.001f)
    }
}

class HomeHeadlineFitTest {
    @Test
    fun fit_is_core_size_on_the_slot_less_the_art_pad() {
        // A 390 dp phone: card 358, strip padding 2 × 12 → 334; sparkle sides 2 × 16 → 302 per line.
        val fit = homeHeadlineFit(302f)
        assertEquals(com.wordocious.core.headlineFontSize(292.0), fit.size)
        assertEquals(292.0 / fit.size, fit.maxEm, 1e-9)
        // "GOOD AFTERNOON," always fits one line at the device size (it sets the size).
        assertTrue(com.wordocious.core.headlineWidthEm(com.wordocious.core.HEADLINE_SIZING_LINE) <= fit.maxEm)
        // Wide screens cap at 38.
        assertEquals(38, homeHeadlineFit(900f).size)
    }

    @Test
    fun long_names_stack_full_size_never_shrink() {
        val fit = homeHeadlineFit(302f)
        val l = com.wordocious.core.headlineLayout("GOOD AFTERNOON, MAXIMILLIAN_THE_GREAT!", "Maximillian_The_Great", fit.maxEm)
        assertTrue(l.lines.size > 1)
        assertTrue(l.nameLines.isNotEmpty())
        l.lines.forEach { assertTrue(it, com.wordocious.core.headlineWidthEm(it) <= fit.maxEm) }
        assertTrue(homeHeadlineFixedSize("GOOD AFTERNOON, BMT!", "BMT", stacked = false))
        assertTrue(homeHeadlineFixedSize("WARMING UP · 3 DOWN", "BMT", stacked = true))
        assertFalse(homeHeadlineFixedSize("HOME STRETCH · 2 LEFT", "BMT", stacked = false))
    }
}
