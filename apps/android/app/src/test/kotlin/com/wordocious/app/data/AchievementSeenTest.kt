package com.wordocious.app.data

import com.wordocious.app.ui.BadgeArt
import com.wordocious.app.ui.BadgeMath
import com.wordocious.app.ui.BadgeMoment
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/** FINISH_SPEC BF3 / BE: unlocks celebrate once, in order; old unlocks never flood; hidden ones never show. */
class AchievementSeenTest {
    private val earned = mapOf("first_win" to "2026-09-01T10:00:00Z", "streak_7" to "2026-09-20T08:00:00Z")

    @Test fun firstLaunchSeedsEverythingAndCelebratesNothing() {
        val d = AchievementSeen.diff(earned, seen = null)
        assertEquals(emptyList<String>(), d.celebrate)
        assertEquals(earned.keys, d.seen)
    }

    @Test fun aNewKeyIsQueuedOnceThenNeverAgain() {
        val first = AchievementSeen.diff(earned + ("puzzle_sweep" to "2026-10-02T09:00:00Z"), seen = earned.keys)
        assertEquals(listOf("puzzle_sweep"), first.celebrate)
        val again = AchievementSeen.diff(earned + ("puzzle_sweep" to "2026-10-02T09:00:00Z"), seen = first.seen)
        assertEquals(emptyList<String>(), again.celebrate)
    }

    @Test fun alreadySeenNeverPopsAndNewOnesQueueOldestFirst() {
        val now = earned + ("night_owl" to "2026-10-02T03:00:00Z") + ("early_bird" to "2026-10-01T06:00:00Z")
        val d = AchievementSeen.diff(now, seen = earned.keys)
        assertEquals(listOf("early_bird", "night_owl"), d.celebrate)
    }

    @Test fun queueKeepsOrderAndDropsRepeats() {
        val queued = listOf<BadgeMoment>(BadgeMoment.Achievement("a"))
        val add = BadgeMath.toEnqueue(queued, seen = setOf("ach:b"), incoming = listOf(BadgeMoment.Achievement("a"), BadgeMoment.Achievement("b"), BadgeMoment.Achievement("c"), BadgeMoment.Achievement("d"), BadgeMoment.Achievement("c")))
        assertEquals(listOf("c", "d"), add.map { (it as BadgeMoment.Achievement).key })
    }

    @Test fun hiddenAchievementsAreDroppedFromTheCatalog() {
        val defs = listOf(
            AchievementService.AchievementDef("muddle_master", "Muddle Master", "Solve 25 Muddles", "puzzles"),
            AchievementService.AchievementDef("pocket_pro", "Pocket Pro", "Win every pocket game", "pocket", hidden = true),
        )
        assertEquals(listOf("muddle_master"), AchievementCatalog.visible(defs).map { it.key })
    }

    @Test fun ownArtNameAndCategoryFallback() {
        assertEquals("art_ach_muddle_master", BadgeArt.ownArtName("muddle_master"))
        assertEquals("art_ach_wake_up_call", BadgeArt.ownArtName("Wake-Up Call".replace(' ', '_')))
        // An icon without art falls back to the category's icon; a known icon wins.
        assertEquals(BadgeArt.achievement("grid"), BadgeArt.achievement("puzzle-piece", "puzzles"))
        assertEquals(BadgeArt.achievement("trophy"), BadgeArt.achievement("trophy", "puzzles"))
        assertNotEquals(BadgeArt.achievement("swords"), BadgeArt.achievement(null, "friends"))
    }
}
