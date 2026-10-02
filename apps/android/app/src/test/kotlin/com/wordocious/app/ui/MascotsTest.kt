package com.wordocious.app.ui

import com.wordocious.app.ModeGen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The cast table (docs/MASCOT_SPEC.md §0, §5, §6). */
class MascotsTest {
    @Test fun castSpellsWordocious() {
        assertEquals("WORDOCIOUS", Mascots.cast.joinToString("") { it.letter })
        assertEquals(10, Mascots.cast.size)
    }

    @Test fun everyDailyGameHasAHost() {
        ModeGen.daily.forEach { m -> assertNotNull("no host for ${m.dbKey}", Mascots.hostFor(m.dbKey)) }
        assertEquals(18, Mascots.gameHosts.size)
    }

    @Test fun spotCheckHosts() {
        assertEquals(MascotId.W, Mascots.hostFor("DUEL"))
        assertEquals(MascotId.O1, Mascots.hostFor("QUORDLE"))
        assertEquals(MascotId.O3, Mascots.hostFor("WORDSEARCH"))
        assertEquals(MascotId.S, Mascots.hostFor("REGIONS"))
        assertNull(Mascots.hostFor(null))
        assertNull(Mascots.hostFor("VS"))
    }

    @Test fun dailyPickIsStableAndFnv1a() {
        val a = Mascots.dailyPick("2026-10-02", "DUEL")
        assertEquals(a, Mascots.dailyPick("2026-10-02", "DUEL"))
        // FNV-1a 64 over "2026-10-02|DUEL", mod 10 (iOS Mascots.dailyPick parity).
        var h = 0xcbf29ce484222325UL
        for (b in "2026-10-02|DUEL".toByteArray()) h = (h xor b.toUByte().toULong()) * 0x100000001b3UL
        assertEquals(Mascots.cast[(h % 10UL).toInt()], a)
    }

    @Test fun voiceIsShortAndAmerican() {
        val lines = Mascots.loadingTips + listOf(
            Mascots.nobodyOnLine, Mascots.addFriendLine, Mascots.statsEmptyLine, Mascots.offlineLine,
        )
        lines.forEach { l ->
            assertTrue(l, l.length <= 64)
            listOf("colour", "favourite", "centre", "grey").forEach { assertTrue(l, !l.lowercase().contains(it)) }
        }
    }
}
