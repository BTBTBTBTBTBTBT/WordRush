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

    @Test fun secretAchievementsAreListedOnlyOnceUnlocked() {
        val defs = listOf(
            AchievementService.AchievementDef("muddle_master", "Muddle Master", "Solve 25 Muddles", "puzzles"),
            AchievementService.AchievementDef("pocket_pro", "Pocket Pro", "Win every pocket game", "pocket", hidden = true),
            AchievementService.AchievementDef("tune_ode_to_joy", "Ode to Joy", "Played Ode to Joy on the cast", "mascot", secret = true),
        )
        assertEquals(listOf("muddle_master"), AchievementCatalog.listed(defs) { false }.map { it.key })
        assertEquals(listOf("muddle_master", "tune_ode_to_joy"), AchievementCatalog.listed(defs) { true }.map { it.key })
        // The bundled snapshot carries `secret` on the seven musical-cast tunes (five everyday + two Halloween; core MusicalCast.ACHIEVEMENT_KEYS).
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }
        val body = java.io.File("src/main/assets/achievements-catalog.json").readText()
        val all = json.decodeFromString(
            kotlinx.serialization.builtins.ListSerializer(AchievementService.AchievementDef.serializer()),
            json.parseToJsonElement(body).let { (it as kotlinx.serialization.json.JsonObject)["achievements"].toString() },
        )
        assertEquals(com.wordocious.core.MusicalCast.ACHIEVEMENT_KEYS, all.filter { it.secret }.map { it.key })
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
