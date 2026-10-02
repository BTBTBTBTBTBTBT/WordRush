package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** FINISH_SPEC V: the level tier thresholds (Bronze 1–10 · Silver 11–25 · Gold 26–50 · Platinum 51–99 · Diamond 100+). */
class LevelTierTest {
    private data class LevelCase(val level: Int, val tier: String, val label: String)
    private data class Fixtures(val levels: List<LevelCase>)

    /** Parity: packages/core level-season.ts (level-season-fixtures.json `levels`). */
    @Test
    fun matches_shared_fixture() {
        val raw = javaClass.classLoader!!.getResource("fixtures/level-season-fixtures.json")!!.readText(Charsets.UTF_8)
        val f = Gson().fromJson(raw, Fixtures::class.java)
        assertTrue(f.levels.isNotEmpty())
        for (c in f.levels) {
            val t = levelTier(c.level)
            assertEquals("levelTier(${c.level})", c.tier, t.key)
            assertEquals("levelTierLabel(${c.level})", c.label, levelTierLabel(t))
        }
    }

    @Test
    fun thresholds() {
        val cases = mapOf(
            -3 to LevelTier.BRONZE, 0 to LevelTier.BRONZE, 1 to LevelTier.BRONZE, 10 to LevelTier.BRONZE,
            11 to LevelTier.SILVER, 25 to LevelTier.SILVER,
            26 to LevelTier.GOLD, 50 to LevelTier.GOLD,
            51 to LevelTier.PLATINUM, 99 to LevelTier.PLATINUM,
            100 to LevelTier.DIAMOND, 500 to LevelTier.DIAMOND,
        )
        cases.forEach { (level, tier) -> assertEquals("levelTier($level)", tier, levelTier(level)) }
    }

    @Test
    fun labels_and_keys() {
        assertEquals(listOf("bronze", "silver", "gold", "platinum", "diamond"), LevelTier.entries.map { it.key })
        assertEquals(listOf("Bronze", "Silver", "Gold", "Platinum", "Diamond"), LevelTier.entries.map { levelTierLabel(it) })
        LevelTier.entries.forEach { assertEquals(it, levelTier(it.minLevel)) }
    }

    @Test
    fun tier_change_gate() {
        assertTrue(levelTierChanged(10, 11))
        assertTrue(levelTierChanged(24, 27))
        assertTrue(levelTierChanged(99, 100))
        assertFalse(levelTierChanged(11, 12))
        assertFalse(levelTierChanged(100, 140))
    }
}
