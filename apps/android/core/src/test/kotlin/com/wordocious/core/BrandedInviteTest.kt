package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Same cases as packages/core/src/branded-invite.test.ts. */
class BrandedInviteTest {
    @Test fun codes_and_urls() {
        assertEquals("ANT5TTZR", BrandedInvite.clean(" ant5-ttzr "))
        assertTrue(BrandedInvite.isVsCode("ANT5TTZR"))
        assertFalse(BrandedInvite.isVsCode("ANT5TTZ"))
        assertFalse(BrandedInvite.isVsCode("ANT5TT0R"))
        assertEquals("https://wordocious.com/vs/ANT5TTZR", BrandedInvite.url(BrandedInvite.Kind.VS, "ant5ttzr"))
        assertEquals("https://wordocious.com/friend/ABC234", BrandedInvite.url(BrandedInvite.Kind.FRIEND, "abc234"))
    }

    @Test fun parses_new_and_old_forms() {
        val vs = BrandedInvite.Parsed(BrandedInvite.Kind.VS, "ANT5TTZR")
        assertEquals(vs, BrandedInvite.parse("https://wordocious.com/vs/ANT5TTZR"))
        assertEquals(vs, BrandedInvite.parse("https://www.wordocious.com/vs/join/ant5ttzr?x=1"))
        assertEquals(vs, BrandedInvite.parse("/vs/challenge/ANT5TTZR/"))
        val friend = BrandedInvite.Parsed(BrandedInvite.Kind.FRIEND, "ABC234")
        assertEquals(friend, BrandedInvite.parse("https://wordocious.com/friend/ABC234"))
        assertEquals(friend, BrandedInvite.parse("https://wordocious.com/join/ABC234"))
    }

    @Test fun static_vs_pages_are_never_codes() {
        for (p in listOf("/vs/bots", "/vs/live", "/vs/friend", "/vs/join", "/vs/challenge")) assertNull(BrandedInvite.parse(p))
        assertNull(BrandedInvite.parse("https://example.com/vs/ANT5TTZR"))
        assertFalse(BrandedInvite.isBrandedVsCode("bots"))
        assertTrue(BrandedInvite.isBrandedVsCode("ant5ttzr"))
    }

    @Test fun have_a_code() {
        val vs = BrandedInvite.Parsed(BrandedInvite.Kind.VS, "ANT5TTZR")
        assertEquals(vs, BrandedInvite.parseTyped("ant5 ttzr"))
        assertEquals(vs, BrandedInvite.parseTyped("https://wordocious.com/vs/ANT5TTZR"))
        assertNull(BrandedInvite.parseTyped("hello"))
        assertEquals("Johnny wants to race you in Classic", BrandedInvite.shareLine(BrandedInvite.Variant.LIVE, "Johnny", "Classic"))
    }
}
