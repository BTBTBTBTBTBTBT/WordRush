package com.wordocious.app.ui

import com.wordocious.core.ScrambleAction
import com.wordocious.core.ScrambleBank
import com.wordocious.core.ScrambleFinal
import com.wordocious.core.ScrambleWord
import com.wordocious.core.ScrambleStatus
import com.wordocious.core.createScrambleState
import com.wordocious.core.scrambleReduce
import com.wordocious.core.scramblePuzzleForDay
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

/** Throwaway probe: does the MuddleSession SaveDto shape round-trip through kotlinx on the JVM? */
class MuddleSaveProbeTest {
    class Holder {
        @Serializable private data class SaveDto(
            val seed: String, val date: String, val elapsed: Int, val savedAt: Long,
            val id: String, val words: List<ScrambleWord>, val final: ScrambleFinal, val caption: String,
            val entries: List<String>, val solved: List<Boolean>, val revealed: List<String>,
            val checks: Int, val mistakes: Int, val hintsUsed: Int, val lastRow: Int?, val lastResult: String?,
            val events: List<String>, val status: String, val ended: Boolean, val startTime: Long, val endTime: Long?,
            val row: Int = 0,
        )
        private val json = Json { ignoreUnknownKeys = true }
        fun roundTrip(): String {
            val bank = ScrambleBank.bundled!!
            val p = scramblePuzzleForDay(bank, "2026-09-25", null)!!
            var s = createScrambleState(p, "daily-2026-09-25-SCRAMBLE", 1000L)
            for (r in 0..3) s = scrambleReduce(s, ScrambleAction.SolveWord(r), 2000L)
            s = scrambleReduce(s, ScrambleAction.SolveWord(4), 3000L)
            val dto = SaveDto(
                s.seed, "2026-09-25", 12, 4000L,
                s.id, s.words, s.final, s.caption, s.entries, s.solved, s.revealed,
                s.checks, s.mistakes, s.hintsUsed, s.lastRow, s.lastResult?.key, s.events, s.status.key, s.ended, s.startTime, s.endTime, 4,
            )
            val raw = json.encodeToString(dto)
            val back = json.decodeFromString<SaveDto>(raw)
            assertEquals(dto, back)
            return back.status + " " + back.entries.size + " " + back.solved.size + " " + back.revealed.size + " " + back.words.size
        }
    }

    @Test
    fun save_dto_round_trips() {
        val r = Holder().roundTrip()
        assertNotNull(r)
        assertEquals("${ScrambleStatus.WON.key} 5 5 5 4", r)
    }
}
