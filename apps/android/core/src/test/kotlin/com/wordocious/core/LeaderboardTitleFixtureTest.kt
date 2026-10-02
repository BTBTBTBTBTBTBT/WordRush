package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the Leaderboard title (founder 2026-10-01):
 * [leaderboardTitle] must print packages/core/src/leaderboard-title.ts's words
 * byte for byte (the curly ’ in FRIDAY’S FINEST included).
 */
class LeaderboardTitleFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText(Charsets.UTF_8)

    private data class TitleCase(val day: String, val holiday: String?, val title: String)
    private data class Fixtures(val titles: List<TitleCase>)

    @Test
    fun titles_match_shared_fixtures() {
        val f = Gson().fromJson(loadFixture("leaderboard-title-fixtures.json"), Fixtures::class.java)
        assertTrue(f.titles.isNotEmpty())
        for (c in f.titles) {
            val got = leaderboardTitle(c.day, c.holiday)
            assertEquals("leaderboardTitle(${c.day}, ${c.holiday})", c.title, got)
            assertTrue("bytes for ${c.day}", c.title.toByteArray(Charsets.UTF_8).contentEquals(got.toByteArray(Charsets.UTF_8)))
        }
    }

    @Test
    fun friday_uses_the_curly_apostrophe() {
        assertEquals("FRIDAY’S FINEST", leaderboardTitle("2026-10-02"))
        assertEquals("SATURDAY STARS", leaderboardTitle("2026-10-03", "   "))
    }
}
