package com.wordocious.core

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime

/** Time of day (10-16): the slot per hour and the next boundary, pinned by time-of-day-fixtures.json. */
class TimeOfDayTest {
    private class H(val hour: Double, val time: String)
    private class P(val y: Int, val m: Int, val d: Int, val h: Int, val mi: Int)
    private class N(val from: P, val next: P)
    private class F(val times: List<String>, val hours: List<H>, val edges: List<H>, val next: List<N>)

    @Test fun matchesSharedFixture() {
        val raw = javaClass.classLoader!!.getResource("fixtures/time-of-day-fixtures.json")!!.readText(Charsets.UTF_8)
        val f = Gson().fromJson(raw, F::class.java)
        assertEquals(f.times, TimeOfDay.entries.map { it.id })
        for (h in f.hours + f.edges) assertEquals("hour ${h.hour}", h.time, TimeOfDay.at(h.hour).id)
        for (n in f.next) {
            val from = LocalDateTime.of(n.from.y, n.from.m, n.from.d, n.from.h, n.from.mi)
            val want = LocalDateTime.of(n.next.y, n.next.m, n.next.d, n.next.h, n.next.mi)
            assertEquals("${n.from.y}-${n.from.m}-${n.from.d} ${n.from.h}:${n.from.mi}", want, TimeOfDay.nextChange(from))
        }
    }
}
