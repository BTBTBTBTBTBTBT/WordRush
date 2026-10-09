package com.wordocious.app.data

import com.wordocious.app.data.AgeCheck.State
import com.wordocious.app.data.AgeCheck.Stored
import com.wordocious.app.data.AgeCheck.Verdict
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The 13+ age check rules: strict year reading, no default on the wheel, sticky stored answer. */
class AgeCheckTest {
    private val now = 2026

    @Test fun `the wheel has no default and lists newest first`() {
        val y = AgeCheck.years(now)
        assertEquals(2026, y.first())
        assertEquals(1926, y.last())
        assertEquals(101, y.size)
    }

    @Test fun `strict year reading passes only a guaranteed 13 plus`() {
        assertEquals(Verdict.PASS, AgeCheck.verdict(2012, now))
        assertEquals(Verdict.UNDER, AgeCheck.verdict(2013, now)) // turns 13 sometime in 2026
        assertEquals(Verdict.UNDER, AgeCheck.verdict(2018, now))
        assertEquals(Verdict.PASS, AgeCheck.verdict(1990, now))
        assertEquals(Verdict.INVALID, AgeCheck.verdict(2027, now))
        assertEquals(Verdict.INVALID, AgeCheck.verdict(1900, now))
    }

    @Test fun `stored answers round trip and a forged ok is refused`() {
        assertEquals(Stored(State.OK, 1990), AgeCheck.parse(AgeCheck.encode(Stored(State.OK, 1990)), now))
        assertEquals(Stored(State.UNDER, 2018), AgeCheck.parse(AgeCheck.encode(Stored(State.UNDER, 2018)), now))
        assertEquals(Stored(State.UNDER, 2018), AgeCheck.parse(AgeCheck.encode(Stored(State.OK, 2018)), now))
        assertNull(AgeCheck.parse("garbage", now))
        assertNull(AgeCheck.parse(null, now))
    }
}
