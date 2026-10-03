package com.wordocious.app.data

import com.wordocious.app.ModeGen
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * FINISH_SPEC BJ12 — every game reaches Stats and Friends Moments. For EVERY
 * catalog mode in mode-coverage-fixtures.json (rendered from packages/core
 * mode-coverage.ts): the Perfect-medal rule, the Moments headlines for its
 * medals and records and the More Games Sweep copy must match the TS core, and
 * the app's catalog must carry the same mode.
 * Regenerate: apps/server/node_modules/.bin/tsx packages/core/scripts/gen-mode-coverage-fixtures.ts
 */
class ModeCoverageFixtureTest {
    @Serializable private data class PerfectCase(val guessCount: Int, val boardsSolved: Int, val totalBoards: Int, val completed: Boolean, val expected: Boolean)
    @Serializable private data class Moments(val gold: String, val bronze: String, val perfect: String, val fewestValue: String, val fewest: String, val fastestValue: String, val fastest: String)
    @Serializable private data class Mode(
        val dbKey: String, val id: String, val title: String, val group: String,
        val guessSemantics: String, val guessBase: Int, val dailyEligible: Boolean, val enabled: Boolean,
        val perfect: List<PerfectCase>, val moments: Moments,
    )
    @Serializable private data class MoreSweep(val keys: List<String>, val sweep: String, val flawless: String)
    @Serializable private data class Fixture(val modes: List<Mode>, val moreSweep: MoreSweep)

    private fun load(): Fixture {
        val text = javaClass.classLoader!!.getResource("fixtures/mode-coverage-fixtures.json")!!.readText()
        return Json { ignoreUnknownKeys = true }.decodeFromString(text)
    }

    @Test
    fun everyModeMatchesTheSharedRules() {
        val f = load()
        assertEquals("every catalog game with a dbKey", 18, f.modes.size)
        for (m in f.modes) {
            // The app catalog (stats key, picker, recent-match label) carries the mode.
            val meta = ModeGen.byDbKey(m.dbKey)
            assertEquals("${m.dbKey} title", m.title, meta?.title)
            assertEquals("${m.dbKey} group", m.group, meta?.group)
            assertEquals("${m.dbKey} guessBase", m.guessBase, meta?.guessBase)
            m.perfect.forEachIndexed { i, c ->
                assertEquals("perfect ${m.dbKey}#$i", c.expected,
                    ModeCoverage.isPerfectDailyResult(m.dbKey, c.guessCount, c.boardsSolved, c.totalBoards, c.completed))
            }
            fun head(type: String, kind: String, me: Boolean, value: String?) =
                ModeCoverage.modeMomentHeadline(type, me, "Doug", kind, m.dbKey, m.title, m.guessSemantics, value)
            assertEquals(m.dbKey, m.moments.gold, head("medal", "gold", false, null))
            assertEquals(m.dbKey, m.moments.bronze, head("medal", "bronze", false, null))
            assertEquals(m.dbKey, m.moments.perfect, head("medal", "perfect", true, null))
            val fewest = ModeCoverage.recordValueText("fewest_guesses", m.guessBase, m.guessSemantics, m.guessBase)
            assertEquals(m.dbKey, m.moments.fewestValue, fewest)
            assertEquals(m.dbKey, m.moments.fewest, head("record", "fewest_guesses", false, fewest))
            val fastest = ModeCoverage.recordValueText("fastest_win", 75, m.guessSemantics, m.guessBase)
            assertEquals(m.dbKey, m.moments.fastestValue, fastest)
            assertEquals(m.dbKey, m.moments.fastest, head("record", "fastest_win", false, fastest))
            if (m.dailyEligible && m.enabled) assertTrue("${m.dbKey} can never earn Perfect", m.perfect.any { it.expected })
        }
        assertEquals(f.moreSweep.keys, ModeCoverage.moreSweepKeys)
        assertEquals(f.moreSweep.sweep, ModeCoverage.moreSweepMomentText("Doug", false, ModeCoverage.moreSweepKeys.size))
        assertEquals(f.moreSweep.flawless, ModeCoverage.moreSweepMomentText("You", true, ModeCoverage.moreSweepKeys.size))
    }

    /** App wiring, read as text: medals + Moments go through ModeCoverage, and puzzle finishes flip only today's card. */
    @Test
    fun appSurfacesUseTheSharedRules() {
        val root = File("src/main/kotlin/com/wordocious/app")
        val medal = File(root, "data/MedalService.kt").readText()
        assertTrue("MedalService must use the shared Perfect rule", medal.contains("ModeCoverage.isPerfectDailyResult"))
        val feed = File(root, "ui/ActivityFeed.kt").readText()
        assertFalse("the More Games Sweep count comes from the catalog", feed.contains("all ten"))
        assertTrue(feed.contains("ModeCoverage.modeMomentHeadline"))
        val profile = File(root, "ui/ProfileScreen.kt").readText()
        assertTrue("Stats VS boards include ProperNoundle", profile.contains("modes = PICKER_MODES.filter(::hasVs)"))
        val screens = File(root, "ui/game").listFiles()!!.filter { it.name.endsWith("Screen.kt") }
        for (s in screens) {
            assertFalse("${s.name}: a puzzle finish must use notePuzzleFinish (day-gated, keeps the score)",
                s.readText().contains("DailyCompletionsService.noteCompletion("))
        }
    }

    @Test
    fun puzzleFinishKeepsTheRecordedScoreRule() {
        // Pure guards of the notePuzzleFinish contract (the cache itself needs Android prefs).
        assertTrue(ModeCoverage.isPerfectDailyResult("SUDOKU", 1, 1, 1, true))
        assertFalse(ModeCoverage.isPerfectDailyResult("SUDOKU", 2, 1, 1, true))
        assertTrue(ModeCoverage.isPerfectDailyResult("WORDSEARCH", 10, 1, 1, true))
        assertFalse(ModeCoverage.isPerfectDailyResult("NOT_A_MODE", 1, 1, 1, true))
    }
}
