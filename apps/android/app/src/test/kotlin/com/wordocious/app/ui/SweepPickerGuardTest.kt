package com.wordocious.app.ui

import com.wordocious.app.ModeGen
import com.wordocious.core.GameMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guard for the 10th "Sweep" picker tile. The Daily Sweep board is driven by the
 * synthetic id [SWEEP_ID], which is NOT a `:core` GameMode — `GameMode.valueOf("SWEEP")`
 * throws IllegalArgumentException at runtime. Every picker-reachable call site must
 * route through [pickerGameModeOrNull] (or an explicit SWEEP branch). This test
 * pins that contract so a future caller that hands a raw picker id to `valueOf`
 * regresses here instead of crashing the Leaderboard/Records screens.
 */
class SweepPickerGuardTest {

    @Test
    fun sweepIdResolvesToNullWithoutThrowing() {
        // The guard must swallow SWEEP and hand back null (the "no engine mode" signal).
        assertNull("SWEEP must map to null, never throw", pickerGameModeOrNull(SWEEP_ID))
    }

    @Test
    fun rawValueOfOnSweepThrows_documentsTheHazard() {
        assertThrows(IllegalArgumentException::class.java) { GameMode.valueOf(SWEEP_ID) }
    }

    @Test
    fun theSweepModesResolveToTheirEnum() {
        // The picker's real modes ARE the catalog's sweep set — derived, never a
        // literal count (More Games Stage 9 took ProperNoundle out of the sweep).
        val realIds = MODE_OPTIONS.map { it.first }.filter { it != SWEEP_ID }
        val sweepKeys = ModeGen.sweep.mapNotNull { it.dbKey }
        assertEquals("picker should carry exactly the sweep modes + SWEEP", sweepKeys, realIds)
        realIds.forEach { id ->
            assertEquals("$id must resolve to its enum", GameMode.valueOf(id), pickerGameModeOrNull(id))
        }
    }

    @Test
    fun moreGamesTitlesStayOffTheSweepPicker() {
        // Every More Games title (ProperNoundle included) reaches the boards
        // through the More chip, never as a sweep tile.
        val pickerIds = MODE_OPTIONS.map { it.first }.toSet()
        ModeGen.more.mapNotNull { it.dbKey }.forEach { key ->
            assertFalse("$key is a More Games title and must not be a sweep chip", key in pickerIds)
        }
        assertTrue("ProperNoundle lives under the More tile", ModeGen.more.any { it.dbKey == "PROPERNOUNDLE" })
        // Codegen invariant, mirrored here so a hand-edited era row cannot drift
        // from the catalog's sweep flags: newest era == modes.filter(sweep).
        assertEquals("newest sweep era must equal the current sweep set",
            ModeGen.sweep.mapNotNull { it.dbKey }.toSet(), ModeGen.sweepEras.first().modes.toSet())
    }

    @Test
    fun everyPickerIdIsHandledByTheGuard() {
        // Routing every picker id through the guard must not throw for any entry.
        MODE_OPTIONS.forEach { (id, _) -> pickerGameModeOrNull(id) }
        assertTrue("SWEEP tile must be present in the picker", MODE_OPTIONS.any { it.first == SWEEP_ID })
    }
}
