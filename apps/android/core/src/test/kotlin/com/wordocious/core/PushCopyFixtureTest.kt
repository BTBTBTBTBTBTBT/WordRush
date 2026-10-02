package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Cross-platform parity guard: [PushCopy] must match packages/core/src/push-copy.ts. */
class PushCopyFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText(Charsets.UTF_8)

    private data class FilledCase(val kind: String, val name: String?, val game: String?, val days: Double?, val text: String)
    private data class Fixtures(val title: String, val bank: Map<String, String>, val filled: List<FilledCase>)

    private val f: Fixtures by lazy { Gson().fromJson(loadFixture("push-copy-fixtures.json"), Fixtures::class.java) }

    @Test
    fun bank_matches_byte_for_byte() {
        assertEquals(f.title, PushCopy.TITLE)
        assertEquals(f.bank.keys, PushCopy.Kind.entries.map { it.key }.toSet())
        for ((key, line) in f.bank) {
            val kind = PushCopy.kindOf(key)
            assertNotNull(key, kind)
            assertEquals(key, line, PushCopy.BANK.getValue(kind!!))
        }
    }

    @Test
    fun filled_matches() {
        assertTrue(f.filled.isNotEmpty())
        for (c in f.filled) {
            val kind = PushCopy.kindOf(c.kind)!!
            assertEquals(c.toString(), c.text, PushCopy.text(kind, c.name, c.game, c.days?.toInt()))
        }
    }

    @Test
    fun no_em_dashes_or_british_spellings() {
        for (line in PushCopy.BANK.values) {
            assertFalse(line, line.contains('—'))
            assertFalse(line, Regex("(?i)colour|favourite|centre").containsMatchIn(line))
        }
    }
}
