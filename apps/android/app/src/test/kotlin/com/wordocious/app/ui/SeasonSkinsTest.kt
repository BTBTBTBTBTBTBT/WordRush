package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** FINISH_SPEC X: the season switch, the admin preview and the costume crops. */
class SeasonSkinsTest {
    @Test fun seasonFollowsTheCoreWindowAndThePreview() {
        assertNull(SeasonSkins.seasonFor(LocalDate.of(2026, 10, 2), force = false))
        assertEquals("halloween", SeasonSkins.seasonFor(LocalDate.of(2026, 10, 2), force = true))
        assertEquals("halloween", SeasonSkins.seasonFor(LocalDate.of(2026, 10, 24), force = false))
        assertEquals("halloween", SeasonSkins.seasonFor(LocalDate.of(2026, 11, 1), force = false))
        assertNull(SeasonSkins.seasonFor(LocalDate.of(2026, 11, 2), force = false))
        assertEquals("halloween", SeasonSkins.seasonFor(LocalDate.of(2026, 10, 17), force = false))
        assertNull(SeasonSkins.seasonFor(LocalDate.of(2026, 10, 16), force = false))
        assertEquals("halloween", SeasonSkins.seasonFor(LocalDate.of(2026, 3, 1), preview = "halloween"))
        assertNull(SeasonSkins.seasonFor(LocalDate.of(2026, 3, 1), preview = null))
    }

    @Test fun costumeCropsFitTheirSource() {
        MascotId.entries.forEach { id ->
            val f = SeasonSkins.frame(id, "halloween")
            assertEquals(320, f.source)
            assertTrue(f.crop.left >= 0 && f.crop.top >= 0 && f.crop.right <= 320 && f.crop.bottom <= 320)
            assertTrue(f.crop.width > 0 && f.crop.height > 0)
            assertEquals(512, SeasonSkins.frame(id, null).source)
        }
    }

    @Test fun rowFillsTheWidthInEitherSkin() {
        for (season in listOf(null, "halloween")) {
            val width = 400f
            val h = SeasonSkins.figureHeight(width, season)
            val span = MascotId.entries.sumOf { (SeasonSkins.frame(it, season).crop.aspect * h).toDouble() }.toFloat() -
                CastCrops.OVERLAP * width * (MascotId.entries.size - 1)
            assertEquals(width, span, 0.5f)
        }
        assertEquals(CastCrops.figureHeight(400f), SeasonSkins.figureHeight(400f, null), 0.001f)
    }
}
