package com.wordocious.app.ui.vs

import com.wordocious.app.ui.MascotId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/** FINISH_SPEC D3 on the VS screens: the RECORD row's soft-number parts and the A7 spare-cast pick. */
class VsFinishTest {
    @Test fun recordPartsSplitLabelsFromNumbers() {
        assertEquals(
            listOf("PEOPLE" to "12–7", "BOTS" to "31–9", "LADDER" to "2/10"),
            vsRecordParts("PEOPLE 12–7 · BOTS 31–9 · LADDER 2/10"),
        )
    }

    @Test fun recordPartsKeepTheClearedWord() {
        assertEquals(listOf("PEOPLE" to "0–0", "BOTS" to "4–1", "LADDER" to "CLEARED"), vsRecordParts("PEOPLE 0–0 · BOTS 4–1 · LADDER CLEARED"))
    }

    @Test fun recordPartsWithoutASpaceAreAllLabel() {
        assertEquals(listOf("RECORD" to ""), vsRecordParts("RECORD"))
        assertEquals(emptyList<Pair<String, String>>(), vsRecordParts(""))
    }

    @Test fun spareCastSkipsEveryoneOnScreen() {
        assertEquals(MascotId.U, vsSpareCast())
        assertEquals(MascotId.O1, vsSpareCast(MascotId.U))
        assertEquals(MascotId.C, vsSpareCast(MascotId.U, MascotId.O1, null))
        val pick = vsSpareCast(MascotId.S, preferred = listOf(MascotId.S, MascotId.O1))
        assertNotEquals(MascotId.S, pick)
    }

    @Test fun spareCastFallsBackWhenEveryoneIsTaken() {
        assertEquals(MascotId.S, vsSpareCast(MascotId.S, preferred = listOf(MascotId.S)))
    }
}
