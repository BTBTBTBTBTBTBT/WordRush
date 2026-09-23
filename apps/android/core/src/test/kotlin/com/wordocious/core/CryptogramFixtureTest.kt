package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Codebreaker engine (More Games §16): bank
 * lookups (holiday and plain), the cipher helpers, the reducer and the
 * matches-row round trip must match packages/core/src/games/cryptogram.ts byte
 * for byte.
 */
class CryptogramFixtureTest {
    private fun loadFixture(name: String): String = javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class DayCase(val day: String, val id: String?, val plainId: String?, val number: Int)
    private data class SeedCase(val seed: String, val id: String?)
    private data class Puzzle(val id: String, val text: String, val key: String, val given: List<String>, val holiday: String?)
    private data class Initial(val mapping: Map<String, String>, val locked: List<String>, val hintTarget: String?)
    private data class GuessCount(val checks: Int, val guessCount: Int)
    private data class Act(val type: String, val code: String?, val plain: String?)
    private data class Expect(
        val mapping: Map<String, String>, val locked: List<String>, val hinted: List<String>, val hintsUsed: Int, val checks: Int, val lastWrong: List<String>,
        val events: List<String>, val status: String, val ended: Boolean, val endTime: Double?, val guessCount: Int, val conflicts: List<String>, val correct: Int, val hintTarget: String?,
    )
    private data class Row(val solutions: List<String>, val guesses: List<String>)
    private data class Recon(
        val id: String, val text: String, val key: String, val cipher: String, val mapping: Map<String, String>, val given: List<String>, val hinted: List<String>,
        val revealed: Boolean, val checks: Int, val correct: Int, val total: Int, val solved: Boolean,
    )
    private data class Script(val name: String, val id: String, val actions: List<Act>, val expect: Expect, val row: Row, val reconstruct: Recon?)
    private data class Fixtures(
        val epoch: String, val dailyCount: Int, val extraCount: Int, val holidayKeys: List<String>, val days: List<DayCase>, val seeds: List<SeedCase>,
        val puzzle: Puzzle, val cipher: String, val codes: List<String>, val frequencies: Map<String, Int>, val initial: Initial,
        val guessCounts: List<GuessCount>, val reducer: List<Script>, val malformed: List<Recon?>,
    )

    private fun fixtures() = Gson().fromJson(loadFixture("cryptogram-fixtures.json"), Fixtures::class.java)
    private fun puzzle(p: Puzzle) = CryptogramPuzzle(p.id, p.text, p.key, p.given, p.holiday)
    private fun action(a: Act): CryptogramAction = when (a.type) {
        "SET" -> CryptogramAction.Set(a.code!!, a.plain)
        "CHECK" -> CryptogramAction.Check
        "HINT" -> CryptogramAction.Hint
        "REVEAL" -> CryptogramAction.Reveal
        "FINISH" -> CryptogramAction.Finish
        else -> error("unknown action ${a.type}")
    }

    @Test
    fun bank_and_cipher_match_shared_fixtures() {
        val f = fixtures(); val b = CryptogramBank.bundled!!; val h = HolidayTable.bundled!!
        assertEquals(f.epoch, b.epoch); assertEquals(f.dailyCount, b.daily.size); assertEquals(f.extraCount, b.extra.size)
        assertEquals(f.holidayKeys, b.holiday!!.keys.toList())
        for (c in f.days) {
            assertEquals("day ${c.day}", c.id, cryptogramPuzzleForDay(b, c.day, h)?.id)
            assertEquals("plain day ${c.day}", c.plainId, cryptogramPuzzleForDay(b, c.day, null)?.id)
            assertEquals("number ${c.day}", c.number, cryptogramDailyNumber(c.day))
        }
        for (c in f.seeds) assertEquals("seed ${c.seed}", c.id, cryptogramPuzzleForSeed(b, c.seed)?.id)
        assertEquals(puzzle(f.puzzle), b.daily[0])
        val p = puzzle(f.puzzle)
        assertEquals(f.cipher, cryptogramEncipher(p.text, p.key))
        assertEquals(f.codes, cryptogramCodeLetters(f.cipher))
        assertEquals(f.frequencies, cryptogramFrequencies(f.cipher))
        val init = createCryptogramState(p, "fixture", 0)
        assertEquals(f.initial.mapping, init.mapping); assertEquals(f.initial.locked, init.locked); assertEquals(f.initial.hintTarget, cryptogramHintTarget(init))
        assertEquals(f.cipher, init.cipher); assertEquals(CryptogramStatus.PLAYING, init.status); assertEquals(0, init.checks); assertNull(init.endTime)
        for (g in f.guessCounts) assertEquals("guessCount ${g.checks}", g.guessCount, cryptogramGuessCount(g.checks))
    }

