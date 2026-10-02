package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cross-platform parity guard for the S4 share caption bank: [ShareCaptions] must
 * hash, pick and fill exactly like packages/core/src/share-captions.ts.
 */
class ShareCaptionsFixtureTest {
    private fun loadFixture(name: String): String =
        javaClass.classLoader!!.getResource("fixtures/$name")!!.readText(Charsets.UTF_8)

    private data class HashCase(val key: String, val hash: Long)
    private data class PickCase(val kind: String, val date: String, val game: String, val index: Int)
    private data class FilledCase(
        val kind: String, val date: String, val game: String,
        val n: Double?, val t: String?, val b: Double?, val k: Double?, val opp: String?, val url: String?,
        val d: Double?, val text: String,
    )
    private data class Fixtures(
        val bank: Map<String, List<String>>,
        val toasts: Map<String, String>,
        val hashes: List<HashCase>,
        val picks: List<PickCase>,
        val filled: List<FilledCase>,
    )

    private val f: Fixtures by lazy { Gson().fromJson(loadFixture("share-captions-fixtures.json"), Fixtures::class.java) }

    private fun num(x: Double?): Any? = x?.let { if (it == Math.floor(it)) it.toLong() else it }

    @Test
    fun bank_matches_byte_for_byte() {
        assertEquals(f.bank.keys, ShareCaptions.Kind.entries.map { it.key }.toSet())
        for ((key, lines) in f.bank) {
            val kind = ShareCaptions.kindOf(key)
            assertNotNull(key, kind)
            assertEquals(key, lines, ShareCaptions.BANK.getValue(kind!!))
        }
        assertEquals(f.toasts["copied"], ShareCaptions.TOAST_COPIED)
        assertEquals(f.toasts["saved"], ShareCaptions.TOAST_SAVED)
    }

    @Test
    fun hashes_match() {
        assertTrue(f.hashes.isNotEmpty())
        for (h in f.hashes) assertEquals("hash(${h.key})", h.hash, ShareCaptions.captionHash(h.key))
        // The pinned check values (FNV-1a 32 reference vectors).
        assertEquals(0xe40c292cL, ShareCaptions.captionHash("a"))
        assertEquals(0xbf9cf968L, ShareCaptions.captionHash("foobar"))
        assertEquals(2166136261L, ShareCaptions.captionHash(""))
    }

    @Test
    fun picks_match() {
        assertTrue(f.picks.isNotEmpty())
        for (p in f.picks) {
            assertEquals("${p.kind} ${p.date} ${p.game}", p.index, ShareCaptions.index(ShareCaptions.kindOf(p.kind)!!, p.date, p.game))
        }
    }

    @Test
    fun filled_captions_match() {
        assertTrue(f.filled.isNotEmpty())
        for (c in f.filled) {
            val got = ShareCaptions.caption(
                ShareCaptions.kindOf(c.kind)!!,
                ShareCaptions.Vars(
                    date = c.date, game = c.game, n = num(c.n), t = c.t, b = num(c.b),
                    d = c.d?.toInt(), k = num(c.k), opp = c.opp, url = c.url,
                ),
            )
            assertEquals("${c.kind} d=${c.d}", c.text, got)
        }
    }

    @Test
    fun copy_has_no_em_dashes() {
        for (lines in ShareCaptions.BANK.values) for (l in lines) assertTrue(l, '—' !in l)
    }
}
