package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Items 11 + 11b: parity with packages/core/src/leaderboard-stage.test.ts. */
class LeaderboardStageTest {
    @Test fun hostsOnePerWeekdayWNeverHostsWednesdayIsTheWizard() {
        assertEquals(7, LeaderboardStage.DAY_HOSTS.size)
        assertTrue(LeaderboardStage.DAY_HOSTS.all { it.castId != "w" })
        assertEquals("WEDNESDAY WIZARDS", leaderboardTitle("2026-10-07", null))   // a Wednesday
        assertEquals(LeaderboardStage.Host("u", "spin"), LeaderboardStage.host("2026-10-07"))
        assertEquals(0, LeaderboardStage.weekday("2026-10-04"))
        assertEquals(6, LeaderboardStage.weekday("2026-10-10"))
    }

    @Test fun ledgeStepsAreTwoOneThreeCentered() {
        assertEquals(listOf(2, 1, 3), LeaderboardStage.LEDGE_STEPS.map { it.place })
        assertEquals(0.5f, LeaderboardStage.LEDGE_STEPS[1].x, 0.0001f)
        assertTrue(LeaderboardStage.LEDGE_STEPS[1].top < LeaderboardStage.LEDGE_STEPS[0].top)
        assertTrue(LeaderboardStage.LEDGE_STEPS[0].top < LeaderboardStage.LEDGE_STEPS[2].top)
    }

    @Test fun stageTopLeavesRoomForThePodium() {
        assertTrue(LeaderboardStage.podiumFits(LeaderboardStage.TOP_MAX_HEIGHT))
        assertFalse(LeaderboardStage.podiumFits(LeaderboardStage.TOP_MAX_HEIGHT + 200))
    }

    @Test fun dayPropsAndWizardHat() {
        assertEquals(7, LeaderboardStage.DAY_PROPS.size)
        assertEquals(LeaderboardStage.DayProp("art-lb-day-wand-swish", "swish"), LeaderboardStage.dayProp("2026-10-07"))
        assertEquals(LeaderboardStage.DayProp("art-lb-day-lightning", "flash"), LeaderboardStage.dayProp("2026-10-08"))
        assertTrue(LeaderboardStage.DAY_PROPS.map { it.motion }.toSet().size >= 5)
        assertTrue(LeaderboardStage.wearsWizardHat("2026-10-07"))
        listOf("2026-10-04", "2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09", "2026-10-10").forEach { assertFalse(LeaderboardStage.wearsWizardHat(it)) }
    }
}
