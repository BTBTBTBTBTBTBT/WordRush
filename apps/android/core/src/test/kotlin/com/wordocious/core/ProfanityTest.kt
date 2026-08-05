package com.wordocious.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mirrors packages/core/src/username.test.ts (and the Swift
 * ProfanityParityTests) — the same accept/reject cases on all three
 * platforms, so the ports can't drift from the TS module or the SQL trigger
 * silently.
 */
class ProfanityTest {

    @Test
    fun accepts_ordinary_names() {
        for (n in listOf("Brian", "Word_Master", "player.one", "A1b2", "Wordocious4821")) {
            assertNull("$n should be allowed", Profanity.usernameError(n))
        }
    }

    @Test
    fun rejects_shape() {
        assertNotNull(Profanity.usernameError("ab"))
        assertNotNull(Profanity.usernameError("a".repeat(21)))
        assertNotNull(Profanity.usernameError("..."))
    }

    @Test
    fun rejects_every_blocked_term_on_its_own() {
        for (term in Profanity.BLOCKED_SUBSTRINGS) {
            assertNotNull("$term should be rejected", Profanity.usernameError(term))
        }
    }

    @Test
    fun rejects_leet_and_separator_evasions() {
        for (n in listOf("n1gg3r", "f-u-c-k", "C U N T", "p0rn", "N4ZI", "BigD1ck69")) {
            assertNotNull("$n should be rejected", Profanity.usernameError(n))
        }
    }

    @Test
    fun rejects_the_incident_name_and_family() {
        for (n in listOf("DamnDickCockBallsAss", "damndickcockballsass", "xXPenisXx", "C-o-c-k_Lord")) {
            assertNotNull("$n should be rejected", Profanity.usernameError(n))
        }
    }

    @Test
    fun tier2_tokens_rejected_only_as_whole_tokens() {
        for (n in listOf("Ass_Master", "Big Balls", "DamnGoodPlayer", "Tit.For.Tat", "PissBoy")) {
            assertNotNull("$n should be rejected", Profanity.usernameError(n))
        }
        for (n in listOf("Cassidy", "Titanic", "Sassy_Sue", "Bassett", "Assisi_Pilgrim")) {
            assertNull("$n should be allowed", Profanity.usernameError(n))
        }
    }

    @Test
    fun scunthorpe_problem() {
        for (n in listOf(
            "Cassandra", "Michelle", "Scunthorpe", "Shitake", "Analyst", "Cockburn",
            "Penistone", "Titan", "Dickens", "Hitchcock", "Peacock42", "Swank",
            "TitanFall", "Bass Player", "MassEffect",
        )) {
            assertNull("$n should be allowed", Profanity.usernameError(n))
        }
        // An allowlisted word must not shield a real term.
        assertNotNull(Profanity.usernameError("ScunthorpeCunt"))
        assertNull(Profanity.usernameError("Scunthorpe_Fan"))
    }

    @Test
    fun pn_guess_screening() {
        assertTrue(Profanity.pnGuessBlocked("penispenisp", "taylorswift"))
        assertTrue(Profanity.pnGuessBlocked("fuckfuckfuc", "taylorswift"))
        for (g in listOf("taylorswift", "harrystyles", "masseffect", "jurassicpark")) {
            assertFalse("$g should be allowed", Profanity.pnGuessBlocked(g, "taylorswift"))
        }
        // Answers that trip the scan themselves (Ice Spice contains SPIC)
        // disable screening for that puzzle — the answer must be typeable.
        assertTrue(Profanity.containsBlockedTerm("icespice"))
        assertFalse(Profanity.pnGuessBlocked("icespice", "icespice"))
        assertFalse(Profanity.pnGuessBlocked("acespace", "icespice"))
    }

    @Test
    fun normalize_collapses_and_undoes_leet() {
        assertEquals(Profanity.normalize("niger"), Profanity.normalize("n1iiggg3r"))
        assertEquals("FUCK", Profanity.normalize("f.u.c.k"))
    }
}
