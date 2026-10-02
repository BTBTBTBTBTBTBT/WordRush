package com.wordocious.app.ui

import com.wordocious.core.BannerTier
import com.wordocious.core.DayStreaks
import com.wordocious.core.GroupProgress
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * FINISH_SPEC Z: toggling Daily ⇄ Unlimited must not move the Home banner's tile rows.
 * Every layout input above the rows (scene band, host clearance, share slot, switch,
 * flame slots) and the switch's geometry must be identical in both modes.
 */
class BannerSlotsTest {
    private val progresses = listOf(
        GroupProgress(0, 0, 8), GroupProgress(3, 2, 8), GroupProgress(8, 5, 8), GroupProgress(8, 8, 8),
    )
    private val puzzleProgresses = listOf(
        GroupProgress(0, 0, 10), GroupProgress(10, 4, 10), GroupProgress(10, 10, 10),
    )
    private val streaks = listOf(DayStreaks(0, 0), DayStreaks(4, 0), DayStreaks(6, 2))

    @Test fun slotsAreIdenticalInBothModes() {
        for (w in progresses) for (p in puzzleProgresses) for (ws in streaks) for (ps in streaks) {
            val daily = bannerSlots(w, p, ws, ps, unlimited = false)
            val unlimited = bannerSlots(w, p, ws, ps, unlimited = true)
            assertEquals("slots for $w / $p / $ws / $ps", daily, unlimited)
            for (width in listOf(296f, 328f, 360f, 420f)) {
                assertEquals(sceneBandHeight(daily.sceneBand, width), sceneBandHeight(unlimited.sceneBand, width), 0f)
            }
        }
    }

    @Test fun sceneBandFollowsTodaysDailiesNotTheMode() {
        val swept = bannerSlots(GroupProgress(8, 5, 8), GroupProgress(0, 0, 10), DayStreaks(1, 0), DayStreaks(0, 0), unlimited = true)
        assertEquals(BannerTier.SWEEP, swept.sceneBand)
        assertEquals(false, swept.hostShown)
        assertEquals(0f, swept.headlineEndClear, 0f)
        val fresh = bannerSlots(GroupProgress(0, 0, 8), GroupProgress(0, 0, 10), DayStreaks(0, 0), DayStreaks(0, 0), unlimited = true)
        assertEquals(BannerTier.NONE, fresh.sceneBand)
        assertEquals(true, fresh.hostShown)
        assertEquals(BANNER_HOST_CLEAR.value, fresh.headlineEndClear, 0f)
    }

    @Test fun sceneBandHeightCapsTheArt() {
        assertEquals(0f, sceneBandHeight(BannerTier.NONE, 360f), 0f)
        // 10 bar + 8 padding + min(0.62 × width, 140).
        assertEquals(10f + 8f + 0.62f * 200f, sceneBandHeight(BannerTier.SWEEP, 200f), 0.001f)
        assertEquals(10f + 8f + 140f, sceneBandHeight(BannerTier.FLAWLESS, 400f), 0.001f)
    }

    @Test fun switchTrackNeverChangesWithSelection() {
        val geo = switchGeometry(34f, 66f)
        assertEquals(54f, geo.dailyWidth, 0f)
        assertEquals(86f, geo.unlimitedWidth, 0f)
        assertEquals(144f, geo.trackWidth, 0f)
        // The thumb covers exactly its segment; only it moves.
        assertEquals(0f to 54f, geo.thumb(unlimited = false))
        assertEquals(54f to 86f, geo.thumb(unlimited = true))
        val (x, w) = geo.thumb(unlimited = true)
        assertEquals(geo.trackWidth - BannerSlotSpec.SWITCH_PAD * 2, x + w, 0f)
    }
}
