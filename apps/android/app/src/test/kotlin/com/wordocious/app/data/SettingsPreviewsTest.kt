package com.wordocious.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BI25: Settings tile previews + single-fire sheet taps (parity ×3). */
class SettingsPreviewsTest {
    @Test fun themePreviewsSpellWordInEachThemesColors() {
        for (key in listOf("light", "dark", "ocean", "forest")) {
            val spec = SettingsPreviews.theme(key)
            assertEquals("WORD", spec.tiles.joinToString("") { it.letter })
        }
        assertEquals(0x1A1A2E, SettingsPreviews.theme("dark").page)
        assertEquals(0x0EA5E9, SettingsPreviews.theme("ocean").tiles[0].hex)
        assertEquals(0x16A34A, SettingsPreviews.theme("forest").tiles[0].hex)
        assertEquals(SettingsPreviews.theme("default"), SettingsPreviews.theme("light"))
    }

    @Test fun keyRowsPlaceEnterAndDelete() {
        val e = SettingsPreviews.ENTER; val d = SettingsPreviews.DELETE
        assertEquals(listOf(listOf(e, "Z", "X", "C", "V", d)), SettingsPreviews.keyRows("standard"))
        assertEquals(listOf(listOf(d, "Z", "X", "C", "V", e)), SettingsPreviews.keyRows("flipped"))
        assertEquals(listOf(listOf(d, "Z", "X", "C", "V", d), listOf(e, SettingsPreviews.SPACE, e)), SettingsPreviews.keyRows("michael"))
    }

    @Test fun sheetTapIsSingleFire() {
        assertTrue(SettingsPreviews.sheetTapFires(1000, null, false))
        assertFalse(SettingsPreviews.sheetTapFires(1200, 1000, false))
        assertFalse(SettingsPreviews.sheetTapFires(3000, 1000, true))
        assertTrue(SettingsPreviews.sheetTapFires(1700, 1000, false))
    }
}
