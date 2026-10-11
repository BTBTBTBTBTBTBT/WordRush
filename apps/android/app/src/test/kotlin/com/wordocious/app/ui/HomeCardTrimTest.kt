package com.wordocious.app.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC BH: the compact Home game card + its candy cap trim (parity with web/iOS). */
class HomeCardTrimTest {
    @Test fun compactCardMeasures() {
        // Founder 10-10: full-width names — ~74–82 tall, the name on top, the 30 dp icon leading the subtitle line.
        assertTrue(HomeCardSpec.HEIGHT in 74f..82f)
        assertEquals(40f, HomeCardSpec.ICON)
        assertEquals(30f, HomeCardSpec.ROW_ICON)
        assertEquals(18f, HomeCardSpec.NAME)
        assertEquals(13f, HomeCardSpec.DESC)
        assertEquals(22f, HomeCardSpec.BADGE)
        // The card hugs the rows: band + top pad + name line + gap + icon row + bottom pad.
        val content = 21f + HomeCardSpec.DESC_GAP + HomeCardSpec.ROW_ICON
        assertTrue(CardTrimGeometry.BAND + HomeCardSpec.PAD_TOP + content + HomeCardSpec.PAD_BOTTOM <= HomeCardSpec.HEIGHT + 1f)
    }

    /** BJ18: one name size per grid row — the widest name decides it; floored at 13 (then per-card shrink). iOS parity. */
    @Test fun uniformNameSizeFitsTheWidestName() {
        assertEquals(18f, HomeCardSpec.uniformNameSize(listOf(60f, 70f), 80f))
        assertEquals(16.5f, HomeCardSpec.uniformNameSize(listOf(60f, 85f), 80f))   // 18 × 80/85 = 16.9 → 16.5
        assertEquals(13f, HomeCardSpec.uniformNameSize(listOf(60f, 200f), 80f))     // the floor
        assertEquals(18f, HomeCardSpec.uniformNameSize(emptyList(), 80f))
        assertEquals(170f - 20f - 4f - 22f, HomeCardSpec.nameSlot(350f))
    }

    @Test fun longResultStaysOneLine() {
        assertEquals("3 guesses · 23s", HomeCardSpec.compactLine("3 guesses · 23s"))
        assertEquals("38g · 10m 46s", HomeCardSpec.compactLine("38 guesses · 10m 46s"))
        assertEquals("12 miss · 10m 46s", HomeCardSpec.compactLine("12 mistakes · 10m 46s"))
    }

    @Test fun trimIsOneRowOfDrips() {
        val segs = CardTrimGeometry.segments(176f)
        assertEquals(CardTrimGeometry.BUMPS, segs.size)
        // Right → left, the first drip ends at x = 154 on the band line, the last at the left edge.
        assertEquals(154f, segs.first()[2], 0.001f)
        assertEquals(0f, segs.last()[2], 0.001f)
        // Control 2·drip below the band → the curve peaks exactly `drip` below it.
        assertEquals(CardTrimGeometry.BAND + 2 * CardTrimGeometry.DRIP, segs[0][1], 0.001f)
        assertTrue(CardTrimGeometry.BAND + CardTrimGeometry.DRIP <= HomeCardSpec.HEIGHT / 5f)
    }

    @Test fun compactBanner() {
        // BH3: the 52 dp host centered on the one-line headline row; the slimmer banner pieces.
        assertEquals(52f, HOME_HOST_SIZE.value)
        assertEquals(6f, HOME_HOST_PEEK.value)
        assertEquals(34f, BannerSlotSpec.SHARE)
        val src = java.io.File("src/main/kotlin/com/wordocious/app/ui/HomeBannerView.kt").readText()
        // 2.8 item 6: the headline now wraps to a balanced 2nd line via BubbleText (never "…"), so no maxLines = 1.
        assertTrue(src.contains("homeHeadlineFit("))
        assertTrue(src.contains("(maxWidth * 0.64f).coerceAtMost(230.dp)"))
    }
}
