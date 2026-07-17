package com.wordocious.app.data

import com.wordocious.core.BoardState
import com.wordocious.core.GameMode
import com.wordocious.core.GameState
import com.wordocious.core.GameStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertNotNull
import org.junit.Test

/**
 * Pins the save-version gate + the pure key parsing (the parts of
 * GamePersistence testable without SharedPreferences). The gate exists because
 * `ignoreUnknownKeys = true` restored ANY decodable legacy save into a newer
 * reducer, where the web discards on SAVE_VERSION mismatch.
 */
class GamePersistenceTest {

    private fun state(status: GameStatus = GameStatus.PLAYING) = GameState(
        mode = GameMode.DUEL,
        seed = "daily-2026-07-16-DUEL",
        startTime = 0.0,
        boards = listOf(BoardState(solution = "GLASS", maxGuesses = 6, status = status)),
        currentBoardIndex = 0,
        status = status,
    )

    @Test
    fun versioned_round_trip() {
        val encoded = GamePersistence.encodeVersionedSave(state(), savedAt = 1234L)
        val decoded = GamePersistence.decodeVersionedSave(encoded)
        assertNotNull(decoded)
        assertEquals(GamePersistence.SAVE_VERSION, decoded!!.version)
        assertEquals(1234L, decoded.savedAt)
        assertEquals("daily-2026-07-16-DUEL", decoded.state.seed)
        assertEquals(GameStatus.PLAYING, decoded.state.status)
    }

    @Test
    fun version_mismatch_is_discarded() {
        val encoded = GamePersistence.encodeVersionedSave(state(), savedAt = 1L)
        val bumped = encoded.replaceFirst("\"version\":${GamePersistence.SAVE_VERSION}", "\"version\":999")
        assertNull("a future/old save version must be discarded, not restored",
            GamePersistence.decodeVersionedSave(bumped))
    }

    @Test
    fun legacy_bare_gamestate_decodes_as_v1() {
        // Pre-envelope on-disk shape: a bare GameState JSON. Must still load
        // (today's shape IS v1) so shipping the envelope doesn't wipe in-flight
        // games — savedAt is unknown → 0 (never qualifies for the grace).
        val bare = kotlinx.serialization.json.Json.encodeToString(GameState.serializer(), state())
        val decoded = GamePersistence.decodeVersionedSave(bare)
        assertNotNull(decoded)
        assertEquals(0L, decoded!!.savedAt)
        assertEquals("GLASS", decoded.state.boards[0].solution)
    }

    @Test
    fun corrupt_payload_is_null_not_crash() {
        assertNull(GamePersistence.decodeVersionedSave("{not json"))
        assertNull(GamePersistence.decodeVersionedSave("{\"version\":1}"))
    }

    @Test
    fun dailyDateFrom_parses_only_daily_keys() {
        assertEquals("2026-07-16", GamePersistence.dailyDateFrom("game-DUEL-daily-2026-07-16-DUEL"))
        assertEquals("2026-07-16", GamePersistence.dailyDateFrom("elapsed-DUEL_6-daily-2026-07-16-DUEL_6"))
        assertEquals("2026-07-16", GamePersistence.dailyDateFrom("hints-PROPERNOUNDLE-daily-2026-07-16-PROPERNOUNDLE"))
        assertNull(GamePersistence.dailyDateFrom("game-DUEL-unlimited-1752680000"))
        assertNull(GamePersistence.dailyDateFrom("game-DUEL-daily-garbage"))
    }
}
