package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** FINISH_SPEC A1 washes, A9 squish, the cast pose table and C5's week tiles. */
class FinishKitTest {
    @Test fun washIsTheAccentOverWhite() {
        // color-mix(in srgb, #7c3aed 13%, white): 255 − (255 − c) × .13.
        assertEquals(0xFFEEE5FD.toInt(), Wash.mixArgb(0xFF7C3AED.toInt(), 0.13f))
        assertEquals(0xFFFFFFFF.toInt(), Wash.mixArgb(0xFF7C3AED.toInt(), 0f))
        // The accent's own alpha is ignored (washes are opaque).
        assertEquals(Wash.mixArgb(0xFF0D9488.toInt(), 0.32f), Wash.mixArgb(0x330D9488, 0.32f))
    }

    @Test fun squishDepthEasesOffOnBigSurfacesAndSkipsScrims() {
        assertEquals(1f, Squish.attenuation(120f, 44f), 0f)
        assertEquals(Squish.MIN_DEPTH, Squish.attenuation(360f, 300f), 0.001f)
        assertEquals(0f, Squish.attenuation(400f, 800f), 0f)
        val mid = Squish.attenuation(300f, 186f)
        assertTrue(mid < 1f && mid > Squish.MIN_DEPTH)
        assertEquals(0.92f, Squish.applied(Squish.DOWN, 1f), 0.0001f)
        assertEquals(1f, Squish.applied(Squish.DOWN, 0f), 0f)
    }

    @Test fun everyShippedPoseIsReachable() {
        // 62 personality poses + the VS set (4 per character).
        assertEquals(62 + 40, CastPoses.count)
        MascotId.entries.forEach {
            assertTrue(CastPoses.poses(it).size >= 10)
            assertTrue(CastPoses.poses(it).containsAll(listOf("ready", "waiting", "victory", "goodgame")))
        }
        assertNotNull(CastPoses.res(MascotId.S, "trophy"))
        assertNotNull(CastPoses.res(MascotId.U, "Lotus"))
        assertNull(CastPoses.res(MascotId.W, "moonwalk"))
    }

    @Test fun candyLipIsTheBottomDarkened() {
        // #6d28d9 darkened 35%: each channel × .65.
        val lip = CandyColor.PURPLE.lip
        assertEquals(0x6D * 0.65f / 255f, lip.red, 0.01f)
        assertEquals(0x28 * 0.65f / 255f, lip.green, 0.01f)
        assertEquals(0xD9 * 0.65f / 255f, lip.blue, 0.01f)
    }

    @Test fun streakWeekCountsBackFromTodayOrYesterday() {
        val thu = LocalDate.of(2026, 10, 1) // a Thursday
        // Played today, 3-day run: Tue Wed Thu.
        assertEquals(listOf(false, true, true, true, false, false, false), StreakWeek.days(thu, 3, playedToday = true))
        // Not yet today: the run ends yesterday (Mon Tue Wed).
        assertEquals(listOf(true, true, true, false, false, false, false), StreakWeek.days(thu, 3, playedToday = false))
        // A long run fills the week up to today.
        assertEquals(listOf(true, true, true, true, false, false, false), StreakWeek.days(thu, 82, playedToday = true))
        assertEquals(List(7) { false }, StreakWeek.days(thu, 0, playedToday = true))
    }
}
