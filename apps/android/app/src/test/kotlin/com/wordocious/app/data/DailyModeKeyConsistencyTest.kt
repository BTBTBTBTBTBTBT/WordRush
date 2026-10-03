package com.wordocious.app.data

import com.wordocious.app.ModeGen
import com.wordocious.app.ui.MODE_OPTIONS
import com.wordocious.app.ui.modeCardForKey
import com.wordocious.core.GameMode
import com.wordocious.core.generateDailySeed
import com.wordocious.core.getDailySeedDate
import com.wordocious.core.isDailySeed
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * One key per daily mode, end to end. A finished daily is recorded under
 * `GameMode.<X>.name` with seed `generateDailySeed(today, X)`; daily_results is
 * scored by DailyScoring.config[X]; Home reads completions by the card's dbKey;
 * the leaderboard picker queries `game_mode = card.dbKey` (GamePickerCard tile
 * key); the sweep/widget count ModeGen.sweep dbKeys. If any of those drift for
 * one mode, its result lands where no screen looks (the 2026-10-02 Muddle
 * outage audit) — this pins them together for every ModeGen daily mode.
 */
class DailyModeKeyConsistencyTest {

    private val date = "2026-10-02"

    /** The modes the outage audit walked — every one must still be a daily. */
    private val audited = listOf(
        "DUEL", "DUEL_7", "DUEL_6", "QUORDLE", "OCTORDLE", "RESCUE", "SEQUENCE", "PROPERNOUNDLE", "GAUNTLET",
        "SCRAMBLE", "HUB", "SUDOKU", "REGIONS", "LADDER", "WORDSEARCH", "CRYPTOGRAM", "GROUPS", "CROSSWORD",
    )

    @Test
    fun auditedModesAreAllCatalogDailies() {
        val daily = ModeGen.daily.mapNotNull { it.dbKey }.toSet()
        for (k in audited) assertTrue("$k missing from ModeGen.daily", k in daily)
    }

    @Test
    fun everyDailyModeMapsConsistently() {
        for (m in ModeGen.daily) {
            val key = m.dbKey!!
            // 1) the engine mode screens record with IS the db key
            val engine = runCatching { GameMode.valueOf(key) }.getOrNull()
            assertNotNull("$key has no :core GameMode", engine)
            assertEquals(key, engine!!.name)
            // 2) daily seed round-trips
            val seed = generateDailySeed(date, engine.name)
            assertTrue("$key seed not daily: $seed", isDailySeed(seed))
            assertEquals("$key seed date", date, getDailySeedDate(seed))
            // 3) daily_results scoring + plausibility floors know the key
            assertTrue("$key has no DailyScoring config", DailyScoring.config.containsKey(key))
            assertTrue("$key has no V1 DailyScoring config", DailyScoring.configV1.containsKey(key))
            assertTrue("$key has no plausibility floor", Plausibility.MIN_WIN_GUESSES.containsKey(key))
            // 4) Home card + leaderboard picker key (GamePickerCard: c.dbKey ?: c.id)
            val card = modeCardForKey(key)
            assertNotNull("$key has no ModeCard (Home/picker)", card)
            assertEquals(key, card!!.dbKey ?: card.id)
            assertEquals("$key card engine", engine, card.engineMode)
            // 5) a perfect plausible win is not rejected by the queue's DAILY gate
            val c = DailyScoring.config.getValue(key)
            val perfect = Plausibility.MIN_WIN_GUESSES.getValue(key)
            val time = maxOf(Plausibility.MIN_WIN_SECONDS[key] ?: 0, perfect) + 30
            assertTrue(
                "$key perfect win would be rejected",
                !PendingRecords.dailyPermanentlyRejected(key, true, perfect, time, c.totalBoards),
            )
        }
    }

    @Test
    fun sweepModesAreOnTheLeaderboardPickerAndCounted() {
        val pickerKeys = MODE_OPTIONS.map { it.first }.toSet()
        for (m in ModeGen.sweep) assertTrue("${m.dbKey} missing from leaderboard MODE_OPTIONS", m.dbKey in pickerKeys)
        assertEquals(ModeGen.sweep.mapNotNull { it.dbKey }.toSet(), DailyCompletionsService.SWEEP_KEYS)
    }

    @Test
    fun scrambleEndToEnd() {
        val seed = generateDailySeed(date, GameMode.SCRAMBLE.name)
        assertEquals("daily-2026-10-02-SCRAMBLE", seed)
        assertEquals("SCRAMBLE", modeCardForKey("SCRAMBLE")?.dbKey)
        assertTrue(DailyScoring.config.containsKey("SCRAMBLE"))
    }
}
