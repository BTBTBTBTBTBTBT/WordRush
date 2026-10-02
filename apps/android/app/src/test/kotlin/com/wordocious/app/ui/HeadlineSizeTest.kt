package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC N1: calm centered titles — ≈62% / ≤ 300 × 64 dp; the day title ≈58% / ≤ 150 dp tall. */
class HeadlineSizeTest {
    @Test
    fun wide_lettering_is_width_limited_at_62_percent() {
        val (w, h) = HeadlineSize.fit(390f, 7.38f)
        assertEquals(390f * 0.62f, w, 0.01f)
        assertEquals(w / 7.38f, h, 0.01f)
        assertTrue(h <= 64f)
    }

    @Test
    fun tall_lettering_is_height_limited_at_64() {
        val (w, h) = HeadlineSize.fit(390f, 2.23f)
        assertEquals(64f, h, 0.01f)
        assertEquals(64f * 2.23f, w, 0.01f)
    }

    @Test
    fun tablets_cap_at_300_wide() {
        val (w, _) = HeadlineSize.fit(900f, 6f)
        assertEquals(300f, w, 0.01f)
    }

    @Test
    fun the_day_title_keeps_its_host_at_58_percent_and_150_tall() {
        // A wide day title is width-limited at 58%…
        val (w, h) = HeadlineSize.fit(390f, 1.82f, day = true)
        assertEquals(390f * 0.58f, w, 0.01f)
        assertTrue(h <= 150f)
        val (_, h2) = HeadlineSize.fit(390f, 1.05f, day = true)
        assertEquals(150f, h2, 0.01f)
    }
}
