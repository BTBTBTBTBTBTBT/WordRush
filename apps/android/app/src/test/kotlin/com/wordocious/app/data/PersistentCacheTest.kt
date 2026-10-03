package com.wordocious.app.data

import kotlinx.serialization.Serializable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** BI19: screen caches persist across launches — versioned, size-bounded, cleared per owner. */
class PersistentCacheTest {
    @Serializable
    data class Board(val rows: List<String>, val count: Int)

    @Test fun `a cache survives relaunch`() {
        val kv = MemoryKeyValueStore()
        PersistentCache(kv).put("board:me:DUEL", Board(listOf("a", "b"), 2), Board.serializer())
        // A new instance (a relaunch) over the same persisted store reads it back.
        val relaunched = PersistentCache(kv)
        assertEquals(Board(listOf("a", "b"), 2), relaunched.get("board:me:DUEL", Board.serializer()))
        assertEquals("""{"rows":["a","b"],"count":2}""", relaunched.getRaw("board:me:DUEL"))
    }

    @Test fun `another schema version is purged, not decoded`() {
        val kv = MemoryKeyValueStore()
        PersistentCache(kv, version = 1).putRaw("k", "old")
        val v2 = PersistentCache(kv, version = 2)
        assertNull(v2.getRaw("k"))
        assertEquals(emptySet<String>(), kv.keys())
    }

    @Test fun `entries are bounded, oldest first, and oversized values are skipped`() {
        var now = 0L
        val cache = PersistentCache(MemoryKeyValueStore(), maxEntries = 3, maxValueChars = 10, clock = { now++ })
        for (i in 1..5) cache.putRaw("k$i", "v$i")
        assertNull(cache.getRaw("k1"))
        assertNull(cache.getRaw("k2"))
        assertEquals("v5", cache.getRaw("k5"))
        cache.putRaw("big", "x".repeat(11))
        assertNull(cache.getRaw("big"))
    }

    @Test fun `a corrupt entry reads as missing and clear drops everything`() {
        val cache = PersistentCache(MemoryKeyValueStore())
        cache.putRaw("bad", "{not json")
        assertNull(cache.get("bad", Board.serializer()))
        assertNull(cache.getRaw("bad"))
        cache.putRaw("x", "1")
        cache.clear()
        assertNull(cache.getRaw("x"))
    }
}