    @Test
    fun reducer_scripts_match_shared_fixtures() {
        val f = fixtures()
        val p = puzzle(f.puzzle)
        assertTrue(f.reducer.isNotEmpty())
        for (sc in f.reducer) {
            assertEquals(sc.id, p.id)
            var s = createCryptogramState(p, "fixture", 0)
            for (a in sc.actions) s = cryptogramReduce(s, action(a), 1000)
            assertEquals("${sc.name} mapping", sc.expect.mapping, s.mapping)
            assertEquals("${sc.name} locked", sc.expect.locked, s.locked)
            assertEquals("${sc.name} hinted", sc.expect.hinted, s.hinted)
            assertEquals("${sc.name} hintsUsed", sc.expect.hintsUsed, s.hintsUsed)
            assertEquals("${sc.name} checks", sc.expect.checks, s.checks)
            assertEquals("${sc.name} lastWrong", sc.expect.lastWrong, s.lastWrong)
            assertEquals("${sc.name} events", sc.expect.events, s.events)
            assertEquals("${sc.name} status", sc.expect.status, s.status.key)
            assertEquals("${sc.name} ended", sc.expect.ended, s.ended)
            assertEquals("${sc.name} endTime", sc.expect.endTime?.toLong(), s.endTime)
            assertEquals("${sc.name} guessCount", sc.expect.guessCount, s.guessCount)
            assertEquals("${sc.name} conflicts", sc.expect.conflicts, s.conflicts)
            assertEquals("${sc.name} correct", sc.expect.correct, s.correctCount)
            assertEquals("${sc.name} hintTarget", sc.expect.hintTarget, s.hintTarget)
            val (solutions, guesses) = cryptogramMatchRow(s)
            assertEquals("${sc.name} solutions", sc.row.solutions, solutions); assertEquals("${sc.name} guesses", sc.row.guesses, guesses)
            val r = reconstructCryptogram(solutions, guesses)
            assertNotNull("${sc.name} reconstruct", r); assertNotNull("${sc.name} fixture reconstruct", sc.reconstruct)
            val e = sc.reconstruct!!
            assertEquals(e.id, r!!.id); assertEquals(e.text, r.text); assertEquals(e.key, r.key); assertEquals(e.cipher, r.cipher)
            assertEquals("${sc.name} recon mapping", e.mapping, r.mapping); assertEquals(e.given, r.given); assertEquals("${sc.name} recon hinted", e.hinted, r.hinted)
            assertEquals(e.revealed, r.revealed); assertEquals(e.checks, r.checks); assertEquals(e.correct, r.correct); assertEquals(e.total, r.total); assertEquals(e.solved, r.solved)
        }
        assertEquals(2, f.malformed.size); for (m in f.malformed) assertNull(m)
        assertNull(reconstructCryptogram(listOf("x", "ABC"), emptyList()))
        assertNull(reconstructCryptogram(listOf("Hi there.", "AABCDEFGHIJKLMNOPQRSTUVWXY", "id"), emptyList()))
        assertNull(reconstructCryptogram(null, null)); assertNull(reconstructCryptogram(listOf("x"), emptyList()))
    }
}
