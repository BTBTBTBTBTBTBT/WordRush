package com.wordocious.core

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Validates the Kotlin engine against the SAME JSON fixtures the Swift port
 * passes (`apps/ios/Tests/Fixtures`, copied into `src/test/resources/fixtures`).
 * Green here == Kotlin engine is byte-identical to TS and Swift.
 */
class SeedFixtureTest {

    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText()

    private data class HashCase(val input: String, val output: Long)

    @Test
    fun simpleHash_matches_shared_fixtures() {
        val type = object : TypeToken<List<HashCase>>() {}.type
        val cases: List<HashCase> = Gson().fromJson(loadFixture("hash-fixtures.json"), type)
        assertTrue("expected hash fixtures to load", cases.isNotEmpty())
        for (c in cases) {
            assertEquals("simpleHash(\"${c.input}\")", c.output, simpleHash(c.input).toLong())
        }
    }

    @Test
    fun dailySeed_roundtrips() {
        assertEquals("daily-2026-01-15-DUEL", generateDailySeed("2026-01-15", "DUEL"))
        assertTrue(isDailySeed("daily-2026-01-15-DUEL"))
        assertEquals("2026-01-15", getDailySeedDate("daily-2026-01-15-DUEL"))
    }
}
